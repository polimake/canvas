import { unzipSync, strFromU8 } from 'fflate';
import { DocumentImportError, estimateTextHeight, readBytes, type ParseLimits, type ImportDocument, type DocumentElement, type DocumentPage } from '../documents/model';
import { connectorPoints, customGeometry, flipPoints, imageSize, presetGeometry, type Point } from './pptx-geometry';
import { readColor, readTheme, type PptxColor, type PptxTheme } from './pptx-theme';
import { xml, child, children, descendants, value, relationId, type XmlNode } from './xml';

const EMU = 9525; // 96 CSS pixels per inch, 914400 EMU per inch.
const POINT = 96 / 72;
const DEFAULT_FONT_SIZE = 18 * POINT;
const NATURAL_LINE_HEIGHT = 1.2;
const DEFAULT_INSET = { left: 91440 / EMU, top: 45720 / EMU, right: 91440 / EMU, bottom: 45720 / EMU };
const ALIGN: Record<string, DocumentElement['textAlign']> = { l: 'left', just: 'left', dist: 'left', ctr: 'center', r: 'right' };
const ANCHOR: Record<string, DocumentElement['verticalAlign']> = { t: 'top', ctr: 'middle', b: 'bottom' };
const CONNECTORS = /^(line|straightConnector\d*|bentConnector\d*|curvedConnector\d*)$/;
const DEFAULT_TABLE_STYLE = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}'; // Medium Style 2, Accent 1: PowerPoint's default.
const PLACEHOLDER_FILL = '#e9ecef', PLACEHOLDER_STROKE = '#adb5bd';
/** Presets drawn as one of the basic editable shapes. */
const BASIC_SHAPES: Record<string, { kind: DocumentElement['kind']; rounded?: boolean }> = {
  rect: { kind: 'rectangle' }, flowChartProcess: { kind: 'rectangle' }, ellipse: { kind: 'ellipse' }, flowChartConnector: { kind: 'ellipse' },
  diamond: { kind: 'diamond' }, flowChartDecision: { kind: 'diamond' }, roundRect: { kind: 'rectangle', rounded: true },
  round2SameRect: { kind: 'rectangle', rounded: true }, flowChartAlternateProcess: { kind: 'rectangle', rounded: true }, flowChartTerminator: { kind: 'rectangle', rounded: true },
};
const number = (v: string | undefined, fallback = 0) => v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback;
const firstOf = <T>(items: (T | undefined)[]) => items.find(item => item !== undefined);

function resolvePart(source: string, target: string): string {
  if (target.includes('\\') || /[?#]|^[a-z]+:/i.test(target)) throw new DocumentImportError('invalid-file', 'Invalid package relationship.');
  const parts = (target.startsWith('/') ? target.slice(1) : `${source.slice(0, source.lastIndexOf('/') + 1)}${target}`).split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      if (!result.length) throw new DocumentImportError('invalid-file', 'Relationship escapes the package.');
      result.pop();
    } else if (part && part !== '.') result.push(part);
  }
  return result.join('/');
}

interface Relationship { target: string; type: string; external: boolean }
interface Transform { x: number; y: number; sx: number; sy: number; groupIds: string[] }
interface Box { x: number; y: number; width: number; height: number; rotation?: number; groupIds?: string[]; opacity?: number }
interface TextLevels { near: XmlNode[]; far: XmlNode[] }
interface Placeholder { shapes: XmlNode[]; kind: string }
interface TextBlock { text: string; fontSize: number; fontFamily?: string; color: string; textAlign: NonNullable<DocumentElement['textAlign']>; lineHeight: number; before: number; after: number }

/** A typeface whose name already says its weight («Funnel Sans SemiBold»): bold on it is PowerPoint's fake bold. */
const NAMED_WEIGHT = /\b(thin|hairline|light|regular|book|medium|(semi|demi|extra|ultra)?\s?bold|black|heavy)$/i;

/**
 * The family a paragraph is drawn with, its bold and italic included: the canvas has no
 * weight per text, so «Funnel Sans Bold» is a family of its own that the host resolves.
 */
function styledFamily(font: string | undefined, bold: boolean, italic: boolean): string | undefined {
  if (!font) return font;
  const named = NAMED_WEIGHT.test(font.replace(/\s+italic$/i, ''));
  return `${font}${bold && !named ? ' Bold' : ''}${italic && !/italic$/i.test(font) ? ' Italic' : ''}`;
}

