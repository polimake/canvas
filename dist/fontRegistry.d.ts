import { type CustomFontFace } from './fonts';
export interface RegisteredFont {
    /** Nombre con el que se declara el `@font-face` (ver `fontFamilyAlias`). */
    alias: string;
    /** Id que va en `element.fontFamily`. */
    id: number;
}
/**
 * Da de alta una familia propia y devuelve el id con el que hay que marcar los
 * textos. Idempotente.
 *
 * Devuelve `null` si el nombre está vacío o si su id ya lo ocupa OTRA familia
 * (colisión de hash, ver `customFontFamilyId`): en ese caso es preferible que
 * el texto se pinte con la fuente de respaldo y quede un aviso en consola, a
 * que se pinte con la tipografía equivocada de otra marca sin decir nada.
 */
export declare function registerCustomFont(name: string): RegisteredFont | null;
/**
 * Registra un lote y devuelve las caras que de verdad se pueden declarar, ya
 * con el alias por familia. Lo que no se pudo registrar se cae fuera.
 */
export declare function registerCustomFonts(faces: readonly CustomFontFace[]): {
    faces: CustomFontFace[];
    ids: Map<string, number>;
};
/**
 * Id de una familia YA registrada (o de una de serie de Excalidraw), sin darla
 * de alta. Lo usan los presets de texto para nacer en la tipografía de marca.
 */
export declare function fontFamilyId(name: string): number | null;
/** Solo para tests: olvida lo registrado en este proceso. */
export declare function resetFontRegistry(): void;
//# sourceMappingURL=fontRegistry.d.ts.map