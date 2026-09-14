import { DocumentImportError, readBytes, type ImportDocument, type ParseLimits } from '../documents/model';

/** Runtime-specific PDF engine. The package never executes Illustrator/PostScript. */
export interface PdfAdapter {
  read(bytes: Uint8Array, limits: ParseLimits): Promise<ImportDocument>;
}

export interface IllustratorParseOptions extends ParseLimits { pdf?: PdfAdapter }

/** Modern PDF-compatible AI only; old PostScript AI requires an external conversion. */
export async function parseIllustrator(input: Uint8Array | ArrayBuffer, options: IllustratorParseOptions = {}): Promise<ImportDocument> {
  const bytes = readBytes(input, options);
  const header = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (!header.startsWith('%PDF-')) {
    throw new DocumentImportError('unsupported-format', 'This AI file has no PDF header. Re-save with Create PDF Compatible File, or convert it externally to PDF/SVG.');
  }
  if (!options.pdf) throw new DocumentImportError('adapter-required', 'PDF-compatible AI requires a PDF adapter; use createPdfJsAdapter with your PDF.js runtime.');
  const document = await options.pdf.read(bytes, options);
  return { ...document, format: 'ai', warnings: [...document.warnings, {
    code: 'illustrator-pdf', message: 'Imported the PDF representation. Illustrator layers, effects and native paths are not reconstructed.',
  }] };
}
