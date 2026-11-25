import type { SceneElement } from '../core/excal';
import { framesInDocumentOrder, isPageBackground, isSkippedFrame, notesOf, transitionOf } from '../core/pageModel';
import type { DocumentAsset, DocumentElement, DocumentPage, ImportDocument, ImportNote } from '../documents/model';

/**
 * Escena → modelo de documento: lo inverso de `documentToScene`.
 *
 * Es el primer paso para exportar a un formato de oficina (`documentToPptx`):
 * cada página es una diapositiva, con su fondo, sus notas, si se salta y su
 * transición. Puro: ni Excalidraw ni DOM. Las imágenes tienen que llegar con
 * sus bytes (`files` con `data:`), que es lo que hidrata el host antes de
 * exportar; una imagen sin bytes no se inventa: se avisa y se queda fuera.
 */

/** Lo que Excalidraw guarda de un fichero de imagen. */
export interface SceneFile {
  id?: string;
  dataURL?: string;
  mimeType?: string;
}

export interface SceneToDocumentOptions {
  /**
   * Nombre de familia de un `fontFamily` numérico de la escena. Las familias
   * propias llevan un id derivado de su nombre (`customFontFamilyId`); quien
   * tiene el registro (el editor) lo resuelve. Sin respuesta, las de serie de
   * Excalidraw y, si no, ninguna: la aplicación de destino pone la suya.
   */
  fontName?: (id: number) => string | undefined;
  /** Tamaño natural de una imagen (para el recorte), por id de fichero. */
  imageSize?: (fileId: string) => { width: number; height: number } | undefined;
}

/** Las familias de serie de Excalidraw 0.18 por id (fonts.ts guarda los nombres). */
const BUILTIN_FONTS: Record<number, string> = {
  1: 'Virgil', 2: 'Helvetica', 3: 'Cascadia', 5: 'Excalifont', 6: 'Nunito', 7: 'Lilita One', 8: 'Comic Shanns', 9: 'Liberation Sans',
};
/** Sufijo con el que se registra una fuente de marca que choca con una de serie (fonts.ts). */
const BRAND_ALIAS = / \(marca\)$/;

type Loose = SceneElement & Record<string, unknown>;

const transparent = (color: unknown) =>
  typeof color !== 'string' || !color || color === 'transparent' || /^#[0-9a-f]{6}00$/i.test(color);

function strokeStyleOf(el: Loose): DocumentElement['strokeStyle'] {
  return el.strokeStyle === 'dashed' || el.strokeStyle === 'dotted' ? el.strokeStyle : 'solid';
}

/** Bytes de un `data:` URL (base64 o texto). */
export function dataUrlBytes(dataURL: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;,]+)?((?:;[^;,]*)*?)(;base64)?,(.*)$/s.exec(dataURL);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const payload = match[4];
  if (match[3]) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mimeType };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeType };
}

