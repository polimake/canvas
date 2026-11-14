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
import '@excalidraw/excalidraw/index.css';
export { Excalidraw, MainMenu, CaptureUpdateAction, convertToExcalidrawElements, serializeAsJSON, newElementWith, getNonDeletedElements, getVisibleSceneBounds, viewportCoordsToSceneCoords, FONT_FAMILY, } from '@excalidraw/excalidraw';
export type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, } from '@excalidraw/excalidraw/types';
import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
/** One element as returned by the live scene (no borrados). */
export type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number];
/**
 * Un elemento con los borrados incluidos (`getSceneElementsIncludingDeleted`).
 * Upstream estrechó `getSceneElements` a `NonDeleted<…>`; lo que trabaja sobre
 * la escena entera, borrados incluidos, usa este.
 */
export type AnySceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElementsIncludingDeleted']>[number];
/** The elements array accepted by `updateScene`. */
export type SceneElements = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['elements'];
/** El estado de la escena (appState) tal como lo devuelve el API en vivo. */
export type SceneAppState = ReturnType<ExcalidrawImperativeAPI['getAppState']>;
/** A frame element (our "page"). */
export type FrameElement = Extract<SceneElement, {
    type: 'frame';
}>;
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
    getDimensions?: (width: number, height: number) => {
        width: number;
        height: number;
        scale?: number;
    };
    mimeType?: string;
    /** 0–1, para JPEG y WebP. */
    quality?: number;
}
export declare function exportToCanvas(input: ExportInput): Promise<HTMLCanvasElement>;
export declare function exportToSvg(input: ExportInput): Promise<SVGSVGElement>;
/**
 * PNG, JPEG o WebP. `exportScene` solo hace PNG y JPEG; el WebP de las
 * miniaturas de página sale del canvas, como lo hacía la 0.18 por dentro.
 */
export declare function exportToBlob(input: ExportInput): Promise<Blob>;
/**
 * Escena GUARDADA → escena válida: rellena lo que un fichero puede no traer
 * (índices fraccionarios, alturas de línea, defaults de appState). El editor lo
 * hace solo con `initialData`; quien renderiza una escena sin montar el editor
 * —las miniaturas de la galería— tiene que llamarlo a mano.
 */
export declare function restore(data: {
    elements?: readonly unknown[] | null;
    appState?: object | null;
    files?: BinaryFiles | null;
}, localAppState: null, localElements: null, opts?: {
    refreshDimensions?: boolean;
    repairBindings?: boolean;
}): {
    elements: SceneElement[];
    appState: SceneAppState;
    files: BinaryFiles;
};
//# sourceMappingURL=excal.d.ts.map