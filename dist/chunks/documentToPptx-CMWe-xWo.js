import { zipSync, strToU8 } from "fflate";
const PAGE_MARKER = "c2page";
function pageOrderOf(el) {
  var _a, _b;
  const raw = (_b = (_a = el.customData) == null ? void 0 : _a[PAGE_MARKER]) == null ? void 0 : _b.index;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}
function framesInDocumentOrder(elements) {
  const frames = elements.filter((e) => e.type === "frame");
  const marked = frames.length > 0 && frames.every((f) => pageOrderOf(f) !== null);
  return frames.slice().sort(
    marked ? (a, b) => pageOrderOf(a) - pageOrderOf(b) : (a, b) => a.x - b.x
  );
}
const BG_MARKER = "pageBackground";
function isPageBackground(el) {
  var _a;
  return ((_a = el.customData) == null ? void 0 : _a.c2) === BG_MARKER;
}
const SLIDE_NOTES_KEY = "c2notes";
const SLIDE_SKIP_KEY = "c2skip";
const SLIDE_TRANSITION_KEY = "c2transition";
const SLIDE_TRANSITIONS = ["none", "fade"];
function notesOf(el) {
  var _a;
  const raw = (_a = el == null ? void 0 : el.customData) == null ? void 0 : _a[SLIDE_NOTES_KEY];
  return typeof raw === "string" ? raw : "";
}
function isSkippedFrame(el) {
  var _a;
  return ((_a = el == null ? void 0 : el.customData) == null ? void 0 : _a[SLIDE_SKIP_KEY]) === true;
}
function transitionOf(el) {
  var _a;
  const raw = (_a = el == null ? void 0 : el.customData) == null ? void 0 : _a[SLIDE_TRANSITION_KEY];
  return SLIDE_TRANSITIONS.includes(raw) ? raw : "none";
}
const BUILTIN_FONTS = {
  1: "Virgil",
  2: "Helvetica",
  3: "Cascadia",
  5: "Excalifont",
  6: "Nunito",
  7: "Lilita One",
  8: "Comic Shanns",
  9: "Liberation Sans"
};
const BRAND_ALIAS = / \(marca\)$/;
const transparent = (color) => typeof color !== "string" || !color || color === "transparent" || /^#[0-9a-f]{6}00$/i.test(color);
function strokeStyleOf(el) {
  return el.strokeStyle === "dashed" || el.strokeStyle === "dotted" ? el.strokeStyle : "solid";
}
function dataUrlBytes(dataURL) {
  const match = /^data:([^;,]+)?((?:;[^;,]*)*?)(;base64)?,(.*)$/s.exec(dataURL);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const payload = match[4];
  if (match[3]) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mimeType };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeType };
}
function sceneToDocument(elements, files, options = {}) {
  const warnings = [];
  const assets = [];
  const assetIds = /* @__PURE__ */ new Set();
  const live = elements.filter((e) => !e.isDeleted);
  const fontName = (id) => {
    var _a;
    if (typeof id !== "number") return void 0;
    const name = ((_a = options.fontName) == null ? void 0 : _a.call(options, id)) ?? BUILTIN_FONTS[id];
    return name == null ? void 0 : name.replace(BRAND_ALIAS, "");
  };
  const pages = framesInDocumentOrder(live).map((frame, index) => {
    const f = frame;
    const page = {
      id: frame.id,
      name: typeof f.name === "string" && f.name ? f.name : `${index + 1}`,
      width: frame.width,
      height: frame.height,
      elements: []
    };
    const notes = notesOf(f);
    if (notes) page.notes = notes;
    if (isSkippedFrame(f)) page.hidden = true;
    if (transitionOf(f) === "fade") page.transition = "fade";
    for (const el of live) {
      if (el.frameId !== frame.id) continue;
      if (isPageBackground(el)) {
        if (!transparent(el.backgroundColor)) page.background = el.backgroundColor;
        continue;
      }
      const converted = convert(el, frame.x, frame.y, page.id);
      if (converted) page.elements.push(converted);
    }
    return page;
  });
  const loose = live.filter((e) => e.type !== "frame" && !e.frameId && !isPageBackground(e));
  if (loose.length) warnings.push({ code: "outside-pages", message: `${loose.length} elements outside every page are not exported.` });
  return { format: "pptx", pages, assets, warnings };
  function convert(el, ox, oy, pageId) {
    var _a;
    const common = {
      id: el.id,
      kind: "rectangle",
      x: el.x - ox,
      y: el.y - oy,
      width: el.width,
      height: el.height,
      rotation: el.angle ? el.angle * 180 / Math.PI : void 0,
      opacity: typeof el.opacity === "number" && el.opacity < 100 ? el.opacity : void 0,
      groupIds: Array.isArray(el.groupIds) && el.groupIds.length ? el.groupIds : void 0
    };
    switch (el.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
        return {
          ...common,
          kind: el.type,
          fill: transparent(el.backgroundColor) ? void 0 : el.backgroundColor,
          stroke: transparent(el.strokeColor) ? void 0 : el.strokeColor,
          strokeWidth: typeof el.strokeWidth === "number" ? el.strokeWidth : void 0,
          strokeStyle: strokeStyleOf(el),
          rounded: Boolean(el.roundness) || void 0
        };
      case "text": {
        const text = typeof el.originalText === "string" && el.originalText ? el.originalText : String(el.text ?? "");
        if (!text.trim()) return null;
        return {
          ...common,
          kind: "text",
          text,
          fontFamily: fontName(el.fontFamily),
          fontSize: typeof el.fontSize === "number" ? el.fontSize : 20,
          color: transparent(el.strokeColor) ? void 0 : el.strokeColor,
          textAlign: el.textAlign === "center" || el.textAlign === "right" ? el.textAlign : "left",
          verticalAlign: el.verticalAlign === "middle" ? "middle" : el.verticalAlign === "bottom" ? "bottom" : "top",
          lineHeight: typeof el.lineHeight === "number" ? el.lineHeight : 1.25
        };
      }
      case "line":
      case "arrow":
      case "freedraw": {
        const points = Array.isArray(el.points) ? el.points : [];
        if (points.length < 2) return null;
        if (el.roundness && el.type !== "freedraw") {
          warnings.push({ code: "curve-approximated", message: "Curved lines are exported as straight segments.", pageId, elementId: el.id });
        }
        const closed = el.type === "line" && (el.polygon === true || points.length > 2 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]);
        return {
          ...common,
          kind: "line",
          points: points.map(([x, y]) => [x, y]),
          stroke: transparent(el.strokeColor) ? void 0 : el.strokeColor,
          strokeWidth: typeof el.strokeWidth === "number" ? el.strokeWidth : void 0,
          strokeStyle: strokeStyleOf(el),
          fill: closed && !transparent(el.backgroundColor) ? el.backgroundColor : void 0,
          arrowStart: el.type === "arrow" && Boolean(el.startArrowhead) ? true : void 0,
          arrowEnd: el.type === "arrow" && Boolean(el.endArrowhead) ? true : void 0
        };
      }
      case "image": {
        const fileId = typeof el.fileId === "string" ? el.fileId : "";
        const file = files[fileId];
        const decoded = (file == null ? void 0 : file.dataURL) ? dataUrlBytes(file.dataURL) : null;
        if (!decoded) {
          warnings.push({ code: "image-unavailable", message: "An image without its bytes is left out.", pageId, elementId: el.id });
          return null;
        }
        if (!assetIds.has(fileId)) {
          assetIds.add(fileId);
          const size = (_a = options.imageSize) == null ? void 0 : _a.call(options, fileId);
          assets.push({ id: fileId, name: fileId, mimeType: (file == null ? void 0 : file.mimeType) || decoded.mimeType, bytes: decoded.bytes, ...size });
        }
        const scale = Array.isArray(el.scale) ? el.scale : [1, 1];
        const crop = el.crop;
        return {
          ...common,
          kind: "image",
          assetId: fileId,
          flipH: scale[0] < 0 || void 0,
          flipV: scale[1] < 0 || void 0,
          crop: crop && crop.naturalWidth > 0 && crop.naturalHeight > 0 ? {
            left: crop.x / crop.naturalWidth,
            top: crop.y / crop.naturalHeight,
            right: 1 - (crop.x + crop.width) / crop.naturalWidth,
            bottom: 1 - (crop.y + crop.height) / crop.naturalHeight
          } : void 0
        };
      }
      default:
        warnings.push({ code: "unsupported-element", message: `Element ${String(el.type)} is not exported.`, pageId, elementId: el.id });
        return null;
    }
  }
}
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const POTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.template";
const EMU = 9525;
const MIN_SLIDE = 914400, MAX_SLIDE = 51206400;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const IMAGE_EXT = { "image/png": "png", "image/jpeg": "jpeg", "image/jpg": "jpeg", "image/gif": "gif", "image/bmp": "bmp", "image/tiff": "tiff" };
function xmlText(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const emu = (px) => Math.round(px * EMU);
function parseColor(color) {
  if (!color) return null;
  const c = color.trim().toLowerCase();
  if (c === "transparent") return null;
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  if (m) return { hex: `${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase(), alpha: 1 };
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(c);
  if (m) return { hex: m[1].toUpperCase(), alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("").toUpperCase();
    return { hex, alpha: m[4] !== void 0 ? Math.max(0, Math.min(1, Number(m[4]))) : 1 };
  }
  const named = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF" };
  return named[c] ? { hex: named[c], alpha: 1 } : null;
}
function solid(color, opacity = 1) {
  const parsed = parseColor(color);
  if (!parsed) return "<a:noFill/>";
  const alpha = Math.round(parsed.alpha * opacity * 1e5);
  return `<a:solidFill><a:srgbClr val="${parsed.hex}">${alpha < 1e5 ? `<a:alpha val="${alpha}"/>` : ""}</a:srgbClr></a:solidFill>`;
}
function outline(el, opacity) {
  if (!parseColor(el.stroke)) return "<a:ln><a:noFill/></a:ln>";
  const dash = el.strokeStyle === "dashed" ? '<a:prstDash val="dash"/>' : el.strokeStyle === "dotted" ? '<a:prstDash val="sysDot"/>' : "";
  const head = el.arrowStart ? '<a:headEnd type="triangle"/>' : "";
  const tail = el.arrowEnd ? '<a:tailEnd type="triangle"/>' : "";
  return `<a:ln w="${emu(Math.max(0.25, el.strokeWidth ?? 1))}" cap="rnd">${solid(el.stroke, opacity)}${dash}<a:round/>${head}${tail}</a:ln>`;
}
function xfrm(el, at) {
  const rot = el.rotation ? Math.round((el.rotation % 360 + 360) % 360 * 6e4) : 0;
  const attrs = `${rot ? ` rot="${rot}"` : ""}${el.flipH ? ' flipH="1"' : ""}${el.flipV ? ' flipV="1"' : ""}`;
  return `<a:xfrm${attrs}><a:off x="${emu(at.dx + el.x * at.scale)}" y="${emu(at.dy + el.y * at.scale)}"/><a:ext cx="${Math.max(1, emu(el.width * at.scale))}" cy="${Math.max(1, emu(el.height * at.scale))}"/></a:xfrm>`;
}
const PRESET = { rectangle: "rect", ellipse: "ellipse", diamond: "diamond" };
function slideXml(page, at, ctx) {
  let id = 1;
  const shapes = [];
  const nv = (name, extra = "") => `<p:cNvPr id="${++id}" name="${xmlText(name)} ${id}"/>${extra}`;
  for (const el of page.elements) {
    const opacity = (el.opacity ?? 100) / 100;
    if (el.kind === "image") {
      const rid = el.assetId ? ctx.imageRel(el.assetId) : null;
      if (!rid) continue;
      const c = el.crop;
      const crop = c ? `<a:srcRect l="${Math.round(c.left * 1e5)}" t="${Math.round(c.top * 1e5)}" r="${Math.round(c.right * 1e5)}" b="${Math.round(c.bottom * 1e5)}"/>` : "";
      const alpha = opacity < 1 ? `<a:alphaModFix amt="${Math.round(opacity * 1e5)}"/>` : "";
      shapes.push(`<p:pic><p:nvPicPr>${nv("Picture", '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/>')}</p:nvPicPr><p:blipFill><a:blip r:embed="${rid}">${alpha}</a:blip>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(el, at)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
    } else if (el.kind === "text") {
      shapes.push(textBox(el, at, nv, ctx.lang));
    } else if (el.kind === "line") {
      const points = el.points ?? [];
      if (points.length < 2) continue;
      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const w = Math.max(1, Math.max(...xs) - minX), h = Math.max(1, Math.max(...ys) - minY);
      const pw = Math.max(1, emu(w)), ph = Math.max(1, emu(h));
      const closed = Boolean(el.fill);
      const path = points.map(([x, y], i) => `<a:${i ? "lnTo" : "moveTo"}><a:pt x="${emu(x - minX)}" y="${emu(y - minY)}"/></a:${i ? "lnTo" : "moveTo"}>`).join("") + (closed ? "<a:close/>" : "");
      const box = { ...el, x: el.x + minX, y: el.y + minY, width: w, height: h };
      shapes.push(`<p:sp><p:nvSpPr>${nv("Freeform", "<p:cNvSpPr/><p:nvPr/>")}</p:nvSpPr><p:spPr>${xfrm(box, at)}<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${pw}" h="${ph}"${closed ? "" : ' fill="none"'}>${path}</a:path></a:pathLst></a:custGeom>${closed ? solid(el.fill, opacity) : "<a:noFill/>"}${outline(el, opacity)}</p:spPr></p:sp>`);
    } else {
      const preset = el.kind === "rectangle" && el.rounded ? "roundRect" : PRESET[el.kind] ?? "rect";
      const adj = preset === "roundRect" ? '<a:gd name="adj" fmla="val 8000"/>' : "";
      shapes.push(`<p:sp><p:nvSpPr>${nv(preset === "ellipse" ? "Oval" : preset === "diamond" ? "Diamond" : "Rectangle", "<p:cNvSpPr/><p:nvPr/>")}</p:nvSpPr><p:spPr>${xfrm(el, at)}<a:prstGeom prst="${preset}"><a:avLst>${adj}</a:avLst></a:prstGeom>${solid(el.fill, opacity)}${outline(el, opacity)}</p:spPr></p:sp>`);
    }
  }
  const bg = parseColor(page.background) ? `<p:bg><p:bgPr>${solid(page.background)}<a:effectLst/></p:bgPr></p:bg>` : "";
  const transition = page.transition === "fade" ? '<p:transition spd="med"><p:fade/></p:transition>' : "";
  return `${XML_HEAD}<p:sld ${NS}${page.hidden ? ' show="0"' : ""}><p:cSld name="${xmlText(page.name)}">${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transition}</p:sld>`;
}
function textBox(el, at, nv, lang) {
  const opacity = (el.opacity ?? 100) / 100;
  const size = Math.max(100, Math.round((el.fontSize ?? 20) * at.scale * 75));
  const font = el.fontFamily ? `<a:latin typeface="${xmlText(el.fontFamily)}"/><a:ea typeface="${xmlText(el.fontFamily)}"/><a:cs typeface="${xmlText(el.fontFamily)}"/>` : "";
  const algn = el.textAlign === "center" ? "ctr" : el.textAlign === "right" ? "r" : "l";
  const spacing = Math.round(size * (el.lineHeight ?? 1.25));
  const run = `<a:rPr lang="${lang}" sz="${size}" dirty="0">${solid(el.color ?? "#1a1a1a", opacity)}${font}</a:rPr>`;
  const paragraphs = (el.text ?? "").split("\n").map((line) => `<a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPts val="${spacing}"/></a:lnSpc></a:pPr>` + (line ? `<a:r>${run}<a:t>${xmlText(line)}</a:t></a:r>` : "") + `<a:endParaRPr lang="${lang}" sz="${size}" dirty="0"/></a:p>`).join("");
  const anchor = el.verticalAlign === "middle" ? "ctr" : el.verticalAlign === "bottom" ? "b" : "t";
  const box = { ...el, width: el.width * 1.02 };
  return `<p:sp><p:nvSpPr>${nv("TextBox", '<p:cNvSpPr txBox="1"/><p:nvPr/>')}</p:nvSpPr><p:spPr>${xfrm(box, at)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}
function notesXml(notes, lang) {
  const paragraphs = notes.split("\n").map((line) => `<a:p>${line ? `<a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${xmlText(line)}</a:t></a:r>` : ""}<a:endParaRPr lang="${lang}" dirty="0"/></a:p>`).join("");
  return `${XML_HEAD}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}
