import { readPsd } from 'ag-psd';
import type { PsdDocument } from '../documents/psd';
import { DocumentImportError, readBytes, type ParseLimits } from '../documents/model';

/** Reads PSD/PSB structure and compressed raster channels without a DOM/canvas. */
export function parsePsd(input: Uint8Array | ArrayBuffer, limits: ParseLimits = {}): PsdDocument {
  const bytes = readBytes(input, limits);
  if (bytes.length < 26 || new TextDecoder().decode(bytes.subarray(0, 4)) !== '8BPS' ||
      bytes[4] !== 0 || (bytes[5] !== 1 && bytes[5] !== 2)) {
    throw new DocumentImportError('invalid-file', 'Expected a PSD or PSB header.');
  }
  try {
    return readPsd(bytes, {
      useRawData: true,
      skipThumbnail: true,
      skipLinkedFilesData: true,
      skipCompositeImageData: true,
      totalMemoryLimit: limits.maxExpandedBytes ?? 128 * 1024 * 1024,
    }) as PsdDocument;
  } catch (error) {
    throw new DocumentImportError('invalid-file', `Cannot read Photoshop document: ${error instanceof Error ? error.message : String(error)}`);
  }
}
