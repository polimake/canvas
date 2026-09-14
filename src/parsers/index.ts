export { parsePsd } from './psd';
export { parsePptx } from './pptx';
export { parseIllustrator } from './illustrator';
export type { PdfAdapter, IllustratorParseOptions } from './illustrator';
export { createPdfJsAdapter } from './pdfjs';
export type { PdfJsEngine, PdfPage, PdfTextItem, PdfJsAdapterOptions } from './pdfjs';
export { DocumentImportError } from '../documents/model';
export type { ParseLimits, ImportDocument, DocumentPage, DocumentElement, DocumentAsset, ImportNote } from '../documents/model';
export type { PsdDocument, PsdLayer } from '../documents/psd';

import { DocumentImportError, readBytes, type ImportDocument, type ParseLimits } from '../documents/model';
import { parsePsd } from './psd';
import { parsePptx } from './pptx';
import { parseIllustrator, type PdfAdapter } from './illustrator';
import type { PsdDocument } from '../documents/psd';

export type ParsedFile = { format: 'psd' | 'psb'; document: PsdDocument } | { format: 'pptx' | 'ai'; document: ImportDocument };

/** Honest capability metadata for a host's file picker. No UI dependency. */
export const IMPORT_FORMATS = [
  { extension: 'psd', support: 'native', detail: 'Structure and compressed channels; raster assets require host decoding/upload.' },
  { extension: 'psb', support: 'native', detail: 'Large Photoshop structure subject to configured limits.' },
  { extension: 'pptx', support: 'partial', detail: 'Direct text, shapes, images and notes; master/theme features are reported.' },
  { extension: 'ai', support: 'adapter', detail: 'PDF-compatible AI via PDF adapter; native Illustrator editing is not preserved.' },
  { extension: 'ppt', support: 'external-conversion', detail: 'Convert binary PowerPoint to PPTX before parsing.' },
] as const;

export async function parseFile(input: Uint8Array | ArrayBuffer, options: ParseLimits & { fileName: string; pdf?: PdfAdapter }): Promise<ParsedFile> {
  const bytes = readBytes(input, options);
  const extension = options.fileName.split('.').pop()?.toLowerCase();
  if (extension === 'psd' || extension === 'psb') {
    const document = parsePsd(bytes, options);
    return { format: bytes[5] === 2 ? 'psb' : 'psd', document };
  }
  if (extension === 'pptx') return { format: 'pptx', document: parsePptx(bytes, options) };
  if (extension === 'ai') return { format: 'ai', document: await parseIllustrator(bytes, options) };
  throw new DocumentImportError('unsupported-format', extension === 'ppt' ? 'Binary .ppt is not supported. Convert to .pptx first.' : `Unsupported extension: ${extension ?? '(none)'}`);
}
