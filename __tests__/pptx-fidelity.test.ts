import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parsePptx } from '../src/parsers';
import { documentToScene } from '../src/converters/document';

const NS = 'xmlns:p="p" xmlns:a="a" xmlns:r="r"';
const rels = (entries: [string, string, string][]) => `<Relationships>${entries.map(([id, type, target]) => `<Relationship Id="${id}" Type="x/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const xfrm = (x: number, y: number, w: number, h: number, extra = '') => `<a:xfrm${extra}><a:off x="${x * 9525}" y="${y * 9525}"/><a:ext cx="${w * 9525}" cy="${h * 9525}"/></a:xfrm>`;
const tree = (shapes: string) => `<p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>`;
const sp = (props: string, body = '', nv = '<p:nvPr/>') => `<p:sp><p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/>${nv}</p:nvSpPr><p:spPr>${props}</p:spPr>${body}</p:sp>`;
const text = (content: string, attrs = '') => `<p:txBody><a:bodyPr${attrs}/><a:p><a:r><a:t>${content}</a:t></a:r></a:p></p:txBody>`;
const theme = '<a:theme><a:themeElements><a:clrScheme name="c"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:accent1><a:srgbClr val="3A39F5"/></a:accent1></a:clrScheme><a:fontScheme name="f"><a:majorFont><a:latin typeface="Newsreader"/></a:majorFont><a:minorFont><a:latin typeface="Funnel Sans"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>';
const master = `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:bgPr></p:bg><p:spTree>${sp(xfrm(0, 0, 50, 50) + '<a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>')}${sp(xfrm(10, 10, 400, 60), '', '<p:nvPr><p:ph type="title"/></p:nvPr>')}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1"/><p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="3000"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle></p:txStyles></p:sldMaster>`;

