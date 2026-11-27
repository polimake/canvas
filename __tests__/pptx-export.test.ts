import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { XMLValidator } from 'fast-xml-parser';
import { sceneToDocument, documentToPptx, parseColor, xmlText, dataUrlBytes } from '../src/converters';
import { parsePptx } from '../src/parsers';

// PNG de 1×1 (transparente).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const base = { angle: 0, opacity: 100, strokeColor: '#111111', backgroundColor: 'transparent', strokeWidth: 2, strokeStyle: 'solid', groupIds: [], isDeleted: false, version: 1 };

function deck(): any[] {
  return [
    { ...base, id: 'f1', type: 'frame', x: 0, y: 0, width: 1920, height: 1080, name: 'Portada', frameId: null,
      customData: { c2page: { index: 0 }, c2notes: 'Abrir con la pregunta\nSegunda línea', c2transition: 'fade' } },
    { ...base, id: 'bg1', type: 'rectangle', x: 0, y: 0, width: 1920, height: 1080, frameId: 'f1', backgroundColor: '#000000', customData: { c2: 'pageBackground' } },
    { ...base, id: 'r1', type: 'rectangle', x: 100, y: 100, width: 400, height: 200, frameId: 'f1', backgroundColor: '#3a39f5', roundness: { type: 3 } },
    { ...base, id: 'e1', type: 'ellipse', x: 600, y: 100, width: 200, height: 200, frameId: 'f1', opacity: 50, angle: Math.PI / 4 },
    { ...base, id: 't1', type: 'text', x: 100, y: 400, width: 800, height: 120, frameId: 'f1', strokeColor: '#ffffff',
      text: 'Busca & <dentro>\nde tu contenido', originalText: 'Busca & <dentro>\nde tu contenido', fontSize: 48, fontFamily: 2, textAlign: 'center', verticalAlign: 'top', lineHeight: 1.25 },
    { ...base, id: 'a1', type: 'arrow', x: 100, y: 700, width: 300, height: 0, frameId: 'f1', points: [[0, 0], [300, 0]], endArrowhead: 'arrow', startArrowhead: null },
    { ...base, id: 'l1', type: 'line', x: 500, y: 700, width: 100, height: 100, frameId: 'f1', points: [[0, 0], [100, 0], [100, 100], [0, 0]], backgroundColor: '#e0533d', polygon: true },
    { ...base, id: 'i1', type: 'image', x: 1000, y: 100, width: 640, height: 360, frameId: 'f1', fileId: 'file-1', scale: [-1, 1],
      crop: { x: 10, y: 0, width: 80, height: 100, naturalWidth: 100, naturalHeight: 100 } },
    { ...base, id: 'f2', type: 'frame', x: 1968, y: 0, width: 1920, height: 1080, name: 'Segunda', frameId: null,
      customData: { c2page: { index: 1 }, c2skip: true } },
    { ...base, id: 't2', type: 'text', x: 2068, y: 100, width: 600, height: 60, frameId: 'f2', text: 'Ctrl\u0001 fuera', originalText: 'Ctrl\u0001 fuera', fontSize: 32, fontFamily: 10_001, textAlign: 'left', lineHeight: 1.25 },
    { ...base, id: 'loose', type: 'rectangle', x: -500, y: -500, width: 10, height: 10, frameId: null },
  ];
}
const files = { 'file-1': { id: 'file-1', dataURL: PNG, mimeType: 'image/png' } };
const fontName = (id: number) => (id === 10_001 ? 'Funnel Sans (marca)' : undefined);

function unpack(bytes: Uint8Array) {
  const zip = unzipSync(bytes);
  const text = (path: string) => strFromU8(zip[path]);
  return { zip, text };
}

