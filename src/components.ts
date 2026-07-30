import { PAGE_GAP } from './layout';
import { dedupeFontFaces, type CustomFontFace } from './fonts';

/**
 * Componentes de diseño reutilizables: el motor de instanciación.
 *
 * Un componente es una fila de `designs` (template=1, format='excalidraw') cuya
 * única página es la pieza a reutilizar. Este módulo la extrae, la clona con
 * identidad fresca y rellena sus huecos ("slots"). Es PURO a propósito — solo
 * tipos de ./excal, nada de DOM — porque corre en tres sitios: el navegador
 * (picker del editor), el worker (endpoint de instanciación que usa la IA por
 * MCP) y node (tests). El hermano impuro, `insertComponent.ts`, es quien habla
 * con la API de Excalidraw.
 *
 * Los slots viven en los ELEMENTOS, no en una plantilla aparte, para que un
 * componente se pueda seguir editando como cualquier diseño sin que el editor
 * sepa nada de slots:
 *
 *   - `customData: { c2: 'slot', name, maxChars? }` — forma canónica. `c2` es el
 *     mismo espacio de nombres que ya usa el papel de página ('pageBackground');
 *     nada en la ruta de guardado toca `customData`.
 *   - Azúcar de autoría: un elemento de texto cuyo contenido es exactamente
 *     `{{nombre}}` es un slot llamado `nombre`. Permite marcar huecos desde el
 *     editor de hoy, sin ninguna interfaz nueva.
 *   - Azúcar de imagen: si el componente no declara ningún slot de imagen, su
 *     imagen MÁS GRANDE es el slot implícito `foto`. Sustituir la foto es el
 *     relleno más común y las imágenes no tienen texto donde escribir `{{}}`.
 *
 * El manifiesto `componentMeta` de la fila es un ÍNDICE para elegir componente
 * sin abrir `editorConfig`; si manifiesto y escena divergen, manda la escena.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────
//
// Estructurales y PROPIOS a propósito: importar `SceneElement` (./excal) o
// `FileEntry` (./media), aunque sea con `import type`, mete esos ficheros en el
// programa de tsc del WORKER — y ni el CSS de Excalidraw ni los globals de DOM
// compilan allí. El `SceneElement` real los satisface; las funciones son
// genéricas para que los llamantes del paquete conserven su tipo exacto.

/** Lo mínimo que el motor necesita saber de un elemento de escena. */
export interface ComponentElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frameId?: string | null;
  isDeleted?: boolean;
  customData?: unknown;
}

/** Entrada del mapa `files` (compatible con BinaryFileData de Excalidraw). */
export interface ComponentFileEntry {
  id: string;
  dataURL: string;
  mimeType: string;
  created?: number;
  lastRetrieved?: number;
}

export interface ComponentSlotInfo {
  name: string;
  type: 'text' | 'image';
  elementId: string;
  maxChars?: number;
  /** true si salió del azúcar (texto `{{…}}` o imagen mayor), no de customData. */
  implicit?: boolean;
}

/** Valor de relleno: texto plano, o imagen por URL (las medidas reales, si se
 *  conocen, evitan deformar — regla dura: la foto se contiene, no se recorta). */
export type SlotValue = string | { url: string; w?: number; h?: number };
export type SlotValues = Record<string, SlotValue>;

export interface ComponentFragment {
  /** El marco de página del componente. */
  frame: ComponentElement;
  /** Miembros del marco, papel de página incluido. */
  members: ComponentElement[];
  /** Solo los ficheros que referencian los miembros (dataURL = URL remota). */
  files: Record<string, ComponentFileEntry>;
  /** Tipografías que el componente trae consigo (editorConfig.fonts). */
  fonts: CustomFontFace[];
  pageSize: { width: number; height: number };
}

