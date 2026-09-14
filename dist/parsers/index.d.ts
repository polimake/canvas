export { parsePsd } from './psd';
export { parsePptx } from './pptx';
export { parseIllustrator } from './illustrator';
export type { PdfAdapter, IllustratorParseOptions } from './illustrator';
export { createPdfJsAdapter } from './pdfjs';
export type { PdfJsEngine, PdfPage, PdfTextItem, PdfJsAdapterOptions } from './pdfjs';
export { DocumentImportError } from '../documents/model';
export type { ParseLimits, ImportDocument, DocumentPage, DocumentElement, DocumentAsset, ImportNote } from '../documents/model';
export type { PsdDocument, PsdLayer } from '../documents/psd';
import { type ImportDocument, type ParseLimits } from '../documents/model';
import { type PdfAdapter } from './illustrator';
import type { PsdDocument } from '../documents/psd';
export type ParsedFile = {
    format: 'psd' | 'psb';
    document: PsdDocument;
} | {
    format: 'pptx' | 'ai';
    document: ImportDocument;
};
/** Honest capability metadata for a host's file picker. No UI dependency. */
export declare const IMPORT_FORMATS: readonly [{
    readonly extension: "psd";
    readonly support: "native";
    readonly detail: "Structure and compressed channels; raster assets require host decoding/upload.";
}, {
    readonly extension: "psb";
    readonly support: "native";
    readonly detail: "Large Photoshop structure subject to configured limits.";
}, {
    readonly extension: "pptx";
    readonly support: "partial";
    readonly detail: "Direct text, shapes, images and notes; master/theme features are reported.";
}, {
    readonly extension: "ai";
    readonly support: "adapter";
    readonly detail: "PDF-compatible AI via PDF adapter; native Illustrator editing is not preserved.";
}, {
    readonly extension: "ppt";
    readonly support: "external-conversion";
    readonly detail: "Convert binary PowerPoint to PPTX before parsing.";
}];
export declare function parseFile(input: Uint8Array | ArrayBuffer, options: ParseLimits & {
    fileName: string;
    pdf?: PdfAdapter;
}): Promise<ParsedFile>;
//# sourceMappingURL=index.d.ts.map