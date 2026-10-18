"use client";
import { h as packPagesInArray, r as renumberPagesInArray, i as commitElements, j as goToPage, k as pageElementsInOrder, l as buildPersistableFiles } from "./chunks/LibraryPanel-BRnFNiSa.js";
import { B, C, a, b, f, q, D, e, a2, at, L, c, n, X, s, g, d, P, au, aH, w, Q, G, Y, ac, am, S, aw, O, t, as, a as a3, x, ad, A, az, ab, a9, aa, af, ae, _, ao, aq, y, aA, N, a5, ax, v, aG, aF, ap, o, an, ah, ai, aj, av, aC, ar, aB, J, aE, u, T, m, H, I, R, p, a7, U, a3 as a32, a4, F, z, $, ak, E, a1, al, a8, a0, a6, Z, ay, K, aD, ag, W } from "./chunks/LibraryPanel-BRnFNiSa.js";
import { P as P2 } from "./chunks/layout-BEpoNps2.js";
import "@excalidraw/excalidraw/index.css";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { D as D2, P as P3, c as c2, f as f2, g as g2, h, l, e as e2, a as a10, p as p2, b as b2, r, s as s2 } from "./chunks/psd-BkuMvcm9.js";
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
  const scoped = [...pageElementsInOrder([frame], members)];
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
  q as DEFAULT_PAGE_SIZE,
  D as DesignPanel,
  e as DragPreview,
  a2 as EMPTY_BRAND,
  EXCALIDRAW_BUILTIN_FAMILIES,
  at as ImageLoadError,
  L as LayersPanel,
  c as LibraryPanel,
  n as MEDIA_DROP_TYPE,
  X as PAGE_ALIGNMENTS,
  P2 as PAGE_GAP,
  s as PAGE_SIZE_PRESETS,
  g as PANEL_FONT,
  P3 as PSD_IMAGE_MARKER,
  d as PageActions,
  P as PageNavigator,
  au as TEXT_PRESETS,
  aH as VIDEO_MARKER,
  w as addPage,
  Q as adoptLooseIntoPage,
  G as adoptStrayFramesInArray,
  Y as alignToPage,
  appendComponentToEditorConfig,
  buildFontFaceCss,
  buildHydratedFiles,
  buildPersistableFiles,
  ac as captureThumbnail,
  am as cascadePoints,
  clearHydrationCache,
  cloneSceneElements,
  S as clusterLooseElements,
  commitElements,
  aw as contrastTextColor,
  convertToExcalidrawElements,
  O as convertToPages,
  c2 as countSubpaths,
  t as createBlankScene,
  customFontFamilyId,
  as as dataUrlToBlob,
  dedupeFontFaces,
  a3 as default,
  x as deletePage,
  deriveComponentMeta,
  ad as downloadBlob,
  A as duplicatePage,
  az as ensurePagePapers,
  ab as exportScenePdf,
  a9 as exportScenePng,
  aa as exportSceneSvg,
  af as exportStoredScenePng,
  ae as exportStoredSceneSvg,
  _ as extendToPage,
  ao as externalizeInlineImages,
  extractComponentFragment,
  extractPageForComponent,
  aq as findInlineImageIds,
  y as fitAllPages,
  fitImageInBox,
  aA as fitPagePapersInArray,
  f2 as flattenBezierPath,
  N as focusLayer,
  fontFamilyAlias,
  a5 as fontFamilyId,
  ax as getPageBackground,
  v as getPageSize,
  aG as getSelectedVideo,
  aF as getVideoMeta,
  goToPage,
  g2 as groupStyleRuns,
  ap as hasUploadsInFlight,
  o as hideNativeDragImage,
  an as imageAtScenePoint,
  insertComponentIntoScene,
  ah as insertImageFromBlob,
  ai as insertImageFromUrl,
  aj as insertImageWithPreview,
  av as insertTextPreset,
  aC as insertVideo,
  instantiateComponent,
  ar as isInlineDataUrl,
  aB as isPageBackground,
  J as isPageLocked,
  aE as isVideoElement,
  h as legacyToScene,
  l as listImagePlaceholders,
  u as listPages,
  listSlots,
  T as looseElements,
  measureWrappedText,
  m as mergeLabels,
  H as movePage,
  I as movePageTo,
  normalizeFontName,
  packPagesInArray,
  R as paginateSceneInArray,
  p as palette,
  e2 as parseLegacyText,
  a7 as parseScene,
  U as patchElement,
  a10 as postScriptStyleToCss,
  p2 as psdColorToHex,
  b2 as psdToScene,
  a32 as registerCustomFont,
  a4 as registerCustomFonts,
  F as relayoutPages,
  z as renamePage,
  renumberPagesInArray,
  $ as reorderPageMembers,
  ak as replaceImageFromUrl,
  r as resetPsdIdCounter,
  E as resizePage,
  a1 as resolveBrandKit,
  al as resolveInsertPageId,
  a8 as restoreScene,
  a0 as sendMemberToBack,
  a6 as serializeScene,
  Z as setAsBackground,
  ay as setPageBackgroundColor,
  K as setPageLocked,
  aD as setVideoPoster,
  s2 as splitPostScriptFont,
  ag as storedScenePageCount,
  W as usePageThumbnails
};
//# sourceMappingURL=index.js.map
