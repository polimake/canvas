import type { SceneElement } from '../core/excal';
import { type CustomFontFace } from '../core/fonts';
export type ConversionTier = 'T1' | 'T2' | 'T3';
export interface ConversionNote {
    page: number;
    layer: string;
    /** 'dropped' = no se pudo representar; 'lossy' = se representa distinto. */
    kind: 'dropped' | 'lossy';
    detail: string;
}
export interface ConversionReport {
    pages: number;
    tier: ConversionTier;
    counts: Record<string, number>;
    notes: ConversionNote[];
    /** true si nada se perdió por el camino. */
    clean: boolean;
}
export interface LegacyScene {
    elements: SceneElement[];
    files: Record<string, unknown>;
    /**
     * Tipografías propias que la escena necesita para verse como el original.
     * Se guardan junto a la escena (`editorConfig.fonts`) y el host las pasa a
     * `fontOverrides`, así que un diseño migrado es AUTOSUFICIENTE: no depende de
     * que el brand kit del proyecto siga teniendo esa fuente.
     */
    fonts: CustomFontFace[];
    report: ConversionReport;
}
/** Reinicia el contador para que dos llamadas con la misma entrada coincidan. */
export declare function resetIdCounter(): void;
interface ParsedParagraph {
    text: string;
    fontSize: number;
    color: string;
    align: string;
    /** Nombre de familia declarado en línea, ya sin comillas. '' si no hay. */
    fontFamily: string;
}
/**
 * Parte el HTML de una capa de texto en párrafos con su estilo efectivo. El
 * color del `<span>` interior gana al del `<p>`, que es como lo escribe el
 * editor legacy.
 */
export declare function parseLegacyText(html: string): ParsedParagraph[];
/** Fichero de una tipografía, venga de donde venga. */
export interface FontSource {
    url: string;
    style?: string;
}
export interface LegacyConversionOptions {
    /**
     * Último recurso para una fuente que el diseño nombra pero cuyo fichero no
     * guarda. Pasa MUCHO: el editor legacy solo escribía `url` en la capa cuando
     * la fuente venía de su lista curada, así que hay diseños que dicen
     * "Montserrat" sin decir de dónde bajarla.
     *
     * Se inyecta en vez de resolverse aquí para que el módulo siga siendo puro:
     * el script de migración lo cablea al brand kit del proyecto y a la lista de
     * Google Fonts del paquete legacy; los tests, a un mapa de mentira.
     */
    resolveFontUrl?: (name: string) => FontSource | null;
}
export declare function legacyToScene(editorConfig: unknown, options?: LegacyConversionOptions): LegacyScene;
export {};
//# sourceMappingURL=legacy.d.ts.map