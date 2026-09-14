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
    getViewport(options: {
        scale: number;
    }): {
        width: number;
        height: number;
        transform: number[];
    };
    getTextContent(): Promise<{
        items: unknown[];
        styles: Record<string, {
            fontFamily?: string;
        }>;
    }>;
    cleanup(): void;
}
export interface PdfJsEngine<Page extends PdfPage = PdfPage> {
    getDocument(options: {
        data: Uint8Array;
        isEvalSupported: boolean;
        useSystemFonts: boolean;
    }): {
        promise: Promise<{
            numPages: number;
            getPage(n: number): Promise<Page>;
        }>;
        destroy(): Promise<void>;
    };
}
export interface PdfJsAdapterOptions<Page extends PdfPage = PdfPage> {
    /** Optional rasterizer, owned by the host (PDF.js page.render + canvas/offscreen). */
    renderPage?: (page: Page, pageNumber: number) => Promise<{
        bytes: Uint8Array;
        mimeType: 'image/png' | 'image/jpeg';
    }>;
}
/** Extracts text without a DOM; with renderPage, preserves page appearance as an image. */
export declare function createPdfJsAdapter<Page extends PdfPage>(engine: PdfJsEngine<Page>, options?: PdfJsAdapterOptions<Page>): PdfAdapter;
//# sourceMappingURL=pdfjs.d.ts.map