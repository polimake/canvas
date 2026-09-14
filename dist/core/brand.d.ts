/**
 * Traduce el brand kit de un proyecto a lo que canvas2 sabe consumir.
 *
 * Módulo PURO a propósito: no importa nada de Excalidraw (ni siquiera un tipo),
 * así que se puede probar en node sin montar el editor. La consecuencia de
 * diseño es que aquí no se resuelven los IDS numéricos de familia tipográfica —
 * se devuelven NOMBRES de familia y es `Canvas2Editor`, que ya vive del lado de
 * Excalidraw, quien los convierte con el `FONT_FAMILY` real. Así la tabla de
 * constantes existe una sola vez y no puede desincronizarse.
 *
 * El brand kit llega tal cual sale de la base de datos (`projects.brandKit`, un
 * blob JSON sin esquema), así que todo se valida aquí y lo que no encaja se
 * reporta en `notes` en vez de romper o de colarse silenciosamente.
 */
import { type CustomFontFace } from './fonts';
/** Forma laxa de `projects.brandKit`. Todo opcional: 12 de 21 proyectos no lo tienen. */
export interface BrandKitInput {
    mainColor?: unknown;
    colorPalette?: unknown;
    headingFont?: unknown;
    bodyFont?: unknown;
    smallLogo?: unknown;
    logoBlack?: unknown;
    logoWhite?: unknown;
}
export type BrandFontFace = CustomFontFace;
export interface Canvas2Brand {
    mainColor: string | null;
    /** Paleta deduplicada, con `mainColor` al frente si es válido. */
    palette: string[];
    /** Familia de titulares con su nombre REAL, o null si la marca no aporta fichero. */
    headingFamily: string | null;
    /** Familia de texto corrido con su nombre REAL, o null. */
    bodyFamily: string | null;
    /** Listo para la prop `fontOverrides` de Canvas2Editor. */
    fontOverrides: BrandFontFace[];
    logos: {
        small: string | null;
        black: string | null;
        white: string | null;
    };
    /** Lo que se ha descartado y por qué. Se enseña en la UI, no se traga. */
    notes: string[];
}
/** Vacío pero utilizable: evita que cada consumidor tenga que comprobar null. */
export declare const EMPTY_BRAND: Canvas2Brand;
export declare function resolveBrandKit(raw: unknown): Canvas2Brand;
//# sourceMappingURL=brand.d.ts.map