function rels(items) {
  return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` + items.map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${xmlText(r.target)}"/>`).join("") + "</Relationships>";
}
function theme(name, font) {
  const f = xmlText(font);
  const fills = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const line = (w) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
  const color = (n, hex) => `<a:${n}><a:srgbClr val="${hex}"/></a:${n}>`;
  return `${XML_HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${xmlText(name)}"><a:themeElements><a:clrScheme name="${xmlText(name)}"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>` + color("dk2", "3F3B36") + color("lt2", "EFECE6") + color("accent1", "3A39F5") + color("accent2", "E0533D") + color("accent3", "6E6962") + color("accent4", "E3A33A") + color("accent5", "2E8B57") + color("accent6", "8F93F0") + color("hlink", "3A39F5") + color("folHlink", "6E6962") + `</a:clrScheme><a:fontScheme name="${xmlText(name)}"><a:majorFont><a:latin typeface="${f}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${f}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="${xmlText(name)}"><a:fillStyleLst>${fills}</a:fillStyleLst><a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${fills}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}
const CLR_MAP = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';
const EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
const LEVEL = '<a:lvl1pPr><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>';
function mainFont(doc) {
  var _a, _b;
  const count = /* @__PURE__ */ new Map();
  for (const page of doc.pages) for (const el of page.elements) {
    if (el.kind === "text" && el.fontFamily) count.set(el.fontFamily, (count.get(el.fontFamily) ?? 0) + (((_a = el.text) == null ? void 0 : _a.length) ?? 0));
  }
  return ((_b = [...count.entries()].sort((a, b) => b[1] - a[1])[0]) == null ? void 0 : _b[0]) ?? "Calibri";
}
function slideSize(doc, warnings) {
  const first = doc.pages[0];
  let cx = emu((first == null ? void 0 : first.width) ?? 1920), cy = emu((first == null ? void 0 : first.height) ?? 1080);
  const big = Math.max(cx, cy) / MAX_SLIDE, small = Math.min(cx, cy) / MIN_SLIDE;
  let k = 1;
  if (big > 1) k = 1 / big;
  else if (small < 1) k = 1 / small;
  if (k !== 1) {
    warnings.push({ code: "slide-size-scaled", message: "The page size is outside what PowerPoint accepts; slides are scaled to fit." });
    cx = Math.round(cx * k);
    cy = Math.round(cy * k);
  }
  return { cx: Math.min(MAX_SLIDE, Math.max(MIN_SLIDE, cx)), cy: Math.min(MAX_SLIDE, Math.max(MIN_SLIDE, cy)) };
}
function documentToPptx(doc, options = {}) {
  var _a, _b;
  const warnings = [];
  const pages = doc.pages.length ? doc.pages : [{ id: "empty", name: "1", width: 1920, height: 1080, elements: [] }];
  const lang = options.lang ?? "es-ES";
  const { cx, cy } = slideSize({ ...doc, pages }, warnings);
  const slideW = cx / EMU, slideH = cy / EMU;
  const hasNotes = pages.some((p) => {
    var _a2;
    return (_a2 = p.notes) == null ? void 0 : _a2.trim();
  });
  const files = {};
  const put = (path, text) => {
    files[path] = strToU8(text);
  };
  const media = /* @__PURE__ */ new Map();
  const assetById = new Map(doc.assets.map((a) => [a.id, a]));
  const mediaFor = (assetId) => {
    const known = media.get(assetId);
    if (known) return known;
    const asset = assetById.get(assetId);
    const ext = asset ? IMAGE_EXT[asset.mimeType.toLowerCase()] : void 0;
    if (!asset || !ext) {
      warnings.push({ code: "image-format", message: `Image ${assetId} (${(asset == null ? void 0 : asset.mimeType) ?? "missing"}) is not a format PowerPoint opens; it is left out.`, elementId: assetId });
      return null;
    }
    const entry = { path: `media/image${media.size + 1}.${ext}`, ext };
    media.set(assetId, entry);
    files[`ppt/${entry.path}`] = [asset.bytes, { level: 0 }];
    return entry;
  };
  const slideIds = [];
  pages.forEach((page, index) => {
    var _a2;
    const n = index + 1;
    const scale = Math.min(slideW / page.width, slideH / page.height);
    if (Math.abs(scale - 1) > 1e-3 && index > 0) {
      warnings.push({ code: "page-size-mixed", message: "A page with another size is scaled to the presentation size.", pageId: page.id });
    }
    const at = { scale, dx: (slideW - page.width * scale) / 2, dy: (slideH - page.height * scale) / 2 };
    const slideRels = [{ id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" }];
    const imageRels = /* @__PURE__ */ new Map();
    const ctx = {
      lang,
      imageRel: (assetId) => {
        const known = imageRels.get(assetId);
        if (known) return known;
        const entry = mediaFor(assetId);
        if (!entry) return null;
        const id = `rId${slideRels.length + 1}`;
        slideRels.push({ id, type: "image", target: `../${entry.path}` });
        imageRels.set(assetId, id);
        return id;
      }
    };
    put(`ppt/slides/slide${n}.xml`, slideXml(page, at, ctx));
    if ((_a2 = page.notes) == null ? void 0 : _a2.trim()) {
      slideRels.push({ id: `rId${slideRels.length + 1}`, type: "notesSlide", target: `../notesSlides/notesSlide${n}.xml` });
      put(`ppt/notesSlides/notesSlide${n}.xml`, notesXml(page.notes, lang));
      put(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, rels([
        { id: "rId1", type: "notesMaster", target: "../notesMasters/notesMaster1.xml" },
        { id: "rId2", type: "slide", target: `../slides/slide${n}.xml` }
      ]));
    }
    put(`ppt/slides/_rels/slide${n}.xml.rels`, rels(slideRels));
    slideIds.push(`<p:sldId id="${255 + n}" r:id="rId${n + 1}"/>`);
  });
  const font = mainFont(doc);
  const title = ((_a = options.title) == null ? void 0 : _a.trim()) || ((_b = pages[0]) == null ? void 0 : _b.name) || "Presentación";
  const presRels = [
    { id: "rId1", type: "slideMaster", target: "slideMasters/slideMaster1.xml" },
    ...pages.map((_, i) => ({ id: `rId${i + 2}`, type: "slide", target: `slides/slide${i + 1}.xml` }))
  ];
  let next = pages.length + 2;
  const notesMasterRel = hasNotes ? `rId${next++}` : null;
  if (notesMasterRel) presRels.push({ id: notesMasterRel, type: "notesMaster", target: "notesMasters/notesMaster1.xml" });
  presRels.push(
    { id: `rId${next++}`, type: "presProps", target: "presProps.xml" },
    { id: `rId${next++}`, type: "viewProps", target: "viewProps.xml" },
    { id: `rId${next++}`, type: "theme", target: "theme/theme1.xml" },
    { id: `rId${next++}`, type: "tableStyles", target: "tableStyles.xml" }
  );
  put("ppt/presentation.xml", `${XML_HEAD}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` + (notesMasterRel ? `<p:notesMasterIdLst><p:notesMasterId r:id="${notesMasterRel}"/></p:notesMasterIdLst>` : "") + `<p:sldIdLst>${slideIds.join("")}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="${lang}"/></a:defPPr>${LEVEL}</p:defaultTextStyle></p:presentation>`);
  put("ppt/_rels/presentation.xml.rels", rels(presRels));
  put("ppt/presProps.xml", `${XML_HEAD}<p:presentationPr ${NS}/>`);
  put("ppt/viewProps.xml", `${XML_HEAD}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  put("ppt/tableStyles.xml", `${XML_HEAD}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  put("ppt/theme/theme1.xml", theme("Polimake", font));
  put("ppt/slideMasters/slideMaster1.xml", `${XML_HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld><p:clrMap ${CLR_MAP}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle>${LEVEL}</p:titleStyle><p:bodyStyle>${LEVEL}</p:bodyStyle><p:otherStyle>${LEVEL}</p:otherStyle></p:txStyles></p:sldMaster>`);
  put("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels([
    { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
    { id: "rId2", type: "theme", target: "../theme/theme1.xml" }
  ]));
  put("ppt/slideLayouts/slideLayout1.xml", `${XML_HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  put("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels([{ id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" }]));
  if (hasNotes) {
    put("ppt/notesMasters/notesMaster1.xml", `${XML_HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld><p:clrMap ${CLR_MAP}/><p:notesStyle>${LEVEL}</p:notesStyle></p:notesMaster>`);
    put("ppt/notesMasters/_rels/notesMaster1.xml.rels", rels([{ id: "rId1", type: "theme", target: "../theme/theme2.xml" }]));
    put("ppt/theme/theme2.xml", theme("Polimake notes", font));
  }
  const created = (options.created ?? /* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  put("docProps/core.xml", `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlText(title)}</dc:title><dc:creator>Polimake</dc:creator><cp:lastModifiedBy>Polimake</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`);
  put("docProps/app.xml", `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Polimake</Application><Slides>${pages.length}</Slides><Notes>${pages.filter((p) => {
    var _a2;
    return (_a2 = p.notes) == null ? void 0 : _a2.trim();
  }).length}</Notes><HiddenSlides>${pages.filter((p) => p.hidden).length}</HiddenSlides></Properties>`);
  put("_rels/.rels", rels([
    { id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" }
  ]).replace(
    "</Relationships>",
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`
  ));
  const ct = "application/vnd.openxmlformats-officedocument";
  const overrides = [
    [`/ppt/presentation.xml`, `${ct}.presentationml.${options.template ? "template" : "presentation"}.main+xml`],
    ["/ppt/presProps.xml", `${ct}.presentationml.presProps+xml`],
    ["/ppt/viewProps.xml", `${ct}.presentationml.viewProps+xml`],
    ["/ppt/tableStyles.xml", `${ct}.presentationml.tableStyles+xml`],
    ["/ppt/theme/theme1.xml", `${ct}.theme+xml`],
    ["/ppt/slideMasters/slideMaster1.xml", `${ct}.presentationml.slideMaster+xml`],
    ["/ppt/slideLayouts/slideLayout1.xml", `${ct}.presentationml.slideLayout+xml`],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
    ["/docProps/app.xml", `${ct}.extended-properties+xml`],
    ...pages.map((_, i) => [`/ppt/slides/slide${i + 1}.xml`, `${ct}.presentationml.slide+xml`]),
    ...hasNotes ? [
      ["/ppt/notesMasters/notesMaster1.xml", `${ct}.presentationml.notesMaster+xml`],
      ["/ppt/theme/theme2.xml", `${ct}.theme+xml`],
      ...pages.flatMap((p, i) => {
        var _a2;
        return ((_a2 = p.notes) == null ? void 0 : _a2.trim()) ? [[`/ppt/notesSlides/notesSlide${i + 1}.xml`, `${ct}.presentationml.notesSlide+xml`]] : [];
      })
    ] : []
  ];
  const defaults = [
    ["rels", "application/vnd.openxmlformats-package.relationships+xml"],
    ["xml", "application/xml"],
    ...[...new Set([...media.values()].map((m) => m.ext))].map((ext) => [ext, `image/${ext}`])
  ];
  put("[Content_Types].xml", `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` + defaults.map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`).join("") + overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("") + "</Types>");
  const ordered = { "[Content_Types].xml": files["[Content_Types].xml"] };
  for (const [path, data] of Object.entries(files)) if (path !== "[Content_Types].xml") ordered[path] = data;
  return {
    bytes: zipSync(ordered, { level: 6 }),
    mimeType: options.template ? POTX_MIME : PPTX_MIME,
    extension: options.template ? "potx" : "pptx",
    warnings: [...doc.warnings, ...warnings]
  };
}
export {
  BG_MARKER as B,
  PAGE_MARKER as P,
  SLIDE_NOTES_KEY as S,
  SLIDE_SKIP_KEY as a,
  SLIDE_TRANSITION_KEY as b,
  POTX_MIME as c,
  PPTX_MIME as d,
  dataUrlBytes as e,
  documentToPptx as f,
  pageOrderOf as g,
  framesInDocumentOrder as h,
  isPageBackground as i,
  isSkippedFrame as j,
  SLIDE_TRANSITIONS as k,
  notesOf as n,
  parseColor as p,
  sceneToDocument as s,
  transitionOf as t,
  xmlText as x
};
//# sourceMappingURL=documentToPptx-CMWe-xWo.js.map
