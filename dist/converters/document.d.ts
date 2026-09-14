import type { SceneElement } from '../core/excal';
import { type CustomFontFace } from '../core/fonts';
import type { ImportDocument, ImportNote } from '../documents/model';
export interface UploadedAsset {
    url: string;
    mimeType: string;
}
export interface DocumentScene {
    elements: SceneElement[];
    files: Record<string, {
        id: string;
        dataURL: string;
        mimeType: string;
        created: number;
    }>;
    fonts: CustomFontFace[];
    warnings: ImportNote[];
    pendingAssetIds: string[];
}
/** Pure conversion. Byte decoding and asset uploads happen before this call. */
export declare function documentToScene(document: ImportDocument, options?: {
    assets?: Record<string, UploadedAsset>;
    fonts?: CustomFontFace[];
    /** Prefix avoids collisions when importing several documents into one scene. */
    idPrefix?: string;
}): DocumentScene;
//# sourceMappingURL=document.d.ts.map