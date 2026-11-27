import { readPsd } from "ag-psd";
import { r as readBytes, D as DocumentImportError, e as estimateTextHeight } from "./chunks/model-Jk--sAmK.js";
import { unzipSync, strFromU8 } from "fflate";
import { XMLValidator, XMLParser } from "fast-xml-parser";
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
const CURVE_STEPS = 16;
const closePath = (path) => {
  const [x, y] = path[0], last = path[path.length - 1];
  return Math.abs(last[0] - x) < 1e-6 && Math.abs(last[1] - y) < 1e-6 ? path : [...path, path[0]];
};
function joinPaths(paths) {
  const [first, ...rest] = paths.filter((path) => path.length > 1).map(closePath);
  if (!first) return [];
  const joined = [...first];
  for (const path of rest) joined.push(...path, first[0]);
  return joined;
}
function curve(from, controls, out) {
  for (let step = 1; step <= CURVE_STEPS; step++) {
    const t = step / CURVE_STEPS;
    let points = [from, ...controls];
    while (points.length > 1) points = points.slice(1).map((p, i) => [points[i][0] + (p[0] - points[i][0]) * t, points[i][1] + (p[1] - points[i][1]) * t]);
    out.push(points[0]);
  }
}
function customGeometry(geometry, width, height, filled) {
  const paths = [];
  let closed = false;
  for (const path of children(child(geometry, "pathLst"), "path")) {
    const pathWidth = Number(path.attrs.w) || 0, pathHeight = Number(path.attrs.h) || 0;
    const sx = pathWidth ? width / pathWidth : 1, sy = pathHeight ? height / pathHeight : 1;
    let current = [], position = [0, 0], unreadable = false;
    const read = (node) => {
      const x = Number(node.attrs.x), y = Number(node.attrs.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) unreadable = true;
      return [x * sx, y * sy];
    };
    for (const command of path.children) {
      if (command.name === "moveTo") {
        if (current.length) paths.push(current);
        position = read(command.children[0]);
        current = [position];
      } else if (command.name === "lnTo") {
        position = read(command.children[0]);
        current.push(position);
      } else if (command.name === "cubicBezTo" || command.name === "quadBezTo") {
        const controls = command.children.map(read);
        curve(position, controls, current);
        position = controls[controls.length - 1];
      } else if (command.name === "arcTo") {
        const rx = Number(command.attrs.wR) * sx, ry = Number(command.attrs.hR) * sy;
        const start = Number(command.attrs.stAng) / 6e4 * Math.PI / 180, sweep = Number(command.attrs.swAng) / 6e4 * Math.PI / 180;
        if (![rx, ry, start, sweep].every(Number.isFinite)) {
          unreadable = true;
          continue;
        }
        const cx = position[0] - rx * Math.cos(start), cy = position[1] - ry * Math.sin(start);
        for (let step = 1; step <= CURVE_STEPS; step++) {
          const angle = start + sweep * step / CURVE_STEPS;
          position = [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
          current.push(position);
        }
      } else if (command.name === "close" && current.length) {
        paths.push(current);
        current = [];
        closed = true;
      }
    }
    if (unreadable) return null;
    if (current.length) paths.push(current);
  }
  if (paths.length === 1 && !closed && !filled) return paths[0].length > 1 ? paths[0] : null;
  const joined = joinPaths(paths);
  return joined.length ? joined : null;
}
function moon(width, height) {
  const points = [], steps = 36;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + Math.PI * i / steps;
    points.push([width + width * Math.cos(a), height / 2 + height / 2 * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = Math.PI / 2 + Math.PI * i / steps;
    points.push([width + width / 2 * Math.cos(a), height / 2 + height / 2 * Math.sin(a)]);
  }
  return closePath(points);
}
const PRESETS = {
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  rtTriangle: [[0, 0], [1, 1], [0, 1]],
  parallelogram: [[0.25, 0], [1, 0], [0.75, 1], [0, 1]],
  trapezoid: [[0.25, 0], [0.75, 0], [1, 1], [0, 1]],
  pentagon: [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  octagon: [[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]],
  homePlate: [[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1]],
  chevron: [[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]],
  rightArrow: [[0, 0.25], [0.5, 0.25], [0.5, 0], [1, 0.5], [0.5, 1], [0.5, 0.75], [0, 0.75]],
  leftArrow: [[1, 0.25], [0.5, 0.25], [0.5, 0], [0, 0.5], [0.5, 1], [0.5, 0.75], [1, 0.75]],
  upArrow: [[0.25, 1], [0.25, 0.5], [0, 0.5], [0.5, 0], [1, 0.5], [0.75, 0.5], [0.75, 1]],
  downArrow: [[0.25, 0], [0.25, 0.5], [0, 0.5], [0.5, 1], [1, 0.5], [0.75, 0.5], [0.75, 0]],
  plus: [[0.25, 0], [0.75, 0], [0.75, 0.25], [1, 0.25], [1, 0.75], [0.75, 0.75], [0.75, 1], [0.25, 1], [0.25, 0.75], [0, 0.75], [0, 0.25], [0.25, 0.25]]
};
const STAR_INNER = { star4: 0.25, star5: 0.382, star6: 0.577, star7: 0.5, star8: 0.5, star10: 0.6, star12: 0.65, star16: 0.75, star24: 0.8, star32: 0.85 };
function star(points, inner, width, height) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 ? inner : 1, angle = -Math.PI / 2 + Math.PI * i / points;
    return [width / 2 * (1 + radius * Math.cos(angle)), height / 2 * (1 + radius * Math.sin(angle))];
  });
}
function oval(cx, cy, rx, ry, reverse = false) {
  return Array.from({ length: 72 }, (_, i) => {
    const a = (reverse ? -1 : 1) * Math.PI * i / 36;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}
function heart(width, height) {
  const points = [[width / 2, height * 0.25]];
  curve(points[0], [[width * 0.6, 0], [width, 0], [width, height * 0.32]], points);
  curve(points[points.length - 1], [[width, height * 0.62], [width * 0.65, height * 0.8], [width / 2, height]], points);
  curve(points[points.length - 1], [[width * 0.35, height * 0.8], [0, height * 0.62], [0, height * 0.32]], points);
  curve(points[points.length - 1], [[0, 0], [width * 0.4, 0], [width / 2, height * 0.25]], points);
  return points;
}
function connectorPoints(name, width, height) {
  if (name === "bentConnector2") return [[0, 0], [width, 0], [width, height]];
  if (name == null ? void 0 : name.startsWith("bentConnector")) return [[0, 0], [width / 2, 0], [width / 2, height], [width, height]];
  if (name == null ? void 0 : name.startsWith("curvedConnector")) {
    const points = [[0, 0]];
    curve([0, 0], [[width / 2, 0], [width / 2, height], [width, height]], points);
    return points;
  }
  return [[0, 0], [width, height]];
}
function presetGeometry(name, width, height) {
  if (name === "moon") return moon(width, height);
  if (name === "heart") return closePath(heart(width, height));
  if (name === "donut") {
    const ring = Math.min(width, height) * 0.25;
    return joinPaths([oval(width / 2, height / 2, width / 2, height / 2), oval(width / 2, height / 2, width / 2 - ring, height / 2 - ring, true)]);
  }
  if (name && STAR_INNER[name]) return closePath(star(Number(name.slice(4)), STAR_INNER[name], width, height));
  const preset = name ? PRESETS[name] : void 0;
  return preset ? closePath(preset.map(([x, y]) => [x * width, y * height])) : null;
}
const flipPoints = (points, width, height, flipH, flipV) => points.map(([x, y]) => [flipH ? width - x : x, flipV ? height - y : y]);
function imageSize(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 2303741511) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length > 10 && view.getUint32(0) === 1195984440) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (bytes.length > 4 && view.getUint16(0) === 65496) {
    for (let offset = 2; offset + 9 < bytes.length; ) {
      if (bytes[offset] !== 255) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return void 0;
}
const COLOR_NODES = /* @__PURE__ */ new Set(["srgbClr", "schemeClr", "sysClr", "prstClr"]);
const NAMED = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", grey: "808080" };
const DEFAULT_MAP = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
const nodeHex = (node) => node && (node.name === "sysClr" ? node.attrs.lastClr : node.attrs.val);
function readTheme(theme, colorMap) {
  var _a, _b, _c;
  const elements = child(child(theme, "theme"), "themeElements");
  const colors = {};
  for (const slot of ((_a = child(elements, "clrScheme")) == null ? void 0 : _a.children) ?? []) {
    const hex = nodeHex(slot.children[0]);
    if (hex) colors[slot.name] = hex;
  }
  const fonts = child(elements, "fontScheme");
  return {
    colors,
    map: { ...DEFAULT_MAP, ...colorMap == null ? void 0 : colorMap.attrs },
    majorFont: (_b = child(child(fonts, "majorFont"), "latin")) == null ? void 0 : _b.attrs.typeface,
    minorFont: (_c = child(child(fonts, "minorFont"), "latin")) == null ? void 0 : _c.attrs.typeface
  };
}
function toHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, m = l - c / 2, sector = h * 6;
  const x = c * (1 - Math.abs(sector % 2 - 1));
  const table = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(sector) % 6];
  return table.map((v) => v + m);
}
const clamp = (v) => Math.min(1, Math.max(0, v));
function readColor(parent, theme, placeholder) {
  var _a;
  const node = parent == null ? void 0 : parent.children.find((n) => COLOR_NODES.has(n.name));
  if (!node) return void 0;
  const usesPlaceholder = node.name === "schemeClr" && node.attrs.val === "phClr";
  let hex;
  if (usesPlaceholder) hex = placeholder == null ? void 0 : placeholder.hex.slice(1);
  else if (node.name === "schemeClr") hex = theme.colors[theme.map[node.attrs.val] ?? node.attrs.val];
  else if (node.name === "prstClr") hex = NAMED[(_a = node.attrs.val) == null ? void 0 : _a.toLowerCase()];
  else hex = nodeHex(node);
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return void 0;
  let rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  let alpha = usesPlaceholder ? placeholder.alpha : 1;
  for (const mod of node.children) {
    const amount = Number(mod.attrs.val) / 1e5;
    if (!Number.isFinite(amount)) continue;
    if (mod.name === "alpha") alpha = amount;
    else if (mod.name === "alphaMod") alpha *= amount;
    else if (mod.name === "shade") rgb = rgb.map((v) => v * amount);
    else if (mod.name === "tint") rgb = rgb.map((v) => v + (1 - v) * (1 - amount));
    else if (["lumMod", "lumOff", "satMod"].includes(mod.name)) {
      const hsl = toHsl(rgb);
      if (mod.name === "lumMod") hsl[2] = clamp(hsl[2] * amount);
      if (mod.name === "lumOff") hsl[2] = clamp(hsl[2] + amount);
      if (mod.name === "satMod") hsl[1] = clamp(hsl[1] * amount);
      rgb = fromHsl(hsl);
    }
  }
  return { hex: `#${rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0")).join("")}`, alpha };
}
const EMU = 9525;
const POINT = 96 / 72;
const DEFAULT_FONT_SIZE = 18 * POINT;
const NATURAL_LINE_HEIGHT = 1.2;
const DEFAULT_INSET = { left: 91440 / EMU, top: 45720 / EMU, right: 91440 / EMU, bottom: 45720 / EMU };
const ALIGN = { l: "left", just: "left", dist: "left", ctr: "center", r: "right" };
const ANCHOR = { t: "top", ctr: "middle", b: "bottom" };
const CONNECTORS = /^(line|straightConnector\d*|bentConnector\d*|curvedConnector\d*)$/;
const DEFAULT_TABLE_STYLE = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}";
const PLACEHOLDER_FILL = "#e9ecef", PLACEHOLDER_STROKE = "#adb5bd";
const BASIC_SHAPES = {
  rect: { kind: "rectangle" },
  flowChartProcess: { kind: "rectangle" },
  ellipse: { kind: "ellipse" },
  flowChartConnector: { kind: "ellipse" },
  diamond: { kind: "diamond" },
  flowChartDecision: { kind: "diamond" },
  roundRect: { kind: "rectangle", rounded: true },
  round2SameRect: { kind: "rectangle", rounded: true },
  flowChartAlternateProcess: { kind: "rectangle", rounded: true },
  flowChartTerminator: { kind: "rectangle", rounded: true }
};
const number = (v, fallback = 0) => v !== void 0 && Number.isFinite(Number(v)) ? Number(v) : fallback;
const firstOf = (items) => items.find((item) => item !== void 0);
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
const NAMED_WEIGHT = /\b(thin|hairline|light|regular|book|medium|(semi|demi|extra|ultra)?\s?bold|black|heavy)$/i;
function styledFamily(font, bold, italic) {
  if (!font) return font;
  const named = NAMED_WEIGHT.test(font.replace(/\s+italic$/i, ""));
  return `${font}${bold && !named ? " Bold" : ""}${italic && !/italic$/i.test(font) ? " Italic" : ""}`;
}
const placeholderOf = (shape) => descendants(child(shape, "nvSpPr"), "ph")[0];
function notesText(notes) {
  const shapes = descendants(notes, "sp");
  const body = shapes.find((sp) => {
    var _a;
    return ((_a = placeholderOf(sp)) == null ? void 0 : _a.attrs.type) === "body";
  }) ?? shapes.find((sp) => !placeholderOf(sp) && child(sp, "txBody"));
  if (!body) return descendants(notes, "t").map(value).join("\n").replace(/\s+$/, "");
  const paragraphs = descendants(child(body, "txBody"), "p").map((p) => p.children.flatMap((run) => run.name === "br" ? ["\n"] : run.name === "r" || run.name === "fld" ? descendants(run, "t").map(value) : []).join(""));
  return paragraphs.join("\n").replace(/\s+$/, "");
}
const masterKind = (type) => type === "title" || type === "ctrTitle" ? "title" : !type || type === "subTitle" || type === "obj" || type === "body" ? "body" : type;
const shapesOf = (root, tag) => children(child(child(root && child(root, tag), "cSld"), "spTree"), "sp");
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
  const parsed = /* @__PURE__ */ new Map();
  const read = (name) => {
    if (!files[name]) throw new DocumentImportError("invalid-file", `Missing package part: ${name}`);
    let node = parsed.get(name);
    if (!node) {
      node = xml(strFromU8(files[name]));
      parsed.set(name, node);
    }
    return node;
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
  const related = (source, kind) => {
    var _a2;
    if (!source) return void 0;
    const target = (_a2 = [...relationships(source).values()].find((r) => r.type.endsWith(kind) && !r.external)) == null ? void 0 : _a2.target;
    return target && files[target] ? target : void 0;
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
  const defaultTextStyle = child(presentation, "defaultTextStyle");
  const doc = { format: "pptx", pages: [], assets: [], warnings: [] };
  const assetIds = /* @__PURE__ */ new Map();
  const warn = (code, message, pageId, elementId) => doc.warnings.push({ code, message, pageId, elementId });
  for (const [pageIndex, slideId] of slideIds.entries()) {
    let readBlocks = function(body, levelsFor, styleColor, elementId) {
      const fit = child(child(body, "bodyPr"), "normAutofit");
      const fontScale = number(fit == null ? void 0 : fit.attrs.fontScale, 1e5) / 1e5, spacingCut = number(fit == null ? void 0 : fit.attrs.lnSpcReduction) / 1e5;
      let simplified = false;
      const blocks = children(body, "p").map((paragraph) => {
        var _a2, _b2, _c, _d, _e;
        const props = child(paragraph, "pPr"), { near, far } = levelsFor(number(props == null ? void 0 : props.attrs.lvl) + 1), levels = [...near, ...far], chain = [props, ...levels];
        const paragraphValue = (get) => firstOf(chain.map((node) => node && get(node)));
        const runs = paragraph.children.filter((n) => n.name === "r" || n.name === "fld");
        const styled = runs.filter((run) => value(child(run, "t")).trim());
        const styleOf = (run) => {
          const own = child(run, "rPr") ?? child(paragraph, "endParaRPr"), sources = [own, ...levels.map((level) => child(level, "defRPr"))];
          const pick = (get) => firstOf(sources.map((node) => node && get(node)));
          return {
            size: number(pick((n) => n.attrs.sz), DEFAULT_FONT_SIZE / POINT * 100) / 100 * POINT * fontScale,
            font: fontName(pick((n) => {
              var _a3;
              return (_a3 = child(n, "latin")) == null ? void 0 : _a3.attrs.typeface;
            })) ?? theme.minorFont,
            // The shape's style outranks the master's text styles, not the shape's own.
            color: firstOf([own, ...near.map((level) => child(level, "defRPr"))].map((n) => n && paint(child(n, "solidFill")))) ?? styleColor ?? firstOf(far.map((level) => paint(child(child(level, "defRPr"), "solidFill")))) ?? schemeColor("tx1"),
            bold: pick((n) => n.attrs.b) === "1",
            italic: pick((n) => n.attrs.i) === "1"
          };
        };
        const style = styleOf(styled[0] ?? runs[0]);
        let letters = 0, bold = 0, italic = 0;
        for (const run of styled) {
          const other = styleOf(run), length = value(child(run, "t")).length;
          letters += length;
          if (other.bold) bold += length;
          if (other.italic) italic += length;
          if (other.size !== style.size || other.font !== style.font || ((_a2 = other.color) == null ? void 0 : _a2.hex) !== ((_b2 = style.color) == null ? void 0 : _b2.hex)) simplified = true;
        }
        const isBold = letters ? bold * 2 > letters : style.bold, isItalic = letters ? italic * 2 > letters : style.italic;
        if (styled.some((run) => styleOf(run).bold !== isBold || styleOf(run).italic !== isItalic)) simplified = true;
        const spacing = (name) => {
          var _a3, _b3;
          const node = paragraphValue((n) => child(n, name));
          const points = (_a3 = child(node, "spcPts")) == null ? void 0 : _a3.attrs.val, percent2 = (_b3 = child(node, "spcPct")) == null ? void 0 : _b3.attrs.val;
          return points !== void 0 ? number(points) / 100 * POINT : percent2 !== void 0 ? number(percent2) / 1e5 * style.size : 0;
        };
        const lines = paragraphValue((n) => child(n, "lnSpc"));
        const exact = (_c = child(lines, "spcPts")) == null ? void 0 : _c.attrs.val, percent = (_d = child(lines, "spcPct")) == null ? void 0 : _d.attrs.val;
        const lineHeight = exact !== void 0 ? number(exact) / 100 * POINT / style.size : (number(percent, 1e5) / 1e5 - spacingCut) * NATURAL_LINE_HEIGHT;
        const text = paragraph.children.map((n) => n.name === "br" ? "\n" : n.name === "r" || n.name === "fld" ? value(child(n, "t")) : "").join("");
        const bullet = paragraphValue((n) => {
          var _a3;
          return child(n, "buNone") ? "" : (_a3 = child(n, "buChar")) == null ? void 0 : _a3.attrs.char;
        });
        return {
          text: bullet && text.trim() ? `${bullet} ${text}` : text,
          fontSize: style.size,
          fontFamily: styledFamily(style.font, isBold, isItalic),
          color: ((_e = style.color) == null ? void 0 : _e.hex) ?? "#1a1a1a",
          textAlign: ALIGN[paragraphValue((n) => n.attrs.algn) ?? "l"] ?? "left",
          lineHeight,
          before: spacing("spcBef"),
          after: spacing("spcAft")
        };
      });
      if (simplified) warn("text-style", "Bold, italic and mixed styles inside a paragraph are simplified.", page.id, elementId);
      return blocks;
    }, addText = function(body, box, bodies, levelsFor, styleColor, overrides = {}) {
      const id = nextId(), blocks = readBlocks(body, levelsFor, styleColor, id);
      if (!blocks.some((block) => block.text.trim())) return;
      warn("text-layout", "Text remains editable; its metrics depend on the font available.", page.id, id);
      const attribute = (name) => firstOf(bodies.map((node) => node == null ? void 0 : node.attrs[name]));
      const side = (name, key) => {
        var _a2;
        return ((_a2 = overrides.inset) == null ? void 0 : _a2[key]) ?? (attribute(name) !== void 0 ? number(attribute(name)) / EMU : DEFAULT_INSET[key]);
      };
      const inset = { left: side("lIns", "left"), top: side("tIns", "top"), right: side("rIns", "right"), bottom: side("bIns", "bottom") };
      const verticalAlign = ANCHOR[overrides.anchor ?? attribute("anchor") ?? "t"] ?? "top";
      const written = blocks.filter((block) => block.text.trim()), first = written[0];
      const element = (block, extra) => ({
        ...box,
        id,
        kind: "text",
        fontSize: block.fontSize,
        fontFamily: block.fontFamily,
        color: block.color,
        textAlign: block.textAlign,
        lineHeight: block.lineHeight,
        inset,
        verticalAlign,
        ...extra
      });
      const uniform = blocks.every((block) => !block.before && !block.after) && written.every((block) => block.fontSize === first.fontSize && block.fontFamily === first.fontFamily && block.color === first.color && block.textAlign === first.textAlign && block.lineHeight === first.lineHeight);
      if (uniform) {
        page.elements.push(element(first, { text: blocks.map((block) => block.text).join("\n") }));
        return;
      }
      const textWidth = Math.max(1, box.width - inset.left - inset.right), room = box.height - inset.top - inset.bottom;
      const heights = blocks.map((block) => estimateTextHeight(block.text, block.fontSize, block.lineHeight, textWidth));
      const total = blocks.reduce((sum, block, index) => sum + heights[index] + (index ? block.before : 0) + block.after, 0);
      let y = box.y + inset.top + (verticalAlign === "middle" ? (room - total) / 2 : verticalAlign === "bottom" ? room - total : 0);
      blocks.forEach((block, index) => {
        if (index) y += block.before;
        if (block.text.trim()) page.elements.push(element(block, { id: index ? nextId() : id, text: block.text, y, height: heights[index], verticalAlign: "top", inset: { ...inset, top: 0, bottom: 0 } }));
        y += heights[index] + block.after;
      });
    }, appearance = function(sources, style, elementId) {
      var _a2, _b2, _c, _d, _e;
      const fillOwner = sources.find((node) => node && ["noFill", "solidFill", "gradFill", "blipFill", "pattFill"].some((name) => child(node, name)));
      let fill;
      if (fillOwner) {
        fill = paint(child(fillOwner, "solidFill"));
        const gradient = child(fillOwner, "gradFill");
        if (gradient) {
          fill = paint(descendants(gradient, "gs")[0]);
          warn("shape-effects", "Gradients are reduced to their first color.", page.id, elementId);
        }
      } else if (number((_a2 = child(style, "fillRef")) == null ? void 0 : _a2.attrs.idx)) fill = paint(child(style, "fillRef"));
      const lineOwner = sources.map((node) => child(node, "ln")).find((node) => node && node.children.some((n) => n.name === "noFill" || n.name === "solidFill"));
      const lineProps = sources.map((node) => child(node, "ln")).find(Boolean);
      let stroke;
      if (lineOwner) stroke = paint(child(lineOwner, "solidFill"));
      else if (number((_b2 = child(style, "lnRef")) == null ? void 0 : _b2.attrs.idx)) stroke = paint(child(style, "lnRef"));
      const dash = (_c = child(lineProps, "prstDash")) == null ? void 0 : _c.attrs.val;
      if (sources.some((node) => node && descendants(child(node, "effectLst"), "outerShdw").length)) warn("shape-effects", "Shadows are not retained.", page.id, elementId);
      return {
        fill,
        stroke,
        strokeWidth: number(lineProps == null ? void 0 : lineProps.attrs.w, EMU) / EMU,
        strokeStyle: !dash || dash === "solid" ? void 0 : /dot/i.test(dash) && !/dash/i.test(dash) ? "dotted" : "dashed",
        arrowStart: ["triangle", "arrow", "stealth"].includes(((_d = child(lineProps, "headEnd")) == null ? void 0 : _d.attrs.type) ?? ""),
        arrowEnd: ["triangle", "arrow", "stealth"].includes(((_e = child(lineProps, "tailEnd")) == null ? void 0 : _e.attrs.type) ?? "")
      };
    }, addImage = function(node, box, props, transformFlip, sourceRels, id) {
      var _a2, _b2, _c, _d;
      const blip = descendants(node, "blip")[0];
      const imageRel = blip && sourceRels.get(relationId(blip, "embed") ?? "");
      if (!imageRel || imageRel.external || !files[imageRel.target]) {
        warn("missing-image", "Image is external or missing; no network request was made.", page.id, id);
        return;
      }
      let assetId = assetIds.get(imageRel.target);
      if (!assetId) {
        assetId = `asset-${assetIds.size + 1}`;
        assetIds.set(imageRel.target, assetId);
        const extension = (_a2 = imageRel.target.split(".").pop()) == null ? void 0 : _a2.toLowerCase();
        const mimeType = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp" }[extension ?? ""] ?? "application/octet-stream";
        doc.assets.push({ id: assetId, name: imageRel.target.split("/").pop(), mimeType, bytes: files[imageRel.target], ...imageSize(files[imageRel.target]) });
        if (mimeType === "application/octet-stream") warn("image-format", "Embedded image needs conversion before browser rendering.", page.id, id);
      }
      const source = descendants(node, "srcRect")[0], side = (name) => Math.max(0, number(source == null ? void 0 : source.attrs[name]) / 1e5);
      const crop = { left: side("l"), top: side("t"), right: side("r"), bottom: side("b") };
      const cropped = Object.values(crop).some(Boolean), asset = doc.assets.find((item) => item.id === assetId);
      if (cropped && !(asset == null ? void 0 : asset.width)) warn("image-crop", "Image cropping needs the image size, which could not be read.", page.id, id);
      const transparency = number((_b2 = descendants(blip, "alphaModFix")[0]) == null ? void 0 : _b2.attrs.amt, 1e5) / 1e3;
      if (((_c = child(props, "prstGeom")) == null ? void 0 : _c.attrs.prst) === "roundRect" || ((_d = child(props, "prstGeom")) == null ? void 0 : _d.attrs.prst) === "ellipse") warn("image-mask", "Rounded image masks are not retained.", page.id, id);
      page.elements.push({ ...box, id, kind: "image", assetId, ...transformFlip, ...cropped ? { crop } : {}, ...transparency < 100 ? { opacity: Math.round(transparency) } : {} });
    }, addTable = function(table, box, transform) {
      const columns = children(child(table, "tblGrid"), "gridCol").map((column) => number(column.attrs.w) / EMU * transform.sx);
      const options = child(table, "tblPr"), styleId = value(child(options, "tableStyleId")).trim(), styled = styleId === DEFAULT_TABLE_STYLE;
      let y = box.y;
      for (const [rowIndex, row] of children(table, "tr").entries()) {
        const header = styled && (options == null ? void 0 : options.attrs.firstRow) === "1" && rowIndex === 0;
        const bandIndex = rowIndex - ((options == null ? void 0 : options.attrs.firstRow) === "1" ? 1 : 0);
        const rowFill = !styled ? void 0 : header ? schemeColor("accent1") : (options == null ? void 0 : options.attrs.bandRow) === "1" && bandIndex % 2 === 0 ? schemeColor("accent1", tint(4e4)) : schemeColor("accent1", tint(2e4));
        const rowHeight = number(row.attrs.h) / EMU * transform.sy;
        let x = box.x;
        children(row, "tc").forEach((cell, index) => {
          var _a2;
          const span = Math.max(1, number(cell.attrs.gridSpan, 1));
          const cellWidth = columns.slice(index, index + span).reduce((sum, column) => sum + column, 0);
          if (cell.attrs.hMerge !== "1" && cell.attrs.vMerge !== "1") {
            const props = child(cell, "tcPr"), cellBox = { x, y, width: cellWidth, height: rowHeight, groupIds: box.groupIds };
            const fill = paint(child(props, "solidFill")) ?? rowFill;
            if (fill) page.elements.push({ ...cellBox, id: nextId(), kind: "rectangle", fill: fill.hex, opacity: opacityOf(fill), ...styled ? { stroke: (_a2 = schemeColor("lt1")) == null ? void 0 : _a2.hex, strokeWidth: 1 } : {} });
            const border = (name, from, to) => {
              const line = child(props, name), color = paint(child(line, "solidFill"));
              if (!color) return;
              const left = Math.min(from[0], to[0]), top = Math.min(from[1], to[1]);
              page.elements.push({
                id: nextId(),
                kind: "line",
                x: left,
                y: top,
                width: Math.abs(to[0] - from[0]),
                height: Math.abs(to[1] - from[1]),
                groupIds: box.groupIds,
                points: [[0, 0], [to[0] - from[0], to[1] - from[1]]],
                stroke: color.hex,
                opacity: opacityOf(color),
                strokeWidth: number(line == null ? void 0 : line.attrs.w, EMU) / EMU
              });
            };
            border("lnT", [x, y], [x + cellWidth, y]);
            border("lnB", [x, y + rowHeight], [x + cellWidth, y + rowHeight]);
            border("lnL", [x, y], [x, y + rowHeight]);
            border("lnR", [x + cellWidth, y], [x + cellWidth, y + rowHeight]);
            const body = child(cell, "txBody"), margin = (name, fallback) => (props == null ? void 0 : props.attrs[name]) !== void 0 ? number(props.attrs[name]) / EMU : fallback;
            if (body) addText(body, cellBox, [child(body, "bodyPr")], (level) => ({ near: present([child(child(body, "lstStyle"), `lvl${level}pPr`)]), far: present([child(defaultTextStyle, `lvl${level}pPr`)]) }), header ? schemeColor("lt1") : schemeColor("tx1"), {
              anchor: (props == null ? void 0 : props.attrs.anchor) ?? "t",
              inset: { left: margin("marL", DEFAULT_INSET.left), right: margin("marR", DEFAULT_INSET.right), top: margin("marT", DEFAULT_INSET.top), bottom: margin("marB", DEFAULT_INSET.bottom) }
            });
          }
          x += cellWidth;
        });
        y += rowHeight;
      }
      if (styleId && !styled) warn("table-style", "Table style presets are not applied; only direct cell formatting is kept.", page.id);
    }, shape = function(node, sourceRels, isSlide, transform) {
      var _a2, _b2, _c, _d, _e;
      if (!["sp", "pic", "cxnSp", "grpSp", "graphicFrame"].includes(node.name)) {
        if (node.name !== "nvGrpSpPr" && node.name !== "grpSpPr" && node.name !== "extLst") warn("unsupported-object", `Object ${node.name} is not converted.`, page.id);
        return;
      }
      if (((_a2 = descendants(node, "cNvPr")[0]) == null ? void 0 : _a2.attrs.hidden) === "1") return;
      const placeholder = node.name === "sp" ? inheritedPlaceholder(node) : void 0;
      if (!isSlide && placeholderOf(node)) return;
      const props = child(node, node.name === "grpSp" ? "grpSpPr" : "spPr");
      const inheritedProps = (placeholder == null ? void 0 : placeholder.shapes.map((s) => child(s, "spPr"))) ?? [];
      const xfrm = node.name === "graphicFrame" ? child(node, "xfrm") : firstOf([props, ...inheritedProps].map((p) => child(p, "xfrm")));
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
          sy: transform.sy * sy,
          groupIds: [`${page.id}-group-${++groupSerial}`, ...transform.groupIds]
        };
        node.children.forEach((n) => shape(n, sourceRels, isSlide, nested));
        return;
      }
      const table = node.name === "graphicFrame" ? descendants(node, "tbl")[0] : void 0;
      if (!off && node.name === "graphicFrame") {
        warn("unsupported-object", "Charts, diagrams and embedded media are not converted.", page.id, nextId());
        return;
      }
      if (!off || !ext) {
        warn("missing-geometry", "Object has no geometry of its own or in its layout.", page.id, nextId());
        return;
      }
      const box = {
        x: transform.x + number(off.attrs.x) / EMU * transform.sx,
        y: transform.y + number(off.attrs.y) / EMU * transform.sy,
        width: number(ext.attrs.cx) / EMU * transform.sx,
        height: number(ext.attrs.cy) / EMU * transform.sy,
        rotation: number(xfrm == null ? void 0 : xfrm.attrs.rot) / 6e4,
        groupIds: transform.groupIds.length ? transform.groupIds : void 0
      };
      if (table) {
        addTable(table, box, transform);
        return;
      }
      if (node.name === "graphicFrame") {
        const id2 = nextId();
        warn("unsupported-object", "Charts, diagrams and embedded media are not converted.", page.id, id2);
        page.elements.push({ ...box, id: id2, kind: "rectangle", fill: PLACEHOLDER_FILL, stroke: PLACEHOLDER_STROKE, strokeWidth: 1 });
        return;
      }
      const flips = { flipH: (xfrm == null ? void 0 : xfrm.attrs.flipH) === "1", flipV: (xfrm == null ? void 0 : xfrm.attrs.flipV) === "1" };
      if (node.name === "pic") {
        if (box.width <= 0 || box.height <= 0) {
          warn("invalid-geometry", "Object has empty geometry.", page.id, nextId());
          return;
        }
        addImage(node, box, props, flips, sourceRels, nextId());
        return;
      }
      const id = nextId(), style = child(node, "style");
      const look = appearance([props, ...inheritedProps], style, id);
      const geometryOwner = [props, ...inheritedProps].find((p) => child(p, "custGeom") || child(p, "prstGeom"));
      const custom = child(geometryOwner, "custGeom"), preset = (_b2 = child(geometryOwner, "prstGeom")) == null ? void 0 : _b2.attrs.prst;
      const isLine = node.name === "cxnSp" || preset !== void 0 && CONNECTORS.test(preset);
      const painted = {
        ...box,
        id,
        kind: "rectangle",
        name: (_c = descendants(node, "cNvPr")[0]) == null ? void 0 : _c.attrs.name,
        fill: ((_d = look.fill) == null ? void 0 : _d.hex) ?? "transparent",
        stroke: (_e = look.stroke) == null ? void 0 : _e.hex,
        strokeWidth: look.strokeWidth,
        strokeStyle: look.strokeStyle,
        opacity: opacityOf(look.fill) ?? opacityOf(look.stroke)
      };
      if (isLine) {
        if (box.width <= 0 && box.height <= 0) {
          warn("invalid-geometry", "Object has empty geometry.", page.id, id);
          return;
        }
        if (look.stroke) page.elements.push({
          ...painted,
          kind: "line",
          fill: void 0,
          arrowStart: look.arrowStart,
          arrowEnd: look.arrowEnd,
          points: flipPoints(connectorPoints(preset, box.width, box.height), box.width, box.height, flips.flipH, flips.flipV)
        });
        return;
      }
      if (box.width <= 0 || box.height <= 0) {
        warn("invalid-geometry", "Object has empty geometry.", page.id, id);
        return;
      }
      if (look.fill || look.stroke) {
        const points = custom ? customGeometry(custom, box.width, box.height, Boolean(look.fill)) : presetGeometry(preset, box.width, box.height);
        if (points) page.elements.push({ ...painted, kind: "line", points: flipPoints(points, box.width, box.height, flips.flipH, flips.flipV) });
        else {
          const basic = BASIC_SHAPES[preset ?? "rect"];
          page.elements.push({ ...painted, kind: (basic == null ? void 0 : basic.kind) ?? "rectangle", rounded: basic == null ? void 0 : basic.rounded });
          if (custom || !basic) warn("shape-geometry", `Geometry ${preset ?? "custom"} is approximated as a rectangle.`, page.id, id);
        }
      }
      const body = child(node, "txBody");
      if (body) {
        const bodies = [body, ...(placeholder == null ? void 0 : placeholder.shapes.map((s) => child(s, "txBody"))) ?? []];
        const styleKey = (placeholder == null ? void 0 : placeholder.kind) === "title" ? "titleStyle" : (placeholder == null ? void 0 : placeholder.kind) === "body" ? "bodyStyle" : "otherStyle";
        const levelsFor = (level) => ({
          near: present(bodies.map((b) => child(child(b, "lstStyle"), `lvl${level}pPr`))),
          far: present([child(child(textStyles, styleKey), `lvl${level}pPr`), child(defaultTextStyle, `lvl${level}pPr`)])
        });
        const fontColor = paint(child(style, "fontRef"));
        addText(body, box, bodies.map((b) => child(b, "bodyPr")), levelsFor, fontColor);
      }
    };
    const rel = rels.get(relationId(slideId, "id") ?? "");
    if (!rel || rel.external || !rel.type.endsWith("/slide")) throw new DocumentImportError("invalid-file", "Invalid slide relationship.");
    const slideRoot = read(rel.target), slide = child(slideRoot, "sld");
    if (!slide) throw new DocumentImportError("invalid-file", "Missing slide root.");
    const page = { id: `slide-${pageIndex + 1}`, name: ((_a = child(slide, "cSld")) == null ? void 0 : _a.attrs.name) || `Slide ${pageIndex + 1}`, width, height, elements: [] };
    if (slide.attrs.show === "0") page.hidden = true;
    doc.pages.push(page);
    page.extractedText = descendants(slide, "t").map(value).join("\n");
    const slideRels = relationships(rel.target);
    const layoutPath = related(rel.target, "/slideLayout"), masterPath = related(layoutPath, "/slideMaster"), themePath = related(masterPath, "/theme");
    if (!masterPath && [...slideRels.values()].some((r) => r.type.endsWith("/slideLayout"))) {
      warn("master-layout", "The slide layout or master is missing; inherited styles are not available.", page.id);
    }
    const layoutRoot = layoutPath ? read(layoutPath) : void 0, masterRoot = masterPath ? read(masterPath) : void 0;
    const layout = child(layoutRoot, "sldLayout"), master = child(masterRoot, "sldMaster");
    const theme = readTheme(themePath ? read(themePath) : void 0, child(master, "clrMap"));
    const textStyles = child(master, "txStyles");
    const paint = (parent, placeholder) => {
      const color = readColor(parent, theme, placeholder);
      if (!color && (parent == null ? void 0 : parent.children.some((n) => n.name === "schemeClr"))) warn("theme-color", "Theme color could not be resolved; a fallback is used.", page.id);
      return color;
    };
    const schemeColor = (name, modifier) => readColor({ children: [{ name: "schemeClr", attrs: { val: name }, children: modifier ? [modifier] : [], value: "" }] }, theme);
    const tint = (amount) => ({ name: "tint", attrs: { val: String(amount) }, children: [], value: "" });
    const opacityOf = (color) => color && color.alpha < 1 ? Math.round(color.alpha * 100) : void 0;
    const backgroundOf = (owner) => {
      const background = child(child(owner, "cSld"), "bg");
      return paint(child(child(background, "bgPr"), "solidFill")) ?? paint(child(background, "bgRef"));
    };
    page.background = (_b = firstOf([slide, layout, master].map(backgroundOf))) == null ? void 0 : _b.hex;
    let serial = 0, groupSerial = 0;
    const nextId = () => `${page.id}-element-${++serial}`;
    const inheritedPlaceholder = (shape2) => {
      var _a2;
      const ph = placeholderOf(shape2);
      if (!ph) return void 0;
      const kind = masterKind(ph.attrs.type), inherited = [];
      const inLayout = shapesOf(layoutRoot, "sldLayout").find((s) => {
        const own = placeholderOf(s);
        return own && (ph.attrs.idx !== void 0 ? own.attrs.idx === ph.attrs.idx : masterKind(own.attrs.type) === kind);
      }) ?? shapesOf(layoutRoot, "sldLayout").find((s) => {
        const own = placeholderOf(s);
        return own && ph.attrs.type && own.attrs.type === ph.attrs.type;
      });
      if (inLayout) inherited.push(inLayout);
      const lookup = inLayout ? masterKind((_a2 = placeholderOf(inLayout)) == null ? void 0 : _a2.attrs.type) : kind;
      const inMaster = shapesOf(masterRoot, "sldMaster").find((s) => {
        const own = placeholderOf(s);
        return own && masterKind(own.attrs.type) === lookup;
      });
      if (inMaster) inherited.push(inMaster);
      return { shapes: inherited, kind: lookup };
    };
    const fontName = (name) => name === "+mj-lt" ? theme.majorFont : !name || name === "+mn-lt" ? name ? theme.minorFont : void 0 : name;
    const present = (nodes) => nodes.filter((n) => Boolean(n));
    const root = { x: 0, y: 0, sx: 1, sy: 1, groupIds: [] };
    const tree = (owner) => {
      var _a2;
      return ((_a2 = child(child(owner, "cSld"), "spTree")) == null ? void 0 : _a2.children) ?? [];
    };
    if (slide.attrs.showMasterSp !== "0" && (layout == null ? void 0 : layout.attrs.showMasterSp) !== "0" && masterPath) tree(master).forEach((n) => shape(n, relationships(masterPath), false, root));
    if (slide.attrs.showMasterSp !== "0" && layoutPath) tree(layout).forEach((n) => shape(n, relationships(layoutPath), false, root));
    tree(slide).forEach((n) => shape(n, slideRels, true, root));
    const notes = [...slideRels.values()].find((r) => r.type.endsWith("/notesSlide") && !r.external);
    if (notes && files[notes.target]) {
      const text = notesText(read(notes.target));
      if (text) page.notes = text;
    }
    const transition = child(slide, "transition") ?? descendants(child(slide, "AlternateContent"), "transition")[0];
    if (transition && transition.children.some((c) => c.name !== "extLst" && c.name !== "sndAc")) page.transition = "fade";
    if (child(slide, "timing")) warn("animation", "Object animations are not imported.", page.id);
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
  { extension: "pptx", support: "partial", detail: "Slides with their theme and layouts: text, shapes, outlines, connectors, tables, images and notes." },
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