interface FrameLike {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Identidad ───────────────────────────────────────────────────────────────

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

// ─── Clonado con identidad fresca ────────────────────────────────────────────

/**
 * Clona un grupo de elementos con ids nuevos, remapeando las referencias
 * internas (frameId, containerId, boundElements, bindings, groupIds) y,
 * opcionalmente, los fileId de las imágenes.
 *
 * Extraído de `duplicatePage` (pages.ts), que ahora delega aquí: la misma
 * mecánica sirve para duplicar una página y para instanciar un componente. Las
 * referencias a elementos FUERA del grupo se dejan tal cual (limitación
 * asumida, igual que en duplicatePage con los bindings entre páginas).
 *
 * `fileIdMap`: mapa vacío que se rellena con viejo→nuevo. Darlo activa el
 * remapeo — imprescindible al instanciar, porque `api.addFiles` de Excalidraw
 * NUNCA sobrescribe un id existente y dos inserciones del mismo componente
 * colisionarían.
 */
export function cloneSceneElements<T extends ComponentElement>(
  group: readonly T[],
  { dx = 0, dy = 0, fileIdMap }: { dx?: number; dy?: number; fileIdMap?: Map<string, string> } = {},
): { clones: T[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  for (const e of group) idMap.set(e.id, createId('el'));
  const groupIdMap = new Map<string, string>();

  const clones = group.map((e) => {
    // Elements are plain serializable objects — deep clone, then rewrite ids.
    const clone: Record<string, unknown> = JSON.parse(JSON.stringify(e));
    clone.id = idMap.get(e.id);
    clone.x = (clone.x as number) + dx;
    clone.y = (clone.y as number) + dy;
    // Fresh identity for the store: bumped version, new nonce, and NO
    // inherited fractional index (updateScene re-derives it from array order).
    clone.version = ((clone.version as number) ?? 0) + 1;
    clone.versionNonce = Math.floor(Math.random() * 2 ** 31);
    clone.updated = Date.now();
    delete clone.index;

    if (typeof clone.frameId === 'string' && idMap.has(clone.frameId)) {
      clone.frameId = idMap.get(clone.frameId);
    }
    if (typeof clone.containerId === 'string' && idMap.has(clone.containerId)) {
      clone.containerId = idMap.get(clone.containerId);
    }
    if (Array.isArray(clone.boundElements)) {
      clone.boundElements = (clone.boundElements as Array<{ id: string }>).map((b) =>
        idMap.has(b.id) ? { ...b, id: idMap.get(b.id)! } : b,
      );
    }
    for (const key of ['startBinding', 'endBinding'] as const) {
      const binding = clone[key] as { elementId?: string } | null | undefined;
      if (binding?.elementId && idMap.has(binding.elementId)) {
        clone[key] = { ...binding, elementId: idMap.get(binding.elementId) };
      }
    }
    if (Array.isArray(clone.groupIds)) {
      clone.groupIds = (clone.groupIds as string[]).map((g) => {
        if (!groupIdMap.has(g)) groupIdMap.set(g, createId('gr'));
        return groupIdMap.get(g)!;
      });
    }
    if (fileIdMap && typeof clone.fileId === 'string') {
      if (!fileIdMap.has(clone.fileId)) fileIdMap.set(clone.fileId, createId('file'));
      clone.fileId = fileIdMap.get(clone.fileId);
    }
    return clone as unknown as T;
  });

  return { clones, idMap };
}

// ─── Medición de texto (heurística, sin DOM) ─────────────────────────────────

/**
 * Parte el texto en líneas que caben, midiendo a ojo por ancho medio de glifo,
 * y devuelve la altura resultante.
 *
 * No hay canvas donde medir de verdad (esto corre también en el worker): 0.52
 * de ancho medio por em es la misma heurística con la que se generaron los
 * diseños del sandbox, validada a ojo sobre cientos de piezas. Quien rellena
 * un slot con texto MUY por encima de `maxChars` se lleva un desbordamiento —
 * la medición aproximada no es un corrector de contenido.
 */
export function measureWrappedText(
  text: string,
  { width, fontSize, lineHeight = 1.2, factor = 0.52 }: {
    width: number;
    fontSize: number;
    lineHeight?: number;
    factor?: number;
  },
): { lines: string[]; text: string; height: number } {
  const max = Math.max(6, Math.floor(width / (fontSize * factor)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > max && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  const kept = lines.filter((l) => l !== '' || lines.length === 1);
  return { lines: kept, text: kept.join('\n'), height: kept.length * fontSize * lineHeight };
}

/**
 * Encaja una imagen ENTERA dentro de una caja, centrada — contain, nunca cover.
 * Regla dura del proyecto: ni recorte ni deformación; el hueco que sobre lo
 * ocupa el fondo.
 */
export function fitImageInBox(
  ratio: number,
  box: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5;
  let width = box.width;
  let height = box.width / safeRatio;
  if (height > box.height) {
    height = box.height;
    width = box.height * safeRatio;
  }
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

// ─── Detección de slots ──────────────────────────────────────────────────────

const SUGAR_RE = /^\{\{\s*([\w-]+)\s*\}\}$/;

function slotFromCustomData(e: ComponentElement): ComponentSlotInfo | null {
  const data = (e as { customData?: { c2?: unknown; name?: unknown; maxChars?: unknown } }).customData;
  if (!data || data.c2 !== 'slot' || typeof data.name !== 'string' || !data.name) return null;
  const type = e.type === 'image' ? 'image' : e.type === 'text' ? 'text' : null;
  if (!type) return null;
  const maxChars =
    typeof data.maxChars === 'number' && Number.isFinite(data.maxChars) && data.maxChars > 0
      ? Math.round(data.maxChars)
      : undefined;
  return { name: data.name, type, elementId: e.id, maxChars };
}

/**
 * Slots de un conjunto de elementos, en orden estable (customData primero,
 * azúcar después). Con nombres repetidos gana la primera aparición: dos
 * elementos anunciando el mismo hueco sería ambigüedad, no funcionalidad.
 */
export function listSlots(elements: readonly ComponentElement[]): ComponentSlotInfo[] {
  const out: ComponentSlotInfo[] = [];
  const seen = new Set<string>();
  const push = (slot: ComponentSlotInfo) => {
    if (seen.has(slot.name)) return;
    seen.add(slot.name);
    out.push(slot);
  };

  for (const e of elements) {
    const tagged = slotFromCustomData(e);
    if (tagged) push(tagged);
  }

  for (const e of elements) {
    if (e.type !== 'text') continue;
    const match = SUGAR_RE.exec(((e as { text?: unknown }).text as string) ?? '');
    if (match) push({ name: match[1], type: 'text', elementId: e.id, implicit: true });
  }

  // Imagen implícita: solo si ningún slot de imagen fue declarado.
  if (!out.some((s) => s.type === 'image')) {
    let biggest: ComponentElement | null = null;
    for (const e of elements) {
      if (e.type !== 'image') continue;
      const area = (e.width ?? 0) * (e.height ?? 0);
      if (!biggest || area > (biggest.width ?? 0) * (biggest.height ?? 0)) biggest = e;
    }
    if (biggest && !seen.has('foto')) {
      out.push({ name: 'foto', type: 'image', elementId: biggest.id, implicit: true });
    }
  }

  return out;
}

/**
 * Manifiesto `componentMeta` derivado de la escena — lo que "Guardar como
 * componente" siembra para que la IA tenga algo que buscar desde el minuto
 * uno. La descripción la pone el autor (o la IA) después; aquí solo se
 * inventaría lo verificable: los slots.
 */
export function deriveComponentMeta(
  elements: readonly ComponentElement[],
  { description = '', tags }: { description?: string; tags?: string[] } = {},
): { description: string; tags?: string[]; slots?: Record<string, { type: 'text' | 'image'; maxChars?: number }> } {
  const slots: Record<string, { type: 'text' | 'image'; maxChars?: number }> = {};
  for (const s of listSlots(elements)) {
    slots[s.name] = { type: s.type, ...(s.maxChars ? { maxChars: s.maxChars } : {}) };
  }
  return {
    description,
    ...(tags?.length ? { tags } : {}),
    ...(Object.keys(slots).length ? { slots } : {}),
  };
}

// ─── Extracción ──────────────────────────────────────────────────────────────

function isCanvas2EditorConfig(cfg: unknown): cfg is { elements: unknown; files?: unknown; fonts?: unknown } {
  return !!cfg && typeof cfg === 'object' && !Array.isArray(cfg) && Array.isArray((cfg as { elements?: unknown }).elements);
}

function normalizeFonts(raw: unknown): CustomFontFace[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is CustomFontFace =>
      !!f && typeof f === 'object' &&
      typeof (f as { family?: unknown }).family === 'string' &&
      typeof (f as { src?: unknown }).src === 'string',
  );
}

/**
 * Extrae la página `pageIndex` (por orden visual, izquierda→derecha) de un
 * `editorConfig` de canvas2 como fragmento instanciable. Devuelve null si el
 * config no es de canvas2 o no tiene marcos: un componente sin página no es
 * instanciable y tratarlo como "todos los elementos sueltos" escondería el
 * error de autoría.
 */
export function extractComponentFragment(
  editorConfig: unknown,
  pageIndex = 0,
): ComponentFragment | null {
  if (!isCanvas2EditorConfig(editorConfig)) return null;
  const elements = (editorConfig.elements as ComponentElement[]).filter(
    (e) => !(e as { isDeleted?: boolean }).isDeleted,
  );

  const frames = elements
    .filter((e): e is ComponentElement & FrameLike => e.type === 'frame')
    .sort((a, b) => a.x - b.x);
  const frame = frames[pageIndex];
  if (!frame) return null;

  const members = elements.filter((e) => (e as { frameId?: string | null }).frameId === frame.id);

  const referenced = new Set<string>();
  for (const e of members) {
    const fileId = (e as { fileId?: unknown }).fileId;
    if (typeof fileId === 'string') referenced.add(fileId);
  }
  const files: Record<string, ComponentFileEntry> = {};
  const rawFiles = (editorConfig.files ?? {}) as Record<string, ComponentFileEntry>;
  for (const id of referenced) {
    if (rawFiles[id]) files[id] = rawFiles[id];
  }

  return {
    frame,
    members,
    files,
    fonts: normalizeFonts(editorConfig.fonts),
    pageSize: { width: frame.width, height: frame.height },
  };
}

// ─── Relleno de slots ────────────────────────────────────────────────────────

function mimeFromUrl(url: string): string {
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Rellena slots SOBRE elementos ya clonados (los muta — por eso solo se llama
 * desde `instantiateComponent`, nunca sobre la escena del componente).
 *
 * Texto: se reenvuelve con la medición heurística y se fija `autoResize:false`
 * para que el envoltorio calculado sea el que se pinte. Imagen: URL remota por
 * referencia — nunca bytes — y, si vienen las medidas reales, contain dentro de
 * la caja del elemento marcador; sin medidas se conserva la caja tal cual.
 */
function fillSlots(
  clones: ComponentElement[],
  files: Record<string, ComponentFileEntry>,
  values: SlotValues,
): { unknown: string[] } {
  if (!Object.keys(values).length) return { unknown: [] };
  const slots = listSlots(clones);
  const byName = new Map(slots.map((s) => [s.name, s]));
  const byId = new Map(clones.map((e) => [e.id, e]));
  const unknown: string[] = [];

  for (const [name, value] of Object.entries(values)) {
    const slot = byName.get(name);
    const el = slot ? (byId.get(slot.elementId) as Record<string, unknown> | undefined) : undefined;
    if (!slot || !el) {
      unknown.push(name);
      continue;
    }

    if (slot.type === 'text') {
      const text = typeof value === 'string' ? value : value.url;
      const fontSize = typeof el.fontSize === 'number' ? el.fontSize : 24;
      const lineHeight = typeof el.lineHeight === 'number' ? el.lineHeight : 1.2;
      const width = typeof el.width === 'number' ? el.width : 400;
      const wrapped = measureWrappedText(text, { width, fontSize, lineHeight });
      el.text = wrapped.text;
      el.originalText = text;
      el.height = wrapped.height;
      el.autoResize = false;
    } else {
      const image = typeof value === 'string' ? { url: value } : value;
      if (!image.url) {
        unknown.push(name);
        continue;
      }
      const fileId = createId('file');
      files[fileId] = {
        id: fileId,
        dataURL: image.url,
        mimeType: mimeFromUrl(image.url),
        created: Date.now(),
      } as ComponentFileEntry;
      el.fileId = fileId;
      if (image.w && image.h) {
        const box = {
          x: el.x as number,
          y: el.y as number,
          width: el.width as number,
          height: el.height as number,
        };
        Object.assign(el, fitImageInBox(image.w / image.h, box));
      }
      el.crop = null;
    }
  }

  return { unknown };
}

// ─── Instanciación ───────────────────────────────────────────────────────────

export interface InstantiatedComponent {
  /** Marco clonado primero, miembros después — listos para concatenar. */
  elements: ComponentElement[];
  /** Ficheros nuevos (ids recién acuñados) que la escena destino debe adoptar. */
  files: Record<string, ComponentFileEntry>;
  /** Tipografías del componente, para fusionar en `editorConfig.fonts`. */
  fonts: CustomFontFace[];
  pageId: string;
  pageSize: { width: number; height: number };
  /** Slots pedidos que el componente no tiene — se reporta, no se inventa. */
  unknownSlots: string[];
}

/**
 * Clona el fragmento con identidad fresca (elementos Y ficheros), lo desplaza
 * a (dx, dy) y rellena los slots. Puro: el resultado se integra después, sea
 * vía `commitElements` (navegador) o concatenando en `editorConfig` (worker).
 */
export function instantiateComponent(
  fragment: ComponentFragment,
  { slots = {}, dx = 0, dy = 0 }: { slots?: SlotValues; dx?: number; dy?: number } = {},
): InstantiatedComponent {
  const fileIdMap = new Map<string, string>();
  const { clones, idMap } = cloneSceneElements([fragment.frame, ...fragment.members], {
    dx,
    dy,
    fileIdMap,
  });

  const files: Record<string, ComponentFileEntry> = {};
  for (const [oldId, newId] of fileIdMap) {
    const entry = fragment.files[oldId];
    if (entry) files[newId] = { ...entry, id: newId } as ComponentFileEntry;
  }

  const { unknown } = fillSlots(clones, files, slots);

  return {
    elements: clones,
    files,
    fonts: fragment.fonts,
    pageId: idMap.get(fragment.frame.id)!,
    pageSize: fragment.pageSize,
    unknownSlots: unknown,
  };
}

// ─── Composición server-side ─────────────────────────────────────────────────

/**
 * Añade un componente como página nueva AL FINAL de un `editorConfig` de
 * canvas2, sin API de Excalidraw: es la mitad del motor que usa el endpoint
 * `/insert-component` (y por él, la IA vía MCP).
 *
 * No re-empaqueta las páginas existentes — solo coloca la nueva tras la última
 * (mismo `PAGE_GAP`), fusiona ficheros (los ids son recién acuñados: no puede
 * haber colisión) y deduplica tipografías. Devuelve null si el config no es de
 * canvas2: el endpoint convierte eso en un 400, no en una página perdida.
 */
export function appendComponentToEditorConfig(
  editorConfig: unknown,
  fragment: ComponentFragment,
  { slots = {} }: { slots?: SlotValues } = {},
): {
  editorConfig: { elements: ComponentElement[]; appState: unknown; files: Record<string, ComponentFileEntry>; fonts?: CustomFontFace[] };
  pages: number;
  pageId: string;
  unknownSlots: string[];
} | null {
  if (!isCanvas2EditorConfig(editorConfig)) return null;
  const elements = (editorConfig.elements as ComponentElement[]).filter(
    (e) => !(e as { isDeleted?: boolean }).isDeleted,
  );

  const frames = elements
    .filter((e): e is ComponentElement & FrameLike => e.type === 'frame')
    .sort((a, b) => a.x - b.x);
  const last = frames[frames.length - 1] ?? null;

  // Tras la última página; en un lienzo aún sin páginas, donde estaba el marco
  // del componente (0 arbitrario sería igual de válido, esto conserva autoría).
  const dx = last ? last.x + last.width + PAGE_GAP - fragment.frame.x : 0;
  const dy = last ? last.y - fragment.frame.y : 0;

  const instance = instantiateComponent(fragment, { slots, dx, dy });

  const existingFiles = ((editorConfig as { files?: unknown }).files ?? {}) as Record<string, ComponentFileEntry>;
  const existingFonts = normalizeFonts((editorConfig as { fonts?: unknown }).fonts);
  const mergedFonts = dedupeFontFaces([...existingFonts, ...instance.fonts]);

  return {
    editorConfig: {
      ...(editorConfig as object),
      elements: [...elements, ...instance.elements],
      appState: (editorConfig as { appState?: unknown }).appState ?? {},
      files: { ...existingFiles, ...instance.files },
      ...(mergedFonts.length ? { fonts: mergedFonts } : {}),
    },
    pages: frames.length + 1,
    pageId: instance.pageId,
    unknownSlots: instance.unknownSlots,
  };
}
