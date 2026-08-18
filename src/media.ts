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
  /**
   * Página (marco) donde dejar la imagen. Es el respaldo: con `at`, manda la
   * página bajo el punto de suelte. Sin ninguno de los dos, la primera.
   */
  pageId?: string;
  /**
   * Punto de la ESCENA donde centrar la imagen. Lo usa el arrastre desde la
   * biblioteca: sin esto todo cae en el centro de la página y soltar en un sitio
   * concreto no significaría nada. Sin él, se centra en la página.
   *
   * También DECIDE la página: se usa la que contiene el punto. Ver
   * `insertImageByReference` para por qué no basta con colocarla ahí.
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

/**
 * Cuánto se espera a que el CDN devuelva la imagen antes de rendirse.
 *
 * Sin tope, un `<img>` cuya URL nunca responde deja la promesa colgada PARA
 * SIEMPRE: quien inserta se queda con su indicador girando y sin error que
 * enseñar, que en pantalla es idéntico a que la aplicación se haya quedado
 * muerta. Con tope, se falla y se puede avisar.
 */
const IMAGE_LOAD_TIMEOUT_MS = 20_000;

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const stop = () => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    const timer = setTimeout(() => {
      stop();
      // Cortar la descarga en curso: si no, el navegador sigue tirando de red
      // por una imagen que ya nadie va a usar.
      img.src = '';
      reject(new Error('La imagen tardó demasiado en cargar'));
    }, IMAGE_LOAD_TIMEOUT_MS);
    img.onload = () => {
      stop();
      // Un 0×0 es un `load` que miente (SVG sin dimensiones intrínsecas, o una
      // respuesta vacía que el decodificador acepta). Insertarla daría un
      // elemento de tamaño cero: invisible, pero ahí, y no hay forma de
      // agarrarlo con el ratón para borrarlo.
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('La imagen no tiene dimensiones utilizables'));
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      stop();
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = src;
  });
}

/** Página cuyo rectángulo contiene el punto, si alguna lo contiene. */
function pageAtPoint(pages: FrameElement[], at: { x: number; y: number }): FrameElement | null {
  return (
    pages.find(
      (f) => at.x >= f.x && at.x <= f.x + f.width && at.y >= f.y && at.y <= f.y + f.height,
    ) ?? null
  );
}

/** LA regla de qué página recibe una inserción. Una sola, y aquí. */
function resolvePage(api: ExcalidrawImperativeAPI, opts?: InsertImageOptions): FrameElement | null {
  const pages = frames(api);
  return (
    (opts?.at ? pageAtPoint(pages, opts.at) : null) ||
    (opts?.pageId ? pages.find((f) => f.id === opts.pageId) : null) ||
    pages[0] ||
    null
  );
}

/**
 * Página donde CAERÍA una inserción con estas opciones, sin insertar nada.
 *
 * La necesita el host para decidir ANTES de empezar: si esa página está
 * bloqueada, un lote de cinco archivos tiene que rebotar con un aviso, no con
 * cinco. Usa exactamente la misma regla que la inserción real — es la misma
 * función — para que no puedan discrepar.
 */
