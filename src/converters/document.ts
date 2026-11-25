import type { SceneElement } from '../core/excal';
import { PAGE_GAP } from '../core/layout';
import { customFontFamilyId, type CustomFontFace } from '../core/fonts';
import { estimateTextHeight, type DocumentElement, type ImportDocument, type ImportNote } from '../documents/model';
import { PAGE_MARKER, SLIDE_NOTES_KEY, SLIDE_SKIP_KEY, SLIDE_TRANSITION_KEY } from '../core/pageModel';

export interface UploadedAsset { url: string; mimeType: string }
export interface DocumentScene {
  elements: SceneElement[];
  files: Record<string, { id: string; dataURL: string; mimeType: string; created: number }>;
  fonts: CustomFontFace[];
  warnings: ImportNote[];
  pendingAssetIds: string[];
}

const ROUNDNESS_ADAPTIVE = 3;
const AVERAGE_GLYPH_WIDTH = 0.5;
const MAX_ONE_LINE_OVERFLOW = 1.4;

/** Where a text goes inside its box. Without layout data, the box itself. */
function textPlacement(source: DocumentElement, fontSize: number, lineHeight: number) {
  if (!source.inset && !source.verticalAlign) return { x: source.x, y: source.y, width: source.width, height: source.height, autoResize: false };
  const inset = source.inset ?? { left: 0, top: 0, right: 0, bottom: 0 };
  const width = Math.max(1, source.width - inset.left - inset.right), room = source.height - inset.top - inset.bottom;
  const height = estimateTextHeight(source.text ?? '', fontSize, lineHeight, width);
  const offset = source.verticalAlign === 'middle' ? (room - height) / 2 : source.verticalAlign === 'bottom' ? room - height : 0;
  // With a replacement font a one-line text may not fit: if its box had no room for more
  // lines than paragraphs, it grows sideways instead of wrapping over what lies below.
  // A text clearly longer than its box was meant to wrap, whatever the box height says.
  const paragraphs = (source.text ?? '').split('\n');
  const fitsOneLine = Math.max(...paragraphs.map(line => line.length)) * fontSize * AVERAGE_GLYPH_WIDTH <= width * MAX_ONE_LINE_OVERFLOW;
  const autoResize = fitsOneLine && paragraphs.length >= Math.round(room / (fontSize * lineHeight));
  return { x: source.x + inset.left, y: source.y + inset.top + offset, width, height, autoResize };
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
  document.pages.forEach((page, pageIndex) => {
    // El marco lleva el orden del documento y, como diapositiva, sus notas, si
    // se salta y su transición (pageModel.ts): lo que el espacio Presentación
    // lee y lo que `documentToPptx` vuelve a escribir.
    const customData: Record<string, unknown> = { [PAGE_MARKER]: { index: pageIndex } };
    if (page.notes?.trim()) customData[SLIDE_NOTES_KEY] = page.notes.replace(/\s+$/, '');
    if (page.hidden) customData[SLIDE_SKIP_KEY] = true;
    if (page.transition === 'fade') customData[SLIDE_TRANSITION_KEY] = 'fade';
    const frame = base({ type: 'frame', x: xOffset, width: page.width, height: page.height, name: page.name, customData });
    result.elements.push(frame, base({ x: xOffset, width: page.width, height: page.height, frameId: frame.id,
      backgroundColor: page.background ?? '#ffffff', locked: true, customData: { c2: 'pageBackground' } }));
    for (const source of page.elements) {
      const common = { x: xOffset + source.x, y: source.y, width: source.width, height: source.height,
        frameId: frame.id, angle: (source.rotation ?? 0) * Math.PI / 180, groupIds: source.groupIds ?? [],
        opacity: source.opacity ?? 100, strokeStyle: source.strokeStyle ?? 'solid',
        roundness: source.rounded ? { type: ROUNDNESS_ADAPTIVE } : null,
        backgroundColor: source.fill ?? 'transparent', strokeColor: source.stroke ?? 'transparent', strokeWidth: source.strokeWidth ?? 1,
        customData: { sourceId: source.id, sourceFormat: document.format } };
      if (source.kind === 'text') {
        const font = result.fonts.find(f => f.family === source.fontFamily);
        if (source.fontFamily && !font) result.warnings.push({ code: 'unresolved-font', message: `Font ${source.fontFamily} uses a fallback until supplied by the host.`, pageId: page.id, elementId: source.id });
        const fontSize = source.fontSize ?? 24, lineHeight = source.lineHeight ?? 1.25;
        const placed = textPlacement(source, fontSize, lineHeight);
        const text = source.inset ? (source.text ?? '').trimEnd() : source.text ?? '';
        result.elements.push(base({ ...common, ...placed, x: xOffset + placed.x, type: 'text', text, originalText: text,
          fontSize, fontFamily: font ? customFontFamilyId(font.family) : 2,
          textAlign: source.textAlign ?? 'left', verticalAlign: 'top', containerId: null, lineHeight,
          backgroundColor: 'transparent', strokeColor: source.color ?? '#1a1a1a' }));
      } else if (source.kind === 'line') {
        const points = source.points ?? [[0, 0], [source.width, source.height]];
        const [first, last] = [points[0], points[points.length - 1]];
        result.elements.push(base({ ...common, type: source.arrowStart || source.arrowEnd ? 'arrow' : 'line', points,
          polygon: points.length > 2 && first[0] === last[0] && first[1] === last[1],
          lastCommittedPoint: null, startBinding: null, endBinding: null,
          startArrowhead: source.arrowStart ? 'arrow' : null, endArrowhead: source.arrowEnd ? 'arrow' : null }));
      } else if (source.kind === 'image') {
        const asset = source.assetId ? options.assets?.[source.assetId] : undefined;
        if (asset && /^https?:\/\//i.test(asset.url)) {
          const fileId = `${prefix}-asset-${source.assetId}`;
          result.files[fileId] = { id: fileId, dataURL: asset.url, mimeType: asset.mimeType, created: 0 };
          const natural = document.assets.find(item => item.id === source.assetId);
          const crop = source.crop && natural?.width && natural.height ? {
            x: source.crop.left * natural.width, y: source.crop.top * natural.height,
            width: natural.width * (1 - source.crop.left - source.crop.right), height: natural.height * (1 - source.crop.top - source.crop.bottom),
            naturalWidth: natural.width, naturalHeight: natural.height,
          } : null;
          result.elements.push(base({ ...common, type: 'image', fileId, status: 'saved', scale: [source.flipH ? -1 : 1, source.flipV ? -1 : 1], crop }));
        } else {
          if (source.assetId && !result.pendingAssetIds.includes(source.assetId)) result.pendingAssetIds.push(source.assetId);
          result.elements.push(base({ ...common, backgroundColor: '#e9ecef', strokeColor: '#adb5bd',
            customData: { ...common.customData, c2: 'importAsset', assetId: source.assetId } }));
          result.warnings.push({ code: 'asset-upload-required', message: 'Image remains a placeholder until a persistent HTTP(S) asset URL is supplied.', pageId: page.id, elementId: source.id });
        }
      } else result.elements.push(base({ ...common, type: source.kind }));
    }
    xOffset += page.width + PAGE_GAP;
  });
  return result;
}
