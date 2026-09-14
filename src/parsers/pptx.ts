import { unzipSync, strFromU8 } from 'fflate';
import { DocumentImportError, readBytes, type ParseLimits, type ImportDocument, type DocumentElement, type DocumentPage } from '../documents/model';
import { xml, child, children, descendants, value, relationId, type XmlNode } from './xml';

const EMU = 9525; // 96 CSS pixels per inch, 914400 EMU per inch.
const number = (v: string | undefined, fallback = 0) => v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback;

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

/** Reads slide order, direct text/shapes/images and notes from an OOXML ZIP. */
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
  const read = (name: string) => {
    if (!files[name]) throw new DocumentImportError('invalid-file', `Missing package part: ${name}`);
    return xml(strFromU8(files[name]));
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
  const doc: ImportDocument = { format: 'pptx', pages: [], assets: [], warnings: [] };
  const assetIds = new Map<string, string>();
  const warn = (code: string, message: string, pageId: string, elementId?: string) => doc.warnings.push({ code, message, pageId, elementId });

  for (const [pageIndex, slideId] of slideIds.entries()) {
    const rel = rels.get(relationId(slideId, 'id') ?? '');
    if (!rel || rel.external || !rel.type.endsWith('/slide')) throw new DocumentImportError('invalid-file', 'Invalid slide relationship.');
    const slide = child(read(rel.target), 'sld');
    if (!slide) throw new DocumentImportError('invalid-file', 'Missing slide root.');
    const page: DocumentPage = { id: `slide-${pageIndex + 1}`, name: child(slide, 'cSld')?.attrs.name || `Slide ${pageIndex + 1}`, width, height, elements: [] };
    doc.pages.push(page);
    // Indexing preserves source text even when a placeholder lacks direct geometry.
    page.extractedText = descendants(slide, 't').map(value).join('\n');
    const slideRels = relationships(rel.target);
    const color = (node: XmlNode | undefined): string | undefined => {
      const rgb = descendants(node, 'srgbClr')[0]?.attrs.val;
      if (rgb && /^[0-9a-f]{6}$/i.test(rgb)) return `#${rgb}`;
      if (descendants(node, 'schemeClr').length) warn('theme-color', 'Theme color requires master/theme resolution; a fallback is used.', page.id);
      return undefined;
    };
    page.background = color(child(child(slide, 'cSld'), 'bg'));
    if ([...slideRels.values()].some(r => r.type.endsWith('/slideLayout'))) {
      warn('master-layout', 'Master/layout artwork, inherited placeholder geometry and theme styles are not resolved.', page.id);
    }
    let serial = 0;
    function shape(node: XmlNode, transform = { x: 0, y: 0, sx: 1, sy: 1 }): void {
      if (node.name === 'nvGrpSpPr' || node.name === 'grpSpPr' || node.name === 'extLst') return;
      const props = child(node, node.name === 'grpSp' ? 'grpSpPr' : 'spPr');
      const xfrm = child(props, 'xfrm');
      const off = child(xfrm, 'off'), ext = child(xfrm, 'ext');
      if (node.name === 'grpSp') {
        const chOff = child(xfrm, 'chOff'), chExt = child(xfrm, 'chExt');
        const sx = number(ext?.attrs.cx, 1) / (number(chExt?.attrs.cx, 1) || 1);
        const sy = number(ext?.attrs.cy, 1) / (number(chExt?.attrs.cy, 1) || 1);
        if (number(xfrm?.attrs.rot) || xfrm?.attrs.flipH === '1' || xfrm?.attrs.flipV === '1') warn('group-transform', 'Group rotation/reflection is not retained.', page.id);
        const nested = { x: transform.x + (number(off?.attrs.x) - number(chOff?.attrs.x) * sx) / EMU * transform.sx,
          y: transform.y + (number(off?.attrs.y) - number(chOff?.attrs.y) * sy) / EMU * transform.sy, sx: transform.sx * sx, sy: transform.sy * sy };
        node.children.forEach(n => shape(n, nested));
        return;
      }
      const id = `${page.id}-element-${++serial}`;
      if (node.name !== 'sp' && node.name !== 'pic') {
        warn('unsupported-object', `Object ${node.name} is not converted (charts, tables, connectors and media need an adapter).`, page.id, id); return;
      }
      if (!off || !ext) { warn('missing-geometry', 'Object has no direct geometry; inherited layout is required.', page.id, id); return; }
      const element: DocumentElement = { id, kind: 'rectangle', name: descendants(node, 'cNvPr')[0]?.attrs.name,
        x: transform.x + number(off.attrs.x) / EMU * transform.sx, y: transform.y + number(off.attrs.y) / EMU * transform.sy,
        width: number(ext.attrs.cx) / EMU * transform.sx, height: number(ext.attrs.cy) / EMU * transform.sy,
        rotation: number(xfrm?.attrs.rot) / 60000, fill: color(child(props, 'solidFill')) ?? 'transparent' };
      if (element.width <= 0 || element.height <= 0) { warn('invalid-geometry', 'Object has empty geometry.', page.id, id); return; }
      const line = child(props, 'ln');
      element.stroke = color(child(line, 'solidFill'));
      element.strokeWidth = number(line?.attrs.w, EMU) / EMU;
      if (child(line, 'prstDash')) warn('line-style', 'Dash patterns use a solid stroke.', page.id, id);
      if (xfrm?.attrs.flipH === '1' || xfrm?.attrs.flipV === '1') warn('reflection', 'Object reflection is not retained.', page.id, id);
      if (node.name === 'pic') {
        const blip = descendants(node, 'blip')[0];
        const imageRel = blip && slideRels.get(relationId(blip, 'embed') ?? '');
        if (!imageRel || imageRel.external || !files[imageRel.target]) { warn('missing-image', 'Image is external or missing; no network request was made.', page.id, id); return; }
        let assetId = assetIds.get(imageRel.target);
        if (!assetId) {
          assetId = `asset-${assetIds.size + 1}`; assetIds.set(imageRel.target, assetId);
          const extension = imageRel.target.split('.').pop()?.toLowerCase();
          const mimeType = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
          doc.assets.push({ id: assetId, name: imageRel.target.split('/').pop()!, mimeType, bytes: files[imageRel.target] });
          if (mimeType === 'application/octet-stream') warn('image-format', 'Embedded image needs conversion before browser rendering.', page.id, id);
        }
        element.kind = 'image'; element.assetId = assetId;
        if (descendants(node, 'srcRect').length) warn('image-crop', 'Image cropping is approximated by its destination box.', page.id, id);
      } else {
        const textBody = child(node, 'txBody');
        const text = children(textBody, 'p').map(p => p.children.map(n => n.name === 'br' ? '\n' : value(child(n, 't'))).join('')).join('\n');
        if (text) {
          element.kind = 'text'; element.text = text;
          const style = descendants(textBody, 'rPr')[0] ?? descendants(textBody, 'defRPr')[0];
          element.fontSize = number(style?.attrs.sz, 1800) / 100 * 96 / 72;
          element.fontFamily = child(style, 'latin')?.attrs.typeface;
          element.color = color(child(style, 'solidFill')) ?? '#1a1a1a';
          warn('text-layout', 'Text remains editable; run styling, bullets, insets and line metrics are approximated.', page.id, id);
          if (element.fill !== 'transparent') page.elements.push({ ...element, id: `${id}-background`, kind: 'rectangle', text: undefined });
        } else {
          const geometry = child(props, 'prstGeom')?.attrs.prst;
          element.kind = geometry === 'ellipse' ? 'ellipse' : 'rectangle';
          if (!element.stroke && element.fill === 'transparent' && !child(props, 'noFill') && !child(line, 'noFill')) {
            element.stroke = '#1a1a1a';
            warn('shape-style', 'No explicit shape color; using a visible fallback stroke.', page.id, id);
          }
          if (geometry !== 'rect' && geometry !== 'ellipse') warn('shape-geometry', `Geometry ${geometry ?? 'custom'} is approximated as a rectangle.`, page.id, id);
        }
        if (descendants(props, 'gradFill').length || descendants(props, 'effectLst').some(n => n.children.length)) warn('shape-effects', 'Gradients and effects are not retained.', page.id, id);
      }
      page.elements.push(element);
    }
    children(child(slide, 'cSld'), 'spTree')[0]?.children.forEach(n => shape(n));
    const notes = [...slideRels.values()].find(r => r.type.endsWith('/notesSlide') && !r.external);
    if (notes && files[notes.target]) page.notes = descendants(read(notes.target), 't').map(value).join('\n');
    if (child(slide, 'timing') || child(slide, 'transition')) warn('animation', 'Animation and transitions are not imported.', page.id);
  }
  return doc;
}
