"use client";
import { h as buildPersistableFiles, i as packPagesInArray, r as renumberPagesInArray, j as commitElements, k as goToPage } from "./chunks/LibraryPanel-DsMt5nOA.js";
import { B, C, a, b, D, l, c, d, E, L, e, M, n, o, P, f, g, R, T, q, s, t, u, v, w, x, y, z, A, F, G, a as a2, H, I, J, K, N, O, Q, S, U, W, X, Y, Z, _, $, a0, a1, a2 as a22, a3, a4, a5, a6, a7, a8, a9, aa, ab, ac, ad, ae, af, m, ag, ah, ai, p, aj, ak, al, am, an, ao, ap, aq, ar, as, at, au, av, aw, ax, ay, az, aA, aB, aC } from "./chunks/LibraryPanel-DsMt5nOA.js";
import { P as P2 } from "./chunks/layout-BEpoNps2.js";
import { D as D2, P as P3, c as c2, f as f2, g as g2, l as l2, a as a10, p as p2, b as b2, d as d2, e as e2, h, s as s2 } from "./chunks/legacy-BS2a1q37.js";
import { EXCALIDRAW_BUILTIN_FAMILIES, buildFontFaceCss, customFontFamilyId, dedupeFontFaces, fontFamilyAlias, normalizeFontName } from "./fonts.js";
import { instantiateComponent } from "./components.js";
import { appendComponentToEditorConfig, cloneSceneElements, deriveComponentMeta, extractComponentFragment, fitImageInBox, listSlots, measureWrappedText } from "./components.js";
async function blobToDataUrl(blob, fallbackMime) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || fallbackMime};base64,${btoa(binary)}`;
}
function needsHydration(value) {
  return typeof value === "string" && !value.startsWith("data:") && !value.startsWith("blob:");
}
const NO_CORS_ORIGINS = /* @__PURE__ */ new Set();
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
async function fetchBytes(url, fetcher, preferProxy) {
  const origin = originOf(url);
  if (preferProxy || origin === null || NO_CORS_ORIGINS.has(origin)) {
    return fetcher(url);
  }
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  } catch {
    NO_CORS_ORIGINS.add(origin);
    return fetcher(url);
  }
}
const BYTES_CACHE = /* @__PURE__ */ new Map();
const CACHE_MAX_BYTES = 32 * 1024 * 1024;
let cacheBytes = 0;
const REVOKE_DELAY_MS = 5e3;
function releaseEntry(entry) {
  if (!entry.revocable) return;
  setTimeout(() => URL.revokeObjectURL(entry.url), REVOKE_DELAY_MS);
}
const cacheKey = (url, output) => `${output}\0${url}`;
function cacheGet(key) {
  const hit = BYTES_CACHE.get(key);
  if (!hit) return void 0;
  BYTES_CACHE.delete(key);
  BYTES_CACHE.set(key, hit);
  return hit;
}
function cacheSet(key, entry) {
  if (entry.bytes > CACHE_MAX_BYTES) return;
  const previo = BYTES_CACHE.get(key);
  if (previo) {
    cacheBytes -= previo.bytes;
    releaseEntry(previo);
  }
  BYTES_CACHE.set(key, entry);
  cacheBytes += entry.bytes;
  while (cacheBytes > CACHE_MAX_BYTES) {
    const oldest = BYTES_CACHE.keys().next().value;
    if (oldest === void 0) break;
    const victima = BYTES_CACHE.get(oldest);
    BYTES_CACHE.delete(oldest);
    if (victima) {
      cacheBytes -= victima.bytes;
      releaseEntry(victima);
    }
  }
}
function clearHydrationCache() {
  for (const entry of BYTES_CACHE.values()) releaseEntry(entry);
  BYTES_CACHE.clear();
  cacheBytes = 0;
  NO_CORS_ORIGINS.clear();
}
async function buildHydratedFiles(api, fetcher, { output = "blob", preferProxy = false } = {}) {
  const source = api.getFiles() ?? {};
  const files = { ...source };
  const failed = [];
  let hydrated = 0;
  const pending = Object.values(source).filter((f3) => needsHydration(f3 == null ? void 0 : f3.dataURL));
  if (pending.length === 0) return { files, hydrated, failed };
  await Promise.all(
    pending.map(async (file) => {
      const remota = file.dataURL;
      const key = cacheKey(remota, output);
      const cached = cacheGet(key);
      if (cached) {
        files[file.id] = { ...file, dataURL: cached.url, mimeType: cached.mimeType };
        hydrated += 1;
        return;
      }
      try {
        const blob = await fetchBytes(remota, fetcher, preferProxy);
        const mimeType = blob.type || file.mimeType;
        const entry = output === "blob" ? { url: URL.createObjectURL(blob), mimeType, bytes: blob.size, revocable: true } : await (async () => {
          const dataURL = await blobToDataUrl(blob, file.mimeType);
          return { url: dataURL, mimeType, bytes: dataURL.length, revocable: false };
        })();
        cacheSet(key, entry);
        files[file.id] = { ...file, dataURL: entry.url, mimeType: entry.mimeType };
        hydrated += 1;
      } catch {
        failed.push(remota);
      }
    })
  );
  return { files, hydrated, failed };
}
function frames(elements) {
  return elements.filter((e3) => e3.type === "frame").slice().sort((a11, b3) => a11.x - b3.x);
}
function insertComponentIntoScene(api, fragment, { afterPageId, slots } = {}) {
  const elements = api.getSceneElements();
  const existing = frames(elements);
  const anchor = afterPageId && existing.find((f3) => f3.id === afterPageId) || existing[existing.length - 1] || null;
  const dx = anchor ? anchor.x + anchor.width + 1 - fragment.frame.x : 0;
  const dy = anchor ? anchor.y - fragment.frame.y : 0;
  const instance = instantiateComponent(fragment, { slots, dx, dy });
  const fileEntries = Object.values(instance.files);
  if (fileEntries.length) {
    api.addFiles(fileEntries);
  }
  const order = existing.map((f3) => f3.id);
  const at2 = anchor ? order.indexOf(anchor.id) + 1 : order.length;
  order.splice(at2, 0, instance.pageId);
  const cloned = instance.elements;
  let combined = [...elements, ...cloned];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined);
  goToPage(api, instance.pageId);
  return { pageId: instance.pageId, fonts: instance.fonts, unknownSlots: instance.unknownSlots };
}
function extractPageForComponent(api, pageId, { fonts } = {}) {
  const elements = api.getSceneElements();
  const frame = elements.find((e3) => e3.id === pageId && e3.type === "frame");
  if (!frame) return null;
  const members = elements.filter((e3) => e3.frameId === pageId);
  const scoped = [frame, ...members];
  const persistable = buildPersistableFiles(scoped, api.getFiles());
  return {
    editorConfig: {
      elements: scoped,
      appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
      files: persistable.files,
      ...(fonts == null ? void 0 : fonts.length) ? { fonts: [...fonts] } : {}
    },
    inline: persistable.inline
  };
}
export {
  B as BrandGallery,
  C as Canvas2,
  a as Canvas2Editor,
  b as CanvasMenu,
  D as DEFAULT_LABELS,
  D2 as DEFAULT_MAX_SUBPATHS,
  l as DEFAULT_PAGE_SIZE,
  c as DesignPanel,
  d as DragPreview,
  E as EMPTY_BRAND,
  EXCALIDRAW_BUILTIN_FAMILIES,
  L as LayersPanel,
  e as LibraryPanel,
  M as MEDIA_DROP_TYPE,
  n as PAGE_ALIGNMENTS,
  P2 as PAGE_GAP,
  o as PAGE_SIZE_PRESETS,
  P as PANEL_FONT,
  P3 as PSD_IMAGE_MARKER,
  f as PageActions,
  g as PageNavigator,
  R as RightDock,
  T as TEXT_PRESETS,
  q as VIDEO_MARKER,
  s as addPage,
  t as adoptLooseIntoPage,
  u as adoptStrayFramesInArray,
  v as alignToPage,
  appendComponentToEditorConfig,
  buildFontFaceCss,
  buildHydratedFiles,
  buildPersistableFiles,
  w as captureThumbnail,
  x as cascadePoints,
  clearHydrationCache,
  cloneSceneElements,
  y as clusterLooseElements,
  commitElements,
  z as contrastTextColor,
  A as convertToPages,
  c2 as countSubpaths,
  F as createBlankScene,
  customFontFamilyId,
  G as dataUrlToBlob,
  dedupeFontFaces,
  a2 as default,
  H as deletePage,
  deriveComponentMeta,
  I as downloadBlob,
  J as duplicatePage,
  K as ensurePagePapers,
  N as exportScenePdf,
  O as exportScenePng,
  Q as exportSceneSvg,
  S as exportStoredScenePng,
  U as exportStoredSceneSvg,
  W as extendToPage,
  X as externalizeInlineImages,
  extractComponentFragment,
  extractPageForComponent,
  Y as findInlineImageIds,
  Z as fitAllPages,
  fitImageInBox,
  f2 as flattenBezierPath,
  fontFamilyAlias,
  _ as fontFamilyId,
  $ as getPageBackground,
  a0 as getPageSize,
  a1 as getSelectedVideo,
  a22 as getVideoMeta,
  goToPage,
  g2 as groupStyleRuns,
  a3 as hideNativeDragImage,
  a4 as imageAtScenePoint,
  insertComponentIntoScene,
  a5 as insertImageFromBlob,
  a6 as insertImageFromUrl,
  a7 as insertImageWithPreview,
  a8 as insertTextPreset,
  a9 as insertVideo,
  instantiateComponent,
  aa as isInlineDataUrl,
  ab as isPageBackground,
  ac as isPageLocked,
  ad as isVideoElement,
  l2 as legacyToScene,
  a10 as listImagePlaceholders,
  ae as listPages,
  listSlots,
  af as looseElements,
  measureWrappedText,
  m as mergeLabels,
  ag as movePage,
  ah as movePageTo,
  normalizeFontName,
  packPagesInArray,
  ai as paginateSceneInArray,
  p as palette,
  p2 as parseLegacyText,
  aj as parseScene,
  ak as patchElement,
  b2 as postScriptStyleToCss,
  d2 as psdColorToHex,
  e2 as psdToScene,
  al as registerCustomFont,
  am as registerCustomFonts,
  an as relayoutPages,
  ao as renamePage,
  renumberPagesInArray,
  ap as reorderPageMembers,
  aq as replaceImageFromUrl,
  h as resetPsdIdCounter,
  ar as resizePage,
  as as resolveBrandKit,
  at as resolveInsertPageId,
  au as restoreScene,
  av as sendMemberToBack,
  aw as serializeScene,
  ax as setAsBackground,
  ay as setPageBackgroundColor,
  az as setPageLocked,
  aA as setVideoPoster,
  s2 as splitPostScriptFont,
  aB as storedScenePageCount,
  aC as usePageThumbnails
};
//# sourceMappingURL=index.js.map
