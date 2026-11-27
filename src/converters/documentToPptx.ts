import { strToU8, zipSync, type Zippable } from 'fflate';
import type { DocumentAsset, DocumentElement, DocumentPage, ImportDocument, ImportNote } from '../documents/model';

/**
 * Modelo de documento → PowerPoint (.pptx) o plantilla (.potx).
 *
 * El inverso de `parsePptx`, con la misma unidad (px CSS a 96 ppp) y el mismo
 * modelo intermedio, así que lo que sale se puede volver a importar. Escribe
 * un paquete OOXML completo y mínimo (maestro, un diseño en blanco, tema, notas)
 * con `fflate`, sin dependencias nuevas. Todo es editable en destino: formas
 * nativas, cuadros de texto, líneas como geometría propia e imágenes con su
 * recorte.
 *
 * Una presentación tiene UN tamaño de diapositiva: es el de la primera página.
 * Una página de otro tamaño se escala, sin deformar, y se centra.
 */

export interface PptxOptions {
  /** `.potx`: el mismo paquete marcado como plantilla. */
  template?: boolean;
  title?: string;
  /** Idioma de los textos (`es-ES`), para la corrección ortográfica de destino. */
  lang?: string;
  /** Fecha de creación (por defecto, ahora). */
  created?: Date;
}

export interface PptxResult {
  bytes: Uint8Array;
  mimeType: string;
  extension: 'pptx' | 'potx';
  warnings: ImportNote[];
}

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const POTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.template';

const EMU = 9525; // 914400 EMU por pulgada, 96 px por pulgada.
/** PowerPoint admite diapositivas de 1 a 56 pulgadas por lado. */
const MIN_SLIDE = 914400, MAX_SLIDE = 51206400;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const IMAGE_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/tiff': 'tiff' };

/** Texto para XML: escapa y quita los caracteres de control que XML 1.0 prohíbe. */
export function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const emu = (px: number) => Math.round(px * EMU);