export function resolveInsertPageId(
  api: ExcalidrawImperativeAPI,
  opts?: InsertImageOptions,
): string | null {
  return resolvePage(api, opts)?.id ?? null;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Puntos escalonados para soltar VARIOS archivos de una vez.
 *
 * Uno encima de otro no es una inserción múltiple, es una que parece fallida:
 * la de arriba tapa al resto y no hay forma de saber que entraron cuatro. Se
 * escalonan como una baraja abierta.
 *
 * El paso va en unidades de ESCENA y sale del tamaño de la página (4% del lado
 * corto), no de píxeles de pantalla: así se ve igual de abierto en una story
 * vertical que en un A4, y no depende del zoom que tengas puesto.
 *
 * La dirección la decide el cuadrante donde sueltas. Escalonando siempre hacia
 * abajo-derecha, soltar cerca de esa esquina empujaba todas las copias contra el
 * borde, donde el recorte a la página las volvía a apilar en el mismo sitio —
 * justo el amontonamiento que esto viene a evitar.
 */
export function cascadePoints(
  api: ExcalidrawImperativeAPI,
  at: { x: number; y: number },
  count: number,
): { x: number; y: number }[] {
  if (count <= 1) return [at];
  const page = resolvePage(api, { at });
  const box = page
    ? { x: page.x, y: page.y, w: page.width, h: page.height }
    : { x: at.x - 400, y: at.y - 300, w: 800, h: 600 };
  const step = Math.min(box.w, box.h) * 0.04;
  const dx = at.x > box.x + box.w / 2 ? -step : step;
  const dy = at.y > box.y + box.h / 2 ? -step : step;
  return Array.from({ length: count }, (_, i) => ({ x: at.x + dx * i, y: at.y + dy * i }));
}

/** Rectángulo de una imagen de la escena, para dibujar sobre ella. */
export interface ImageHit {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * La imagen que hay bajo un punto de la escena, si hay alguna.
 *
 * Se recorre al revés porque la escena está ordenada de atrás hacia delante:
 * la que el usuario ve bajo el puntero es la ÚLTIMA que lo contiene, no la
 * primera. Sirve para el intercambio con Mayúsculas y para dibujar el marco que
 * lo anuncia mientras arrastras.
 */
export function imageAtScenePoint(
  api: ExcalidrawImperativeAPI,
  at: { x: number; y: number },
): ImageHit | null {
  const elements = api.getSceneElements();
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i] as SceneElement & { fileId?: string };
    if (el.type !== 'image' || el.isDeleted || !el.fileId) continue;
    if (
      at.x >= el.x &&
      at.x <= el.x + el.width &&
      at.y >= el.y &&
      at.y <= el.y + el.height
    ) {
      return { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height };
    }
  }
  return null;
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
 *
 * Devuelve el id del ELEMENTO creado, no el del fichero: quien inserta lo
 * siguiente que quiere es operar sobre lo insertado (marcarlo como vídeo,
 * mandarlo al fondo, seleccionarlo), y todas esas funciones piden un id de
 * elemento. Devolver el `fileId` compilaba igual —los dos son `string`— y dejó
 * dos funciones mudas: `insertVideo` no llegaba a marcar nunca el vídeo y
 * `setAsBackground` no encontraba la portada que acababa de entrar.
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

  // La página la manda el PUNTO donde se suelta; la activa es solo el respaldo
  // para cuando no hay punto (clic en la mediateca).
  //
  // Y es una regla dura, no una preferencia: Excalidraw RECORTA cada elemento
  // contra el marco al que dice pertenecer, así que un `frameId` de la página 1
  // con las coordenadas de la página 3 no sale "en el sitio raro" — no sale.
  // Sueltas la foto sobre la página que estás mirando, desaparece, y no hay
  // error, ni hueco, ni nada que mirar.
  const target = resolvePage(api, opts);
  const box = target
    ? { x: target.x, y: target.y, w: target.width, h: target.height }
    : { x: 0, y: 0, w: 800, h: 600 };

  // Contain within the page with a small margin, centered.
  const fit = Math.min((box.w * 0.9) / file.width, (box.h * 0.9) / file.height, 1);
  const w = Math.max(1, file.width * fit);
  const h = Math.max(1, file.height * fit);
  // Con punto de suelte, la imagen se centra AHÍ; si no, en la página. Y en los
  // dos casos se mete DENTRO de la página: soltar pegado al borde (o fuera de
  // toda página, en el gris) dejaba la mitad de la foto recortada por el marco,
  // que es la misma pantalla que "no ha pasado nada".
  const x = opts?.at
    ? clamp(opts.at.x - w / 2, box.x, box.x + box.w - w)
    : box.x + (box.w - w) / 2;
  const y = opts?.at
    ? clamp(opts.at.y - h / 2, box.y, box.y + box.h - h)
    : box.y + (box.h - h) / 2;

  const skeleton = [
    { type: 'image', fileId, x, y, width: w, height: h, status: 'saved' },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) =>
    target ? { ...el, frameId: target.id } : el,
  );
  const elementId = (created[0] as { id: string }).id;

  commitElements(
    api,
    [...api.getSceneElements(), ...(created as unknown as readonly SceneElement[])],
    'undoable',
    // Seleccionada al entrar: lo que se acaba de insertar es justo lo que se va
    // a mover o redimensionar, y sin selección hay que ir a cazarla con el ratón
    // (y en una página llena, encontrarla).
    { selectedElementIds: { [elementId]: true } },
  );
  return elementId;
}

/**
 * Inserta una imagen ya alojada en MediaMonster, POR REFERENCIA.
 *
 * No descarga nada: la URL se guarda tal cual en el mapa de ficheros. (Antes
 * esta función hacía justo lo contrario —`fetch` + inline a base64—, que es
 * precisamente lo que la regla prohíbe.)
 *
 * @returns el id del ELEMENTO insertado (ver `insertImageByReference`).
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
 *
 * @returns el id del ELEMENTO insertado (ver `insertImageByReference`).
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

/**
 * Cambia el ARCHIVO de una imagen ya colocada, conservando su sitio.
 *
 * Es rellenar un hueco de plantilla: la foto que ya está maquetada (posición,
 * tamaño, capa, página) se queda donde está y solo pasa a apuntar a otra. Sin
 * esto había que borrar, volver a insertar y recolocar a ojo.
 *
 * NO se estira la imagen nueva hasta llenar la caja vieja: una foto vertical en
 * un hueco horizontal saldría deformada, y Excalidraw no sabe recortar. Se
 * conserva el CENTRO y se mete dentro de la caja anterior con su propia
 * proporción, que es lo más parecido a "el mismo sitio, el mismo tamaño" que se
 * puede hacer sin mentir sobre la imagen.
 *
 * Como en `externalizeInlineImages`, el fichero entra con un id NUEVO:
 * `addFiles` ignora en silencio todo id que ya exista, así que reaprovechar el
 * anterior dejaría el elemento apuntando a la imagen vieja.
 *
 * @returns `false` si ese id no es una imagen de la escena.
 */