function deck(slide: string) {
  const parts: Record<string, string> = {
    '_rels/.rels': rels([['o', 'officeDocument', 'ppt/presentation.xml']]),
    'ppt/presentation.xml': `<p:presentation ${NS}><p:sldIdLst><p:sldId id="1" r:id="s"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels([['s', 'slide', 'slides/slide1.xml']]),
    'ppt/slides/slide1.xml': `<p:sld ${NS}>${tree(slide)}</p:sld>`,
    'ppt/slides/_rels/slide1.xml.rels': rels([['l', 'slideLayout', '../slideLayouts/layout1.xml']]),
    'ppt/slideLayouts/layout1.xml': `<p:sldLayout ${NS}>${tree('')}</p:sldLayout>`,
    'ppt/slideLayouts/_rels/layout1.xml.rels': rels([['m', 'slideMaster', '../slideMasters/master1.xml']]),
    'ppt/slideMasters/master1.xml': master,
    'ppt/slideMasters/_rels/master1.xml.rels': rels([['t', 'theme', '../theme/theme1.xml']]),
    'ppt/theme/theme1.xml': theme,
  };
  return parsePptx(zipSync(Object.fromEntries(Object.entries(parts).map(([name, content]) => [name, strToU8(content)]))));
}

describe('PPTX fidelity', () => {
  it('does not wrap a text whose box only had room for its paragraphs', () => {
    const doc = deck(sp(xfrm(0, 0, 320, 40) + '<a:noFill/>', '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="2400"/><a:t>Un titular bastante largo</a:t></a:r></a:p><a:p><a:endParaRPr sz="2400"/></a:p></p:txBody>'));
    const scene = documentToScene(doc).elements.find(e => (e as { type: string }).type === 'text') as unknown as { autoResize: boolean; text: string };
    expect(scene).toMatchObject({ autoResize: true, text: 'Un titular bastante largo' });
  });

  it('draws stars, donuts and routed connectors, and keeps the place of a chart', () => {
    const shape = (name: string) => sp(xfrm(0, 0, 100, 100) + `<a:prstGeom prst="${name}"/><a:solidFill><a:srgbClr val="000000"/></a:solidFill>`);
    const connector = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="2" name="c"/></p:nvCxnSpPr><p:spPr>${xfrm(0, 0, 100, 50)}<a:prstGeom prst="bentConnector3"/><a:ln><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`;
    const chart = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="g"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="${100 * 9525}" cy="${100 * 9525}"/></p:xfrm><a:graphic><a:graphicData/></a:graphic></p:graphicFrame>`;
    const doc = deck(shape('star5') + shape('donut') + connector + chart), [, star, donut, line, placeholder] = doc.pages[0].elements;
    expect(star.points).toHaveLength(11);
    expect(donut.kind).toBe('line');
    expect(line.points).toEqual([[0, 0], [50, 0], [50, 50], [100, 50]]);
    expect(placeholder).toMatchObject({ kind: 'rectangle', width: 100 });
    expect(doc.warnings.map(w => w.code)).toContain('unsupported-object');
    expect(doc.warnings.map(w => w.code)).not.toContain('shape-geometry');
  });

  it('uses the shape style color over the master text styles, and the default table style', () => {
    const styled = sp(xfrm(0, 0, 100, 40) + '<a:prstGeom prst="rect"/>', text('Blanco')).replace('</p:spPr>', '</p:spPr><p:style><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>');
    const cell = (t: string) => `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`;
    const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="t"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="${100 * 9525}"/><a:ext cx="${100 * 9525}" cy="${40 * 9525}"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid><a:gridCol w="${100 * 9525}"/></a:tblGrid><a:tr h="${20 * 9525}">${cell('Cabecera')}</a:tr><a:tr h="${20 * 9525}">${cell('Dato')}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    const elements = deck(styled + table).pages[0].elements;
    expect(elements.find(e => e.text === 'Blanco')?.color).toBe('#ffffff');
    expect(elements.find(e => e.text === 'Cabecera')?.color).toBe('#ffffff');
    expect(elements.find(e => e.text === 'Dato')?.color).toBe('#111111');
    expect(elements.filter(e => e.kind === 'rectangle' && e.fill === '#3a39f5')).toHaveLength(1);
  });

  it('keeps the bold and italic of a paragraph in its family, and warns when they are mixed', () => {
    const run = (t: string, attrs = '', font = '') => `<a:r><a:rPr${attrs}>${font ? `<a:latin typeface="${font}"/>` : ''}</a:rPr><a:t>${t}</a:t></a:r>`;
    const body = (...paragraphs: string[]) => `<p:txBody><a:bodyPr/>${paragraphs.map(p => `<a:p>${p}</a:p>`).join('')}</p:txBody>`;
    const doc = deck(
      sp(xfrm(0, 0, 300, 40) + '<a:noFill/>', body(run('Todo en negrita', ' b="1"'))) +
      sp(xfrm(0, 50, 300, 40) + '<a:noFill/>', body(run('Una cursiva', ' i="1"', 'Newsreader'))) +
      sp(xfrm(0, 100, 300, 40) + '<a:noFill/>', body(run('Ya pesa', ' b="1"', 'Funnel Sans SemiBold'))) +
      sp(xfrm(0, 150, 300, 40) + '<a:noFill/>', body(run('Nadie quiere ') + run('navegar', ' i="1"') + run(' por su mar de archivos'))),
    );
    const family = (text: string) => doc.pages[0].elements.find(e => e.text === text)?.fontFamily;
    expect(family('Todo en negrita')).toBe('Funnel Sans Bold');
    expect(family('Una cursiva')).toBe('Newsreader Italic');
    expect(family('Ya pesa')).toBe('Funnel Sans SemiBold');
    expect(family('Nadie quiere navegar por su mar de archivos')).toBe('Funnel Sans');
    expect(doc.warnings.map(w => w.code)).toContain('text-style');
  });

  it('wraps a text far longer than a short box', () => {
    const long = 'Un texto que claramente ocupa varias líneas aunque su caja sea baja';
    const scene = documentToScene(deck(sp(xfrm(0, 0, 100, 30) + '<a:noFill/>', text(long)))).elements.find(e => (e as { type: string }).type === 'text') as unknown as { autoResize: boolean };
    expect(scene.autoResize).toBe(false);
  });

  it('keeps each text on its own page of the scene', () => {
    const doc = deck(sp(xfrm(10, 0, 100, 40) + '<a:noFill/>', text('Uno', ' lIns="0"')));
    doc.pages.push({ ...doc.pages[0], id: 'slide-2' });
    const texts = documentToScene(doc).elements.filter(e => (e as { type: string }).type === 'text') as unknown as { x: number }[];
    expect(texts[1].x - texts[0].x).toBeGreaterThanOrEqual(doc.pages[0].width);
  });

  it('inherits background, artwork and placeholder geometry and style from the master', () => {
    const { pages: [page] } = deck(sp('', text('Título'), '<p:nvPr><p:ph type="title"/></p:nvPr>'));
    expect(page.background).toBe('#3a39f5');
    expect(page.elements[0]).toMatchObject({ kind: 'rectangle', fill: '#111111', width: 50 });
    expect(page.elements[1]).toMatchObject({ kind: 'text', text: 'Título', x: 10, width: 400, fontSize: 40, color: '#3a39f5', fontFamily: 'Newsreader', textAlign: 'center' });
  });

  it('applies color modifiers and transparency', () => {
    const fill = '<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="12000"/></a:srgbClr></a:solidFill>';
    const dark = '<a:solidFill><a:schemeClr val="bg1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill>';
    const { pages: [page] } = deck(sp(xfrm(0, 0, 10, 10) + `<a:prstGeom prst="roundRect"/>${fill}`) + sp(xfrm(0, 0, 10, 10) + `<a:prstGeom prst="ellipse"/>${dark}`));
    expect(page.elements[1]).toMatchObject({ rounded: true, fill: '#ffffff', opacity: 12 });
    expect(page.elements[2]).toMatchObject({ kind: 'ellipse', fill: '#808080' });
  });

  it('keeps custom shapes as outlines, holes included', () => {
    const square = (a: number, b: number) => `<a:moveTo><a:pt x="${a}" y="${a}"/></a:moveTo><a:lnTo><a:pt x="${b}" y="${a}"/></a:lnTo><a:lnTo><a:pt x="${b}" y="${b}"/></a:lnTo><a:lnTo><a:pt x="${a}" y="${b}"/></a:lnTo><a:close/>`;
    const geometry = `<a:custGeom><a:pathLst><a:path w="100" h="100">${square(0, 100)}${square(25, 75)}</a:path></a:pathLst></a:custGeom><a:solidFill><a:srgbClr val="000000"/></a:solidFill>`;
    const doc = deck(sp(xfrm(5, 5, 200, 200) + geometry));
    const shape = doc.pages[0].elements[1];
    expect(shape.kind).toBe('line');
    expect(shape.points).toContainEqual([50, 50]);
    expect(shape.points?.at(-1)).toEqual([0, 0]);
    expect(doc.warnings.some(w => w.code === 'shape-geometry')).toBe(false);
    const line = documentToScene(doc).elements.find(e => (e as { type: string }).type === 'line') as unknown as { polygon: boolean; backgroundColor: string };
    expect(line).toMatchObject({ polygon: true, backgroundColor: '#000000' });
  });

  it('converts connectors and tables', () => {
    const connector = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="2" name="c"/></p:nvCxnSpPr><p:spPr>${xfrm(0, 10, 100, 0)}<a:prstGeom prst="straightConnector1"/><a:ln w="19050"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:prstDash val="dash"/><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`;
    const cell = (content: string, fill = '') => `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${content}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr">${fill}</a:tcPr></a:tc>`;
    const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="t"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="${100 * 9525}"/><a:ext cx="${200 * 9525}" cy="${40 * 9525}"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="${100 * 9525}"/><a:gridCol w="${100 * 9525}"/></a:tblGrid><a:tr h="${40 * 9525}">${cell('A', '<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>')}${cell('B')}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    const elements = deck(connector + table).pages[0].elements.slice(1);
    expect(elements[0]).toMatchObject({ kind: 'line', stroke: '#ff0000', strokeWidth: 2, strokeStyle: 'dashed', arrowEnd: true });
    expect(elements.filter(e => e.kind === 'text').map(e => [e.text, e.x, e.verticalAlign])).toEqual([['A', 0, 'middle'], ['B', 100, 'middle']]);
    expect(elements.find(e => e.fill === '#00ff00')).toMatchObject({ width: 100, height: 40 });
  });

  it('places anchored text and separates paragraphs with their own style', () => {
    const body = '<p:txBody><a:bodyPr anchor="b" tIns="0" bIns="0" lIns="0" rIns="0"/><a:p><a:r><a:rPr sz="3000"/><a:t>Grande</a:t></a:r></a:p><a:p><a:r><a:rPr sz="1200"/><a:t>Pequeña</a:t></a:r></a:p></p:txBody>';
    const doc = deck(sp(xfrm(0, 0, 400, 300) + '<a:noFill/>', body));
    const [big, small] = doc.pages[0].elements.slice(1);
    expect(big).toMatchObject({ text: 'Grande', fontSize: 40 });
    expect(small).toMatchObject({ text: 'Pequeña', fontSize: 16 });
    expect(small.y! + small.height!).toBeCloseTo(300, 0);
    expect(big.y!).toBeLessThan(small.y!);
    const anchored = deck(sp(xfrm(0, 0, 400, 300) + '<a:noFill/>', text('Abajo', ' anchor="b" tIns="0" bIns="0"')));
    const scene = documentToScene(anchored).elements.find(e => (e as { type: string }).type === 'text') as unknown as { y: number; height: number };
    expect(scene.y + scene.height).toBeCloseTo(300, 0);
  });
});
