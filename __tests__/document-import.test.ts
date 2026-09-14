import { describe, it, expect, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseFile, parsePsd, parsePptx, parseIllustrator, createPdfJsAdapter } from '../src/parsers';
import { documentToScene } from '../src/converters/document';
import { psdToScene } from '../src/converters/psd';
import { indexDocument, indexScene, indexPsd, searchDocument } from '../src/indexers';

const relationships = (entries: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`;
const rel = (id: string, type: string, target: string, external = false) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"${external ? ' TargetMode="External"' : ''}/>`;
const geometry = '<a:xfrm><a:off x="95250" y="190500"/><a:ext cx="1905000" cy="952500"/></a:xfrm>';
const textShape = `<p:sp><p:nvSpPr><p:cNvPr id="1" name="Heading"/></p:nvSpPr><p:spPr>${geometry}<a:prstGeom prst="rect"/></p:spPr><p:txBody><a:p><a:r><a:rPr sz="2400"><a:latin typeface="Arial"/></a:rPr><a:t>Café &amp; té</a:t></a:r><a:br/><a:r><a:t>segunda línea</a:t></a:r></a:p></p:txBody></p:sp>`;
const picture = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Photo"/></p:nvPicPr><p:blipFill><a:blip r:embed="image"/></p:blipFill><p:spPr>${geometry}</p:spPr></p:pic>`;
const slide = (objects: string) => `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree>${objects}</p:spTree></p:cSld></p:sld>`;
function pptx(overrides: Record<string, string | Uint8Array> = {}) {
  const parts: Record<string, string | Uint8Array> = {
    '_rels/.rels': relationships(rel('office', 'officeDocument', 'ppt/presentation.xml')),
    'ppt/presentation.xml': '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="second"/><p:sldId id="257" r:id="first"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': relationships(rel('first', 'slide', 'slides/slide1.xml') + rel('second', 'slide', 'slides/slide2.xml')),
    'ppt/slides/slide2.xml': slide(textShape + picture),
    'ppt/slides/slide1.xml': slide(textShape.replace('Café &amp; té', 'Final')),
    'ppt/slides/_rels/slide2.xml.rels': relationships(rel('image', 'image', '../media/image.png') + rel('notes', 'notesSlide', '../notesSlides/notesSlide1.xml')),
    'ppt/notesSlides/notesSlide1.xml': '<p:notes xmlns:p="p" xmlns:a="a"><a:t>Notas del ponente</a:t></p:notes>',
    'ppt/media/image.png': new Uint8Array([137, 80, 78, 71]),
    ...overrides,
  };
  return zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])));
}

function minimalPsd(version = 1) {
  // A real 1x1, 8-bit RGB Photoshop document: header, empty sections, raw composite.
  const bytes = new Uint8Array(version === 1 ? 43 : 47);
  bytes.set([56, 66, 80, 83]);
  const view = new DataView(bytes.buffer);
  view.setUint16(4, version); view.setUint16(12, 3);
  view.setUint32(14, 1); view.setUint32(18, 1);
  view.setUint16(22, 8); view.setUint16(24, 3);
  return bytes;
}

