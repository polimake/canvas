import type { ImportDocument } from '../documents/model';
import type { PsdDocument } from '../documents/psd';
export interface IndexedPage {
    id: string;
    name: string;
    text: string;
    elementCount: number;
}
export interface DocumentIndex {
    version: 1;
    pages: IndexedPage[];
    text: string;
    fonts: string[];
    assetIds: string[];
    tokens: string[];
}
/** Index source content without converting it or mounting an editor. No asset bytes. */
export declare function indexDocument(document: ImportDocument): DocumentIndex;
export interface IndexableElement {
    id: string;
    type: string;
    name?: string;
    text?: string;
    frameId?: string | null;
    isDeleted?: boolean;
    fileId?: string | null;
    fontFamily?: string | number;
    x?: number;
}
/** Serializable scene indexing; excludes deleted elements and retains unframed text. */
export declare function indexScene(scene: {
    elements?: readonly IndexableElement[];
}): DocumentIndex;
/** PSD structure only; raw raster channels never enter the search index. */
export declare function indexPsd(document: PsdDocument, options?: {
    includeHidden?: boolean;
}): DocumentIndex;
/** Returns matching pages, using accent-insensitive AND matching. */
export declare function searchDocument(indexed: DocumentIndex, query: string): IndexedPage[];
//# sourceMappingURL=index.d.ts.map