const EXCALIDRAW_BUILTIN_FAMILIES = [
  "Virgil",
  "Helvetica",
  "Cascadia",
  "Excalifont",
  "Nunito",
  "Lilita One",
  "Comic Shanns",
  "Liberation Sans",
  "Assistant",
  // FONT_FAMILY_FALLBACKS (con los genéricos que upstream añadió delante del emoji)
  "Xiaolai",
  "sans-serif",
  "monospace",
  "Segoe UI Emoji"
];
const BUILTIN = new Set(EXCALIDRAW_BUILTIN_FAMILIES.map((f) => f.toLowerCase()));
const ALIAS_SUFFIX = " (marca)";
const ID_MIN = 1e4;
const ID_MAX = 1e6;
function normalizeFontName(raw) {
  return raw.trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
}
function stripFontDigits(name) {
  return name.split(" ").map((token) => token.replace(new RegExp("\\p{Nd}", "gu"), "")).filter(Boolean).join(" ");
}
function fontFamilyAlias(name) {
  const limpio = stripFontDigits(normalizeFontName(name));
  if (!limpio) return "";
  return BUILTIN.has(limpio.toLowerCase()) ? `${limpio}${ALIAS_SUFFIX}` : limpio;
}
function customFontFamilyId(name) {
  const alias = fontFamilyAlias(name);
  if (!alias) return 0;
  let hash = 2166136261;
  for (let i = 0; i < alias.length; i += 1) {
    hash ^= alias.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ID_MIN + (hash >>> 0) % (ID_MAX - ID_MIN);
}
function normalizeFontSrc(src) {
  const limpio = src.trim();
  return limpio.startsWith("http://") ? `https://${limpio.slice("http://".length)}` : limpio;
}
function fontFormatHint(src) {
  const limpio = src.split("?")[0].toLowerCase();
  if (limpio.endsWith(".woff2")) return "woff2";
  if (limpio.endsWith(".woff")) return "woff";
  if (limpio.endsWith(".otf")) return "opentype";
  if (limpio.endsWith(".ttf")) return "truetype";
  return null;
}
function dentroDeCadenaCss(texto) {
  return texto.replace(/["\\<>\u0000-\u001f\u007f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
}
function pesoCss(peso) {
  return peso && /^(normal|bold|bolder|lighter|\d{1,4}( \d{1,4})?)$/.test(peso) ? peso : "normal";
}
function estiloCss(estilo) {
  return estilo && /^(normal|italic|oblique( -?\d{1,3}(\.\d+)?deg){0,2})$/.test(estilo) ? estilo : "normal";
}
function buildFontFaceCss(faces, opts) {
  return faces.filter((f) => f.family && f.src).map((f) => {
    const hint = fontFormatHint(f.src);
    const direccion = `url("${dentroDeCadenaCss(f.src)}")`;
    const src = hint ? `${direccion} format("${hint}")` : direccion;
    return `@font-face{font-family:"${dentroDeCadenaCss(f.family)}";src:${src};font-weight:${pesoCss(f.weight)};font-style:${estiloCss(f.style)};` + ((opts == null ? void 0 : opts.display) ? `font-display:${opts.display};` : "") + "}";
  }).join("\n");
}
function dedupeFontFaces(faces) {
  const porClave = /* @__PURE__ */ new Map();
  for (const f of faces) {
    if (!f.family || !f.src) continue;
    porClave.set(`${f.family}|${f.weight ?? "normal"}|${f.style ?? "normal"}`, f);
  }
  return [...porClave.values()];
}
export {
  EXCALIDRAW_BUILTIN_FAMILIES,
  buildFontFaceCss,
  customFontFamilyId,
  dedupeFontFaces,
  fontFamilyAlias,
  fontFormatHint,
  normalizeFontName,
  normalizeFontSrc,
  stripFontDigits
};
//# sourceMappingURL=fonts.js.map