/** `#rgb`, `#rrggbb`, `#rrggbbaa` → `{ hex: 'RRGGBB', alpha: 0–1 }`; cualquier otra cosa, null. */
export function parseColor(color: string | undefined): { hex: string; alpha: number } | null {
  if (!color) return null;
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return null;
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  if (m) return { hex: `${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase(), alpha: 1 };
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(c);
  if (m) return { hex: m[1].toUpperCase(), alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex, alpha: m[4] !== undefined ? Math.max(0, Math.min(1, Number(m[4]))) : 1 };
  }
  const named: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF' };
  return named[c] ? { hex: named[c], alpha: 1 } : null;
}

function solid(color: string | undefined, opacity = 1): string {
  const parsed = parseColor(color);
  if (!parsed) return '<a:noFill/>';
  const alpha = Math.round(parsed.alpha * opacity * 100000);
  return `<a:solidFill><a:srgbClr val="${parsed.hex}">${alpha < 100000 ? `<a:alpha val="${alpha}"/>` : ''}</a:srgbClr></a:solidFill>`;
}

function outline(el: DocumentElement, opacity: number): string {
  if (!parseColor(el.stroke)) return '<a:ln><a:noFill/></a:ln>';
  const dash = el.strokeStyle === 'dashed' ? '<a:prstDash val="dash"/>' : el.strokeStyle === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
  const head = el.arrowStart ? '<a:headEnd type="triangle"/>' : '';
  const tail = el.arrowEnd ? '<a:tailEnd type="triangle"/>' : '';
  return `<a:ln w="${emu(Math.max(0.25, el.strokeWidth ?? 1))}" cap="rnd">${solid(el.stroke, opacity)}${dash}<a:round/>${head}${tail}</a:ln>`;
}

interface Placement { scale: number; dx: number; dy: number }

function xfrm(el: { x: number; y: number; width: number; height: number; rotation?: number; flipH?: boolean; flipV?: boolean }, at: Placement): string {
  const rot = el.rotation ? Math.round((((el.rotation % 360) + 360) % 360) * 60000) : 0;
  const attrs = `${rot ? ` rot="${rot}"` : ''}${el.flipH ? ' flipH="1"' : ''}${el.flipV ? ' flipV="1"' : ''}`;
  return `<a:xfrm${attrs}><a:off x="${emu(at.dx + el.x * at.scale)}" y="${emu(at.dy + el.y * at.scale)}"/>` +
    `<a:ext cx="${Math.max(1, emu(el.width * at.scale))}" cy="${Math.max(1, emu(el.height * at.scale))}"/></a:xfrm>`;
}

const PRESET: Partial<Record<DocumentElement['kind'], string>> = { rectangle: 'rect', ellipse: 'ellipse', diamond: 'diamond' };

/** Una diapositiva: fondo, formas en orden de pila, notas y transición. */
function slideXml(page: DocumentPage, at: Placement, ctx: SlideContext): string {
  let id = 1;
  const shapes: string[] = [];
  const nv = (name: string, extra = '') => `<p:cNvPr id="${++id}" name="${xmlText(name)} ${id}"/>${extra}`;
  for (const el of page.elements) {
    const opacity = (el.opacity ?? 100) / 100;
    if (el.kind === 'image') {
      const rid = el.assetId ? ctx.imageRel(el.assetId) : null;
      if (!rid) continue;
      const c = el.crop;
      const crop = c ? `<a:srcRect l="${Math.round(c.left * 100000)}" t="${Math.round(c.top * 100000)}" r="${Math.round(c.right * 100000)}" b="${Math.round(c.bottom * 100000)}"/>` : '';
      const alpha = opacity < 1 ? `<a:alphaModFix amt="${Math.round(opacity * 100000)}"/>` : '';
      shapes.push(`<p:pic><p:nvPicPr>${nv('Picture', '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/>')}</p:nvPicPr>` +
        `<p:blipFill><a:blip r:embed="${rid}">${alpha}</a:blip>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
        `<p:spPr>${xfrm(el, at)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
    } else if (el.kind === 'text') {
      shapes.push(textBox(el, at, nv, ctx.lang));
    } else if (el.kind === 'line') {
      const points = el.points ?? [];
      if (points.length < 2) continue;
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const w = Math.max(1, Math.max(...xs) - minX), h = Math.max(1, Math.max(...ys) - minY);
      const pw = Math.max(1, emu(w)), ph = Math.max(1, emu(h));
      const closed = Boolean(el.fill);
      const path = points.map(([x, y], i) => `<a:${i ? 'lnTo' : 'moveTo'}><a:pt x="${emu(x - minX)}" y="${emu(y - minY)}"/></a:${i ? 'lnTo' : 'moveTo'}>`).join('') + (closed ? '<a:close/>' : '');
      const box = { ...el, x: el.x + minX, y: el.y + minY, width: w, height: h };
      shapes.push(`<p:sp><p:nvSpPr>${nv('Freeform', '<p:cNvSpPr/><p:nvPr/>')}</p:nvSpPr><p:spPr>${xfrm(box, at)}` +
        `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${pw}" h="${ph}"${closed ? '' : ' fill="none"'}>${path}</a:path></a:pathLst></a:custGeom>` +
        `${closed ? solid(el.fill, opacity) : '<a:noFill/>'}${outline(el, opacity)}</p:spPr></p:sp>`);
    } else {
      const preset = el.kind === 'rectangle' && el.rounded ? 'roundRect' : PRESET[el.kind] ?? 'rect';
      const adj = preset === 'roundRect' ? '<a:gd name="adj" fmla="val 8000"/>' : '';
      shapes.push(`<p:sp><p:nvSpPr>${nv(preset === 'ellipse' ? 'Oval' : preset === 'diamond' ? 'Diamond' : 'Rectangle', '<p:cNvSpPr/><p:nvPr/>')}</p:nvSpPr>` +
        `<p:spPr>${xfrm(el, at)}<a:prstGeom prst="${preset}"><a:avLst>${adj}</a:avLst></a:prstGeom>${solid(el.fill, opacity)}${outline(el, opacity)}</p:spPr></p:sp>`);
    }
  }
  const bg = parseColor(page.background)
    ? `<p:bg><p:bgPr>${solid(page.background)}<a:effectLst/></p:bgPr></p:bg>` : '';
  const transition = page.transition === 'fade' ? '<p:transition spd="med"><p:fade/></p:transition>' : '';
  return `${XML_HEAD}<p:sld ${NS}${page.hidden ? ' show="0"' : ''}><p:cSld name="${xmlText(page.name)}">${bg}<p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    `${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transition}</p:sld>`;
}

function textBox(el: DocumentElement, at: Placement, nv: (name: string, extra?: string) => string, lang: string): string {
  const opacity = (el.opacity ?? 100) / 100;
  // px de escena → centésimas de punto, escalados con la página.
  const size = Math.max(100, Math.round((el.fontSize ?? 20) * at.scale * 75));
  const font = el.fontFamily ? `<a:latin typeface="${xmlText(el.fontFamily)}"/><a:ea typeface="${xmlText(el.fontFamily)}"/><a:cs typeface="${xmlText(el.fontFamily)}"/>` : '';
  const algn = el.textAlign === 'center' ? 'ctr' : el.textAlign === 'right' ? 'r' : 'l';
  // En puntos exactos: `spcPct` es relativo al interlineado sencillo de la
  // fuente (≈1,2× su tamaño), no al tamaño, y salía más alto que en el lienzo
  // y más alto aún al volver a importarlo (`parsePptx` lo lee así).
  const spacing = Math.round(size * (el.lineHeight ?? 1.25));
  const run = `<a:rPr lang="${lang}" sz="${size}" dirty="0">${solid(el.color ?? '#1a1a1a', opacity)}${font}</a:rPr>`;
  const paragraphs = (el.text ?? '').split('\n').map((line) =>
    `<a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPts val="${spacing}"/></a:lnSpc></a:pPr>` +
    (line ? `<a:r>${run}<a:t>${xmlText(line)}</a:t></a:r>` : '') +
    `<a:endParaRPr lang="${lang}" sz="${size}" dirty="0"/></a:p>`).join('');
  const anchor = el.verticalAlign === 'middle' ? 'ctr' : el.verticalAlign === 'bottom' ? 'b' : 't';
  // Un pelo más ancho: con otra métrica de la misma fuente, la última palabra
  // de una línea no salta a la siguiente por un píxel.
  const box = { ...el, width: el.width * 1.02 };
  return `<p:sp><p:nvSpPr>${nv('TextBox', '<p:cNvSpPr txBox="1"/><p:nvPr/>')}</p:nvSpPr>` +
    `<p:spPr>${xfrm(box, at)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

interface SlideContext {
  imageRel: (assetId: string) => string | null;
  lang: string;
}

function notesXml(notes: string, lang: string): string {
  const paragraphs = notes.split('\n').map((line) =>
    `<a:p>${line ? `<a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${xmlText(line)}</a:t></a:r>` : ''}<a:endParaRPr lang="${lang}" dirty="0"/></a:p>`).join('');
  return `${XML_HEAD}<p:notes ${NS}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    // Con su propia geometría (página de notas de 7,5 × 10 pulgadas): el maestro
    // de notas va vacío y no hay de quién heredarla.
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>` +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
}

function rels(items: { id: string; type: string; target: string }[]): string {
  return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    items.map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${xmlText(r.target)}"/>`).join('') + '</Relationships>';
}

function theme(name: string, font: string): string {
  const f = xmlText(font);
  const fills = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const line = (w: number) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
  const color = (n: string, hex: string) => `<a:${n}><a:srgbClr val="${hex}"/></a:${n}>`;
  return `${XML_HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${xmlText(name)}"><a:themeElements>` +
    `<a:clrScheme name="${xmlText(name)}"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>` +
    color('dk2', '3F3B36') + color('lt2', 'EFECE6') + color('accent1', '3A39F5') + color('accent2', 'E0533D') + color('accent3', '6E6962') +
    color('accent4', 'E3A33A') + color('accent5', '2E8B57') + color('accent6', '8F93F0') + color('hlink', '3A39F5') + color('folHlink', '6E6962') + '</a:clrScheme>' +
    `<a:fontScheme name="${xmlText(name)}"><a:majorFont><a:latin typeface="${f}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="${f}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="${xmlText(name)}"><a:fillStyleLst>${fills}</a:fillStyleLst><a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst>` +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    `<a:bgFillStyleLst>${fills}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

const CLR_MAP = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';
const EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
const LEVEL = '<a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>';

/** La familia que más texto lleva: la del tema, para lo que se escriba nuevo en destino. */
function mainFont(doc: ImportDocument): string {
  const count = new Map<string, number>();
  for (const page of doc.pages) for (const el of page.elements) {
    if (el.kind === 'text' && el.fontFamily) count.set(el.fontFamily, (count.get(el.fontFamily) ?? 0) + (el.text?.length ?? 0));
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Calibri';
}

/** Tamaño de diapositiva válido para PowerPoint, sin deformar: el de la primera página. */
function slideSize(doc: ImportDocument, warnings: ImportNote[]): { cx: number; cy: number } {
  const first = doc.pages[0];
  let cx = emu(first?.width ?? 1920), cy = emu(first?.height ?? 1080);
  const big = Math.max(cx, cy) / MAX_SLIDE, small = Math.min(cx, cy) / MIN_SLIDE;
  let k = 1;
  if (big > 1) k = 1 / big;
  else if (small < 1) k = 1 / small;
  if (k !== 1) {
    warnings.push({ code: 'slide-size-scaled', message: 'The page size is outside what PowerPoint accepts; slides are scaled to fit.' });
    cx = Math.round(cx * k);
    cy = Math.round(cy * k);
  }
  return { cx: Math.min(MAX_SLIDE, Math.max(MIN_SLIDE, cx)), cy: Math.min(MAX_SLIDE, Math.max(MIN_SLIDE, cy)) };
}

export function documentToPptx(doc: ImportDocument, options: PptxOptions = {}): PptxResult {
  const warnings: ImportNote[] = [];
  const pages = doc.pages.length ? doc.pages : [{ id: 'empty', name: '1', width: 1920, height: 1080, elements: [] } as DocumentPage];
  const lang = options.lang ?? 'es-ES';
  const { cx, cy } = slideSize({ ...doc, pages }, warnings);
  const slideW = cx / EMU, slideH = cy / EMU;
  const hasNotes = pages.some((p) => p.notes?.trim());
  const files: Zippable = {};
  const put = (path: string, text: string) => { files[path] = strToU8(text); };

  // Imágenes: una por asset, compartida entre diapositivas.
  const media = new Map<string, { path: string; ext: string }>();
  const assetById = new Map<string, DocumentAsset>(doc.assets.map((a) => [a.id, a]));
  const mediaFor = (assetId: string) => {
    const known = media.get(assetId);
    if (known) return known;
    const asset = assetById.get(assetId);
    const ext = asset ? IMAGE_EXT[asset.mimeType.toLowerCase()] : undefined;
    if (!asset || !ext) {
      warnings.push({ code: 'image-format', message: `Image ${assetId} (${asset?.mimeType ?? 'missing'}) is not a format PowerPoint opens; it is left out.`, elementId: assetId });
      return null;
    }
    const entry = { path: `media/image${media.size + 1}.${ext}`, ext };
    media.set(assetId, entry);
    files[`ppt/${entry.path}`] = [asset.bytes, { level: 0 }];
    return entry;
  };

  const slideIds: string[] = [];
  pages.forEach((page, index) => {
    const n = index + 1;
    // Otra medida que la presentación: escalada sin deformar y centrada.
    const scale = Math.min(slideW / page.width, slideH / page.height);
    if (Math.abs(scale - 1) > 0.001 && index > 0) {
      warnings.push({ code: 'page-size-mixed', message: 'A page with another size is scaled to the presentation size.', pageId: page.id });
    }
    const at: Placement = { scale, dx: (slideW - page.width * scale) / 2, dy: (slideH - page.height * scale) / 2 };
    const slideRels: { id: string; type: string; target: string }[] = [{ id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }];
    const imageRels = new Map<string, string>();
    const ctx: SlideContext = {
      lang,
      imageRel: (assetId) => {
        const known = imageRels.get(assetId);
        if (known) return known;
        const entry = mediaFor(assetId);
        if (!entry) return null;
        const id = `rId${slideRels.length + 1}`;
        slideRels.push({ id, type: 'image', target: `../${entry.path}` });
        imageRels.set(assetId, id);
        return id;
      },
    };
    put(`ppt/slides/slide${n}.xml`, slideXml(page, at, ctx));
    if (page.notes?.trim()) {
      slideRels.push({ id: `rId${slideRels.length + 1}`, type: 'notesSlide', target: `../notesSlides/notesSlide${n}.xml` });
      put(`ppt/notesSlides/notesSlide${n}.xml`, notesXml(page.notes, lang));
      put(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, rels([
        { id: 'rId1', type: 'notesMaster', target: '../notesMasters/notesMaster1.xml' },
        { id: 'rId2', type: 'slide', target: `../slides/slide${n}.xml` },
      ]));
    }
    put(`ppt/slides/_rels/slide${n}.xml.rels`, rels(slideRels));
    slideIds.push(`<p:sldId id="${255 + n}" r:id="rId${n + 1}"/>`);
  });

  const font = mainFont(doc);
  const title = options.title?.trim() || pages[0]?.name || 'Presentación';
  const presRels = [
    { id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' },
    ...pages.map((_, i) => ({ id: `rId${i + 2}`, type: 'slide', target: `slides/slide${i + 1}.xml` })),
  ];
  let next = pages.length + 2;
  const notesMasterRel = hasNotes ? `rId${next++}` : null;
  if (notesMasterRel) presRels.push({ id: notesMasterRel, type: 'notesMaster', target: 'notesMasters/notesMaster1.xml' });
  presRels.push(
    { id: `rId${next++}`, type: 'presProps', target: 'presProps.xml' },
    { id: `rId${next++}`, type: 'viewProps', target: 'viewProps.xml' },
    { id: `rId${next++}`, type: 'theme', target: 'theme/theme1.xml' },
    { id: `rId${next++}`, type: 'tableStyles', target: 'tableStyles.xml' },
  );

  put('ppt/presentation.xml', `${XML_HEAD}<p:presentation ${NS} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    (notesMasterRel ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesMasterRel}"/></p:notesMasterIdLst>` : '') +
    `<p:sldIdLst>${slideIds.join('')}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/>` +
    `<p:defaultTextStyle><a:defPPr><a:defRPr lang="${lang}"/></a:defPPr>${LEVEL}</p:defaultTextStyle></p:presentation>`);
  put('ppt/_rels/presentation.xml.rels', rels(presRels));
  put('ppt/presProps.xml', `${XML_HEAD}<p:presentationPr ${NS}/>`);
  put('ppt/viewProps.xml', `${XML_HEAD}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  put('ppt/tableStyles.xml', `${XML_HEAD}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  put('ppt/theme/theme1.xml', theme('Polimake', font));
  put('ppt/slideMasters/slideMaster1.xml', `${XML_HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld>` +
    `<p:clrMap ${CLR_MAP}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `<p:txStyles><p:titleStyle>${LEVEL}</p:titleStyle><p:bodyStyle>${LEVEL}</p:bodyStyle><p:otherStyle>${LEVEL}</p:otherStyle></p:txStyles></p:sldMaster>`);
  put('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([
    { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
    { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' },
  ]));
  put('ppt/slideLayouts/slideLayout1.xml', `${XML_HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  put('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([{ id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]));
  if (hasNotes) {
    put('ppt/notesMasters/notesMaster1.xml', `${XML_HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld>` +
      `<p:clrMap ${CLR_MAP}/><p:notesStyle>${LEVEL}</p:notesStyle></p:notesMaster>`);
    put('ppt/notesMasters/_rels/notesMaster1.xml.rels', rels([{ id: 'rId1', type: 'theme', target: '../theme/theme2.xml' }]));
    put('ppt/theme/theme2.xml', theme('Polimake notes', font));
  }

  const created = (options.created ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  put('docProps/core.xml', `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xmlText(title)}</dc:title><dc:creator>Polimake</dc:creator><cp:lastModifiedBy>Polimake</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`);
  put('docProps/app.xml', `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Polimake</Application><Slides>${pages.length}</Slides><Notes>${pages.filter((p) => p.notes?.trim()).length}</Notes><HiddenSlides>${pages.filter((p) => p.hidden).length}</HiddenSlides></Properties>`);
  put('_rels/.rels', rels([
    { id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' },
  ]).replace('</Relationships>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`));

  const ct = 'application/vnd.openxmlformats-officedocument';
  const overrides = [
    [`/ppt/presentation.xml`, `${ct}.presentationml.${options.template ? 'template' : 'presentation'}.main+xml`],
    ['/ppt/presProps.xml', `${ct}.presentationml.presProps+xml`],
    ['/ppt/viewProps.xml', `${ct}.presentationml.viewProps+xml`],
    ['/ppt/tableStyles.xml', `${ct}.presentationml.tableStyles+xml`],
    ['/ppt/theme/theme1.xml', `${ct}.theme+xml`],
    ['/ppt/slideMasters/slideMaster1.xml', `${ct}.presentationml.slideMaster+xml`],
    ['/ppt/slideLayouts/slideLayout1.xml', `${ct}.presentationml.slideLayout+xml`],
    ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
    ['/docProps/app.xml', `${ct}.extended-properties+xml`],
    ...pages.map((_, i) => [`/ppt/slides/slide${i + 1}.xml`, `${ct}.presentationml.slide+xml`]),
    ...(hasNotes ? [
      ['/ppt/notesMasters/notesMaster1.xml', `${ct}.presentationml.notesMaster+xml`],
      ['/ppt/theme/theme2.xml', `${ct}.theme+xml`],
      ...pages.flatMap((p, i) => (p.notes?.trim() ? [[`/ppt/notesSlides/notesSlide${i + 1}.xml`, `${ct}.presentationml.notesSlide+xml`]] : [])),
    ] : []),
  ];
  const defaults = [['rels', 'application/vnd.openxmlformats-package.relationships+xml'], ['xml', 'application/xml'],
    ...[...new Set([...media.values()].map((m) => m.ext))].map((ext) => [ext, `image/${ext}`])];
  put('[Content_Types].xml', `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    defaults.map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`).join('') +
    overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('') + '</Types>');

  // [Content_Types].xml primero: algunos lectores lo esperan como primera entrada.
  const ordered: Zippable = { '[Content_Types].xml': files['[Content_Types].xml'] };
  for (const [path, data] of Object.entries(files)) if (path !== '[Content_Types].xml') ordered[path] = data;
  return {
    bytes: zipSync(ordered, { level: 6 }),
    mimeType: options.template ? POTX_MIME : PPTX_MIME,
    extension: options.template ? 'potx' : 'pptx',
    warnings: [...doc.warnings, ...warnings],
  };
}
