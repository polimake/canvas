"use client";
import { h as packPagesInArray, r as renumberPagesInArray, i as commitElements, j as goToPage, k as buildPersistableFiles } from "./chunks/LibraryPanel-CyIW6tbs.js";
import { B, C, a, b, f, n, D, e, a0, L, c, M, U, o, g, d, P, R, aq, aC, u, K, E, W, aa, ak, O, as, J, q, ap, a as a2, v, ab, y, av, a9, a7, a8, ad, ac, Y, am, an, w, a3, at, t, aB, aA, l, al, af, ag, ah, ar, ax, ao, aw, H, az, s, Q, m, F, G, N, p, a5, S, a1, a2 as a22, A, x, Z, ai, z, $, aj, a6, _, a4, X, au, I, ay, ae, T } from "./chunks/LibraryPanel-CyIW6tbs.js";
import { P as P2 } from "./chunks/layout-BEpoNps2.js";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { D as D2, P as P3, c as c2, f as f2, g as g2, h, l as l2, e as e2, a as a10, p as p2, b as b2, r, s as s2 } from "./chunks/psd-BkuMvcm9.js";
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
  f as DEFAULT_LABELS,
  D2 as DEFAULT_MAX_SUBPATHS,
  n as DEFAULT_PAGE_SIZE,
  D as DesignPanel,
  e as DragPreview,
  a0 as EMPTY_BRAND,
  EXCALIDRAW_BUILTIN_FAMILIES,
  L as LayersPanel,
  c as LibraryPanel,
  M as MEDIA_DROP_TYPE,
  U as PAGE_ALIGNMENTS,
  P2 as PAGE_GAP,
  o as PAGE_SIZE_PRESETS,
  g as PANEL_FONT,
  P3 as PSD_IMAGE_MARKER,
  d as PageActions,
  P as PageNavigator,
  R as RightDock,
  aq as TEXT_PRESETS,
  aC as VIDEO_MARKER,
  u as addPage,
  K as adoptLooseIntoPage,
  E as adoptStrayFramesInArray,
  W as alignToPage,
  appendComponentToEditorConfig,
  buildFontFaceCss,
  buildHydratedFiles,
  buildPersistableFiles,
  aa as captureThumbnail,
  ak as cascadePoints,
  clearHydrationCache,
  cloneSceneElements,
  O as clusterLooseElements,
  commitElements,
  as as contrastTextColor,
  convertToExcalidrawElements,
  J as convertToPages,
  c2 as countSubpaths,
  q as createBlankScene,
  customFontFamilyId,
  ap as dataUrlToBlob,
  dedupeFontFaces,
  a2 as default,
  v as deletePage,
  deriveComponentMeta,
  ab as downloadBlob,
  y as duplicatePage,
  av as ensurePagePapers,
  a9 as exportScenePdf,
  a7 as exportScenePng,
  a8 as exportSceneSvg,
  ad as exportStoredScenePng,
  ac as exportStoredSceneSvg,
  Y as extendToPage,
  am as externalizeInlineImages,
  extractComponentFragment,
  extractPageForComponent,
  an as findInlineImageIds,
  w as fitAllPages,
  fitImageInBox,
  f2 as flattenBezierPath,
  fontFamilyAlias,
  a3 as fontFamilyId,
  at as getPageBackground,
  t as getPageSize,
  aB as getSelectedVideo,
  aA as getVideoMeta,
  goToPage,
  g2 as groupStyleRuns,
  l as hideNativeDragImage,
  al as imageAtScenePoint,
  insertComponentIntoScene,
  af as insertImageFromBlob,
  ag as insertImageFromUrl,
  ah as insertImageWithPreview,
  ar as insertTextPreset,
  ax as insertVideo,
  instantiateComponent,
  ao as isInlineDataUrl,
  aw as isPageBackground,
  H as isPageLocked,
  az as isVideoElement,
  h as legacyToScene,
  l2 as listImagePlaceholders,
  s as listPages,
  listSlots,
  Q as looseElements,
  measureWrappedText,
  m as mergeLabels,
  F as movePage,
  G as movePageTo,
  normalizeFontName,
  packPagesInArray,
  N as paginateSceneInArray,
  p as palette,
  e2 as parseLegacyText,
  a5 as parseScene,
  S as patchElement,
  a10 as postScriptStyleToCss,
  p2 as psdColorToHex,
  b2 as psdToScene,
  a1 as registerCustomFont,
  a22 as registerCustomFonts,
  A as relayoutPages,
  x as renamePage,
  renumberPagesInArray,
  Z as reorderPageMembers,
  ai as replaceImageFromUrl,
  r as resetPsdIdCounter,
  z as resizePage,
  $ as resolveBrandKit,
  aj as resolveInsertPageId,
  a6 as restoreScene,
  _ as sendMemberToBack,
  a4 as serializeScene,
  X as setAsBackground,
  au as setPageBackgroundColor,
  I as setPageLocked,
  ay as setVideoPoster,
  s2 as splitPostScriptFont,
  ae as storedScenePageCount,
  T as usePageThumbnails
};
//# sourceMappingURL=index.js.map