export async function replaceImageFromUrl(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  url: string,
): Promise<boolean> {
  if (isInlineDataUrl(url)) {
    throw new Error(
      'replaceImageFromUrl recibió un data: URL. Los bytes van a MediaMonster; sube primero.',
    );
  }
  const previo = api.getSceneElements().find((e) => e.id === elementId);
  if (!previo || previo.type !== 'image') return false;

  const { width, height } = await loadImageSize(url);
  const mimeType = url.endsWith('.webp')
    ? 'image/webp'
    : url.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';

  const fileId = createFileId();
  api.addFiles([
    { id: fileId, dataURL: url, mimeType, created: Date.now() },
  ] as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);

  const fit = Math.min(previo.width / width, previo.height / height);
  const w = Math.max(1, width * fit);
  const h = Math.max(1, height * fit);
  const x = previo.x + (previo.width - w) / 2;
  const y = previo.y + (previo.height - h) / 2;

  commitElements(
    api,
    api.getSceneElements().map((el) =>
      el.id === elementId
        ? patchElement(el, { fileId, x, y, width: w, height: h } as Partial<SceneElement>)
        : el,
    ),
    'undoable',
    { selectedElementIds: { [elementId]: true } },
  );
  return true;
}

/** Bytes locales → dataURL, para poder pintar antes de que MM responda. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Inserta bytes locales PINTANDO YA y cambiando a MediaMonster al terminar.
 *
 * Para lo que se arrastra desde el escritorio. `insertImageFromBlob` sube
 * primero y pinta después, que es correcto y se siente roto: sueltas una foto de
 * 8 MB y el lienzo se queda igual varios segundos, sin nada que mirar y sin
 * saber si el gesto ha contado. Aquí la foto aparece en el sitio donde la
 * soltaste con sus propios bytes, y cuando la subida termina el elemento pasa a
 * apuntar a la URL de MM sin que se note.
 *
 * NO abre un agujero en la regla, aunque lo parezca. La única forma de entrar
 * sigue siendo con un `MediaUploader`: no existe —ni se exporta— una función
 * que acepte un `data:` de fuera. Y el base64 no sobrevive al final de esta
 * función pase lo que pase: si la subida sale bien se sustituye, y si falla se
 * BORRA el elemento. Nunca queda un base64 al que el guardado tenga que
 * enfrentarse.
 *
 * La ventana en la que sí existe dura lo que la subida. Si justo ahí cae un
 * autoguardado, `externalizeInlineImages` lo sube por su cuenta y deja un
 * duplicado en la mediateca — feo, pero la regla aguanta y el diseño se guarda.
 *
 * El cambio de fichero entra como `'never'` en el historial: es fontanería, y un
 * Ctrl+Z que devolviera el elemento al base64 recién sustituido sería justo lo
 * que la regla prohíbe.
 *
 * @returns el id del ELEMENTO, ya apuntando a MediaMonster.
 */
export async function insertImageWithPreview(
  api: ExcalidrawImperativeAPI,
  blob: Blob,
  uploader: MediaUploader,
  opts?: InsertImageOptions & { filename?: string },
): Promise<string> {
  if (typeof uploader !== 'function') {
    throw new Error('insertImageWithPreview requiere un MediaUploader: las imágenes van a MediaMonster.');
  }
  const filename = opts?.filename ?? `canvas-${Date.now()}.png`;
  const local = await blobToDataUrl(blob);
  const { width, height } = await loadImageSize(local);
  const elementId = insertImageByReference(
    api,
    { url: local, mimeType: blob.type || 'image/png', width, height },
    opts,
  );

  let url: string;
  try {
    url = await uploader(blob, filename);
    if (isInlineDataUrl(url)) {
      throw new Error('El MediaUploader devolvió un data: URL en vez de una URL de MediaMonster.');
    }
  } catch (e) {
    // Fuera de la escena: quedarse es quedarse en base64, y eso bloquea el
    // guardado del diseño ENTERO, no solo el de esta foto.
    commitElements(
      api,
      api.getSceneElements().filter((el) => el.id !== elementId),
      'never',
    );
    throw e;
  }

  const fileId = createFileId();
  api.addFiles([
    { id: fileId, dataURL: url, mimeType: blob.type || 'image/png', created: Date.now() },
  ] as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);
  commitElements(
    api,
    api
      .getSceneElements()
      .map((el) =>
        el.id === elementId ? patchElement(el, { fileId } as Partial<SceneElement>) : el,
      ),
    'never',
  );
  return elementId;
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
