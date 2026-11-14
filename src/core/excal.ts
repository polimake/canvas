/**
 * THE ONLY module allowed to import from `@excalidraw/excalidraw`.
 *
 * Everything else in this package imports Excalidraw values/types from here,
 * so an Excalidraw upgrade (breaking or not) is absorbed in exactly one file:
 * bump the dependency, fix this adapter until `pnpm typecheck` is green, done.
 * A unit test (`__tests__/decoupling.test.ts`) fails the build if any other
 * source file imports `@excalidraw/*` directly.
 *
 * It also gives the rest of the package canonical scene-element type aliases
 * (derived from the imperative API, not from deep type paths) and lets node
 * tests mock the entire Excalidraw surface by mocking this one module.
 */

// Editor stylesheet (side effect) — lives here so the import rule stays "only
// this file mentions @excalidraw/*".
import '@excalidraw/excalidraw/index.css';

// ─── Values ───────────────────────────────────────────────────────────────────
export {
  Excalidraw,
  // Menú principal (la hamburguesa). Pasarlo como hijo de <Excalidraw> SUSTITUYE
  // al de serie, así que quien lo componga debe reponer los items de fábrica que
  // quiera conservar (MainMenu.DefaultItems).
  MainMenu,
  CaptureUpdateAction,
  convertToExcalidrawElements,
  serializeAsJSON,
  // Excalidraw's own immutable element patch — bumps version/versionNonce so
  // the history store actually records the change (see src/mutate.ts).
  newElementWith,
  // Live-scene helpers used by emission hygiene and viewport-following.
  getNonDeletedElements,
  getVisibleSceneBounds,
  // Pantalla → escena. Lo necesita el soltar desde la biblioteca para insertar
  // donde ha caído el puntero y no en el centro de la página.
  viewportCoordsToSceneCoords,
  // Nombre de familia → id numérico. `src/brand.ts` decide qué familia se
  // secuestra para la marca pero no puede resolver su id sin importar
  // Excalidraw, así que la traducción ocurre aquí y en un solo sitio.
  FONT_FAMILY,
} from '@excalidraw/excalidraw';

// ─── Types (public entry) ─────────────────────────────────────────────────────
export type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';

import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  exportScene,
  restoreAppState,
  restoreElements,
  type ExportSceneConfig,
  type ExportSceneData,
} from '@excalidraw/excalidraw';

// ─── Canonical derived aliases (single source for the whole package) ──────────
/**
 * Un elemento de la escena, borrado o no (`getSceneElementsIncludingDeleted`).
 * Upstream estrechó `getSceneElements` a los no borrados (`NonDeleted<…>`); el
 * paquete mueve arrays de los dos tipos por las mismas funciones, así que el
 * alias es el ancho.
 */
export type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElementsIncludingDeleted']>[number];
/** The elements array accepted by `updateScene`. */
export type SceneElements = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['elements'];
/** El estado de la escena (appState) tal como lo devuelve el API en vivo. */
export type SceneAppState = ReturnType<ExcalidrawImperativeAPI['getAppState']>;
/** A frame element (our "page"). */
export type FrameElement = Extract<SceneElement, { type: 'frame' }>;

// ─── Exportar y restaurar, con la forma de antes ──────────────────────────────
//
// Upstream juntó `exportToBlob`, `exportToCanvas` y `exportToSvg` en
// `exportScene({ type, data, config })`, y partió `restore` en
// `restoreElements` y `restoreAppState`. Aquí se conservan las cuatro con la
// firma que usa el resto del paquete: el cambio se absorbe en este fichero.

/** Lo que el paquete le pasa a una exportación (la forma de la 0.18). */
export interface ExportInput {
  elements: readonly SceneElement[];
  appState?: {
    exportBackground?: boolean;
    exportWithDarkMode?: boolean;
    viewBackgroundColor?: string;
    exportPadding?: number;
  };
  files?: BinaryFiles | null;
  exportingFrame?: FrameElement | null;
  maxWidthOrHeight?: number;
  /** Solo se usa la escala que devuelve. */
  getDimensions?: (width: number, height: number) => { width: number; height: number; scale?: number };
  mimeType?: string;
  /** 0–1, para JPEG y WebP. */
  quality?: number;
}

function exportData(input: ExportInput): ExportSceneData {
  return {
    elements: input.elements.filter((el) => !el.isDeleted) as ExportSceneData['elements'],
    appState: (input.appState?.viewBackgroundColor
      ? { viewBackgroundColor: input.appState.viewBackgroundColor }
      : {}) as ExportSceneData['appState'],
    files: input.files ?? null,
  };
}

function exportConfig(input: ExportInput): ExportSceneConfig {
  const scale = input.getDimensions;
  return {
    theme: input.appState?.exportWithDarkMode ? 'dark' : 'light',
    ...(input.appState?.exportBackground === false ? { canvasBackgroundColor: false as const } : {}),
    exportingFrame: input.exportingFrame ?? null,
    ...(input.appState?.exportPadding !== undefined ? { padding: input.appState.exportPadding } : {}),
    ...(input.maxWidthOrHeight
      ? { maxWidthOrHeight: input.maxWidthOrHeight }
      : scale
        ? { scale: (w: number, h: number) => scale(w, h).scale ?? 1 }
        : {}),
  } as ExportSceneConfig;
}

export function exportToCanvas(input: ExportInput): Promise<HTMLCanvasElement> {
  return exportScene({ type: 'canvas', data: exportData(input), config: exportConfig(input) });
}

export function exportToSvg(input: ExportInput): Promise<SVGSVGElement> {
  return exportScene({ type: 'svg', data: exportData(input), config: exportConfig(input) });
}

/**
 * PNG, JPEG o WebP. `exportScene` solo hace PNG y JPEG; el WebP de las
 * miniaturas de página sale del canvas, como lo hacía la 0.18 por dentro.
 */
export async function exportToBlob(input: ExportInput): Promise<Blob> {
  const mime = input.mimeType ?? 'image/png';
  if (mime === 'image/png') {
    return exportScene({ type: 'png', data: exportData(input), config: exportConfig(input) });
  }
  if (mime === 'image/jpeg') {
    return exportScene({
      type: 'jpeg',
      data: exportData(input),
      config: { ...exportConfig(input), ...(input.quality !== undefined ? { quality: input.quality } : {}) },
    });
  }
  const canvas = await exportToCanvas(input);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(`exportToBlob: el navegador no hizo ${mime}`))), mime, input.quality);
  });
}

/**
 * Escena GUARDADA → escena válida: rellena lo que un fichero puede no traer
 * (índices fraccionarios, alturas de línea, defaults de appState). El editor lo
 * hace solo con `initialData`; quien renderiza una escena sin montar el editor
 * —las miniaturas de la galería— tiene que llamarlo a mano.
 */
export function restore(
  data: { elements?: readonly unknown[] | null; appState?: object | null; files?: BinaryFiles | null },
  localAppState: null,
  localElements: null,
  opts?: { refreshDimensions?: boolean; repairBindings?: boolean },
): { elements: SceneElement[]; appState: SceneAppState; files: BinaryFiles } {
  return {
    elements: restoreElements(data.elements as never, localElements, opts) as unknown as SceneElement[],
    appState: restoreAppState(data.appState as never, localAppState) as unknown as SceneAppState,
    files: data.files ?? {},
  };
}
