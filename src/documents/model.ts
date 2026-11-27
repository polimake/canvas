/** Portable import model: data only, independent of React and Excalidraw. */
export type DocumentFormat = 'pptx' | 'ai' | 'pdf';

export interface ImportNote {
  code: string;
  message: string;
  pageId?: string;
  elementId?: string;
}

export interface DocumentElement {
  id: string;
  kind: 'text' | 'rectangle' | 'ellipse' | 'diamond' | 'image' | 'line';
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise. */
  rotation?: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  /** 0–100. */
  opacity?: number;
  rounded?: boolean;
  /** Groups the element belongs to, innermost first. */
  groupIds?: string[];
  /** `line`: outline relative to x/y. Closed when the last point repeats the first. */
  points?: [number, number][];
  arrowStart?: boolean;
  arrowEnd?: boolean;
  /** Text: x/y/width/height are its box; these place the text inside it. */
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  inset?: { left: number; top: number; right: number; bottom: number };
  lineHeight?: number;
  assetId?: string;
  /** Image: fractions of the source removed from each side. */
  crop?: { left: number; top: number; right: number; bottom: number };
  flipH?: boolean;
  flipV?: boolean;
}

export interface DocumentPage {
  id: string;
  name: string;
  width: number;
  height: number;
  background?: string;
  elements: DocumentElement[];
  notes?: string;
  /** Skipped when presenting (PowerPoint `show="0"`). */
  hidden?: boolean;
  /** How the slide enters when presenting. Anything PowerPoint has beyond a fade arrives as a fade. */
  transition?: 'fade';
  /** Searchable source text when the page is represented by a rendered preview. */
  extractedText?: string;
}

export interface DocumentAsset {
  id: string;
  name: string;
  mimeType: string;
  /** Original bytes; upload separately. Never embedded into the scene JSON. */
  bytes: Uint8Array;
  width?: number;
  height?: number;
}

export interface ImportDocument {
  format: DocumentFormat;
  pages: DocumentPage[];
  assets: DocumentAsset[];
  warnings: ImportNote[];
}

/** Height a text will take, from an average glyph width: no font metrics here. */
export function estimateTextHeight(text: string, fontSize: number, lineHeight: number, width: number): number {
  const perLine = Math.max(1, width / (fontSize * 0.5));
  const lines = text.split('\n').reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / perLine)), 0);
  return lines * fontSize * lineHeight;
}

export interface ParseLimits {
  maxFileBytes?: number;
  maxExpandedBytes?: number;
  maxEntries?: number;
  maxPages?: number;
}

export class DocumentImportError extends Error {
  constructor(public readonly code: 'unsupported-format' | 'invalid-file' | 'limit-exceeded' | 'adapter-required', message: string) {
    super(message);
    this.name = 'DocumentImportError';
  }
}

export function readBytes(input: Uint8Array | ArrayBuffer, limits: ParseLimits = {}): Uint8Array {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length) throw new DocumentImportError('invalid-file', 'The file is empty.');
  if (bytes.length > (limits.maxFileBytes ?? 64 * 1024 * 1024)) {
    throw new DocumentImportError('limit-exceeded', 'The file exceeds maxFileBytes.');
  }
  return bytes;
}