describe('PPTX reader', () => {
  it('reads actual ZIP/XML, presentation order, geometry, text breaks, notes and media', () => {
    const doc = parsePptx(pptx());
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]).toMatchObject({ width: 960, height: 540, notes: 'Notas del ponente' });
    expect(doc.pages[0].elements[0]).toMatchObject({ x: 10, y: 20, width: 200, height: 100, fontSize: 32, text: 'Café & té\nsegunda línea' });
    expect(doc.pages[1].elements[0].text).toContain('Final');
    expect(doc.assets[0]).toMatchObject({ mimeType: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) });
    expect(doc.warnings.some(w => w.code === 'text-layout')).toBe(true);
  });

  it('transforms children of scaled and translated groups', () => {
    const group = `<p:grpSp><p:grpSpPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="1905000" cy="1905000"/><a:chOff x="0" y="0"/><a:chExt cx="952500" cy="952500"/></a:xfrm></p:grpSpPr>${textShape}</p:grpSp>`;
    const doc = parsePptx(pptx({ 'ppt/slides/slide2.xml': slide(group) }));
    expect(doc.pages[0].elements[0]).toMatchObject({ x: 120, y: 140, width: 400, height: 200 });
  });

  it('reports missing layouts and unsupported objects instead of claiming full fidelity', () => {
    const doc = parsePptx(pptx({
      'ppt/slides/slide2.xml': slide('<p:sp><p:txBody><a:p><a:r><a:t>Inherited</a:t></a:r></a:p></p:txBody></p:sp><p:graphicFrame/>'),
      'ppt/slides/_rels/slide2.xml.rels': relationships(rel('layout', 'slideLayout', '../slideLayouts/slideLayout1.xml')),
    }));
    expect(doc.warnings.map(w => w.code)).toEqual(expect.arrayContaining(['master-layout', 'missing-geometry', 'unsupported-object']));
  });

  it('never fetches external relationships', () => {
    const doc = parsePptx(pptx({ 'ppt/slides/_rels/slide2.xml.rels': relationships(rel('image', 'image', 'https://example.com/private.png', true)) }));
    expect(doc.assets).toHaveLength(0);
    expect(doc.warnings.some(w => w.code === 'missing-image')).toBe(true);
  });

  it('bounds file size, expanded ZIP size, entry count and pages', () => {
    const bytes = pptx();
    for (const limits of [{ maxFileBytes: 10 }, { maxExpandedBytes: 100 }, { maxEntries: 2 }, { maxPages: 1 }]) {
      expect(() => parsePptx(bytes, limits)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }));
    }
  });

  it('rejects corrupt archives, XML entities and relationships escaping the package', () => {
    expect(() => parsePptx(new Uint8Array([1, 2, 3]))).toThrow();
    expect(() => parsePptx(pptx({ 'ppt/slides/slide2.xml': '<!DOCTYPE x [<!ENTITY y "x">]><x>&y;</x>' }))).toThrow(/XML|DTD/);
    expect(() => parsePptx(pptx({ 'ppt/_rels/presentation.xml.rels': relationships(rel('second', 'slide', '../../escape.xml')) }))).toThrow(/escapes/);
  });
});

describe('PSD/PSB and format routing', () => {
  it.each([1, 2])('parses Photoshop version %i without canvas globals', async version => {
    const bytes = minimalPsd(version);
    expect(parsePsd(bytes)).toMatchObject({ width: 1, height: 1 });
    expect(await parseFile(bytes, { fileName: 'test.PSD' })).toMatchObject({ format: version === 1 ? 'psd' : 'psb' });
  });
  it('keeps headless raw layer channels as image placeholders during conversion', () => {
    const scene = psdToScene({ width: 100, height: 100, children: [{ name: 'Raster', left: 0, top: 0, right: 80, bottom: 80, rawData: { channels: [] } }] });
    expect(scene.assets).toHaveLength(1);
    expect(scene.report.layers.dropped).toBe(0);
  });
  it('checks signatures, malformed content and binary PPT explicitly', async () => {
    expect(() => parsePsd(new Uint8Array([1]))).toThrow(/header/);
    await expect(parseFile(new Uint8Array([1]), { fileName: 'old.ppt' })).rejects.toMatchObject({ code: 'unsupported-format' });
    await expect(parseFile(pptx(), { fileName: 'slides.pptx' })).resolves.toMatchObject({ format: 'pptx' });
  });
});

