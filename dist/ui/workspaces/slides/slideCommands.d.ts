import { type ExcalidrawImperativeAPI } from '../../../core/excal';
import { type PageInfo, type PageSize } from '../../../core/pages';
import type { PageNames } from '../../../core/pageNames';
/**
 * Las órdenes del espacio Presentación, en UN sitio: las usan la barra de
 * menús, el clic derecho de la tira, la barra de herramientas y los atajos.
 * Cada una es una operación de `core` que ya existe (una entrada de deshacer);
 * aquí solo se decide sobre qué diapositiva y qué queda activa después.
 */
export type ActivatePage = (id: string) => void;
export declare function newSlide(api: ExcalidrawImperativeAPI, afterId: string | null, size: PageSize, names: PageNames | undefined, activate: ActivatePage): void;
export declare function duplicateSlide(api: ExcalidrawImperativeAPI, id: string, names: PageNames | undefined, activate: ActivatePage): void;
/** Borra la diapositiva y activa la que queda en su sitio (la siguiente, o la anterior si era la última). */
export declare function deleteSlide(api: ExcalidrawImperativeAPI, id: string, activate: ActivatePage): void;
export declare function moveSlide(api: ExcalidrawImperativeAPI, id: string, where: 'start' | 'end' | 'up' | 'down'): void;
export declare function toggleSkip(api: ExcalidrawImperativeAPI, id: string): void;
/**
 * El tamaño de una presentación es de TODAS sus diapositivas (Archivo ›
 * Configurar página en Slides): se cambian todas, escalando su contenido, en
 * una sola entrada de deshacer.
 */
export declare function resizeAllSlides(api: ExcalidrawImperativeAPI, size: PageSize): void;
/**
 * Seleccionar todo = lo de LA diapositiva activa, como en Slides. El de
 * Excalidraw coge toda la escena (marcos incluidos): con las vecinas tapadas
 * por la máscara, Supr después borraba la presentación entera. Ni el papel ni
 * lo bloqueado; mirar no entra en el historial.
 */
export declare function selectAllInSlide(api: ExcalidrawImperativeAPI, pageId: string | null): void;
export declare function canDeleteSlide(pages: readonly PageInfo[]): boolean;
/**
 * Lanza un atajo de teclado de Excalidraw como si se hubiera pulsado: deshacer,
 * rehacer, duplicar, eliminar, seleccionar todo, agrupar, ordenar, zoom.
 *
 * Pasa por el mismo reenvío que ya usa el lienzo (keyRouting.ts) en vez de
 * pulsar sus botones escondidos o copiar sus acciones: así el menú hace
 * EXACTAMENTE lo que hace el atajo, con su deshacer y sus reglas.
 */
export declare function sendCanvasKey(root: HTMLElement | null, key: string, mods?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}, code?: string): void;
/**
 * Los atajos de Excalidraw que reutilizan los menús. Traer al frente y enviar
 * al fondo van con Alt en macOS (Cmd+Alt+]/[): es su `keyTest` en Darwin.
 */
export declare const CANVAS_KEYS: {
    readonly undo: readonly ["z", {
        readonly ctrl: true;
    }];
    readonly redo: readonly ["z", {
        readonly ctrl: true;
        readonly shift: true;
    }];
    readonly duplicate: readonly ["d", {
        readonly ctrl: true;
    }];
    readonly delete: readonly ["Delete", {}];
    readonly group: readonly ["g", {
        readonly ctrl: true;
    }];
    readonly ungroup: readonly ["g", {
        readonly ctrl: true;
        readonly shift: true;
    }];
    readonly bringToFront: readonly ["]", {
        ctrl: true;
        alt: true;
        shift?: undefined;
    } | {
        ctrl: true;
        shift: true;
        alt?: undefined;
    }];
    readonly bringForward: readonly ["]", {
        readonly ctrl: true;
    }];
    readonly sendBackward: readonly ["[", {
        readonly ctrl: true;
    }];
    readonly sendToBack: readonly ["[", {
        ctrl: true;
        alt: true;
        shift?: undefined;
    } | {
        ctrl: true;
        shift: true;
        alt?: undefined;
    }];
    readonly zoomIn: readonly ["=", {
        readonly ctrl: true;
    }];
    readonly zoomOut: readonly ["-", {
        readonly ctrl: true;
    }];
};
export type CanvasKey = keyof typeof CANVAS_KEYS;
export declare function runCanvasKey(root: HTMLElement | null, name: CanvasKey): void;
/** Cómo se llaman las teclas en el idioma del editor (labels.slides.keys). */
export interface KeyWords {
    shift: string;
    enter: string;
    del: string;
}
/** Texto del atajo para el menú, en el formato del sistema. */
export declare function shortcutLabel(name: CanvasKey | 'newSlide' | 'present' | 'moveUp' | 'moveDown' | 'selectAll', words: KeyWords): string;
//# sourceMappingURL=slideCommands.d.ts.map