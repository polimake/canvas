import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import type { FileEntry } from './media';
import { commitElements } from './mutate';
import { goToPage, packPagesInArray, renumberPagesInArray } from './pages';
import { buildPersistableFiles } from './media';
import type { CustomFontFace } from './fonts';
import {
  extractComponentFragment,
  instantiateComponent,
  type ComponentFragment,
  type SlotValues,
} from './components';

/**
 * Mitad IMPURA del motor de componentes: la que habla con la API de Excalidraw.
 *
 * La lógica (clonado, slots, medición) vive en `components.ts`, que es puro y
 * corre también en el worker; aquí solo se integra el resultado en la escena
 * viva — un único commit deshacible, ficheros por `addFiles` y navegación a la
 * página recién creada. Separado en su propio módulo para que el worker pueda
 * importar el motor sin arrastrar Excalidraw.
 */

type FrameLike = SceneElement & { type: 'frame'; x: number; y: number; width: number };

function frames(elements: readonly SceneElement[]): FrameLike[] {
  return elements
    .filter((e): e is FrameLike => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

/**
 * Inserta un componente como página nueva tras `afterPageId` (por defecto, la
 * última página) y navega hasta ella. Un solo commit = una sola entrada de
 * deshacer, la regla de todas las operaciones compuestas de pages.ts.
 *
 * Devuelve las tipografías del componente: persistirlas es tarea del HOST
 * (`editorConfig.fonts` es suyo) — aquí no hay dónde guardarlas y callárselas
 * significaría reabrir el diseño con la fuente de respaldo.
 */
export function insertComponentIntoScene(
  api: ExcalidrawImperativeAPI,
  fragment: ComponentFragment,
  { afterPageId, slots }: { afterPageId?: string | null; slots?: SlotValues } = {},
): { pageId: string; fonts: CustomFontFace[]; unknownSlots: string[] } {
  const elements = api.getSceneElements();
  const existing = frames(elements);
  const anchor = (afterPageId && existing.find((f) => f.id === afterPageId)) || existing[existing.length - 1] || null;

  // Posición provisional a la derecha del ancla; `packPagesInArray` la asienta.
  const dx = anchor ? anchor.x + anchor.width + 1 - fragment.frame.x : 0;
  const dy = anchor ? anchor.y - fragment.frame.y : 0;

  const instance = instantiateComponent(fragment, { slots, dx, dy });

  const fileEntries = Object.values(instance.files);
  if (fileEntries.length) {
    // Los ids vienen recién acuñados de la instanciación, así que el
    // `addFiles` de Excalidraw (que nunca sobrescribe) no puede saltarse nada.
    api.addFiles(fileEntries as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);
  }

  const order = existing.map((f) => f.id);
  const at = anchor ? order.indexOf(anchor.id) + 1 : order.length;
  order.splice(at, 0, instance.pageId);

  // El motor trabaja con su tipo estructural (ver components.ts); aquí los
  // clones vuelven a ser elementos de escena de pleno derecho.
  const cloned = instance.elements as unknown as SceneElement[];
  let combined: readonly SceneElement[] = [...elements, ...cloned];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined);

  goToPage(api, instance.pageId);
  return { pageId: instance.pageId, fonts: instance.fonts, unknownSlots: instance.unknownSlots };
}

/**
 * Extrae la página activa de la escena viva con la MISMA forma de `editorConfig`
 * que guarda `useCanvas2Save` — es lo que "Guardar página como componente"
 * envía a `POST /api/designs`. Los ficheros pasan por `buildPersistableFiles`:
 * si queda base64 (una imagen pegada aún sin externalizar), se devuelve en
 * `inline` para que el host CIERRE EL PASO en vez de guardar bytes en la fila.
 */
export function extractPageForComponent(
  api: ExcalidrawImperativeAPI,
  pageId: string,
  { fonts }: { fonts?: readonly CustomFontFace[] } = {},
): {
  editorConfig: { elements: SceneElement[]; appState: { viewBackgroundColor?: string }; files: Record<string, FileEntry>; fonts?: CustomFontFace[] };
  inline: string[];
} | null {
  const elements = api.getSceneElements();
  const frame = elements.find((e) => e.id === pageId && e.type === 'frame');
  if (!frame) return null;

  const members = elements.filter((e) => (e as { frameId?: string | null }).frameId === pageId);
  const scoped = [frame, ...members];
  const persistable = buildPersistableFiles(scoped, api.getFiles());

  // El componente solo usa tipografías que sus textos referencian… saberlo
  // exigiría resolver ids de familia aquí; se guarda el juego completo del
  // diseño origen (deduplicado aguas abajo) — inofensivo y sin falsos huecos.
  return {
    editorConfig: {
      elements: scoped as SceneElement[],
      appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
      files: persistable.files as Record<string, FileEntry>,
      ...(fonts?.length ? { fonts: [...fonts] } : {}),
    },
    inline: persistable.inline,
  };
}

export { extractComponentFragment };
