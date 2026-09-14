/** Portable import model: data only, independent of React and Excalidraw. */
export type DocumentFormat = 'pptx' | 'ai' | 'pdf';
export interface ImportNote {
    code: string;
    message: string;
    pageId?: string;
    elementId?: string;
}
export interface DocumentElement {
    id: string;
    kind: 'text' | 'rectangle' | 'ellipse' | 'image';
    name?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Degrees clockwise. */
    rotation?: number;
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    assetId?: string;
}
export interface DocumentPage {
    id: string;
    name: string;
    width: number;
    height: number;
    background?: string;
    elements: DocumentElement[];
    notes?: string;
    /** Searchable source text when the page is represented by a rendered preview. */
    extractedText?: string;
}
export interface DocumentAsset {
    id: string;
    name: string;
    mimeType: string;
    /** Original bytes; upload separately. Never embedded into the scene JSON. */
    bytes: Uint8Array;
}
export interface ImportDocument {
    format: DocumentFormat;
    pages: DocumentPage[];
    assets: DocumentAsset[];
    warnings: ImportNote[];
}
export interface ParseLimits {
    maxFileBytes?: number;
    maxExpandedBytes?: number;
    maxEntries?: number;
    maxPages?: number;
}
export declare class DocumentImportError extends Error {
    readonly code: 'unsupported-format' | 'invalid-file' | 'limit-exceeded' | 'adapter-required';
    constructor(code: 'unsupported-format' | 'invalid-file' | 'limit-exceeded' | 'adapter-required', message: string);
}
export declare function readBytes(input: Uint8Array | ArrayBuffer, limits?: ParseLimits): Uint8Array;
//# sourceMappingURL=model.d.ts.map