describe('escena → modelo de documento', () => {
  it('cada página con su fondo, sus notas, saltar y transición; lo suelto, avisado', () => {
    const doc = sceneToDocument(deck() as never, files, { fontName });
    expect(doc.pages.map((p) => p.name)).toEqual(['Portada', 'Segunda']);
    expect(doc.pages[0]).toMatchObject({ background: '#000000', notes: 'Abrir con la pregunta\nSegunda línea', transition: 'fade' });
    expect(doc.pages[0].hidden).toBeUndefined();
    expect(doc.pages[1].hidden).toBe(true);
    expect(doc.pages[0].elements.map((e) => e.kind)).toEqual(['rectangle', 'ellipse', 'text', 'line', 'line', 'image']);
    // Coordenadas relativas a su página.
    expect(doc.pages[1].elements[0]).toMatchObject({ x: 100, y: 100, fontFamily: 'Funnel Sans' });
    expect(doc.pages[0].elements[2]).toMatchObject({ fontFamily: 'Helvetica', textAlign: 'center' });
    const image = doc.pages[0].elements[5];
    expect(image.flipH).toBe(true);
    expect(image.crop?.left).toBeCloseTo(0.1, 6);
    expect(image.crop?.right).toBeCloseTo(0.1, 6);
    expect(image.crop?.top).toBeCloseTo(0, 6);
    expect(doc.assets).toHaveLength(1);
    expect(doc.warnings.map((w) => w.code)).toContain('outside-pages');
  });

  it('una imagen sin bytes se queda fuera con aviso, sin romper la exportación', () => {
    const doc = sceneToDocument(deck() as never, { 'file-1': { dataURL: 'https://media.example/x.png' } });
    expect(doc.pages[0].elements.some((e) => e.kind === 'image')).toBe(false);
    expect(doc.warnings.map((w) => w.code)).toContain('image-unavailable');
  });
});

