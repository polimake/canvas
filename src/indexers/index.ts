import type { ImportDocument } from '../documents/model';
import type { PsdDocument, PsdLayer } from '../documents/psd';

export interface IndexedPage { id: string; name: string; text: string; elementCount: number }
export interface DocumentIndex {
  version: 1;
  pages: IndexedPage[];
  text: string;
  fonts: string[];
  assetIds: string[];
  tokens: string[];
}

function normalize(text: string): string { return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(); }
function index(pages: IndexedPage[], fonts: string[], assetIds: string[]): DocumentIndex {
  const text = pages.map(p => `${p.name}\n${p.text}`).join('\n\n');
  return { version: 1, pages, text, fonts: [...new Set(fonts)].sort(), assetIds: [...new Set(assetIds)].sort(),
    tokens: [...new Set(normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [])].sort() };
}

/** Index source content without converting it or mounting an editor. No asset bytes. */
export function indexDocument(document: ImportDocument): DocumentIndex {
  return index(document.pages.map(page => ({ id: page.id, name: page.name,
    text: [page.extractedText ?? page.elements.filter(e => e.kind === 'text').map(e => e.text ?? '').join('\n'), page.notes ?? ''].filter(Boolean).join('\n'),
    elementCount: page.elements.length })),
  document.pages.flatMap(p => p.elements.flatMap(e => e.fontFamily ? [e.fontFamily] : [])), document.assets.map(a => a.id));
}

export interface IndexableElement {
  id: string; type: string; name?: string; text?: string; frameId?: string | null;
  isDeleted?: boolean; fileId?: string | null; fontFamily?: string | number; x?: number;
}

/** Serializable scene indexing; excludes deleted elements and retains unframed text. */
export function indexScene(scene: { elements?: readonly IndexableElement[] }): DocumentIndex {
  const elements = (scene.elements ?? []).filter(e => !e.isDeleted);
  const frames = elements.filter(e => e.type === 'frame').slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const frameIds = new Set(frames.map(f => f.id));
  const pages = frames.map(f => ({ id: f.id, name: f.name ?? '',
    text: elements.filter(e => e.frameId === f.id && e.type === 'text').map(e => e.text ?? '').join('\n'),
    elementCount: elements.filter(e => e.frameId === f.id).length }));
  const loose = elements.filter(e => e.type !== 'frame' && !frameIds.has(e.frameId ?? ''));
  if (loose.length) pages.push({ id: '__unframed__', name: 'Unframed', text: loose.filter(e => e.type === 'text').map(e => e.text ?? '').join('\n'), elementCount: loose.length });
  return index(pages, elements.flatMap(e => e.type === 'text' && e.fontFamily !== undefined ? [String(e.fontFamily)] : []), elements.flatMap(e => e.type === 'image' && e.fileId ? [e.fileId] : []));
}

/** PSD structure only; raw raster channels never enter the search index. */
export function indexPsd(document: PsdDocument, options: { includeHidden?: boolean } = {}): DocumentIndex {
  const fonts: string[] = [], assets: string[] = [], pages: IndexedPage[] = [];
  const root: IndexedPage = { id: 'document', name: 'Photoshop', text: '', elementCount: 0 };
  function visit(layers: PsdLayer[], parent: IndexedPage, address: number[] = []): void {
    layers.forEach((layer, i) => {
      if (layer.hidden && !options.includeHidden) return;
      const path = [...address, i], id = path.join('.');
      const page = layer.artboard ? { id: `artboard-${id}`, name: layer.name ?? '', text: '', elementCount: 0 } : parent;
      if (layer.artboard) pages.push(page);
      page.elementCount++;
      page.text += [layer.name, layer.text?.text].filter(Boolean).join('\n') + '\n';
      for (const style of [layer.text?.style, ...(layer.text?.styleRuns?.map(r => r.style) ?? [])]) if (style?.font?.name) fonts.push(style.font.name);
      if (layer.rawData || layer.imageData || layer.canvas || layer.placedLayer) assets.push(id);
      if (layer.children) visit(layer.children, page, path);
    });
  }
  visit(document.children ?? [], root);
  if (root.elementCount || !pages.length) pages.unshift(root);
  return index(pages, fonts, assets);
}

/** Returns matching pages, using accent-insensitive AND matching. */
export function searchDocument(indexed: DocumentIndex, query: string): IndexedPage[] {
  const terms = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) return [];
  return indexed.pages.filter(page => { const text = normalize(`${page.name}\n${page.text}`); return terms.every(term => text.includes(term)); });
}