const placeholderOf = (shape: XmlNode) => descendants(child(shape, 'nvSpPr'), 'ph')[0];
const masterKind = (type: string | undefined) => type === 'title' || type === 'ctrTitle' ? 'title' : !type || type === 'subTitle' || type === 'obj' || type === 'body' ? 'body' : type;
const shapesOf = (root: XmlNode | undefined, tag: string) => children(child(child(root && child(root, tag), 'cSld'), 'spTree'), 'sp');

/** Reads slides from an OOXML ZIP, resolving their theme, layout and master. */
export function parsePptx(input: Uint8Array | ArrayBuffer, limits: ParseLimits = {}): ImportDocument {
  const bytes = readBytes(input, limits);
  let files: Record<string, Uint8Array>;
  let expanded = 0, entries = 0;
  try {
    files = unzipSync(bytes, { filter: entry => {
      expanded += entry.originalSize;
      if (++entries > (limits.maxEntries ?? 4096) || expanded > (limits.maxExpandedBytes ?? 128 * 1024 * 1024)) {
        throw new DocumentImportError('limit-exceeded', 'PPTX archive exceeds its expansion budget.');
      }
      return true;
    } });
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    throw new DocumentImportError('invalid-file', 'Cannot open PPTX ZIP archive.');
  }
  const parsed = new Map<string, XmlNode>();
  const read = (name: string) => {
    if (!files[name]) throw new DocumentImportError('invalid-file', `Missing package part: ${name}`);
    let node = parsed.get(name);
    if (!node) { node = xml(strFromU8(files[name])); parsed.set(name, node); }
    return node;
  };
  const relationships = (source: string): Map<string, Relationship> => {
    const slash = source.lastIndexOf('/');
    const relPath = source ? `${source.slice(0, slash + 1)}_rels/${source.slice(slash + 1)}.rels` : '_rels/.rels';
    if (!files[relPath]) return new Map();
    return new Map(descendants(read(relPath), 'Relationship').map(n => [n.attrs.Id, {
      target: n.attrs.TargetMode === 'External' ? n.attrs.Target : resolvePart(source, n.attrs.Target ?? ''),
      type: n.attrs.Type ?? '', external: n.attrs.TargetMode === 'External',
    }]));
  };
  const related = (source: string | undefined, kind: string) => {
    if (!source) return undefined;
    const target = [...relationships(source).values()].find(r => r.type.endsWith(kind) && !r.external)?.target;
    return target && files[target] ? target : undefined;
  };
  const office = [...relationships('').values()].find(r => r.type.endsWith('/officeDocument') && !r.external);
  if (!office) throw new DocumentImportError('invalid-file', 'Missing presentation relationship.');
  const presentation = child(read(office.target), 'presentation');
  if (!presentation) throw new DocumentImportError('unsupported-format', 'The ZIP is not a PowerPoint presentation.');
  const size = child(presentation, 'sldSz');
  const width = number(size?.attrs.cx) / EMU, height = number(size?.attrs.cy) / EMU;
  if (width <= 0 || height <= 0) throw new DocumentImportError('invalid-file', 'Invalid slide dimensions.');
  const slideIds = children(child(presentation, 'sldIdLst'), 'sldId');
  if (!slideIds.length) throw new DocumentImportError('invalid-file', 'Presentation has no slides.');
  if (slideIds.length > (limits.maxPages ?? 500)) throw new DocumentImportError('limit-exceeded', 'Too many slides.');
  const rels = relationships(office.target);
  const defaultTextStyle = child(presentation, 'defaultTextStyle');
  const doc: ImportDocument = { format: 'pptx', pages: [], assets: [], warnings: [] };
  const assetIds = new Map<string, string>();
  const warn = (code: string, message: string, pageId: string, elementId?: string) => doc.warnings.push({ code, message, pageId, elementId });

  for (const [pageIndex, slideId] of slideIds.entries()) {
    const rel = rels.get(relationId(slideId, 'id') ?? '');
    if (!rel || rel.external || !rel.type.endsWith('/slide')) throw new DocumentImportError('invalid-file', 'Invalid slide relationship.');
    const slideRoot = read(rel.target), slide = child(slideRoot, 'sld');
    if (!slide) throw new DocumentImportError('invalid-file', 'Missing slide root.');
    const page: DocumentPage = { id: `slide-${pageIndex + 1}`, name: child(slide, 'cSld')?.attrs.name || `Slide ${pageIndex + 1}`, width, height, elements: [] };
    doc.pages.push(page);
    // Indexing preserves source text even for what cannot be placed.
    page.extractedText = descendants(slide, 't').map(value).join('\n');
    const slideRels = relationships(rel.target);

    const layoutPath = related(rel.target, '/slideLayout'), masterPath = related(layoutPath, '/slideMaster'), themePath = related(masterPath, '/theme');
    if (!masterPath && [...slideRels.values()].some(r => r.type.endsWith('/slideLayout'))) {
      warn('master-layout', 'The slide layout or master is missing; inherited styles are not available.', page.id);
    }
    const layoutRoot = layoutPath ? read(layoutPath) : undefined, masterRoot = masterPath ? read(masterPath) : undefined;
    const layout = child(layoutRoot, 'sldLayout'), master = child(masterRoot, 'sldMaster');
    const theme: PptxTheme = readTheme(themePath ? read(themePath) : undefined, child(master, 'clrMap'));
    const textStyles = child(master, 'txStyles');

    const paint = (parent: XmlNode | undefined, placeholder?: PptxColor) => {
      const color = readColor(parent, theme, placeholder);
      if (!color && parent?.children.some(n => n.name === 'schemeClr')) warn('theme-color', 'Theme color could not be resolved; a fallback is used.', page.id);
      return color;
    };
    const schemeColor = (name: string, modifier?: XmlNode) => readColor({ name: 'c', attrs: {}, value: '', children: [{ name: 'schemeClr', attrs: { val: name }, children: modifier ? [modifier] : [], value: '' }] }, theme);
    const tint = (amount: number): XmlNode => ({ name: 'tint', attrs: { val: String(amount) }, children: [], value: '' });
    const opacityOf = (color: PptxColor | undefined) => color && color.alpha < 1 ? Math.round(color.alpha * 100) : undefined;
    const backgroundOf = (owner: XmlNode | undefined) => {
      const background = child(child(owner, 'cSld'), 'bg');
      return paint(child(child(background, 'bgPr'), 'solidFill')) ?? paint(child(background, 'bgRef'));
    };
    page.background = firstOf([slide, layout, master].map(backgroundOf))?.hex;

    let serial = 0, groupSerial = 0;
    const nextId = () => `${page.id}-element-${++serial}`;

    const inheritedPlaceholder = (shape: XmlNode): Placeholder | undefined => {
      const ph = placeholderOf(shape);
      if (!ph) return undefined;
      const kind = masterKind(ph.attrs.type), inherited: XmlNode[] = [];
      const inLayout = shapesOf(layoutRoot, 'sldLayout').find(s => {
        const own = placeholderOf(s);
        return own && (ph.attrs.idx !== undefined ? own.attrs.idx === ph.attrs.idx : masterKind(own.attrs.type) === kind);
      }) ?? shapesOf(layoutRoot, 'sldLayout').find(s => { const own = placeholderOf(s); return own && ph.attrs.type && own.attrs.type === ph.attrs.type; });
      if (inLayout) inherited.push(inLayout);
      const lookup = inLayout ? masterKind(placeholderOf(inLayout)?.attrs.type) : kind;
      const inMaster = shapesOf(masterRoot, 'sldMaster').find(s => { const own = placeholderOf(s); return own && masterKind(own.attrs.type) === lookup; });
      if (inMaster) inherited.push(inMaster);
      return { shapes: inherited, kind: lookup };
    };

    const fontName = (name: string | undefined) => name === '+mj-lt' ? theme.majorFont : !name || name === '+mn-lt' ? name ? theme.minorFont : undefined : name;

    const present = (nodes: (XmlNode | undefined)[]) => nodes.filter((n): n is XmlNode => Boolean(n));

    /** Text of a body as blocks, each with its resolved style. */
    function readBlocks(body: XmlNode, levelsFor: (level: number) => TextLevels, styleColor: PptxColor | undefined, elementId: string): TextBlock[] {
      const fit = child(child(body, 'bodyPr'), 'normAutofit');
      const fontScale = number(fit?.attrs.fontScale, 100000) / 100000, spacingCut = number(fit?.attrs.lnSpcReduction) / 100000;
      let simplified = false;
      const blocks = children(body, 'p').map(paragraph => {
        const props = child(paragraph, 'pPr'), { near, far } = levelsFor(number(props?.attrs.lvl) + 1), levels = [...near, ...far], chain = [props, ...levels];
        const paragraphValue = <T>(get: (node: XmlNode) => T | undefined) => firstOf(chain.map(node => node && get(node)));
        const runs = paragraph.children.filter(n => n.name === 'r' || n.name === 'fld');
        const styled = runs.filter(run => value(child(run, 't')).trim());
        const styleOf = (run: XmlNode | undefined) => {
          const own = child(run, 'rPr') ?? child(paragraph, 'endParaRPr'), sources = [own, ...levels.map(level => child(level, 'defRPr'))];
          const pick = <T>(get: (node: XmlNode) => T | undefined) => firstOf(sources.map(node => node && get(node)));
          return {
            size: number(pick(n => n.attrs.sz), DEFAULT_FONT_SIZE / POINT * 100) / 100 * POINT * fontScale,
            font: fontName(pick(n => child(n, 'latin')?.attrs.typeface)) ?? theme.minorFont,
            // The shape's style outranks the master's text styles, not the shape's own.
            color: firstOf([own, ...near.map(level => child(level, 'defRPr'))].map(n => n && paint(child(n, 'solidFill')))) ?? styleColor
              ?? firstOf(far.map(level => paint(child(child(level, 'defRPr'), 'solidFill')))) ?? schemeColor('tx1'),
            bold: pick(n => n.attrs.b) === '1',
            italic: pick(n => n.attrs.i) === '1',
          };
        };
        const style = styleOf(styled[0] ?? runs[0]);
        // Bold and italic are the paragraph's when most of its letters have them.
        let letters = 0, bold = 0, italic = 0;
        for (const run of styled) {
          const other = styleOf(run), length = value(child(run, 't')).length;
          letters += length;
          if (other.bold) bold += length;
          if (other.italic) italic += length;
          if (other.size !== style.size || other.font !== style.font || other.color?.hex !== style.color?.hex) simplified = true;
        }
        const isBold = letters ? bold * 2 > letters : style.bold, isItalic = letters ? italic * 2 > letters : style.italic;
        if (styled.some(run => styleOf(run).bold !== isBold || styleOf(run).italic !== isItalic)) simplified = true;
        const spacing = (name: string) => {
          const node = paragraphValue(n => child(n, name));
          const points = child(node, 'spcPts')?.attrs.val, percent = child(node, 'spcPct')?.attrs.val;
          return points !== undefined ? number(points) / 100 * POINT : percent !== undefined ? number(percent) / 100000 * style.size : 0;
        };
        const lines = paragraphValue(n => child(n, 'lnSpc'));
        const exact = child(lines, 'spcPts')?.attrs.val, percent = child(lines, 'spcPct')?.attrs.val;
        const lineHeight = exact !== undefined ? number(exact) / 100 * POINT / style.size : (number(percent, 100000) / 100000 - spacingCut) * NATURAL_LINE_HEIGHT;
        const text = paragraph.children.map(n => n.name === 'br' ? '\n' : n.name === 'r' || n.name === 'fld' ? value(child(n, 't')) : '').join('');
        const bullet = paragraphValue(n => child(n, 'buNone') ? '' : child(n, 'buChar')?.attrs.char);
        return {
          text: bullet && text.trim() ? `${bullet} ${text}` : text, fontSize: style.size, fontFamily: styledFamily(style.font, isBold, isItalic),
          color: style.color?.hex ?? '#1a1a1a', textAlign: ALIGN[paragraphValue(n => n.attrs.algn) ?? 'l'] ?? 'left',
          lineHeight, before: spacing('spcBef'), after: spacing('spcAft'),
        };
      });
      if (simplified) warn('text-style', 'Bold, italic and mixed styles inside a paragraph are simplified.', page.id, elementId);
      return blocks;
    }

    /** Places a text body in its box: one element when its style is uniform, one per paragraph otherwise. */
    function addText(body: XmlNode, box: Box, bodies: (XmlNode | undefined)[], levelsFor: (level: number) => TextLevels, styleColor: PptxColor | undefined, overrides: { anchor?: string; inset?: Partial<typeof DEFAULT_INSET> } = {}) {
      const id = nextId(), blocks = readBlocks(body, levelsFor, styleColor, id);
      if (!blocks.some(block => block.text.trim())) return;
      warn('text-layout', 'Text remains editable; its metrics depend on the font available.', page.id, id);
      const attribute = (name: string) => firstOf(bodies.map(node => node?.attrs[name]));
      const side = (name: string, key: keyof typeof DEFAULT_INSET) => overrides.inset?.[key] ?? (attribute(name) !== undefined ? number(attribute(name)) / EMU : DEFAULT_INSET[key]);
      const inset = { left: side('lIns', 'left'), top: side('tIns', 'top'), right: side('rIns', 'right'), bottom: side('bIns', 'bottom') };
      const verticalAlign = ANCHOR[overrides.anchor ?? attribute('anchor') ?? 't'] ?? 'top';
      const written = blocks.filter(block => block.text.trim()), first = written[0];
      const element = (block: TextBlock, extra: Partial<DocumentElement>): DocumentElement => ({
        ...box, id, kind: 'text', fontSize: block.fontSize, fontFamily: block.fontFamily, color: block.color,
        textAlign: block.textAlign, lineHeight: block.lineHeight, inset, verticalAlign, ...extra,
      });
      const uniform = blocks.every(block => !block.before && !block.after) && written.every(block =>
        block.fontSize === first.fontSize && block.fontFamily === first.fontFamily && block.color === first.color && block.textAlign === first.textAlign && block.lineHeight === first.lineHeight);
      if (uniform) { page.elements.push(element(first, { text: blocks.map(block => block.text).join('\n') })); return; }
      const textWidth = Math.max(1, box.width - inset.left - inset.right), room = box.height - inset.top - inset.bottom;
      const heights = blocks.map(block => estimateTextHeight(block.text, block.fontSize, block.lineHeight, textWidth));
      const total = blocks.reduce((sum, block, index) => sum + heights[index] + (index ? block.before : 0) + block.after, 0);
      let y = box.y + inset.top + (verticalAlign === 'middle' ? (room - total) / 2 : verticalAlign === 'bottom' ? room - total : 0);
      blocks.forEach((block, index) => {
        if (index) y += block.before;
        if (block.text.trim()) page.elements.push(element(block, { id: index ? nextId() : id, text: block.text, y, height: heights[index], verticalAlign: 'top', inset: { ...inset, top: 0, bottom: 0 } }));
        y += heights[index] + block.after;
      });
    }

    /** Fill and outline, from the shape itself, what it inherits, or its style reference. */
    function appearance(sources: (XmlNode | undefined)[], style: XmlNode | undefined, elementId: string) {
      const fillOwner = sources.find(node => node && ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill'].some(name => child(node, name)));
      let fill: PptxColor | undefined;
      if (fillOwner) {
        fill = paint(child(fillOwner, 'solidFill'));
        const gradient = child(fillOwner, 'gradFill');
        if (gradient) { fill = paint(descendants(gradient, 'gs')[0]); warn('shape-effects', 'Gradients are reduced to their first color.', page.id, elementId); }
      } else if (number(child(style, 'fillRef')?.attrs.idx)) fill = paint(child(style, 'fillRef'));
      const lineOwner = sources.map(node => child(node, 'ln')).find(node => node && node.children.some(n => n.name === 'noFill' || n.name === 'solidFill'));
      const lineProps = sources.map(node => child(node, 'ln')).find(Boolean);
      let stroke: PptxColor | undefined;
      if (lineOwner) stroke = paint(child(lineOwner, 'solidFill'));
      else if (number(child(style, 'lnRef')?.attrs.idx)) stroke = paint(child(style, 'lnRef'));
      const dash = child(lineProps, 'prstDash')?.attrs.val;
      if (sources.some(node => node && descendants(child(node, 'effectLst'), 'outerShdw').length)) warn('shape-effects', 'Shadows are not retained.', page.id, elementId);
      return {
        fill, stroke, strokeWidth: number(lineProps?.attrs.w, EMU) / EMU,
        strokeStyle: (!dash || dash === 'solid' ? undefined : /dot/i.test(dash) && !/dash/i.test(dash) ? 'dotted' : 'dashed') as DocumentElement['strokeStyle'],
        arrowStart: ['triangle', 'arrow', 'stealth'].includes(child(lineProps, 'headEnd')?.attrs.type ?? ''),
        arrowEnd: ['triangle', 'arrow', 'stealth'].includes(child(lineProps, 'tailEnd')?.attrs.type ?? ''),
      };
    }

    function addImage(node: XmlNode, box: Box, props: XmlNode | undefined, transformFlip: { flipH: boolean; flipV: boolean }, sourceRels: Map<string, Relationship>, id: string) {
      const blip = descendants(node, 'blip')[0];
      const imageRel = blip && sourceRels.get(relationId(blip, 'embed') ?? '');
      if (!imageRel || imageRel.external || !files[imageRel.target]) { warn('missing-image', 'Image is external or missing; no network request was made.', page.id, id); return; }
      let assetId = assetIds.get(imageRel.target);
      if (!assetId) {
        assetId = `asset-${assetIds.size + 1}`; assetIds.set(imageRel.target, assetId);
        const extension = imageRel.target.split('.').pop()?.toLowerCase();
        const mimeType = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
        doc.assets.push({ id: assetId, name: imageRel.target.split('/').pop()!, mimeType, bytes: files[imageRel.target], ...imageSize(files[imageRel.target]) });
        if (mimeType === 'application/octet-stream') warn('image-format', 'Embedded image needs conversion before browser rendering.', page.id, id);
      }
      const source = descendants(node, 'srcRect')[0], side = (name: string) => Math.max(0, number(source?.attrs[name]) / 100000);
      const crop = { left: side('l'), top: side('t'), right: side('r'), bottom: side('b') };
      const cropped = Object.values(crop).some(Boolean), asset = doc.assets.find(item => item.id === assetId);
      if (cropped && !asset?.width) warn('image-crop', 'Image cropping needs the image size, which could not be read.', page.id, id);
      const transparency = number(descendants(blip, 'alphaModFix')[0]?.attrs.amt, 100000) / 1000;
      if (child(props, 'prstGeom')?.attrs.prst === 'roundRect' || child(props, 'prstGeom')?.attrs.prst === 'ellipse') warn('image-mask', 'Rounded image masks are not retained.', page.id, id);
      page.elements.push({ ...box, id, kind: 'image', assetId, ...transformFlip, ...(cropped ? { crop } : {}), ...(transparency < 100 ? { opacity: Math.round(transparency) } : {}) });
    }

    function addTable(table: XmlNode, box: Box, transform: Transform) {
      const columns = children(child(table, 'tblGrid'), 'gridCol').map(column => number(column.attrs.w) / EMU * transform.sx);
      const options = child(table, 'tblPr'), styleId = value(child(options, 'tableStyleId')).trim(), styled = styleId === DEFAULT_TABLE_STYLE;
      let y = box.y;
      for (const [rowIndex, row] of children(table, 'tr').entries()) {
        const header = styled && options?.attrs.firstRow === '1' && rowIndex === 0;
        const bandIndex = rowIndex - (options?.attrs.firstRow === '1' ? 1 : 0);
        const rowFill = !styled ? undefined : header ? schemeColor('accent1') : options?.attrs.bandRow === '1' && bandIndex % 2 === 0 ? schemeColor('accent1', tint(40000)) : schemeColor('accent1', tint(20000));
        const rowHeight = number(row.attrs.h) / EMU * transform.sy;
        let x = box.x;
        children(row, 'tc').forEach((cell, index) => {
          const span = Math.max(1, number(cell.attrs.gridSpan, 1));
          const cellWidth = columns.slice(index, index + span).reduce((sum, column) => sum + column, 0);
          if (cell.attrs.hMerge !== '1' && cell.attrs.vMerge !== '1') {
            const props = child(cell, 'tcPr'), cellBox: Box = { x, y, width: cellWidth, height: rowHeight, groupIds: box.groupIds };
            const fill = paint(child(props, 'solidFill')) ?? rowFill;
            if (fill) page.elements.push({ ...cellBox, id: nextId(), kind: 'rectangle', fill: fill.hex, opacity: opacityOf(fill), ...(styled ? { stroke: schemeColor('lt1')?.hex, strokeWidth: 1 } : {}) });
            const border = (name: string, from: Point, to: Point) => {
              const line = child(props, name), color = paint(child(line, 'solidFill'));
              if (!color) return;
              const left = Math.min(from[0], to[0]), top = Math.min(from[1], to[1]);
              page.elements.push({ id: nextId(), kind: 'line', x: left, y: top, width: Math.abs(to[0] - from[0]), height: Math.abs(to[1] - from[1]), groupIds: box.groupIds,
                points: [[0, 0], [to[0] - from[0], to[1] - from[1]]], stroke: color.hex, opacity: opacityOf(color), strokeWidth: number(line?.attrs.w, EMU) / EMU });
            };
            border('lnT', [x, y], [x + cellWidth, y]); border('lnB', [x, y + rowHeight], [x + cellWidth, y + rowHeight]);
            border('lnL', [x, y], [x, y + rowHeight]); border('lnR', [x + cellWidth, y], [x + cellWidth, y + rowHeight]);
            const body = child(cell, 'txBody'), margin = (name: string, fallback: number) => props?.attrs[name] !== undefined ? number(props.attrs[name]) / EMU : fallback;
            if (body) addText(body, cellBox, [child(body, 'bodyPr')], level => ({ near: present([child(child(body, 'lstStyle'), `lvl${level}pPr`)]), far: present([child(defaultTextStyle, `lvl${level}pPr`)]) }), header ? schemeColor('lt1') : schemeColor('tx1'), {
              anchor: props?.attrs.anchor ?? 't',
              inset: { left: margin('marL', DEFAULT_INSET.left), right: margin('marR', DEFAULT_INSET.right), top: margin('marT', DEFAULT_INSET.top), bottom: margin('marB', DEFAULT_INSET.bottom) },
            });
          }
          x += cellWidth;
        });
        y += rowHeight;
      }
      if (styleId && !styled) warn('table-style', 'Table style presets are not applied; only direct cell formatting is kept.', page.id);
    }

    function shape(node: XmlNode, sourceRels: Map<string, Relationship>, isSlide: boolean, transform: Transform): void {
      if (!['sp', 'pic', 'cxnSp', 'grpSp', 'graphicFrame'].includes(node.name)) {
        if (node.name !== 'nvGrpSpPr' && node.name !== 'grpSpPr' && node.name !== 'extLst') warn('unsupported-object', `Object ${node.name} is not converted.`, page.id);
        return;
      }
      if (descendants(node, 'cNvPr')[0]?.attrs.hidden === '1') return;
      const placeholder = node.name === 'sp' ? inheritedPlaceholder(node) : undefined;
      if (!isSlide && placeholderOf(node)) return; // Layout and master placeholders are prompts, not artwork.
      const props = child(node, node.name === 'grpSp' ? 'grpSpPr' : 'spPr');
      const inheritedProps = placeholder?.shapes.map(s => child(s, 'spPr')) ?? [];
      const xfrm = node.name === 'graphicFrame' ? child(node, 'xfrm') : firstOf([props, ...inheritedProps].map(p => child(p, 'xfrm')));
      const off = child(xfrm, 'off'), ext = child(xfrm, 'ext');
      if (node.name === 'grpSp') {
        const chOff = child(xfrm, 'chOff'), chExt = child(xfrm, 'chExt');
        const sx = number(ext?.attrs.cx, 1) / (number(chExt?.attrs.cx, 1) || 1);
        const sy = number(ext?.attrs.cy, 1) / (number(chExt?.attrs.cy, 1) || 1);
        if (number(xfrm?.attrs.rot) || xfrm?.attrs.flipH === '1' || xfrm?.attrs.flipV === '1') warn('group-transform', 'Group rotation/reflection is not retained.', page.id);
        const nested: Transform = { x: transform.x + (number(off?.attrs.x) - number(chOff?.attrs.x) * sx) / EMU * transform.sx,
          y: transform.y + (number(off?.attrs.y) - number(chOff?.attrs.y) * sy) / EMU * transform.sy, sx: transform.sx * sx, sy: transform.sy * sy,
          groupIds: [`${page.id}-group-${++groupSerial}`, ...transform.groupIds] };
        node.children.forEach(n => shape(n, sourceRels, isSlide, nested));
        return;
      }
      const table = node.name === 'graphicFrame' ? descendants(node, 'tbl')[0] : undefined;
      if (!off && node.name === 'graphicFrame') { warn('unsupported-object', 'Charts, diagrams and embedded media are not converted.', page.id, nextId()); return; }
      if (!off || !ext) { warn('missing-geometry', 'Object has no geometry of its own or in its layout.', page.id, nextId()); return; }
      const box: Box = {
        x: transform.x + number(off.attrs.x) / EMU * transform.sx, y: transform.y + number(off.attrs.y) / EMU * transform.sy,
        width: number(ext.attrs.cx) / EMU * transform.sx, height: number(ext.attrs.cy) / EMU * transform.sy,
        rotation: number(xfrm?.attrs.rot) / 60000, groupIds: transform.groupIds.length ? transform.groupIds : undefined,
      };
      if (table) { addTable(table, box, transform); return; }
      if (node.name === 'graphicFrame') {
        // Keeps its place on the slide: a chart that vanished would go unnoticed.
        const id = nextId();
        warn('unsupported-object', 'Charts, diagrams and embedded media are not converted.', page.id, id);
        page.elements.push({ ...box, id, kind: 'rectangle', fill: PLACEHOLDER_FILL, stroke: PLACEHOLDER_STROKE, strokeWidth: 1 });
        return;
      }
      const flips = { flipH: xfrm?.attrs.flipH === '1', flipV: xfrm?.attrs.flipV === '1' };
      if (node.name === 'pic') {
        if (box.width <= 0 || box.height <= 0) { warn('invalid-geometry', 'Object has empty geometry.', page.id, nextId()); return; }
        addImage(node, box, props, flips, sourceRels, nextId());
        return;
      }
      const id = nextId(), style = child(node, 'style');
      const look = appearance([props, ...inheritedProps], style, id);
      const geometryOwner = [props, ...inheritedProps].find(p => child(p, 'custGeom') || child(p, 'prstGeom'));
      const custom = child(geometryOwner, 'custGeom'), preset = child(geometryOwner, 'prstGeom')?.attrs.prst;
      const isLine = node.name === 'cxnSp' || (preset !== undefined && CONNECTORS.test(preset));
      const painted: DocumentElement = {
        ...box, id, kind: 'rectangle', name: descendants(node, 'cNvPr')[0]?.attrs.name, fill: look.fill?.hex ?? 'transparent',
        stroke: look.stroke?.hex, strokeWidth: look.strokeWidth, strokeStyle: look.strokeStyle, opacity: opacityOf(look.fill) ?? opacityOf(look.stroke),
      };
      if (isLine) {
        if (box.width <= 0 && box.height <= 0) { warn('invalid-geometry', 'Object has empty geometry.', page.id, id); return; }
        if (look.stroke) page.elements.push({ ...painted, kind: 'line', fill: undefined, arrowStart: look.arrowStart, arrowEnd: look.arrowEnd,
          points: flipPoints(connectorPoints(preset, box.width, box.height), box.width, box.height, flips.flipH, flips.flipV) });
        return;
      }
      if (box.width <= 0 || box.height <= 0) { warn('invalid-geometry', 'Object has empty geometry.', page.id, id); return; }
      if (look.fill || look.stroke) {
        const points = custom ? customGeometry(custom, box.width, box.height, Boolean(look.fill)) : presetGeometry(preset, box.width, box.height);
        if (points) page.elements.push({ ...painted, kind: 'line', points: flipPoints(points, box.width, box.height, flips.flipH, flips.flipV) });
        else {
          const basic = BASIC_SHAPES[preset ?? 'rect'];
          page.elements.push({ ...painted, kind: basic?.kind ?? 'rectangle', rounded: basic?.rounded });
          if (custom || !basic) warn('shape-geometry', `Geometry ${preset ?? 'custom'} is approximated as a rectangle.`, page.id, id);
        }
      }
      const body = child(node, 'txBody');
      if (body) {
        const bodies = [body, ...(placeholder?.shapes.map(s => child(s, 'txBody')) ?? [])];
        const styleKey = placeholder?.kind === 'title' ? 'titleStyle' : placeholder?.kind === 'body' ? 'bodyStyle' : 'otherStyle';
        const levelsFor = (level: number) => ({
          near: present(bodies.map(b => child(child(b, 'lstStyle'), `lvl${level}pPr`))),
          far: present([child(child(textStyles, styleKey), `lvl${level}pPr`), child(defaultTextStyle, `lvl${level}pPr`)]),
        });
        const fontColor = paint(child(style, 'fontRef'));
        addText(body, box, bodies.map(b => child(b, 'bodyPr')), levelsFor, fontColor);
      }
    }

    const root: Transform = { x: 0, y: 0, sx: 1, sy: 1, groupIds: [] };
    const tree = (owner: XmlNode | undefined) => child(child(owner, 'cSld'), 'spTree')?.children ?? [];
    if (slide.attrs.showMasterSp !== '0' && layout?.attrs.showMasterSp !== '0' && masterPath) tree(master).forEach(n => shape(n, relationships(masterPath), false, root));
    if (slide.attrs.showMasterSp !== '0' && layoutPath) tree(layout).forEach(n => shape(n, relationships(layoutPath), false, root));
    tree(slide).forEach(n => shape(n, slideRels, true, root));
    const notes = [...slideRels.values()].find(r => r.type.endsWith('/notesSlide') && !r.external);
    if (notes && files[notes.target]) page.notes = descendants(read(notes.target), 't').map(value).join('\n');
    if (child(slide, 'timing') || child(slide, 'transition')) warn('animation', 'Animation and transitions are not imported.', page.id);
  }
  return doc;
}
