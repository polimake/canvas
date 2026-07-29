import {
  convertToExcalidrawElements,
  type ExcalidrawImperativeAPI,
  type FrameElement,
  type SceneElement,
} from './excal';
import { commitElements, patchElement } from './mutate';

/**
 * Inserción de imágenes — y LA REGLA que las gobierna.
 *
 * REGLA (decisión del usuario, no negociable): los bytes de una imagen viven
 * SIEMPRE en MediaMonster. Nunca, bajo ninguna circunstancia, se persisten
 * dentro de `designs.editorConfig` como base64.
 *
 * Por qué la regla existe, y por qué es una pared y no una preferencia:
 * Excalidraw guarda las imágenes en su mapa `files` y hace `image.src =
 * files[id].dataURL`. Ese campo acepta IGUAL de bien un `data:` que una URL
 * remota, así que las dos representaciones funcionan en pantalla — pero solo
 * una es sostenible. Con base64, una foto de 1,5 MB ocupa ~2 MB en la fila
 * (+33% de la codificación) y revienta el límite de 2 MB por valor de D1: el
 * guardado no se degrada, FALLA en seco. Con URL remota el diseño pesa lo que
 * pese su geometría, da igual cuántas fotos lleve.
 *
 * El módulo hace cumplir la regla por las dos puntas:
 *
 *   ENTRADA  Ningún export permite inlinear bytes. `insertImageFromUrl` guarda
 *            la URL; `insertImageFromBlob` EXIGE un `MediaUploader` y sube a MM
 *            antes de tocar la escena. El insertador que trabaja con dataURL es
 *            privado a propósito: si no está exportado, no hay puerta.
 *
 *   SALIDA   `buildPersistableFiles` es el filtro OBLIGATORIO antes de guardar.
 *            Devuelve solo los ficheros realmente referenciados y delata
 *            cualquier base64 superviviente en `inline`, para que el host
 *            aborte el guardado en vez de escribirlo.
 *
 * Queda una vía que NO pasa por aquí: arrastrar, pegar o usar el selector de
 * ficheros nativo de Excalidraw, que inlinea base64 sin preguntar. Para eso
 * está {@link externalizeInlineImages}, que el host ejecuta antes de guardar y
 * que convierte esos base64 en ficheros de MM. Entre externalizar y el filtro
 * de salida, no hay camino por el que un byte de imagen llegue a la base.
 *
 * @see exportHydrate.ts — el viaje inverso (URL → bytes) SOLO en memoria y solo
 * para exportar, porque el canvas se contamina con imágenes remotas.
 */

export interface InsertImageOptions {
  /** Place the image onto this page (frame). Defaults to the first page. */
  pageId?: string;
  /**
   * Punto de la ESCENA donde centrar la imagen. Lo usa el arrastre desde la
   * biblioteca: sin esto todo cae en el centro de la página y soltar en un sitio
   * concreto no significaría nada. Sin él, se centra en la página.
   */
  at?: { x: number; y: number };
}

/**
 * Sube los bytes a MediaMonster y devuelve la URL pública servible.
 *
 * Lo inyecta el host: este paquete no sabe de rutas, de proyecto ni de
 * autenticación (misma decisión que `MediaFetcher` en exportHydrate.ts).
 */
export type MediaUploader = (blob: Blob, filename: string) => Promise<string>;

/** Forma mínima de una entrada del mapa de ficheros de Excalidraw. */
export interface FileEntry {
  id: string;
  dataURL: string;
  mimeType: string;
  created?: number;
  lastRetrieved?: number;
}

/**
 * Un `data:` lleva los bytes dentro; cualquier otra cosa es una referencia.
 *
 * Devuelve `boolean` y NO `value is string` a propósito: como predicado de
 * tipo, sobre un parámetro ya tipado `string` estrecha la rama FALSA a `never`
 * y todo uso posterior de la variable deja de compilar.
 */
