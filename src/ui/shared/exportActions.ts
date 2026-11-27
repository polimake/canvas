import type { ExcalidrawImperativeAPI } from '../../core/excal';
import { listPages, type PageInfo } from '../../core/pages';
import { exportScenePng, exportSceneSvg, exportScenePdf, downloadBlob } from '../../core/export';
import { elementosParaExportar } from '../../core/recortes';
import type { FilesMap } from '../hooks/pageThumbnails';
import type { SvgFontFace } from '../../core/svgFonts';
import { fontFamilyName } from '../../core/fontRegistry';
import { sceneToDocument, type SceneFile } from '../../converters/sceneToDocument';
import { documentToPptx } from '../../converters/documentToPptx';

/**
 * Exportar desde el editor. Lo usan el menú ☰ (CanvasMenu) y Archivo ›
 * Descargar del espacio Presentación: un solo camino, con la misma hidratación
 * de imágenes y las mismas fuentes embebidas.
 */
export type ExportKind = 'png' | 'png-all' | 'svg' | 'pdf' | 'pptx' | 'potx';

export interface ExportContext {
  activePageId?: string | null;
  /**
   * Trae el mapa de ficheros hidratado justo antes de exportar (ver
   * `CanvasMenuProps.hydrateFiles`): con imágenes remotas el canvas queda
   * contaminado y `toBlob` muere con SecurityError.
   */
  hydrateFiles?: (opts?: { output?: 'blob' | 'dataurl' }) => Promise<FilesMap>;
  /** Tipografías de la marca, para embeberlas en el SVG (svgFonts.ts). */
  fontFaces?: readonly SvgFontFace[];
  /** Nombre de serie del fichero cuando la página no da uno. */
  fallbackName: string;
  /** Los nombres de las páginas sin nombre (labels.pages). */
  pageNames?: Parameters<typeof listPages>[1];
  /** Nombre de la presentación (PowerPoint): título del documento y del fichero. */
  title?: string;
  /** Idioma de los textos en PowerPoint (`es-ES`). */
  lang?: string;
}

/** Formatos de imagen que PowerPoint abre tal cual; el resto se pasa a PNG. */
const OFFICE_IMAGES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']);

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Una imagen (WebP, SVG, AVIF…) dibujada a PNG en el navegador. */
async function rasterToPng(dataURL: string): Promise<string | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = dataURL;
  try { await img.decode(); } catch { return null; }
  const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/**
 * Los ficheros de la escena con sus BYTES dentro (`data:`) y en un formato que
 * PowerPoint abre: lo que trae el host hidratado; lo que siga siendo una URL se
 * descarga (si el servidor lo permite) y lo que no sea PNG/JPEG/GIF/BMP se pasa
 * a PNG. Una imagen que no se puede traer se queda fuera con aviso
 * (`sceneToDocument`), sin parar la exportación.
 */
async function officeFiles(source: Record<string, SceneFile>): Promise<Record<string, SceneFile>> {
  const out: Record<string, SceneFile> = {};
  await Promise.all(Object.entries(source).map(async ([id, file]) => {
    let dataURL = file.dataURL;
    try {
      if (dataURL && !dataURL.startsWith('data:')) dataURL = await blobToDataUrl(await (await fetch(dataURL)).blob());
      const mime = /^data:([^;,]+)/.exec(dataURL ?? '')?.[1]?.toLowerCase();
      if (dataURL && mime && !OFFICE_IMAGES.has(mime)) dataURL = (await rasterToPng(dataURL)) ?? undefined;
    } catch (err) {
      console.warn('[canvas2] PowerPoint: imagen sin traer', id, err);
      dataURL = undefined;
    }
    out[id] = { ...file, dataURL, mimeType: dataURL ? /^data:([^;,]+)/.exec(dataURL)?.[1] : file.mimeType };
  }));
  return out;
}

/** `fallback` es el nombre de serie, para cuando la página no da uno. */
export function safeFilename(name: string | undefined, fallback: string): string {
  return (name || fallback).replace(/[\\/:*?"<>|]+/g, '-').trim() || fallback;
}

export async function runCanvasExport(
  api: ExcalidrawImperativeAPI,
  kind: ExportKind,
  ctx: ExportContext,
): Promise<void> {
  const pages: PageInfo[] = listPages(api, ctx.pageNames);
  const activePage = pages.find((p) => p.id === ctx.activePageId) ?? null;
  const base = safeFilename(activePage?.name, ctx.fallbackName);
  // Los bytes de las imágenes remotas, traídos por el host. Sin esto el canvas
  // está contaminado y cualquier rasterizado muere. El SVG necesita los bytes en
  // base64: van DENTRO del fichero, y un `blob:` moriría con la pestaña. El
  // resto rasteriza en un canvas, donde un `blob:` vale igual y sale más barato.
  const office = kind === 'pptx' || kind === 'potx';
  const files = ctx.hydrateFiles
    ? await ctx.hydrateFiles(kind === 'svg' || office ? { output: 'dataurl' } : undefined)
    : undefined;
  // El host puede dar otra imagen de la misma foto (el original en vez de la
  // vista previa): los recortes, a su tamaño (`recortes.ts`).
  const elements = files ? await elementosParaExportar(api.getSceneElements(), files as never) : undefined;
  const pageId = ctx.activePageId ?? undefined;
  if (kind === 'png') {
    downloadBlob(await exportScenePng(api, { pageId, files, elements }), `${base}.png`);
  } else if (kind === 'png-all') {
    for (const page of pages) {
      downloadBlob(
        await exportScenePng(api, { pageId: page.id, files, elements }),
        `${safeFilename(page.name, ctx.fallbackName)}.png`,
      );
    }
  } else if (kind === 'svg') {
    const svg = await exportSceneSvg(api, {
      pageId,
      files,
      elements,
      fontFaces: ctx.fontFaces,
      // Google sirve las fuentes con CORS abierto, así que un `fetch` normal
      // basta. Si falla, la fuente se queda por URL y el SVG se sigue viendo
      // bien donde haya red.
      fontFetcher: (url) => fetch(url).then((r) => r.blob()),
    });
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    downloadBlob(blob, `${base}.svg`);
  } else if (office) {
    // Escena → documento → PowerPoint: las mismas piezas que importar, al revés.
    const sceneFiles = await officeFiles((files ?? api.getFiles()) as unknown as Record<string, SceneFile>);
    const doc = sceneToDocument(elements ?? api.getSceneElements(), sceneFiles, { fontName: fontFamilyName });
    const title = ctx.title?.trim() || pages[0]?.name || ctx.fallbackName;
    const out = documentToPptx(doc, { template: kind === 'potx', title, lang: ctx.lang });
    if (out.warnings.length) console.info('[canvas2] PowerPoint: avisos', out.warnings);
    // `slice()`: un ArrayBuffer propio para el Blob (el de fflate puede ser compartido).
    downloadBlob(new Blob([out.bytes.slice()], { type: out.mimeType }), `${safeFilename(title, ctx.fallbackName)}.${out.extension}`);
  } else {
    downloadBlob(
      await exportScenePdf(api, { files, elements }),
      `${safeFilename(pages[0]?.name, ctx.fallbackName)}.pdf`,
    );
  }
}
