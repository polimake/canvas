import { type ImportDocument, type ParseLimits } from '../documents/model';
/** Runtime-specific PDF engine. The package never executes Illustrator/PostScript. */
export interface PdfAdapter {
    read(bytes: Uint8Array, limits: ParseLimits): Promise<ImportDocument>;
}
export interface IllustratorParseOptions extends ParseLimits {
    pdf?: PdfAdapter;
}
/** Modern PDF-compatible AI only; old PostScript AI requires an external conversion. */
export declare function parseIllustrator(input: Uint8Array | ArrayBuffer, options?: IllustratorParseOptions): Promise<ImportDocument>;
//# sourceMappingURL=illustrator.d.ts.map