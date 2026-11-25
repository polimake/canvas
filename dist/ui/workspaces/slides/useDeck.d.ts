import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import { type PageInfo } from '../../../core/pages';
import type { PageNames } from '../../../core/pageNames';
export interface DeckSlide extends PageInfo {
    skipped: boolean;
}
export interface DeckState {
    slides: DeckSlide[];
    /** Hay algo seleccionado: la barra cambia a las opciones de formato. */
    hasSelection: boolean;
    /** La herramienta activa de Excalidraw (`selection`, `text`, `rectangle`…). */
    activeTool: string;
    /** Zoom actual, en tanto por uno. */
    zoom: number;
}
/**
 * Lo que el cromo del espacio Presentación necesita saber de la escena, con UNA
 * suscripción. Solo avisa a React cuando cambia algo de esto: `onChange` se
 * dispara con cada movimiento del puntero y repintar la tira en cada uno se
 * notaría.
 */
export declare function useDeck(api: ExcalidrawImperativeAPI | null, names?: PageNames): DeckState;
//# sourceMappingURL=useDeck.d.ts.map