import type { ImportDocument, ImportNote } from '../documents/model';
/**
 * Modelo de documento → PowerPoint (.pptx) o plantilla (.potx).
 *
 * El inverso de `parsePptx`, con la misma unidad (px CSS a 96 ppp) y el mismo
 * modelo intermedio, así que lo que sale se puede volver a importar. Escribe
 * un paquete OOXML completo y mínimo (maestro, un diseño en blanco, tema, notas)
 * con `fflate`, sin dependencias nuevas. Todo es editable en destino: formas
 * nativas, cuadros de texto, líneas como geometría propia e imágenes con su
 * recorte.
 *
 * Una presentación tiene UN tamaño de diapositiva: es el de la primera página.
 * Una página de otro tamaño se escala, sin deformar, y se centra.
 */
export interface PptxOptions {
    /** `.potx`: el mismo paquete marcado como plantilla. */
    template?: boolean;
    title?: string;
    /** Idioma de los textos (`es-ES`), para la corrección ortográfica de destino. */
    lang?: string;
    /** Fecha de creación (por defecto, ahora). */
    created?: Date;
}
export interface PptxResult {
    bytes: Uint8Array;
    mimeType: string;
    extension: 'pptx' | 'potx';
    warnings: ImportNote[];
}
export declare const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export declare const POTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.template";
/** Texto para XML: escapa y quita los caracteres de control que XML 1.0 prohíbe. */
export declare function xmlText(value: string): string;
/** `#rgb`, `#rrggbb`, `#rrggbbaa` → `{ hex: 'RRGGBB', alpha: 0–1 }`; cualquier otra cosa, null. */
export declare function parseColor(color: string | undefined): {
    hex: string;
    alpha: number;
} | null;
export declare function documentToPptx(doc: ImportDocument, options?: PptxOptions): PptxResult;
//# sourceMappingURL=documentToPptx.d.ts.map