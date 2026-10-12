import { P as PAGE_GAP } from "./layout-BEpoNps2.js";
import { dedupeFontFaces, normalizeFontName, customFontFamilyId, normalizeFontSrc, fontFamilyAlias } from "../fonts.js";
const PSD_IMAGE_MARKER = "psdImage";
const PAPER_COLOR$1 = "#ffffff";
const BG_MARKER$1 = "pageBackground";
const DEFAULT_FONT_FAMILY$1 = 2;
const PLACEHOLDER_FILL = "#e9ecef";
const PLACEHOLDER_STROKE = "#adb5bd";
const PLACEHOLDER_TEXT = "#6c757d";
const num$1 = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
function unitsToPx(u) {
  return num$1(u == null ? void 0 : u.value);
}
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const hex2 = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
function psdColorToHex(color) {
  if (!color || typeof color !== "object") return null;
  const { r, g, b, fr, fg, fb, c, m, y, k, l } = color;
  if (typeof r === "number" && typeof g === "number" && typeof b === "number") {
    return `#${hex2(r / 255)}${hex2(g / 255)}${hex2(b / 255)}`;
  }
  if (typeof fr === "number" && typeof fg === "number" && typeof fb === "number") {
    return `#${hex2(fr)}${hex2(fg)}${hex2(fb)}`;
  }
  if (typeof c === "number" && typeof m === "number" && typeof y === "number" && typeof k === "number") {
    const tope = Math.max(c, m, y, k) > 100 ? 255 : 100;
    return `#${hex2((1 - clamp01(c / tope)) * (1 - clamp01(k / tope)))}${hex2((1 - clamp01(m / tope)) * (1 - clamp01(k / tope)))}${hex2((1 - clamp01(y / tope)) * (1 - clamp01(k / tope)))}`;
  }
  if (typeof k === "number" && typeof c !== "number") {
    const v = clamp01(k / 100);
    return `#${hex2(v)}${hex2(v)}${hex2(v)}`;
  }
  if (typeof l === "number") {
    const v = clamp01(l / 100);
    return `#${hex2(v)}${hex2(v)}${hex2(v)}`;
  }
  return null;
}
let idCounter$1 = 0;
let idSeed = "";
function makeId$1(seed) {
  idCounter$1 += 1;
  let hash = 2166136261;
  const input = `${idSeed}:${seed}:${idCounter$1}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0") + idCounter$1.toString(36).padStart(3, "0");
}
function resetPsdIdCounter(seed = "") {
  idCounter$1 = 0;
  idSeed = seed;
}
function baseElement$1(extra) {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    // 0 = trazo limpio. Un PSD no tiene nada dibujado a mano alzada y el
    // "roughness" de Excalidraw destrozaría la geometría que venimos de medir.
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 0,
    link: null,
    locked: false,
    ...extra
  };
}
function splitPostScriptFont(raw) {
  const limpio = normalizeFontName(raw ?? "");
  if (!limpio) return { family: "" };
  const guion = limpio.indexOf("-");
  const base = guion > 0 ? limpio.slice(0, guion) : limpio;
  const style = guion > 0 ? limpio.slice(guion + 1) : void 0;
  const familia = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return { family: familia, style: style ? style : void 0 };
}
const PESOS = [
  [/extrabold|ultrabold/i, "800"],
  [/semibold|demibold/i, "600"],
  [/extralight|ultralight/i, "200"],
  [/black|heavy/i, "900"],
  [/\bbold\b|bold/i, "700"],
  [/medium/i, "500"],
  [/light/i, "300"],
  [/\bthin\b|hairline/i, "100"]
];
function postScriptStyleToCss(style) {
  var _a;
  if (!style) return {};
  const italic = /italic|oblique/i.test(style) ? "italic" : void 0;
  const peso = (_a = PESOS.find(([re]) => re.test(style))) == null ? void 0 : _a[1];
  return { weight: peso, style: italic };
}
function toTextAlign(justification) {
  switch (justification) {
    case "right":
    case "justify-right":
      return "right";
    case "center":
    case "justify-center":
      return "center";
    // 'justify-all' y 'justify-left' se quedan a la izquierda: Excalidraw no
    // justifica, y alinear a la izquierda es lo que menos mueve el bloque.
    default:
      return "left";
  }
}
function slugify(name) {
  const s = (name || "capa").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, 48) || "capa";
}
const BEZIER_STEPS = 12;
const DEFAULT_MAX_SUBPATHS = 64;
function countSubpaths(layer) {
  var _a;
  return (((_a = layer.vectorMask) == null ? void 0 : _a.paths) ?? []).filter((p) => {
    var _a2;
    return (((_a2 = p.knots) == null ? void 0 : _a2.length) ?? 0) > 1;
  }).length;
}
function cubicAt(p0, c1, c2, p1, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
}
function flattenBezierPath(path) {
  const knots = (path.knots ?? []).filter((k) => Array.isArray(k.points) && k.points.length >= 6);
  if (knots.length === 0) return [];
  const anchor = (i) => {
    const p = knots[i].points;
    return [p[2], p[3]];
  };
  const out = [anchor(0)];
  const cerrado = path.open === false;
  const tramos = cerrado ? knots.length : knots.length - 1;
  for (let i = 0; i < tramos; i += 1) {
    const a = knots[i].points;
    const b = knots[(i + 1) % knots.length].points;
    const [ax, ay] = [a[2], a[3]];
    const [c1x, c1y] = [a[4], a[5]];
    const [c2x, c2y] = [b[0], b[1]];
    const [bx, by] = [b[2], b[3]];
    const recto = c1x === ax && c1y === ay && c2x === bx && c2y === by;
    if (recto) {
      out.push([bx, by]);
      continue;
    }
    for (let s = 1; s <= BEZIER_STEPS; s += 1) {
      const t = s / BEZIER_STEPS;
      out.push([cubicAt(ax, c1x, c2x, bx, t), cubicAt(ay, c1y, c2y, by, t)]);
    }
  }
  return out;
}
const ORIGIN_RECT = 1;
const ORIGIN_ROUNDED_RECT = 2;
const ORIGIN_ELLIPSE = 4;
const ORIGIN_LINE = 5;
function bump(w, key) {
  w.counts[key] = (w.counts[key] ?? 0) + 1;
}
function note(w, page, layer, kind, detail) {
  w.notes.push({ page, layer, kind, detail });
}
const BLEND_OK = /* @__PURE__ */ new Set(["normal", "pass through", void 0]);
function uniqueFilename(w, base, ext) {
  let candidato = `${base}.${ext}`;
  let n = 2;
  while (w.usados.has(candidato)) {
    candidato = `${base}-${n}.${ext}`;
    n += 1;
  }
  w.usados.add(candidato);
  return candidato;
}
function visibleBounds(layer) {
  let left = num$1(layer.left);
  let top = num$1(layer.top);
  let right = num$1(layer.right);
  let bottom = num$1(layer.bottom);
  const m = layer.mask;
  if (m && m.disabled !== true && typeof m.left === "number" && typeof m.right === "number") {
    left = Math.max(left, num$1(m.left));
    top = Math.max(top, num$1(m.top));
    right = Math.min(right, num$1(m.right));
    bottom = Math.min(bottom, num$1(m.bottom));
  }
  return { left, top, right, bottom };
}
function commonProps(layer, page, groupIds, inherited = 1) {
  const o = num$1(layer.opacity, 1) * num$1(layer.fillOpacity, 1) * inherited;
  return {
    opacity: Math.round(clamp01(o) * 100),
    frameId: page.frameId,
    groupIds: groupIds.slice()
  };
}
function applyStrokeEffect(layer, props, scale) {
  var _a, _b;
  const trazo = (_b = (_a = layer.effects) == null ? void 0 : _a.stroke) == null ? void 0 : _b.find(isOn);
  if (!trazo) return false;
  const color = psdColorToHex(trazo.color);
  if (!color) return false;
  props.strokeColor = color;
  props.strokeWidth = Math.max(0.5, unitsToPx(trazo.size) * scale);
  return true;
}
function isOn(fx) {
  return Boolean(fx) && fx.enabled !== false && fx.present !== false;
}
const anyOn = (fx) => (fx ?? []).some(isOn);
function noteEffects(w, layer, page, nombre) {
  const e = layer.effects;
  if (!e || e.disabled === true) return;
  const perdidos = [];
  if (anyOn(e.dropShadow)) perdidos.push("sombra paralela");
  if (anyOn(e.innerShadow)) perdidos.push("sombra interior");
  if (isOn(e.outerGlow)) perdidos.push("resplandor exterior");
  if (isOn(e.innerGlow)) perdidos.push("resplandor interior");
  if (isOn(e.bevel)) perdidos.push("bisel");
  if (isOn(e.satin)) perdidos.push("satinado");
  if (anyOn(e.gradientOverlay)) perdidos.push("superposición de degradado");
  if (isOn(e.patternOverlay)) perdidos.push("superposición de motivo");
  if (perdidos.length) {
    note(w, page, nombre, "lossy", `efectos no representables: ${perdidos.join(", ")}`);
  }
}
function fillColorOf(layer) {
  var _a, _b, _c, _d, _e;
  const overlay = (_b = (_a = layer.effects) == null ? void 0 : _a.solidFill) == null ? void 0 : _b.find(isOn);
  const overlayHex = psdColorToHex(overlay == null ? void 0 : overlay.color);
  if (overlayHex) return { color: overlayHex, approx: false };
  const fill = layer.vectorFill;
  if (!fill) return { color: null, approx: false };
  if (fill.type === "color") return { color: psdColorToHex(fill.color), approx: false };
  const parada = (_e = (_d = (_c = fill.gradient) == null ? void 0 : _c.colorStops) == null ? void 0 : _d[0]) == null ? void 0 : _e.color;
  const hex = psdColorToHex(parada);
  return { color: hex, approx: hex !== null };
}
function groupStyleRuns(text, textData) {
  const runs = textData.styleRuns ?? [];
  const base = textData.style ?? {};
  if (runs.length === 0) return text ? [{ text, style: base }] : [];
  const clave = (s) => {
    var _a;
    return `${s.fontSize ?? ""}|${((_a = s.font) == null ? void 0 : _a.name) ?? ""}|${psdColorToHex(s.fillColor) ?? ""}|${s.leading ?? ""}`;
  };
  const grupos = [];
  let cursor = 0;
  for (const run of runs) {
    const len = num$1(run.length);
    if (len <= 0) continue;
    const trozo = text.slice(cursor, cursor + len);
    cursor += len;
    if (!trozo) continue;
    const estilo = { ...base, ...run.style ?? {} };
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && clave(ultimo.style) === clave(estilo)) ultimo.text += trozo;
    else grupos.push({ text: trozo, style: estilo });
  }
  if (cursor < text.length) {
    const trozo = text.slice(cursor);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && clave(ultimo.style) === clave(base)) ultimo.text += trozo;
    else grupos.push({ text: trozo, style: base });
  }
  return grupos.filter((g) => g.text.length > 0);
}
function textBox(layer, t) {
  const tr = Array.isArray(t.transform) && t.transform.length >= 6 ? t.transform : null;
  const sx = tr ? Math.hypot(tr[0], tr[1]) || 1 : 1;
  const sy = tr ? Math.hypot(tr[2], tr[3]) || 1 : 1;
  const tx = tr ? tr[4] : 0;
  const ty = tr ? tr[5] : 0;
  if (tr && Array.isArray(t.boxBounds) && t.boxBounds.length >= 4) {
    const [l, top, r, b] = t.boxBounds;
    return {
      x: tx + l * sx,
      y: ty + top * sy,
      width: (r - l) * sx,
      height: (b - top) * sy,
      scale: sx
    };
  }
  const bb = t.boundingBox ?? t.bounds;
  if (tr && bb && bb.left && bb.right) {
    const l = unitsToPx(bb.left);
    const top = unitsToPx(bb.top);
    const r = unitsToPx(bb.right);
    const b = unitsToPx(bb.bottom);
    return {
      x: tx + l * sx,
      y: ty + top * sy,
      width: (r - l) * sx,
      height: (b - top) * sy,
      scale: sx
    };
  }
  const vb = visibleBounds(layer);
  return {
    x: vb.left,
    y: vb.top,
    width: vb.right - vb.left,
    height: vb.bottom - vb.top,
    scale: sx
  };
}
function convertText(w, layer, page, groupIds, inherited, options) {
  var _a, _b, _c;
  const t = layer.text;
  const nombre = layer.name || "texto";
  const crudo = typeof t.text === "string" ? t.text : "";
  const texto = crudo.replace(/\r\n?/g, "\n").replace(/\u0003/g, "\n");
  if (!texto.trim()) {
    w.dropped += 1;
    note(w, page.index, nombre, "dropped", "capa de texto vacía");
    return;
  }
  const caja = textBox(layer, t);
  const align = toTextAlign((_a = t.paragraphStyle) == null ? void 0 : _a.justification);
  const grupos = groupStyleRuns(texto, t);
  if (grupos.length > 1) {
    note(
      w,
      page.index,
      nombre,
      "lossy",
      `estilos mixtos: 1 capa → ${grupos.length} elementos (Excalidraw es un estilo por elemento)`
    );
  }
  noteEffects(w, layer, page.index, nombre);
  if (!BLEND_OK.has(layer.blendMode)) {
    note(w, page.index, nombre, "lossy", `modo de fusión "${layer.blendMode}" no soportado`);
  }
  const S = page.scale;
  let cursorY = page.dy + caja.y * S;
  for (const grupo of grupos) {
    const estilo = grupo.style;
    const size = Math.max(1, num$1(estilo.fontSize, 20) * caja.scale * S);
    const leading = estilo.autoLeading === false ? num$1(estilo.leading) : 0;
    const lineHeight = leading > 0 ? Math.max(0.5, leading / num$1(estilo.fontSize, 20)) : 1.25;
    const lineas = grupo.text.split("\n").length;
    const alto = lineas * size * lineHeight;
    let fontFamily = DEFAULT_FONT_FAMILY$1;
    const psName = ((_b = estilo.font) == null ? void 0 : _b.name) ?? "";
    if (psName) {
      const { family, style } = splitPostScriptFont(psName);
      if (family) {
        const fichero = ((_c = options.resolveFontUrl) == null ? void 0 : _c.call(options, family, style)) ?? null;
        w.fuentes.set(family, (w.fuentes.get(family) ?? false) || fichero !== null);
        if (fichero) {
          fontFamily = customFontFamilyId(family);
          const css = postScriptStyleToCss(fichero.style ?? style);
          w.caras.push({
            family: fontFamilyAlias(family),
            src: normalizeFontSrc(fichero.url),
            weight: fichero.weight ?? css.weight,
            style: css.style
          });
        } else {
          note(
            w,
            page.index,
            nombre,
            "lossy",
            `sin fichero para la fuente "${psName}"; se usa la de respaldo`
          );
        }
      }
    }
    const props = {
      ...commonProps(layer, page, groupIds, inherited),
      id: makeId$1(`txt-${page.index}-${nombre}`),
      type: "text",
      x: page.dx + caja.x * S,
      y: cursorY,
      width: Math.max(1, caja.width * S),
      height: Math.max(1, alto),
      text: grupo.text,
      originalText: grupo.text,
      fontSize: size,
      fontFamily,
      textAlign: align,
      verticalAlign: "top",
      containerId: null,
      lineHeight,
      // false: la caja la manda el PSD. Con autoResize, Excalidraw remide el
      // texto con SU tipografía y el bloque deja de coincidir con el original.
      autoResize: false,
      strokeColor: psdColorToHex(estilo.fillColor) ?? "#1e1e1e"
    };
    w.elements.push(baseElement$1(props));
    cursorY += alto;
  }
  bump(w, "text");
}
function convertShape(w, layer, page, groupIds, inherited) {
  var _a, _b, _c, _d, _e;
  const nombre = layer.name || "forma";
  const S = page.scale;
  const desc = (_b = (_a = layer.vectorOrigination) == null ? void 0 : _a.keyDescriptorList) == null ? void 0 : _b[0];
  const tipo = desc == null ? void 0 : desc.keyOriginType;
  const { color, approx } = fillColorOf(layer);
  if (approx) {
    note(w, page.index, nombre, "lossy", "relleno no plano (degradado o motivo) → color de la primera parada");
  }
  noteEffects(w, layer, page.index, nombre);
  if (!BLEND_OK.has(layer.blendMode)) {
    note(w, page.index, nombre, "lossy", `modo de fusión "${layer.blendMode}" no soportado`);
  }
  const props = {
    ...commonProps(layer, page, groupIds, inherited),
    backgroundColor: color ?? "transparent",
    fillStyle: "solid",
    // Sin trazo el rectángulo de Excalidraw se pinta igual con su borde negro
    // por defecto, y una forma de color plano acabaría con un contorno que el
    // PSD no tiene. Transparente salvo que la capa declare trazo de verdad.
    strokeColor: "transparent",
    strokeWidth: 1
  };
  const trazoVec = layer.vectorStroke;
  if (trazoVec && trazoVec.strokeEnabled !== false) {
    const c = psdColorToHex((_c = trazoVec.content) == null ? void 0 : _c.color);
    if (c) {
      props.strokeColor = c;
      props.strokeWidth = Math.max(0.5, unitsToPx(trazoVec.lineWidth) * S);
      if ((_d = trazoVec.lineDashSet) == null ? void 0 : _d.length) props.strokeStyle = "dashed";
    }
  }
  applyStrokeEffect(layer, props, S);
  const bbox = desc == null ? void 0 : desc.keyOriginShapeBoundingBox;
  const vb = visibleBounds(layer);
  const left = (bbox == null ? void 0 : bbox.left) ? unitsToPx(bbox.left) : vb.left;
  const top = (bbox == null ? void 0 : bbox.top) ? unitsToPx(bbox.top) : vb.top;
  const right = (bbox == null ? void 0 : bbox.right) ? unitsToPx(bbox.right) : vb.right;
  const bottom = (bbox == null ? void 0 : bbox.bottom) ? unitsToPx(bbox.bottom) : vb.bottom;
  const x = page.dx + left * S;
  const y = page.dy + top * S;
  const width = Math.max(1, (right - left) * S);
  const height = Math.max(1, (bottom - top) * S);
  if (tipo === ORIGIN_ELLIPSE) {
    w.elements.push(
      baseElement$1({ ...props, id: makeId$1(`ell-${page.index}-${nombre}`), type: "ellipse", x, y, width, height })
    );
    bump(w, "shape:ellipse");
    return;
  }
  if (tipo === ORIGIN_RECT || tipo === ORIGIN_ROUNDED_RECT) {
    const radios = desc == null ? void 0 : desc.keyOriginRRectRadii;
    const r = radios ? Math.max(
      unitsToPx(radios.topLeft),
      unitsToPx(radios.topRight),
      unitsToPx(radios.bottomLeft),
      unitsToPx(radios.bottomRight)
    ) : 0;
    if (radios && new Set(
      [radios.topLeft, radios.topRight, radios.bottomLeft, radios.bottomRight].map(unitsToPx)
    ).size > 1) {
      note(w, page.index, nombre, "lossy", "radios de esquina distintos → Excalidraw solo tiene uno");
    }
    w.elements.push(
      baseElement$1({
        ...props,
        id: makeId$1(`rec-${page.index}-${nombre}`),
        type: "rectangle",
        x,
        y,
        width,
        height,
        // `adaptive` es el redondeo variable de Excalidraw; `proportional` con
        // un valor fijo es lo que respeta el radio que puso el diseñador.
        roundness: r > 0 ? { type: 2, value: r * S } : null
      })
    );
    bump(w, tipo === ORIGIN_ROUNDED_RECT ? "shape:roundedRect" : "shape:rect");
    return;
  }
  const paths = (((_e = layer.vectorMask) == null ? void 0 : _e.paths) ?? []).filter((p) => {
    var _a2;
    return (((_a2 = p.knots) == null ? void 0 : _a2.length) ?? 0) > 1;
  });
  if (paths.length === 0) {
    w.elements.push(
      baseElement$1({ ...props, id: makeId$1(`rec-${page.index}-${nombre}`), type: "rectangle", x, y, width, height })
    );
    bump(w, "shape:bbox");
    note(w, page.index, nombre, "lossy", "forma sin geometría legible → rectángulo de su caja");
    return;
  }
  if (paths.length > 1) {
    note(
      w,
      page.index,
      nombre,
      "lossy",
      `${paths.length} subcaminos → ${paths.length} elementos (Excalidraw no tiene caminos compuestos, ni agujeros)`
    );
  }
  for (const path of paths) {
    const puntos = flattenBezierPath(path);
    if (puntos.length < 2) continue;
    const cerrado = path.open === false;
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const locales = puntos.map(([px, py]) => [(px - minX) * S, (py - minY) * S]);
    if (cerrado) locales.push([locales[0][0], locales[0][1]]);
    w.elements.push(
      baseElement$1({
        ...props,
        id: makeId$1(`pth-${page.index}-${nombre}`),
        type: "line",
        x: page.dx + minX * S,
        y: page.dy + minY * S,
        width: (Math.max(...xs) - minX) * S,
        height: (Math.max(...ys) - minY) * S,
        points: locales,
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        // Un camino abierto no es una silueta rellenable: pintarlo relleno
        // inventaría una forma que el PSD no dibuja.
        backgroundColor: cerrado ? props.backgroundColor : "transparent",
        strokeColor: cerrado ? props.strokeColor : props.strokeColor === "transparent" ? color ?? "#1e1e1e" : props.strokeColor
      })
    );
  }
  bump(w, tipo === ORIGIN_LINE ? "shape:line" : "shape:path");
}
function convertRaster(w, layer, page, groupIds, inherited, address, path, documentName) {
  const nombre = layer.name || "imagen";
  const S = page.scale;
  const vb = visibleBounds(layer);
  const naturalWidth = Math.round(vb.right - vb.left);
  const naturalHeight = Math.round(vb.bottom - vb.top);
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    w.dropped += 1;
    note(w, page.index, nombre, "dropped", "capa de píxeles sin área visible");
    return;
  }
  if (layer.mask && layer.mask.disabled !== true) {
    note(
      w,
      page.index,
      nombre,
      "lossy",
      "máscara de capa → el hueco se recorta a la caja visible (Excalidraw no tiene máscaras)"
    );
  }
  if (layer.clipping) {
    note(w, page.index, nombre, "lossy", "máscara de recorte no soportada");
  }
  if (!BLEND_OK.has(layer.blendMode)) {
    note(w, page.index, nombre, "lossy", `modo de fusión "${layer.blendMode}" no soportado`);
  }
  noteEffects(w, layer, page.index, nombre);
  const x = page.dx + vb.left * S;
  const y = page.dy + vb.top * S;
  const width = Math.max(1, naturalWidth * S);
  const height = Math.max(1, naturalHeight * S);
  const slotId = makeId$1(`img-${page.index}-${nombre}`);
  const filename = uniqueFilename(
    w,
    `${slugify(documentName)}-p${page.index + 1}-${slugify([...path, nombre].join("-"))}`,
    "png"
  );
  const grupo = makeId$1(`imggrp-${page.index}-${nombre}`);
  const gruposConHueco = [grupo, ...groupIds];
  w.elements.push(
    baseElement$1({
      ...commonProps(layer, page, gruposConHueco, inherited),
      id: slotId,
      type: "rectangle",
      x,
      y,
      width,
      height,
      backgroundColor: PLACEHOLDER_FILL,
      fillStyle: "solid",
      strokeColor: PLACEHOLDER_STROKE,
      strokeStyle: "dashed",
      strokeWidth: 1,
      roundness: null,
      // La proporción original viaja en el propio elemento: quien cambie el
      // hueco por la foto de verdad puede comprobar que no la deforma.
      customData: {
        c2: PSD_IMAGE_MARKER,
        psd: { layer: nombre, path, asset: filename, naturalWidth, naturalHeight }
      }
    })
  );
  const size = Math.max(10, Math.min(28, Math.min(width, height) / 10));
  const etiqueta = `${nombre}
${naturalWidth}×${naturalHeight}`;
  const alto = 2 * size * 1.25;
  w.elements.push(
    baseElement$1({
      ...commonProps(layer, page, gruposConHueco, inherited),
      id: makeId$1(`imglbl-${page.index}-${nombre}`),
      type: "text",
      x,
      y: y + Math.max(0, (height - alto) / 2),
      width,
      height: alto,
      text: etiqueta,
      originalText: etiqueta,
      fontSize: size,
      fontFamily: DEFAULT_FONT_FAMILY$1,
      textAlign: "center",
      verticalAlign: "top",
      containerId: null,
      lineHeight: 1.25,
      autoResize: false,
      strokeColor: PLACEHOLDER_TEXT
    })
  );
  w.assets.push({
    id: slotId,
    name: nombre,
    page: page.index,
    path,
    naturalWidth,
    naturalHeight,
    filename,
    address
  });
  bump(w, "image");
}
function isGroup(layer) {
  return Array.isArray(layer.children);
}
function isShape(layer) {
  return Boolean(layer.vectorFill || layer.vectorMask || layer.vectorOrigination);
}
function walkLayer(w, layer, page, groupIds, inherited, dir, path, options, documentName) {
  const nombre = layer.name || `capa ${dir[dir.length - 1] + 1}`;
  w.total += 1;
  const antes = w.elements.length;
  const cuenta = () => {
    if (w.elements.length > antes) w.converted += 1;
  };
  if (layer.hidden === true && !options.includeHidden) {
    w.hidden += 1;
    bump(w, "hidden");
    return;
  }
  if (isGroup(layer)) {
    bump(w, "group");
    const gid = makeId$1(`grp-${page.index}-${nombre}`);
    if (layer.blendMode && layer.blendMode !== "pass through" && layer.blendMode !== "normal") {
      note(w, page.index, nombre, "lossy", `grupo con modo de fusión "${layer.blendMode}"`);
    }
    if (num$1(layer.opacity, 1) < 1) {
      note(w, page.index, nombre, "lossy", "opacidad de grupo → aplicada a cada hijo");
    }
    walkLayers(
      w,
      layer.children,
      page,
      [gid, ...groupIds],
      // La opacidad del grupo BAJA a sus hijos: es lo que la nota de arriba
      // promete, y sin esto un grupo al 20% se pintaba opaco.
      inherited * clamp01(num$1(layer.opacity, 1)),
      dir,
      [...path, nombre],
      options,
      documentName
    );
    cuenta();
    return;
  }
  if (layer.text) {
    w.sawText = true;
    convertText(w, layer, page, groupIds, inherited, options);
    cuenta();
    return;
  }
  if (isShape(layer)) {
    const subcaminos = countSubpaths(layer);
    const tope = options.maxSubpaths ?? DEFAULT_MAX_SUBPATHS;
    if (subcaminos > tope && (layer.imageData || layer.canvas || layer.rawData)) {
      note(
        w,
        page.index,
        nombre,
        "lossy",
        `${subcaminos} subcaminos (tope ${tope}) → se trata como imagen; sus píxeles salen en .assets/ y conserva su aspecto`
      );
      convertRaster(w, layer, page, groupIds, inherited, dir, path, documentName);
      cuenta();
      return;
    }
    convertShape(w, layer, page, groupIds, inherited);
    cuenta();
    return;
  }
  if (layer.adjustment) {
    w.dropped += 1;
    w.sawUnsupported = true;
    bump(w, "adjustment");
    note(w, page.index, nombre, "dropped", "capa de ajuste (no se puede componer en Excalidraw)");
    return;
  }
  if (layer.imageData || layer.canvas || layer.rawData || layer.placedLayer) {
    if (layer.placedLayer) {
      note(
        w,
        page.index,
        nombre,
        "lossy",
        "objeto inteligente → hueco de imagen con su tamaño colocado (se pierde el original enlazado)"
      );
    }
    convertRaster(w, layer, page, groupIds, inherited, dir, path, documentName);
    cuenta();
    return;
  }
  w.dropped += 1;
  bump(w, "empty");
  note(w, page.index, nombre, "dropped", "capa sin contenido representable");
}
function walkLayers(w, layers, page, groupIds, inherited, address, path, options, documentName) {
  layers.forEach((layer, i) => {
    walkLayer(w, layer, page, groupIds, inherited, [...address, i], path, options, documentName);
  });
}
function psdToScene(psd, options = {}) {
  const S = options.scale && options.scale > 0 ? options.scale : 1;
  const docW = Math.max(1, num$1(psd.width, 1080));
  const docH = Math.max(1, num$1(psd.height, 1350));
  const documentName = options.documentName || "psd";
  resetPsdIdCounter(documentName);
  const w = {
    elements: [],
    assets: [],
    notes: [],
    counts: {},
    caras: [],
    fuentes: /* @__PURE__ */ new Map(),
    usados: /* @__PURE__ */ new Set(),
    total: 0,
    converted: 0,
    hidden: 0,
    dropped: 0,
    sawText: false,
    sawUnsupported: false
  };
  const raiz = psd.children ?? [];
  const mesas = raiz.map((l, i) => ({ l, i })).filter(({ l }) => {
    var _a;
    return (_a = l.artboard) == null ? void 0 : _a.rect;
  });
  const sueltas = raiz.map((l, i) => ({ l, i })).filter(({ l }) => {
    var _a;
    return !((_a = l.artboard) == null ? void 0 : _a.rect);
  });
  let offsetX = 0;
  const abrePagina = (index, nombre, left, top, width, height, fondo) => {
    const frameId = makeId$1(`frame-${index}`);
    const pw = Math.max(1, width * S);
    const ph = Math.max(1, height * S);
    w.elements.push(
      baseElement$1({
        id: frameId,
        type: "frame",
        x: offsetX,
        y: 0,
        width: pw,
        height: ph,
        name: nombre,
        strokeColor: "#bbb"
      })
    );
    w.elements.push(
      baseElement$1({
        id: makeId$1(`paper-${index}`),
        type: "rectangle",
        x: offsetX,
        y: 0,
        width: pw,
        height: ph,
        backgroundColor: fondo,
        fillStyle: "solid",
        strokeColor: "#d4d4d8",
        strokeWidth: 1,
        roundness: null,
        locked: true,
        frameId,
        customData: { c2: BG_MARKER$1 }
      })
    );
    return { index, frameId, dx: offsetX - left * S, dy: -top * S, scale: S };
  };
  if (mesas.length > 0) {
    mesas.forEach(({ l: mesa, i: real }, i) => {
      var _a;
      const r = mesa.artboard.rect;
      const left = num$1(r.left);
      const top = num$1(r.top);
      const width = Math.max(1, num$1(r.right) - left);
      const height = Math.max(1, num$1(r.bottom) - top);
      const fondo = psdColorToHex((_a = mesa.artboard) == null ? void 0 : _a.color) ?? PAPER_COLOR$1;
      const page = abrePagina(i, mesa.name || `Mesa ${i + 1}`, left, top, width, height, fondo);
      walkLayers(w, mesa.children ?? [], page, [], 1, [real], [], options, documentName);
      offsetX += Math.max(1, width * S) + PAGE_GAP;
    });
    if (sueltas.length > 0) {
      const page = abrePagina(mesas.length, "Fuera de mesa", 0, 0, docW, docH, PAPER_COLOR$1);
      for (const { l, i: real } of sueltas) {
        walkLayer(w, l, page, [], 1, [real], [], options, documentName);
      }
      offsetX += Math.max(1, docW * S) + PAGE_GAP;
    }
  } else {
    const page = abrePagina(0, documentName, 0, 0, docW, docH, PAPER_COLOR$1);
    walkLayers(w, raiz, page, [], 1, [], [], options, documentName);
  }
  const pages = mesas.length > 0 ? mesas.length + (sueltas.length > 0 ? 1 : 0) : 1;
  const tier = w.sawUnsupported ? "T3" : w.sawText ? "T2" : "T1";
  return {
    elements: w.elements,
    files: {},
    fonts: dedupeFontFaces(w.caras),
    assets: w.assets,
    report: {
      document: { width: docW, height: docH, scale: S },
      pages,
      tier,
      layers: {
        total: w.total,
        converted: w.converted,
        hidden: w.hidden,
        dropped: w.dropped
      },
      // Marcos y papeles fuera: son andamiaje de la página, no contenido.
      elements: w.elements.filter(
        (e) => e.type !== "frame"
      ).length - pages,
      counts: w.counts,
      fonts: [...w.fuentes].map(([name, resolved]) => ({ name, resolved })),
      notes: w.notes,
      clean: w.notes.length === 0
    }
  };
}
function listImagePlaceholders(elements) {
  const out = [];
  for (const el of elements) {
    const cd = el.customData;
    if ((cd == null ? void 0 : cd.c2) !== PSD_IMAGE_MARKER || !cd.psd) continue;
    const e = el;
    out.push({
      id: e.id,
      layer: String(cd.psd.layer ?? ""),
      asset: String(cd.psd.asset ?? ""),
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      naturalWidth: num$1(cd.psd.naturalWidth),
      naturalHeight: num$1(cd.psd.naturalHeight)
    });
  }
  return out;
}
const PAPER_COLOR = "#ffffff";
const BG_MARKER = "pageBackground";
const DEFAULT_FONT_FAMILY = 2;
let idCounter = 0;
function makeId(seed) {
  idCounter += 1;
  let hash = 2166136261;
  const input = `${seed}:${idCounter}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0") + idCounter.toString(36).padStart(3, "0");
}
function resetIdCounter() {
  idCounter = 0;
}
function baseElement(extra) {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 0,
    link: null,
    locked: false,
    ...extra
  };
}
const num = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function styleValue(style, prop) {
  const m = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i").exec(style);
  return m ? m[1].trim() : null;
}
function parseLegacyText(html) {
  var _a, _b;
  const out = [];
  const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi);
  const chunks = paragraphs ?? (html.trim() ? [`<p>${html}</p>`] : []);
  for (const p of chunks) {
    const pStyle = decodeEntities(((_a = /<p\b[^>]*style="([^"]*)"/i.exec(p)) == null ? void 0 : _a[1]) ?? "");
    const spanStyle = decodeEntities(((_b = /<span\b[^>]*style="([^"]*)"/i.exec(p)) == null ? void 0 : _b[1]) ?? "");
    const text = decodeEntities(p.replace(/<[^>]+>/g, "")).trim();
    if (!text) continue;
    const size = styleValue(pStyle, "font-size");
    const familia = styleValue(spanStyle, "font-family") ?? styleValue(pStyle, "font-family");
    out.push({
      text,
      fontSize: size ? parseFloat(size) : 20,
      color: styleValue(spanStyle, "color") ?? styleValue(pStyle, "color") ?? "#1e1e1e",
      align: styleValue(pStyle, "text-align") ?? "left",
      fontFamily: familia ? normalizeFontName(familia) : ""
    });
  }
  return out;
}
function groupParagraphs(paras) {
  const groups = [];
  for (const p of paras) {
    const last = groups[groups.length - 1];
    const head = last == null ? void 0 : last[0];
    if (head && head.fontSize === p.fontSize && head.color === p.color && head.align === p.align && head.fontFamily === p.fontFamily) {
      last.push(p);
    } else {
      groups.push([p]);
    }
  }
  return groups;
}
function legacyToScene(editorConfig, options = {}) {
  resetIdCounter();
  const parsed = typeof editorConfig === "string" ? JSON.parse(editorConfig) : editorConfig;
  const raw = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && !Array.isArray(parsed.elements) ? [parsed] : [];
  const elements = [];
  const filesOut = {};
  const notes = [];
  const counts = {};
  const caras = [];
  let offsetX = 0;
  let sawText = false;
  let sawUnsupported = false;
  raw.forEach((page, pageIndex) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const layers = page.c ?? {};
    const root = layers.d;
    const width = num((_b = (_a = root == null ? void 0 : root.g) == null ? void 0 : _a.h) == null ? void 0 : _b.i, 1080);
    const height = num((_d = (_c = root == null ? void 0 : root.g) == null ? void 0 : _c.h) == null ? void 0 : _d.j, 1350);
    const pageId = makeId(`frame-${pageIndex}`);
    elements.push(
      baseElement({
        id: pageId,
        type: "frame",
        x: offsetX,
        y: 0,
        width,
        height,
        name: page.a || `Página ${pageIndex + 1}`,
        strokeColor: "#bbb"
      })
    );
    elements.push(
      baseElement({
        id: makeId(`paper-${pageIndex}`),
        type: "rectangle",
        x: offsetX,
        y: 0,
        width,
        height,
        backgroundColor: typeof ((_e = root == null ? void 0 : root.g) == null ? void 0 : _e.o) === "string" ? root.g.o : PAPER_COLOR,
        fillStyle: "solid",
        strokeColor: "#d4d4d8",
        strokeWidth: 1,
        roughness: 0,
        roundness: null,
        locked: true,
        frameId: pageId,
        customData: { c2: BG_MARKER }
      })
    );
    const bg = (_f = root == null ? void 0 : root.g) == null ? void 0 : _f.p;
    const bgUrl = (bg == null ? void 0 : bg.y) ?? (bg == null ? void 0 : bg.aj);
    if (typeof bgUrl === "string" && bgUrl) {
      counts.RootBackgroundImage = (counts.RootBackgroundImage ?? 0) + 1;
      if (bgUrl.startsWith("blob:")) {
        notes.push({
          page: pageIndex,
          layer: "ROOT",
          kind: "dropped",
          detail: "fondo de página con URL blob: (bytes irrecuperables)"
        });
      } else {
        const bgFileId = makeId(`bgfile-${pageIndex}`);
        elements.push(
          baseElement({
            id: makeId(`bgimg-${pageIndex}`),
            type: "image",
            x: offsetX + num((_g = bg == null ? void 0 : bg.k) == null ? void 0 : _g.l),
            y: num((_h = bg == null ? void 0 : bg.k) == null ? void 0 : _h.m),
            width: num((_i = bg == null ? void 0 : bg.h) == null ? void 0 : _i.i, width),
            height: num((_j = bg == null ? void 0 : bg.h) == null ? void 0 : _j.j, height),
            angle: num(bg == null ? void 0 : bg.n) * Math.PI / 180,
            fileId: bgFileId,
            status: "saved",
            scale: [1, 1],
            crop: null,
            frameId: pageId,
            // El fondo no se selecciona al hacer clic en la foto: se comporta
            // como fondo, igual que en el editor legacy.
            locked: true
          })
        );
        filesOut[bgFileId] = {
          mimeType: bgUrl.endsWith(".webp") ? "image/webp" : "image/png",
          id: bgFileId,
          dataURL: bgUrl,
          created: 0,
          lastRetrieved: 0
        };
      }
    }
    const childIds = Array.isArray(root == null ? void 0 : root.s) ? root.s : [];
    childIds.forEach((childId) => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h2, _i2, _j2, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
      const layer = layers[childId];
      const kind = ((_a2 = layer == null ? void 0 : layer.e) == null ? void 0 : _a2.f) ?? "Unknown";
      counts[kind] = (counts[kind] ?? 0) + 1;
      const g = (layer == null ? void 0 : layer.g) ?? {};
      const x = offsetX + num((_b2 = g.k) == null ? void 0 : _b2.l);
      const y = num((_c2 = g.k) == null ? void 0 : _c2.m);
      const w = num((_d2 = g.h) == null ? void 0 : _d2.i, width);
      const h = num((_e2 = g.h) == null ? void 0 : _e2.j, height);
      const angle = num(g.n) * Math.PI / 180;
      if (kind === "ImageLayer") {
        const url = ((_f2 = g.p) == null ? void 0 : _f2.y) ?? ((_g2 = g.p) == null ? void 0 : _g2.aj);
        if (typeof url !== "string" || !url) {
          notes.push({ page: pageIndex, layer: childId, kind: "dropped", detail: "ImageLayer sin URL" });
          return;
        }
        if (url.startsWith("blob:")) {
          notes.push({ page: pageIndex, layer: childId, kind: "dropped", detail: "URL blob: (bytes irrecuperables)" });
          return;
        }
        const innerW = num((_i2 = (_h2 = g.p) == null ? void 0 : _h2.h) == null ? void 0 : _i2.i, w);
        const innerH = num((_k = (_j2 = g.p) == null ? void 0 : _j2.h) == null ? void 0 : _k.j, h);
        const innerX = num((_m = (_l = g.p) == null ? void 0 : _l.k) == null ? void 0 : _m.l);
        const innerY = num((_o = (_n = g.p) == null ? void 0 : _n.k) == null ? void 0 : _o.m);
        const fileId = makeId(`file-${pageIndex}-${childId}`);
        elements.push(
          baseElement({
            id: makeId(`img-${pageIndex}-${childId}`),
            type: "image",
            x: x + innerX,
            y: y + innerY,
            width: innerW,
            height: innerH,
            angle,
            fileId,
            status: "saved",
            scale: [1, 1],
            crop: null,
            frameId: pageId,
            locked: Boolean(layer == null ? void 0 : layer.r)
          })
        );
        filesOut[fileId] = {
          mimeType: url.endsWith(".webp") ? "image/webp" : "image/png",
          id: fileId,
          // Excalidraw hace `image.src = <este campo>`, así que una URL remota
          // funciona. Nada de dataURL: la escena pesa como el editorConfig.
          dataURL: url,
          created: 0,
          lastRetrieved: 0
        };
        return;
      }
      if (kind === "VideoLayer") {
        const media = g.ar;
        const poster = (media == null ? void 0 : media.as) ?? (media == null ? void 0 : media.at) ?? ((_p = g.p) == null ? void 0 : _p.aj) ?? ((_q = g.p) == null ? void 0 : _q.y);
        if (typeof poster !== "string" || !poster || poster.startsWith("blob:")) {
          sawUnsupported = true;
          notes.push({
            page: pageIndex,
            layer: childId,
            kind: "dropped",
            detail: "VideoLayer sin póster recuperable"
          });
          return;
        }
        const innerW = num((_r = media == null ? void 0 : media.h) == null ? void 0 : _r.i, w);
        const innerH = num((_s = media == null ? void 0 : media.h) == null ? void 0 : _s.j, h);
        const innerX = num((_t = media == null ? void 0 : media.k) == null ? void 0 : _t.l);
        const innerY = num((_u = media == null ? void 0 : media.k) == null ? void 0 : _u.m);
        const fileId = makeId(`vfile-${pageIndex}-${childId}`);
        elements.push(
          baseElement({
            id: makeId(`vimg-${pageIndex}-${childId}`),
            type: "image",
            x: x + innerX,
            y: y + innerY,
            width: innerW,
            height: innerH,
            angle,
            fileId,
            status: "saved",
            scale: [1, 1],
            crop: null,
            frameId: pageId,
            locked: Boolean(layer == null ? void 0 : layer.r)
          })
        );
        filesOut[fileId] = {
          mimeType: poster.endsWith(".webp") ? "image/webp" : "image/png",
          id: fileId,
          dataURL: poster,
          created: 0,
          lastRetrieved: 0
        };
        notes.push({
          page: pageIndex,
          layer: childId,
          kind: "lossy",
          detail: "VideoLayer → póster: se conserva el fotograma, no la reproducción"
        });
        return;
      }
      if (kind === "TextLayer") {
        sawText = true;
        const scale = num(g.u, 1);
        const paras = parseLegacyText(typeof g.v === "string" ? g.v : "");
        if (paras.length === 0) {
          notes.push({ page: pageIndex, layer: childId, kind: "dropped", detail: "TextLayer vacía" });
          return;
        }
        const groups = groupParagraphs(paras);
        if (groups.length > 1) {
          notes.push({
            page: pageIndex,
            layer: childId,
            kind: "lossy",
            detail: `estilos mixtos: 1 capa → ${groups.length} elementos (Excalidraw es un estilo por elemento)`
          });
        }
        const catalogo = /* @__PURE__ */ new Map();
        for (const f of g.w ?? []) {
          const nombre = normalizeFontName((f == null ? void 0 : f.a) ?? (f == null ? void 0 : f.x) ?? "");
          const url = typeof (f == null ? void 0 : f.y) === "string" ? f.y.trim() : "";
          if (!nombre || !/^https?:\/\//i.test(url)) continue;
          catalogo.set(nombre.toLowerCase(), {
            url: normalizeFontSrc(url),
            style: (f == null ? void 0 : f.z) && f.z !== "regular" ? f.z : void 0
          });
        }
        let cursorY = y;
        for (const group of groups) {
          const head = group[0];
          const size = head.fontSize * scale;
          const text = group.map((p) => p.text).join("\n");
          const boxH = group.length * size * 1.25;
          let fontFamily = DEFAULT_FONT_FAMILY;
          if (head.fontFamily) {
            const fichero = catalogo.get(head.fontFamily.toLowerCase()) ?? ((_v = options.resolveFontUrl) == null ? void 0 : _v.call(options, head.fontFamily)) ?? null;
            if (fichero) {
              fontFamily = customFontFamilyId(head.fontFamily);
              caras.push({
                family: fontFamilyAlias(head.fontFamily),
                src: normalizeFontSrc(fichero.url),
                style: fichero.style
              });
            } else {
              notes.push({
                page: pageIndex,
                layer: childId,
                kind: "lossy",
                detail: `sin fichero para la fuente "${head.fontFamily}"; se usa la de respaldo`
              });
            }
          }
          elements.push(
            baseElement({
              id: makeId(`txt-${pageIndex}-${childId}`),
              type: "text",
              x,
              y: cursorY,
              width: w * scale,
              height: boxH,
              angle,
              text,
              originalText: text,
              fontSize: size,
              fontFamily,
              textAlign: head.align === "justify" ? "left" : head.align,
              verticalAlign: "top",
              containerId: null,
              lineHeight: 1.25,
              autoResize: false,
              strokeColor: head.color,
              frameId: pageId,
              locked: Boolean(layer == null ? void 0 : layer.r)
            })
          );
          cursorY += boxH;
        }
        return;
      }
      sawUnsupported = true;
      notes.push({
        page: pageIndex,
        layer: childId,
        kind: "dropped",
        detail: `capa no soportada: ${kind}`
      });
    });
    offsetX += width + PAGE_GAP;
  });
  const tier = sawUnsupported ? "T3" : sawText ? "T2" : "T1";
  return {
    elements,
    files: filesOut,
    fonts: dedupeFontFaces(caras),
    report: {
      pages: raw.length,
      tier,
      counts,
      notes,
      clean: notes.length === 0
    }
  };
}
export {
  DEFAULT_MAX_SUBPATHS as D,
  PSD_IMAGE_MARKER as P,
  listImagePlaceholders as a,
  postScriptStyleToCss as b,
  countSubpaths as c,
  psdColorToHex as d,
  psdToScene as e,
  flattenBezierPath as f,
  groupStyleRuns as g,
  resetPsdIdCounter as h,
  legacyToScene as l,
  parseLegacyText as p,
  resetIdCounter as r,
  splitPostScriptFont as s
};
//# sourceMappingURL=legacy-BS2a1q37.js.map