export function sceneToDocument(
  elements: readonly SceneElement[],
  files: Readonly<Record<string, SceneFile>>,
  options: SceneToDocumentOptions = {},
): ImportDocument {
  const warnings: ImportNote[] = [];
  const assets: DocumentAsset[] = [];
  const assetIds = new Set<string>();
  const live = elements.filter((e) => !e.isDeleted) as Loose[];
  const fontName = (id: unknown): string | undefined => {
    if (typeof id !== 'number') return undefined;
    const name = options.fontName?.(id) ?? BUILTIN_FONTS[id];
    return name?.replace(BRAND_ALIAS, '');
  };

  const pages: DocumentPage[] = framesInDocumentOrder(live as readonly SceneElement[]).map((frame, index) => {
    const f = frame as unknown as Loose;
    const page: DocumentPage = {
      id: frame.id,
      name: typeof f.name === 'string' && f.name ? f.name : `${index + 1}`,
      width: frame.width,
      height: frame.height,
      elements: [],
    };
    const notes = notesOf(f as never);
    if (notes) page.notes = notes;
    if (isSkippedFrame(f as never)) page.hidden = true;
    if (transitionOf(f as never) === 'fade') page.transition = 'fade';

    for (const el of live) {
      if (el.frameId !== frame.id) continue;
      if (isPageBackground(el)) {
        if (!transparent(el.backgroundColor)) page.background = el.backgroundColor as string;
        continue;
      }
      const converted = convert(el, frame.x, frame.y, page.id);
      if (converted) page.elements.push(converted);
    }
    return page;
  });

  const loose = live.filter((e) => e.type !== 'frame' && !e.frameId && !isPageBackground(e));
  if (loose.length) warnings.push({ code: 'outside-pages', message: `${loose.length} elements outside every page are not exported.` });

  return { format: 'pptx', pages, assets, warnings };

  function convert(el: Loose, ox: number, oy: number, pageId: string): DocumentElement | null {
    const common: DocumentElement = {
      id: el.id,
      kind: 'rectangle',
      x: el.x - ox,
      y: el.y - oy,
      width: el.width,
      height: el.height,
      rotation: el.angle ? (el.angle * 180) / Math.PI : undefined,
      opacity: typeof el.opacity === 'number' && el.opacity < 100 ? el.opacity : undefined,
      groupIds: Array.isArray(el.groupIds) && el.groupIds.length ? (el.groupIds as string[]) : undefined,
    };
    switch (el.type) {
      case 'rectangle':
      case 'ellipse':
      case 'diamond':
        return {
          ...common,
          kind: el.type,
          fill: transparent(el.backgroundColor) ? undefined : (el.backgroundColor as string),
          stroke: transparent(el.strokeColor) ? undefined : (el.strokeColor as string),
          strokeWidth: typeof el.strokeWidth === 'number' ? el.strokeWidth : undefined,
          strokeStyle: strokeStyleOf(el),
          rounded: Boolean(el.roundness) || undefined,
        };
      case 'text': {
        const text = typeof el.originalText === 'string' && el.originalText ? el.originalText : String(el.text ?? '');
        if (!text.trim()) return null;
        return {
          ...common,
          kind: 'text',
          text,
          fontFamily: fontName(el.fontFamily),
          fontSize: typeof el.fontSize === 'number' ? el.fontSize : 20,
          color: transparent(el.strokeColor) ? undefined : (el.strokeColor as string),
          textAlign: el.textAlign === 'center' || el.textAlign === 'right' ? el.textAlign : 'left',
          verticalAlign: el.verticalAlign === 'middle' ? 'middle' : el.verticalAlign === 'bottom' ? 'bottom' : 'top',
          lineHeight: typeof el.lineHeight === 'number' ? el.lineHeight : 1.25,
        };
      }
      case 'line':
      case 'arrow':
      case 'freedraw': {
        const points = (Array.isArray(el.points) ? el.points : []) as [number, number][];
        if (points.length < 2) return null;
        if (el.roundness && el.type !== 'freedraw') {
          warnings.push({ code: 'curve-approximated', message: 'Curved lines are exported as straight segments.', pageId, elementId: el.id });
        }
        const closed = el.type === 'line' && (el.polygon === true || (points.length > 2 &&
          points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]));
        return {
          ...common,
          kind: 'line',
          points: points.map(([x, y]) => [x, y]),
          stroke: transparent(el.strokeColor) ? undefined : (el.strokeColor as string),
          strokeWidth: typeof el.strokeWidth === 'number' ? el.strokeWidth : undefined,
          strokeStyle: strokeStyleOf(el),
          fill: closed && !transparent(el.backgroundColor) ? (el.backgroundColor as string) : undefined,
          arrowStart: el.type === 'arrow' && Boolean(el.startArrowhead) ? true : undefined,
          arrowEnd: el.type === 'arrow' && Boolean(el.endArrowhead) ? true : undefined,
        };
      }
      case 'image': {
        const fileId = typeof el.fileId === 'string' ? el.fileId : '';
        const file = files[fileId];
        const decoded = file?.dataURL ? dataUrlBytes(file.dataURL) : null;
        if (!decoded) {
          warnings.push({ code: 'image-unavailable', message: 'An image without its bytes is left out.', pageId, elementId: el.id });
          return null;
        }
        if (!assetIds.has(fileId)) {
          assetIds.add(fileId);
          const size = options.imageSize?.(fileId);
          assets.push({ id: fileId, name: fileId, mimeType: file?.mimeType || decoded.mimeType, bytes: decoded.bytes, ...size });
        }
        const scale = Array.isArray(el.scale) ? (el.scale as [number, number]) : [1, 1];
        const crop = el.crop as { x: number; y: number; width: number; height: number; naturalWidth: number; naturalHeight: number } | null | undefined;
        return {
          ...common,
          kind: 'image',
          assetId: fileId,
          flipH: scale[0] < 0 || undefined,
          flipV: scale[1] < 0 || undefined,
          crop: crop && crop.naturalWidth > 0 && crop.naturalHeight > 0 ? {
            left: crop.x / crop.naturalWidth,
            top: crop.y / crop.naturalHeight,
            right: 1 - (crop.x + crop.width) / crop.naturalWidth,
            bottom: 1 - (crop.y + crop.height) / crop.naturalHeight,
          } : undefined,
        };
      }
      default:
        warnings.push({ code: 'unsupported-element', message: `Element ${String(el.type)} is not exported.`, pageId, elementId: el.id });
        return null;
    }
  }
}
