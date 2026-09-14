import type { PsdDocument } from '../documents/psd';
import { type ParseLimits } from '../documents/model';
/** Reads PSD/PSB structure and compressed raster channels without a DOM/canvas. */
export declare function parsePsd(input: Uint8Array | ArrayBuffer, limits?: ParseLimits): PsdDocument;
//# sourceMappingURL=psd.d.ts.map