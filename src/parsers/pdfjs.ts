import { DocumentImportError, type ImportDocument, type ParseLimits } from '../documents/model';
import type { PdfAdapter } from './illustrator';

/** Structural PDF.js API: inject the runtime appropriate to Node or the browser. */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}
export interface PdfPage {
  getViewport(options: { scale: number }): { width: number; height: number; transform: number[] };
  getTextContent(): Promise<{ items: unknown[]; styles: Record<string, { fontFamily?: string }> }>;
  cleanup(): void;
}
export interface PdfJsEngine<Page extends PdfPage = PdfPage> {
  getDocument(options: { data: Uint8Array; isEvalSupported: boolean; useSystemFonts: boolean }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<Page> }>;
    destroy(): Promise<void>;
  };
}
export interface PdfJsAdapterOptions<Page extends PdfPage = PdfPage> {
  /** Optional rasterizer, owned by the host (PDF.js page.render + canvas/offscreen). */
  renderPage?: (page: Page, pageNumber: number) => Promise<{ bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' }>;
}

/** Extracts text without a DOM; with renderPage, preserves page appearance as an image. */
export function createPdfJsAdapter<Page extends PdfPage>(engine: PdfJsEngine<Page>, options: PdfJsAdapterOptions<Page> = {}): PdfAdapter {
  return { async read(bytes: Uint8Array, limits: ParseLimits): Promise<ImportDocument> {
    // PDF.js can transfer ownership; keep the caller's byte array intact.
    const task = engine.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > (limits.maxPages ?? 500)) throw new DocumentImportError('limit-exceeded', 'PDF exceeds maxPages.');
      const document: ImportDocument = { format: 'pdf', pages: [], assets: [], warnings: [] };
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        try {
          const viewport = page.getViewport({ scale: 96 / 72 });
          const content = await page.getTextContent();
          const items = content.items.filter((i): i is PdfTextItem => !!i && typeof i === 'object' && 'str' in i && 'transform' in i);
          const pageId = `page-${n}`;
          const parsed = { id: pageId, name: `Page ${n}`, width: viewport.width, height: viewport.height,
            extractedText: items.map(i => i.str).join('\n'), elements: [] as ImportDocument['pages'][number]['elements'] };
          if (options.renderPage) {
            const image = await options.renderPage(page, n);
            const assetId = `page-${n}-preview`;
            document.assets.push({ id: assetId, name: `${assetId}.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`, ...image });
            parsed.elements.push({ id: `${pageId}-image`, kind: 'image', x: 0, y: 0, width: viewport.width, height: viewport.height, assetId });
            document.warnings.push({ code: 'flattened-page', message: 'Page artwork is a raster preview; text remains searchable but is not independently editable.', pageId });
          } else {
            const [a, b, c, d, e, f] = viewport.transform;
            items.forEach((item, index) => {
              const x = a * item.transform[4] + c * item.transform[5] + e;
              const baseline = b * item.transform[4] + d * item.transform[5] + f;
              const size = Math.max(1, Math.hypot(item.transform[2], item.transform[3]) * 96 / 72);
              parsed.elements.push({ id: `${pageId}-text-${index}`, kind: 'text', x, y: baseline - size,
                width: Math.max(1, item.width * 96 / 72), height: Math.max(size, item.height * 96 / 72),
                text: item.str, fontSize: size, fontFamily: content.styles[item.fontName]?.fontFamily });
            });
            document.warnings.push({ code: 'text-only', message: 'Only text and approximate boxes were extracted. Supply renderPage for page artwork; vector paths, images, rotation and styling are not reconstructed.', pageId });
          }
          document.pages.push(parsed);
        } finally { page.cleanup(); }
      }
      return document;
    } finally { await task.destroy(); }
  } };
}
