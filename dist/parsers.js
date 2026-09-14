import { readPsd } from "ag-psd";
import { unzipSync, strFromU8 } from "fflate";
import { XMLValidator, XMLParser } from "fast-xml-parser";
class DocumentImportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DocumentImportError";
  }
}
function readBytes(input, limits = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length) throw new DocumentImportError("invalid-file", "The file is empty.");
  if (bytes.length > (limits.maxFileBytes ?? 64 * 1024 * 1024)) {
    throw new DocumentImportError("limit-exceeded", "The file exceeds maxFileBytes.");
  }
  return bytes;
}
function parsePsd(input, limits = {}) {
  const bytes = readBytes(input, limits);
  if (bytes.length < 26 || new TextDecoder().decode(bytes.subarray(0, 4)) !== "8BPS" || bytes[4] !== 0 || bytes[5] !== 1 && bytes[5] !== 2) {
    throw new DocumentImportError("invalid-file", "Expected a PSD or PSB header.");
  }
  try {
    return readPsd(bytes, {
      useRawData: true,
      skipThumbnail: true,
      skipLinkedFilesData: true,
      skipCompositeImageData: true,
      totalMemoryLimit: limits.maxExpandedBytes ?? 128 * 1024 * 1024
    });
  } catch (error) {
    throw new DocumentImportError("invalid-file", `Cannot read Photoshop document: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  parseTagValue: false,
  processEntities: true
});
function xml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) {
    throw new DocumentImportError("invalid-file", "Invalid XML or unsupported DTD.");
  }
  function nodes(items, depth = 0) {
    if (depth > 128) throw new DocumentImportError("limit-exceeded", "XML nesting exceeds 128 levels.");
    return items.flatMap((item) => Object.keys(item).filter((k) => k !== ":@").map((key) => ({
      name: key.split(":").pop(),
      attrs: Object.fromEntries(Object.entries(item[":@"] ?? {}).map(([k, v]) => [k, String(v)])),
      children: Array.isArray(item[key]) ? nodes(item[key], depth + 1) : [],
      value: typeof item[key] === "string" ? item[key] : ""
    })));
  }
  return { name: "root", attrs: {}, value: "", children: nodes(parser.parse(text)) };
}
const child = (node, name) => node == null ? void 0 : node.children.find((n) => n.name === name);
const children = (node, name) => (node == null ? void 0 : node.children.filter((n) => n.name === name)) ?? [];
function descendants(node, name) {
  return node ? node.children.flatMap((n) => [...n.name === name ? [n] : [], ...descendants(n, name)]) : [];
}
const value = (node) => node ? node.value + node.children.map(value).join("") : "";
function relationId(node, localName) {
  var _a;
  return (_a = Object.entries(node.attrs).find(([key]) => key.endsWith(`:${localName}`))) == null ? void 0 : _a[1];
}
const EMU = 9525;
const number = (v, fallback = 0) => v !== void 0 && Number.isFinite(Number(v)) ? Number(v) : fallback;
function resolvePart(source, target) {
  if (target.includes("\\") || /[?#]|^[a-z]+:/i.test(target)) throw new DocumentImportError("invalid-file", "Invalid package relationship.");
  const parts = (target.startsWith("/") ? target.slice(1) : `${source.slice(0, source.lastIndexOf("/") + 1)}${target}`).split("/");
  const result = [];
  for (const part of parts) {
    if (part === "..") {
      if (!result.length) throw new DocumentImportError("invalid-file", "Relationship escapes the package.");
      result.pop();
    } else if (part && part !== ".") result.push(part);
  }
  return result.join("/");
}
function parsePptx(input, limits = {}) {
  var _a, _b;
  const bytes = readBytes(input, limits);
  let files;
  let expanded = 0, entries = 0;
  try {
    files = unzipSync(bytes, { filter: (entry) => {
      expanded += entry.originalSize;
      if (++entries > (limits.maxEntries ?? 4096) || expanded > (limits.maxExpandedBytes ?? 128 * 1024 * 1024)) {
        throw new DocumentImportError("limit-exceeded", "PPTX archive exceeds its expansion budget.");
      }
      return true;
    } });
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    throw new DocumentImportError("invalid-file", "Cannot open PPTX ZIP archive.");
  }
  const read = (name) => {
    if (!files[name]) throw new DocumentImportError("invalid-file", `Missing package part: ${name}`);
    return xml(strFromU8(files[name]));
  };
  const relationships = (source) => {
    const slash = source.lastIndexOf("/");
    const relPath = source ? `${source.slice(0, slash + 1)}_rels/${source.slice(slash + 1)}.rels` : "_rels/.rels";
    if (!files[relPath]) return /* @__PURE__ */ new Map();
    return new Map(descendants(read(relPath), "Relationship").map((n) => [n.attrs.Id, {
      target: n.attrs.TargetMode === "External" ? n.attrs.Target : resolvePart(source, n.attrs.Target ?? ""),
      type: n.attrs.Type ?? "",
      external: n.attrs.TargetMode === "External"
    }]));
  };
  const office = [...relationships("").values()].find((r) => r.type.endsWith("/officeDocument") && !r.external);
  if (!office) throw new DocumentImportError("invalid-file", "Missing presentation relationship.");
  const presentation = child(read(office.target), "presentation");
  if (!presentation) throw new DocumentImportError("unsupported-format", "The ZIP is not a PowerPoint presentation.");
  const size = child(presentation, "sldSz");
  const width = number(size == null ? void 0 : size.attrs.cx) / EMU, height = number(size == null ? void 0 : size.attrs.cy) / EMU;
  if (width <= 0 || height <= 0) throw new DocumentImportError("invalid-file", "Invalid slide dimensions.");
  const slideIds = children(child(presentation, "sldIdLst"), "sldId");
  if (!slideIds.length) throw new DocumentImportError("invalid-file", "Presentation has no slides.");
  if (slideIds.length > (limits.maxPages ?? 500)) throw new DocumentImportError("limit-exceeded", "Too many slides.");
  const rels = relationships(office.target);
  const doc = { format: "pptx", pages: [], assets: [], warnings: [] };
  const assetIds = /* @__PURE__ */ new Map();
  const warn = (code, message, pageId, elementId) => doc.warnings.push({ code, message, pageId, elementId });
  for (const [pageIndex, slideId] of slideIds.entries()) {
    let shape = function(node, transform = { x: 0, y: 0, sx: 1, sy: 1 }) {
      var _a2, _b2, _c, _d;
      if (node.name === "nvGrpSpPr" || node.name === "grpSpPr" || node.name === "extLst") return;
      const props = child(node, node.name === "grpSp" ? "grpSpPr" : "spPr");
      const xfrm = child(props, "xfrm");
      const off = child(xfrm, "off"), ext = child(xfrm, "ext");
      if (node.name === "grpSp") {
        const chOff = child(xfrm, "chOff"), chExt = child(xfrm, "chExt");
        const sx = number(ext == null ? void 0 : ext.attrs.cx, 1) / (number(chExt == null ? void 0 : chExt.attrs.cx, 1) || 1);
        const sy = number(ext == null ? void 0 : ext.attrs.cy, 1) / (number(chExt == null ? void 0 : chExt.attrs.cy, 1) || 1);
        if (number(xfrm == null ? void 0 : xfrm.attrs.rot) || (xfrm == null ? void 0 : xfrm.attrs.flipH) === "1" || (xfrm == null ? void 0 : xfrm.attrs.flipV) === "1") warn("group-transform", "Group rotation/reflection is not retained.", page.id);
        const nested = {
          x: transform.x + (number(off == null ? void 0 : off.attrs.x) - number(chOff == null ? void 0 : chOff.attrs.x) * sx) / EMU * transform.sx,
          y: transform.y + (number(off == null ? void 0 : off.attrs.y) - number(chOff == null ? void 0 : chOff.attrs.y) * sy) / EMU * transform.sy,
          sx: transform.sx * sx,
          sy: transform.sy * sy
        };
        node.children.forEach((n) => shape(n, nested));
        return;
      }
      const id = `${page.id}-element-${++serial}`;
      if (node.name !== "sp" && node.name !== "pic") {
        warn("unsupported-object", `Object ${node.name} is not converted (charts, tables, connectors and media need an adapter).`, page.id, id);
        return;
      }
      if (!off || !ext) {
        warn("missing-geometry", "Object has no direct geometry; inherited layout is required.", page.id, id);
        return;
      }
      const element = {
        id,
        kind: "rectangle",
        name: (_a2 = descendants(node, "cNvPr")[0]) == null ? void 0 : _a2.attrs.name,
        x: transform.x + number(off.attrs.x) / EMU * transform.sx,
        y: transform.y + number(off.attrs.y) / EMU * transform.sy,
        width: number(ext.attrs.cx) / EMU * transform.sx,
        height: number(ext.attrs.cy) / EMU * transform.sy,
        rotation: number(xfrm == null ? void 0 : xfrm.attrs.rot) / 6e4,
        fill: color(child(props, "solidFill")) ?? "transparent"
      };
      if (element.width <= 0 || element.height <= 0) {
        warn("invalid-geometry", "Object has empty geometry.", page.id, id);
        return;
      }
      const line = child(props, "ln");
      element.stroke = color(child(line, "solidFill"));
      element.strokeWidth = number(line == null ? void 0 : line.attrs.w, EMU) / EMU;
      if (child(line, "prstDash")) warn("line-style", "Dash patterns use a solid stroke.", page.id, id);
      if ((xfrm == null ? void 0 : xfrm.attrs.flipH) === "1" || (xfrm == null ? void 0 : xfrm.attrs.flipV) === "1") warn("reflection", "Object reflection is not retained.", page.id, id);
      if (node.name === "pic") {
        const blip = descendants(node, "blip")[0];
        const imageRel = blip && slideRels.get(relationId(blip, "embed") ?? "");
        if (!imageRel || imageRel.external || !files[imageRel.target]) {
          warn("missing-image", "Image is external or missing; no network request was made.", page.id, id);
          return;
        }
        let assetId = assetIds.get(imageRel.target);
        if (!assetId) {
          assetId = `asset-${assetIds.size + 1}`;
          assetIds.set(imageRel.target, assetId);
          const extension = (_b2 = imageRel.target.split(".").pop()) == null ? void 0 : _b2.toLowerCase();
          const mimeType = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp" }[extension ?? ""] ?? "application/octet-stream";
          doc.assets.push({ id: assetId, name: imageRel.target.split("/").pop(), mimeType, bytes: files[imageRel.target] });
          if (mimeType === "application/octet-stream") warn("image-format", "Embedded image needs conversion before browser rendering.", page.id, id);
        }
        element.kind = "image";
        element.assetId = assetId;
        if (descendants(node, "srcRect").length) warn("image-crop", "Image cropping is approximated by its destination box.", page.id, id);
      } else {
        const textBody = child(node, "txBody");
        const text = children(textBody, "p").map((p) => p.children.map((n) => n.name === "br" ? "\n" : value(child(n, "t"))).join("")).join("\n");
        if (text) {
          element.kind = "text";
          element.text = text;
          const style = descendants(textBody, "rPr")[0] ?? descendants(textBody, "defRPr")[0];
          element.fontSize = number(style == null ? void 0 : style.attrs.sz, 1800) / 100 * 96 / 72;
          element.fontFamily = (_c = child(style, "latin")) == null ? void 0 : _c.attrs.typeface;
          element.color = color(child(style, "solidFill")) ?? "#1a1a1a";
          warn("text-layout", "Text remains editable; run styling, bullets, insets and line metrics are approximated.", page.id, id);
          if (element.fill !== "transparent") page.elements.push({ ...element, id: `${id}-background`, kind: "rectangle", text: void 0 });
        } else {
          const geometry = (_d = child(props, "prstGeom")) == null ? void 0 : _d.attrs.prst;
          element.kind = geometry === "ellipse" ? "ellipse" : "rectangle";
          if (!element.stroke && element.fill === "transparent" && !child(props, "noFill") && !child(line, "noFill")) {
            element.stroke = "#1a1a1a";
            warn("shape-style", "No explicit shape color; using a visible fallback stroke.", page.id, id);
          }
          if (geometry !== "rect" && geometry !== "ellipse") warn("shape-geometry", `Geometry ${geometry ?? "custom"} is approximated as a rectangle.`, page.id, id);
        }
        if (descendants(props, "gradFill").length || descendants(props, "effectLst").some((n) => n.children.length)) warn("shape-effects", "Gradients and effects are not retained.", page.id, id);
      }
      page.elements.push(element);
    };
    const rel = rels.get(relationId(slideId, "id") ?? "");
    if (!rel || rel.external || !rel.type.endsWith("/slide")) throw new DocumentImportError("invalid-file", "Invalid slide relationship.");
    const slide = child(read(rel.target), "sld");
    if (!slide) throw new DocumentImportError("invalid-file", "Missing slide root.");
    const page = { id: `slide-${pageIndex + 1}`, name: ((_a = child(slide, "cSld")) == null ? void 0 : _a.attrs.name) || `Slide ${pageIndex + 1}`, width, height, elements: [] };
    doc.pages.push(page);
    page.extractedText = descendants(slide, "t").map(value).join("\n");
    const slideRels = relationships(rel.target);
    const color = (node) => {
      var _a2;
      const rgb = (_a2 = descendants(node, "srgbClr")[0]) == null ? void 0 : _a2.attrs.val;
      if (rgb && /^[0-9a-f]{6}$/i.test(rgb)) return `#${rgb}`;
      if (descendants(node, "schemeClr").length) warn("theme-color", "Theme color requires master/theme resolution; a fallback is used.", page.id);
      return void 0;
    };
    page.background = color(child(child(slide, "cSld"), "bg"));
    if ([...slideRels.values()].some((r) => r.type.endsWith("/slideLayout"))) {
      warn("master-layout", "Master/layout artwork, inherited placeholder geometry and theme styles are not resolved.", page.id);
    }
    let serial = 0;
    (_b = children(child(slide, "cSld"), "spTree")[0]) == null ? void 0 : _b.children.forEach((n) => shape(n));
    const notes = [...slideRels.values()].find((r) => r.type.endsWith("/notesSlide") && !r.external);
    if (notes && files[notes.target]) page.notes = descendants(read(notes.target), "t").map(value).join("\n");
    if (child(slide, "timing") || child(slide, "transition")) warn("animation", "Animation and transitions are not imported.", page.id);
  }
  return doc;
}
async function parseIllustrator(input, options = {}) {
  const bytes = readBytes(input, options);
  const header = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (!header.startsWith("%PDF-")) {
    throw new DocumentImportError("unsupported-format", "This AI file has no PDF header. Re-save with Create PDF Compatible File, or convert it externally to PDF/SVG.");
  }
  if (!options.pdf) throw new DocumentImportError("adapter-required", "PDF-compatible AI requires a PDF adapter; use createPdfJsAdapter with your PDF.js runtime.");
  const document = await options.pdf.read(bytes, options);
  return { ...document, format: "ai", warnings: [...document.warnings, {
    code: "illustrator-pdf",
    message: "Imported the PDF representation. Illustrator layers, effects and native paths are not reconstructed."
  }] };
}
function createPdfJsAdapter(engine, options = {}) {
  return { async read(bytes, limits) {
    const task = engine.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > (limits.maxPages ?? 500)) throw new DocumentImportError("limit-exceeded", "PDF exceeds maxPages.");
      const document = { format: "pdf", pages: [], assets: [], warnings: [] };
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        try {
          const viewport = page.getViewport({ scale: 96 / 72 });
          const content = await page.getTextContent();
          const items = content.items.filter((i) => !!i && typeof i === "object" && "str" in i && "transform" in i);
          const pageId = `page-${n}`;
          const parsed = {
            id: pageId,
            name: `Page ${n}`,
            width: viewport.width,
            height: viewport.height,
            extractedText: items.map((i) => i.str).join("\n"),
            elements: []
          };
          if (options.renderPage) {
            const image = await options.renderPage(page, n);
            const assetId = `page-${n}-preview`;
            document.assets.push({ id: assetId, name: `${assetId}.${image.mimeType === "image/png" ? "png" : "jpg"}`, ...image });
            parsed.elements.push({ id: `${pageId}-image`, kind: "image", x: 0, y: 0, width: viewport.width, height: viewport.height, assetId });
            document.warnings.push({ code: "flattened-page", message: "Page artwork is a raster preview; text remains searchable but is not independently editable.", pageId });
          } else {
            const [a, b, c, d, e, f] = viewport.transform;
            items.forEach((item, index) => {
              var _a;
              const x = a * item.transform[4] + c * item.transform[5] + e;
              const baseline = b * item.transform[4] + d * item.transform[5] + f;
              const size = Math.max(1, Math.hypot(item.transform[2], item.transform[3]) * 96 / 72);
              parsed.elements.push({
                id: `${pageId}-text-${index}`,
                kind: "text",
                x,
                y: baseline - size,
                width: Math.max(1, item.width * 96 / 72),
                height: Math.max(size, item.height * 96 / 72),
                text: item.str,
                fontSize: size,
                fontFamily: (_a = content.styles[item.fontName]) == null ? void 0 : _a.fontFamily
              });
            });
            document.warnings.push({ code: "text-only", message: "Only text and approximate boxes were extracted. Supply renderPage for page artwork; vector paths, images, rotation and styling are not reconstructed.", pageId });
          }
          document.pages.push(parsed);
        } finally {
          page.cleanup();
        }
      }
      return document;
    } finally {
      await task.destroy();
    }
  } };
}
const IMPORT_FORMATS = [
  { extension: "psd", support: "native", detail: "Structure and compressed channels; raster assets require host decoding/upload." },
  { extension: "psb", support: "native", detail: "Large Photoshop structure subject to configured limits." },
  { extension: "pptx", support: "partial", detail: "Direct text, shapes, images and notes; master/theme features are reported." },
  { extension: "ai", support: "adapter", detail: "PDF-compatible AI via PDF adapter; native Illustrator editing is not preserved." },
  { extension: "ppt", support: "external-conversion", detail: "Convert binary PowerPoint to PPTX before parsing." }
];
async function parseFile(input, options) {
  var _a;
  const bytes = readBytes(input, options);
  const extension = (_a = options.fileName.split(".").pop()) == null ? void 0 : _a.toLowerCase();
  if (extension === "psd" || extension === "psb") {
    const document = parsePsd(bytes, options);
    return { format: bytes[5] === 2 ? "psb" : "psd", document };
  }
  if (extension === "pptx") return { format: "pptx", document: parsePptx(bytes, options) };
  if (extension === "ai") return { format: "ai", document: await parseIllustrator(bytes, options) };
  throw new DocumentImportError("unsupported-format", extension === "ppt" ? "Binary .ppt is not supported. Convert to .pptx first." : `Unsupported extension: ${extension ?? "(none)"}`);
}
export {
  DocumentImportError,
  IMPORT_FORMATS,
  createPdfJsAdapter,
  parseFile,
  parseIllustrator,
  parsePptx,
  parsePsd
};
//# sourceMappingURL=parsers.js.map