export function isInlineDataUrl(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

function createFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `file_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function frames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return api
    .getSceneElements()
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}

/** dataURL → Blob, para poder subir a MM lo que Excalidraw inlineó. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  if (!/;base64/i.test(header)) {
    return new Blob([decodeURIComponent(payload ?? '')], { type: mime });
  }
  const binary = atob(payload ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * PRIVADA A PROPÓSITO. Es el único sitio que escribe en el mapa de ficheros, y
 * no se exporta para que no exista ninguna forma pública de meter un `data:`
 * en la escena. Todo insert público entra por aquí con una URL remota.
 */
function insertImageByReference(
  api: ExcalidrawImperativeAPI,
  file: { url: string; mimeType: string; width: number; height: number },
  opts?: InsertImageOptions,
): string {
  const fileId = createFileId();
  const mimeType = file.mimeType?.startsWith('image/') ? file.mimeType : 'image/png';

  api.addFiles([
    { id: fileId, dataURL: file.url, mimeType, created: Date.now() },
  ] as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);

  const pages = frames(api);
  const target = (opts?.pageId && pages.find((f) => f.id === opts.pageId)) || pages[0] || null;
  const box = target
    ? { x: target.x, y: target.y, w: target.width, h: target.height }
    : { x: 0, y: 0, w: 800, h: 600 };

  // Contain within the page with a small margin, centered.
  const fit = Math.min((box.w * 0.9) / file.width, (box.h * 0.9) / file.height, 1);
  const w = Math.max(1, file.width * fit);
  const h = Math.max(1, file.height * fit);
  // Con punto de suelte, la imagen se centra AHÍ; si no, en la página.
  const x = opts?.at ? opts.at.x - w / 2 : box.x + (box.w - w) / 2;
  const y = opts?.at ? opts.at.y - h / 2 : box.y + (box.h - h) / 2;

  const skeleton = [
    { type: 'image', fileId, x, y, width: w, height: h, status: 'saved' },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) =>
    target ? { ...el, frameId: target.id } : el,
  );

  commitElements(api, [
    ...api.getSceneElements(),
    ...(created as unknown as readonly SceneElement[]),
  ]);
  return fileId;
}

/**
 * Inserta una imagen ya alojada en MediaMonster, POR REFERENCIA.
 *
 * No descarga nada: la URL se guarda tal cual en el mapa de ficheros. (Antes
 * esta función hacía justo lo contrario —`fetch` + inline a base64—, que es
 * precisamente lo que la regla prohíbe.)
 */
export async function insertImageFromUrl(
  api: ExcalidrawImperativeAPI,
  url: string,
  opts?: InsertImageOptions,
): Promise<string> {
  if (isInlineDataUrl(url)) {
    throw new Error(
      'insertImageFromUrl recibió un data: URL. Los bytes van a MediaMonster; usa insertImageFromBlob.',
    );
  }
  const { width, height } = await loadImageSize(url);
  const mimeType = url.endsWith('.webp')
    ? 'image/webp'
    : url.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';
  return insertImageByReference(api, { url, mimeType, width, height }, opts);
}

/**
 * Inserta una imagen desde bytes locales (selector de ficheros, portapapeles):
 * SUBE primero a MediaMonster y luego inserta la referencia.
 *
 * El `uploader` es obligatorio por diseño. Sin él no hay inserción: es lo que
 * impide que exista una ruta "rápida" que se salte MM.
 */
export async function insertImageFromBlob(
  api: ExcalidrawImperativeAPI,
  blob: Blob,
  uploader: MediaUploader,
  opts?: InsertImageOptions & { filename?: string },
): Promise<string> {
  if (typeof uploader !== 'function') {
    throw new Error('insertImageFromBlob requiere un MediaUploader: las imágenes van a MediaMonster.');
  }
  const url = await uploader(blob, opts?.filename ?? `canvas-${Date.now()}.png`);
  if (isInlineDataUrl(url)) {
    throw new Error('El MediaUploader devolvió un data: URL en vez de una URL de MediaMonster.');
  }
  return insertImageFromUrl(api, url, opts);
}

/** Ids del mapa de ficheros que todavía llevan los bytes dentro. */
export function findInlineImageIds(files: Record<string, FileEntry> | null | undefined): string[] {
  return Object.values(files ?? {})
    .filter((f) => f && isInlineDataUrl(f.dataURL))
    .map((f) => f.id);
}

export interface ExternalizeResult {
  /** Cuántas imágenes pasaron de base64 a referencia de MediaMonster. */
  externalized: number;
  /** Ids que no se pudieron subir. Con esto ≠ 0, NO se debe guardar. */
  failed: string[];
}

/**
 * Convierte a ficheros de MediaMonster todo el base64 que haya entrado por la
 * vía nativa de Excalidraw (arrastrar / pegar / selector).
 *
 * Detalle importante: NO se reutiliza el id del fichero. `api.addFiles()`
 * delega en `addMissingFiles()`, que hace `continue` con todo id ya existente,
 * así que sobrescribir una entrada por esa vía es un NO-OP silencioso (la misma
 * trampa documentada en exportHydrate.ts). Por eso cada imagen externalizada
 * recibe un id NUEVO y se repunta el elemento que la usa.
 */
export async function externalizeInlineImages(
  api: ExcalidrawImperativeAPI,
  uploader: MediaUploader,
): Promise<ExternalizeResult> {
  const files = (api.getFiles() ?? {}) as Record<string, FileEntry>;
  const inline = Object.values(files).filter((f) => f && isInlineDataUrl(f.dataURL));
  if (inline.length === 0) return { externalized: 0, failed: [] };

  const remap = new Map<string, string>();
  const failed: string[] = [];

  for (const file of inline) {
    try {
      const blob = dataUrlToBlob(file.dataURL);
      const ext = (file.mimeType?.split('/')[1] ?? 'png').replace(/[^a-z0-9]/gi, '');
      const url = await uploader(blob, `canvas-${file.id}.${ext}`);
      if (isInlineDataUrl(url)) throw new Error('el uploader devolvió un data: URL');
      const newId = createFileId();
      api.addFiles([
        { id: newId, dataURL: url, mimeType: file.mimeType, created: Date.now() },
      ] as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);
      remap.set(file.id, newId);
    } catch {
      failed.push(file.id);
    }
  }

  if (remap.size > 0) {
    const next = api
      .getSceneElements()
      .map((el) => {
        const current = (el as { fileId?: string }).fileId;
        const replacement = current ? remap.get(current) : undefined;
        return replacement
          ? patchElement(el, { fileId: replacement } as Partial<SceneElement>)
          : el;
      });
    // 'never': externalizar es fontanería, no una edición del usuario. Si
    // entrara en el historial, un Ctrl+Z devolvería la escena al base64 que
    // acabamos de quitar.
    commitElements(api, next, 'never');
  }

  return { externalized: remap.size, failed };
}

export interface PersistableFiles {
  /** Solo los ficheros REFERENCIADOS por la escena, listos para guardar. */
  files: Record<string, FileEntry>;
  /** Ficheros que siguen llevando bytes dentro. Si no está vacío, NO guardar. */
  inline: string[];
}

/**
 * EL FILTRO DE SALIDA. Todo guardado tiene que pasar por aquí.
 *
 * Hace dos cosas: se queda solo con los ficheros que algún elemento usa de
 * verdad (Excalidraw nunca limpia el mapa, así que borrar una foto dejaba sus
 * bytes en la fila para siempre), y devuelve en `inline` cualquier base64 que
 * haya sobrevivido para que el host aborte en vez de escribirlo.
 */
export function buildPersistableFiles(
  elements: readonly SceneElement[],
  files: Record<string, FileEntry> | null | undefined,
): PersistableFiles {
  const source = files ?? {};
  const referenced = new Set<string>();
  for (const el of elements) {
    if (el.isDeleted) continue;
    const fileId = (el as { fileId?: string | null }).fileId;
    if (typeof fileId === 'string' && fileId) referenced.add(fileId);
  }

  const out: Record<string, FileEntry> = {};
  const inline: string[] = [];
  for (const id of referenced) {
    const file = source[id];
    if (!file) continue;
    out[id] = file;
    if (isInlineDataUrl(file.dataURL)) inline.push(id);
  }
  return { files: out, inline };
}