describe('Illustrator PDF adapter', () => {
  const bytes = strToU8('%PDF-1.7\n');
  function engine(fail = false) {
    const cleanup = vi.fn(), destroy = vi.fn(async () => {});
    const page = { getViewport: () => ({ width: 200, height: 100, transform: [1, 0, 0, -1, 0, 100] }),
      getTextContent: async () => { if (fail) throw new Error('broken'); return { items: [{ str: 'Illustrator title', width: 80, height: 12, transform: [12, 0, 0, 12, 5, 20], fontName: 'f1' }], styles: { f1: { fontFamily: 'Arial' } } }; }, cleanup };
    return { api: { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => page }), destroy }) }, page, cleanup, destroy };
  }
  it('rejects native PostScript and requires the PDF runtime explicitly', async () => {
    await expect(parseIllustrator(strToU8('%!PS-Adobe'))).rejects.toMatchObject({ code: 'unsupported-format' });
    await expect(parseIllustrator(bytes)).rejects.toMatchObject({ code: 'adapter-required' });
  });
  it('extracts searchable text, marks partial fidelity and releases resources', async () => {
    const runtime = engine();
    const doc = await parseIllustrator(bytes, { pdf: createPdfJsAdapter(runtime.api) });
    expect(doc.format).toBe('ai');
    expect(indexDocument(doc).text).toContain('Illustrator title');
    expect(doc.warnings.map(w => w.code)).toEqual(['text-only', 'illustrator-pdf']);
    expect(runtime.destroy).toHaveBeenCalledOnce(); expect(runtime.cleanup).toHaveBeenCalledOnce();
  });
  it('uses a rendered page as an asset and keeps text only in the search index', async () => {
    const doc = await parseIllustrator(bytes, { pdf: createPdfJsAdapter(engine().api, { renderPage: async () => ({ bytes: new Uint8Array([1, 2]), mimeType: 'image/png' }) }) });
    expect(doc.pages[0].elements.map(e => e.kind)).toEqual(['image']);
    expect(doc.assets).toHaveLength(1);
    expect(indexDocument(doc).text).toContain('Illustrator title');
  });
  it('cleans up on extraction failure and page limit violations', async () => {
    const runtime = engine(true);
    await expect(parseIllustrator(bytes, { pdf: createPdfJsAdapter(runtime.api) })).rejects.toThrow('broken');
    expect(runtime.destroy).toHaveBeenCalledOnce(); expect(runtime.cleanup).toHaveBeenCalledOnce();
    const limited = engine();
    await expect(parseIllustrator(bytes, { maxPages: 0, pdf: createPdfJsAdapter(limited.api) })).rejects.toMatchObject({ code: 'limit-exceeded' });
    expect(limited.destroy).toHaveBeenCalledOnce();
  });
});

describe('conversion and indexing', () => {
  it('keeps images external and makes unresolved assets explicit', () => {
    const document = parsePptx(pptx());
    const original = JSON.stringify(document);
    const pending = documentToScene(document);
    expect(pending.pendingAssetIds).toEqual(['asset-1']);
    expect(pending.files).toEqual({});
    const ready = documentToScene(document, { idPrefix: 'deck', assets: { 'asset-1': { url: 'https://media.example/image.png', mimeType: 'image/png' } } });
    expect(ready.pendingAssetIds).toEqual([]);
    expect(ready.files['deck-asset-asset-1'].dataURL).toBe('https://media.example/image.png');
    expect(new Set(ready.elements.map(e => e.id)).size).toBe(ready.elements.length);
    expect(JSON.stringify(document)).toBe(original);
    expect(documentToScene(document, { assets: { 'asset-1': { url: 'data:image/png;base64,abc', mimeType: 'image/png' } } }).pendingAssetIds).toHaveLength(1);
  });
  it('indexes source text, notes, fonts and asset references without bytes', () => {
    const indexed = indexDocument(parsePptx(pptx()));
    expect(indexed.fonts).toEqual(['Arial']);
    expect(indexed.assetIds).toEqual(['asset-1']);
    expect(searchDocument(indexed, 'CAFE té')).toHaveLength(1);
    expect(searchDocument(indexed, 'ponente')).toHaveLength(1);
    expect(searchDocument(indexed, '')).toEqual([]);
    expect(JSON.stringify(indexed)).not.toContain('bytes');
  });
  it('excludes deleted scene text and preserves orphaned text', () => {
    const indexed = indexScene({ elements: [{ id: 'f', type: 'frame', name: 'Page' },
      { id: 'a', type: 'text', text: 'Visible', frameId: 'f' }, { id: 'b', type: 'text', text: 'Secret', isDeleted: true },
      { id: 'c', type: 'text', text: 'Loose', frameId: 'missing' }] });
    expect(indexed.text).toContain('Visible'); expect(indexed.text).toContain('Loose'); expect(indexed.text).not.toContain('Secret');
  });
  it('indexes PSD artboards and skips hidden descendants', () => {
    const indexed = indexPsd({ children: [{ name: 'Cover', artboard: {}, children: [{ text: { text: 'Hello', style: { font: { name: 'Arial-Bold' } } } }] },
      { hidden: true, children: [{ text: { text: 'Private' } }] }] });
    expect(indexed.pages[0].name).toBe('Cover'); expect(indexed.text).toContain('Hello'); expect(indexed.text).not.toContain('Private');
    expect(indexed.fonts).toEqual(['Arial-Bold']);
  });
});