describe('documento → PowerPoint', () => {
  const doc = sceneToDocument(deck() as never, files, { fontName });
  const result = documentToPptx(doc, { title: 'Polimake · deck', created: new Date('2026-11-25T10:00:00Z') });
  const { zip, text } = unpack(result.bytes);

  it('un paquete completo: todo el XML es válido y cada relación apunta a algo que existe', () => {
    const xmlParts = Object.keys(zip).filter((p) => /\.(xml|rels)$/.test(p));
    for (const part of xmlParts) expect(XMLValidator.validate(text(part)), part).toBe(true);
    for (const relsPath of xmlParts.filter((p) => p.endsWith('.rels'))) {
      const dir = relsPath.replace(/_rels\/[^/]*\.rels$/, '');
      for (const [, target] of text(relsPath).matchAll(/Target="([^"]+)"/g)) {
        const parts = `${dir}${target}`.split('/');
        const resolved: string[] = [];
        for (const seg of parts) {
          if (seg === '..') resolved.pop();
          else if (seg && seg !== '.') resolved.push(seg);
        }
        expect(zip[resolved.join('/')], `${relsPath} → ${target}`).toBeDefined();
      }
    }
  });

  it('cada parte tiene su tipo de contenido', () => {
    const types = text('[Content_Types].xml');
    const defaults = new Set([...types.matchAll(/Default Extension="([^"]+)"/g)].map((m) => m[1]));
    const overrides = new Set([...types.matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1]));
    for (const part of Object.keys(zip)) {
      if (part === '[Content_Types].xml') continue;
      const ext = part.split('.').pop()!;
      expect(overrides.has(part) || defaults.has(ext), part).toBe(true);
    }
    expect(types).toContain('presentationml.presentation.main+xml');
    expect(Object.keys(zip)[0]).toBe('[Content_Types].xml');
  });

  it('vuelve a entrar por el importador con lo mismo', () => {
    const back = parsePptx(result.bytes);
    expect(back.pages).toHaveLength(2);
    expect(back.pages[0]).toMatchObject({ width: 1920, height: 1080, background: '#000000', notes: 'Abrir con la pregunta\nSegunda línea', transition: 'fade' });
    expect(back.pages[1].hidden).toBe(true);
    const texts = back.pages[0].elements.filter((e) => e.kind === 'text').map((e) => e.text);
    expect(texts.join('\n')).toContain('Busca & <dentro>');
    expect(texts.join('\n')).toContain('de tu contenido');
    const kinds = back.pages[0].elements.map((e) => e.kind);
    expect(kinds).toContain('image');
    expect(kinds).toContain('ellipse');
    const rect = back.pages[0].elements.find((e) => e.kind === 'rectangle' && e.fill?.toLowerCase() === '#3a39f5');
    expect(rect).toMatchObject({ x: 100, y: 100, width: 400, height: 200, rounded: true });
    const ellipse = back.pages[0].elements.find((e) => e.kind === 'ellipse');
    expect(ellipse?.rotation).toBeCloseTo(45, 3);
    const t2 = back.pages[1].elements.find((e) => e.kind === 'text');
    expect(t2?.text).toBe('Ctrl fuera');
    expect(t2?.fontFamily).toBe('Funnel Sans');
    // El interlineado vuelve igual: no crece 1,2× en cada ida y vuelta.
    expect(t2?.lineHeight).toBeCloseTo(1.25, 2);
    expect(back.assets).toHaveLength(1);
    expect(back.assets[0].mimeType).toBe('image/png');
  });

  it('notas, oculta y fundido van donde PowerPoint los busca', () => {
    expect(text('ppt/slides/slide2.xml')).toMatch(/<p:sld [^>]*show="0"/);
    expect(text('ppt/slides/slide1.xml')).toContain('<p:transition spd="med"><p:fade/></p:transition>');
    expect(zip['ppt/notesSlides/notesSlide1.xml']).toBeDefined();
    expect(zip['ppt/notesSlides/notesSlide2.xml']).toBeUndefined();
    expect(text('ppt/presentation.xml')).toContain('<p:notesMasterIdLst>');
    expect(text('docProps/core.xml')).toContain('<dc:title>Polimake · deck</dc:title>');
  });

  it('.potx: el mismo paquete marcado como plantilla', () => {
    const potx = documentToPptx(doc, { template: true });
    expect(potx.extension).toBe('potx');
    expect(potx.mimeType).toBe('application/vnd.openxmlformats-officedocument.presentationml.template');
    expect(unpack(potx.bytes).text('[Content_Types].xml')).toContain('presentationml.template.main+xml');
    expect(parsePptx(potx.bytes).pages).toHaveLength(2);
  });

  it('sin notas no hay maestro de notas', () => {
    const plain = documentToPptx({ format: 'pptx', pages: [{ id: 'p', name: 'p', width: 1080, height: 1080, elements: [] }], assets: [], warnings: [] });
    const z = unpack(plain.bytes);
    expect(z.zip['ppt/notesMasters/notesMaster1.xml']).toBeUndefined();
    expect(z.text('ppt/presentation.xml')).not.toContain('notesMaster');
  });

  it('un tamaño fuera de lo que admite PowerPoint se escala, y otra medida se encaja centrada', () => {
    const huge = documentToPptx({ format: 'pptx', assets: [], warnings: [], pages: [
      { id: 'a', name: 'a', width: 8000, height: 4000, elements: [] },
      { id: 'b', name: 'b', width: 1080, height: 1920, elements: [{ id: 'r', kind: 'rectangle', x: 0, y: 0, width: 1080, height: 1920, fill: '#ff0000' }] },
    ] });
    const sz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(unpack(huge.bytes).text('ppt/presentation.xml'))!;
    expect(Number(sz[1])).toBeLessThanOrEqual(51206400);
    expect(Number(sz[1]) / Number(sz[2])).toBeCloseTo(2, 3);
    expect(huge.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['slide-size-scaled', 'page-size-mixed']));
    const back = parsePptx(huge.bytes);
    const r = back.pages[1].elements[0];
    // Encajada sin deformar y centrada.
    expect(r.width / r.height).toBeCloseTo(1080 / 1920, 2);
    expect(r.x + r.width / 2).toBeCloseTo(back.pages[1].width / 2, 0);
  });

  it('una imagen que PowerPoint no abre (webp) queda fuera con aviso', () => {
    const webp = documentToPptx({ format: 'pptx', warnings: [], pages: [{ id: 'p', name: 'p', width: 100, height: 100,
      elements: [{ id: 'i', kind: 'image', x: 0, y: 0, width: 10, height: 10, assetId: 'w' }] }],
      assets: [{ id: 'w', name: 'w', mimeType: 'image/webp', bytes: new Uint8Array([1, 2, 3]) }] });
    expect(webp.warnings.map((w) => w.code)).toContain('image-format');
    expect(Object.keys(unpack(webp.bytes).zip).some((p) => p.startsWith('ppt/media/'))).toBe(false);
  });
});

describe('ayudas', () => {
  it('colores de Excalidraw a PowerPoint', () => {
    expect(parseColor('#abc')).toEqual({ hex: 'AABBCC', alpha: 1 });
    expect(parseColor('#3a39f580')?.alpha).toBeCloseTo(0.5, 2);
    expect(parseColor('transparent')).toBeNull();
    expect(parseColor('rgba(10, 20, 30, 0.25)')).toEqual({ hex: '0A141E', alpha: 0.25 });
    expect(parseColor('nonsense')).toBeNull();
  });

  it('texto seguro para XML', () => {
    expect(xmlText('a & b < c > "d"\u0007')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;');
  });

  it('data URL a bytes', () => {
    expect(dataUrlBytes(PNG)?.mimeType).toBe('image/png');
    expect(dataUrlBytes(PNG)?.bytes[1]).toBe(0x50); // «P» de PNG
    expect(dataUrlBytes('data:text/plain,hola%20y')?.bytes).toEqual(new TextEncoder().encode('hola y'));
    expect(dataUrlBytes('https://x')).toBeNull();
  });
});
