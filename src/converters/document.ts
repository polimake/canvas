import type { SceneElement } from '../core/excal';
import { PAGE_GAP } from '../core/layout';
import { customFontFamilyId, type CustomFontFace } from '../core/fonts';
import type { ImportDocument, ImportNote } from '../documents/model';

export interface UploadedAsset { url: string; mimeType: string }
export interface DocumentScene {
  elements: SceneElement[];
  files: Record<string, { id: string; dataURL: string; mimeType: string; created: number }>;
  fonts: CustomFontFace[];
  warnings: ImportNote[];
  pendingAssetIds: string[];
}

/** Pure conversion. Byte decoding and asset uploads happen before this call. */
export function documentToScene(document: ImportDocument, options: {
  assets?: Record<string, UploadedAsset>;
  fonts?: CustomFontFace[];
  /** Prefix avoids collisions when importing several documents into one scene. */
  idPrefix?: string;
} = {}): DocumentScene {
  const result: DocumentScene = { elements: [], files: {}, fonts: options.fonts ?? [], warnings: [...document.warnings], pendingAssetIds: [] };
  let serial = 0, xOffset = 0;
  const prefix = options.idPrefix ?? 'import';
  const base = (extra: Record<string, unknown>): SceneElement => ({
    id: `${prefix}-${++serial}`, type: 'rectangle', x: 0, y: 0, width: 1, height: 1,
    angle: 0, strokeColor: 'transparent', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [],
    frameId: null, roundness: null, seed: serial, version: 1, versionNonce: serial,
    isDeleted: false, boundElements: null, updated: 0, link: null, locked: false, ...extra,
  }) as unknown as SceneElement;
  for (const page of document.pages) {
    const frame = base({ type: 'frame', x: xOffset, width: page.width, height: page.height, name: page.name });
    result.elements.push(frame, base({ x: xOffset, width: page.width, height: page.height, frameId: frame.id,
      backgroundColor: page.background ?? '#ffffff', locked: true, customData: { c2: 'pageBackground' } }));
    for (const source of page.elements) {
      const common = { x: xOffset + source.x, y: source.y, width: source.width, height: source.height,
        frameId: frame.id, angle: (source.rotation ?? 0) * Math.PI / 180,
        backgroundColor: source.fill ?? 'transparent', strokeColor: source.stroke ?? 'transparent', strokeWidth: source.strokeWidth ?? 1,
        customData: { sourceId: source.id, sourceFormat: document.format } };
      if (source.kind === 'text') {
        const font = result.fonts.find(f => f.family === source.fontFamily);
        if (source.fontFamily && !font) result.warnings.push({ code: 'unresolved-font', message: `Font ${source.fontFamily} uses a fallback until supplied by the host.`, pageId: page.id, elementId: source.id });
        result.elements.push(base({ ...common, type: 'text', text: source.text ?? '', originalText: source.text ?? '',
          fontSize: source.fontSize ?? 24, fontFamily: font ? customFontFamilyId(font.family) : 2,
          textAlign: 'left', verticalAlign: 'top', containerId: null, autoResize: false, lineHeight: 1.25,
          strokeColor: source.color ?? '#1a1a1a' }));
      } else if (source.kind === 'image') {
        const asset = source.assetId ? options.assets?.[source.assetId] : undefined;
        if (asset && /^https?:\/\//i.test(asset.url)) {
          const fileId = `${prefix}-asset-${source.assetId}`;
          result.files[fileId] = { id: fileId, dataURL: asset.url, mimeType: asset.mimeType, created: 0 };
          result.elements.push(base({ ...common, type: 'image', fileId, status: 'saved', scale: [1, 1], crop: null }));
        } else {
          if (source.assetId && !result.pendingAssetIds.includes(source.assetId)) result.pendingAssetIds.push(source.assetId);
          result.elements.push(base({ ...common, backgroundColor: '#e9ecef', strokeColor: '#adb5bd',
            customData: { ...common.customData, c2: 'importAsset', assetId: source.assetId } }));
          result.warnings.push({ code: 'asset-upload-required', message: 'Image remains a placeholder until a persistent HTTP(S) asset URL is supplied.', pageId: page.id, elementId: source.id });
        }
      } else result.elements.push(base({ ...common, type: source.kind }));
    }
    xOffset += page.width + PAGE_GAP;
  }
  return result;
}
