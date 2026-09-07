const EXCALIDRAW_BUILTIN_FAMILIES = [
  "Virgil",
  "Helvetica",
  "Cascadia",
  "Excalifont",
  "Nunito",
  "Lilita One",
  "Comic Shanns",
  "Liberation Sans",
  // FONT_FAMILY_FALLBACKS
  "Xiaolai",
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
function buildFontFaceCss(faces, opts) {
  return faces.filter((f) => f.family && f.src).map((f) => {
    const hint = fontFormatHint(f.src);
    const src = hint ? `url("${f.src}") format("${hint}")` : `url("${f.src}")`;
    return `@font-face{font-family:"${f.family}";src:${src};font-weight:${f.weight ?? "normal"};font-style:${f.style ?? "normal"};` + ((opts == null ? void 0 : opts.display) ? `font-display:${opts.display};` : "") + "}";
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
