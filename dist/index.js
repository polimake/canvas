"use client";
import { h as pageElementsInOrder, i as buildPersistableFiles, j as mesaGuardada, k as packPagesInArray, r as renumberPagesInArray, n as commitElements, o as goToPage } from "./chunks/LibraryPanel-QkeWaUFV.js";
import { B, C, a, b, D, q, c, d, s, E, I, L, e, t, u, v, w, P, f, g, T, x, y, z, A, F, G, H, J, K, N, O, Q, a as a2, R, S, U, W, X, Y, Z, _, $, a0, a1, a2 as a22, a3, a4, a5, a6, a7, a8, a9, aa, ab, ac, ad, ae, af, ag, ah, ai, aj, ak, al, am, an, ao, ap, aq, l, ar, as, m, at, au, av, p, aw, ax, ay, az, aA, aB, aC, aD, aE, aF, aG, aH, aI, aJ, aK, aL, aM, aN, aO, aP, aQ, aR, aS } from "./chunks/LibraryPanel-QkeWaUFV.js";
import { P as P2 } from "./chunks/layout-L5bQ5REv.js";
import "@excalidraw/excalidraw/index.css";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { D as D2, P as P3, c as c2, f as f2, g as g2, l as l2, a as a10, p as p2, b as b2, d as d2, e as e2, h, s as s2 } from "./chunks/legacy-DAAEWkHb.js";
import { EXCALIDRAW_BUILTIN_FAMILIES, buildFontFaceCss, customFontFamilyId, dedupeFontFaces, fontFamilyAlias, normalizeFontName } from "./fonts.js";
import { instantiateComponent } from "./components.js";
import { appendComponentToEditorConfig, cloneSceneElements, deriveComponentMeta, extractComponentFragment, fitImageInBox, listSlots, measureWrappedText } from "./components.js";
import { i } from "./chunks/documentToPptx-CsrYYM5a.js";
async function blobToDataUrl(blob, fallbackMime) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 32768;
  let binary = "";
  for (let i2 = 0; i2 < bytes.length; i2 += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i2, i2 + CHUNK));
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
  if (entry.bytes > CACHE_MAX_BYTES) return entry;
  const previo = BYTES_CACHE.get(key);
  if (previo) {
    releaseEntry(entry);
    return previo;
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
  return entry;
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
        const used = cacheSet(key, entry);
        files[file.id] = { ...file, dataURL: used.url, mimeType: used.mimeType };
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
      appState: { viewBackgroundColor: mesaGuardada(api.getAppState().viewBackgroundColor) },
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
  q as DEFAULT_PAGE_SIZE,
  c as DesignPanel,
  d as DragPreview,
  s as EMPTY_BRAND,
  E as EN_LABELS,
  EXCALIDRAW_BUILTIN_FAMILIES,
  I as ImageLoadError,
  L as LayersPanel,
  e as LibraryPanel,
  t as MEDIA_DROP_TYPE,
  u as MESA,
  v as PAGE_ALIGNMENTS,
  P2 as PAGE_GAP,
  w as PAGE_SIZE_PRESETS,
  P as PANEL_FONT,
  P3 as PSD_IMAGE_MARKER,
  f as PageActions,
  g as PageNavigator,
  T as TEXT_PRESETS,
  x as VIDEO_MARKER,
  y as addPage,
  z as adoptLooseIntoPage,
  A as adoptStrayFramesInArray,
  F as alignToPage,
  appendComponentToEditorConfig,
  buildFontFaceCss,
  buildHydratedFiles,
  buildPersistableFiles,
  G as captureThumbnail,
  H as cascadePoints,
  clearHydrationCache,
  cloneSceneElements,
  J as clusterLooseElements,
  commitElements,
  K as contrastTextColor,
  convertToExcalidrawElements,
  N as convertToPages,
  c2 as countSubpaths,
  O as createBlankScene,
  customFontFamilyId,
  Q as dataUrlToBlob,
  dedupeFontFaces,
  a2 as default,
  R as deletePage,
  deriveComponentMeta,
  S as displayPageName,
  U as downloadBlob,
  W as duplicatePage,
  X as ensurePagePapers,
  Y as exportScenePdf,
  Z as exportScenePng,
  _ as exportSceneSvg,
  $ as exportStoredScenePng,
  a0 as exportStoredSceneSvg,
  a1 as extendToPage,
  a22 as externalizeInlineImages,
  extractComponentFragment,
  extractPageForComponent,
  a3 as findInlineImageIds,
  a4 as fitAllPages,
  fitImageInBox,
  a5 as fitPagePapersInArray,
  f2 as flattenBezierPath,
  a6 as focusLayer,
  fontFamilyAlias,
  a7 as fontFamilyId,
  a8 as getPageBackground,
  a9 as getPageNotes,
  aa as getPageSize,
  ab as getPageTransition,
  ac as getSelectedVideo,
  ad as getVideoMeta,
  goToPage,
  g2 as groupStyleRuns,
  ae as hasUploadsInFlight,
  af as hideNativeDragImage,
  ag as imageAtScenePoint,
  insertComponentIntoScene,
  ah as insertImageFromBlob,
  ai as insertImageFromUrl,
  aj as insertImageWithPreview,
  ak as insertPagesIntoScene,
  al as insertTextPreset,
  am as insertVideo,
  instantiateComponent,
  an as isInlineDataUrl,
  i as isPageBackground,
  ao as isPageLocked,
  ap as isPageSkipped,
  aq as isVideoElement,
  l as labelsFor,
  l2 as legacyToScene,
  a10 as listImagePlaceholders,
  ar as listPages,
  listSlots,
  as as looseElements,
  measureWrappedText,
  m as mergeLabels,
  mesaGuardada,
  at as movePage,
  au as movePageTo,
  normalizeFontName,
  packPagesInArray,
  av as paginateSceneInArray,
  p as palette,
  p2 as parseLegacyText,
  aw as parseScene,
  ax as patchElement,
  b2 as postScriptStyleToCss,
  d2 as psdColorToHex,
  e2 as psdToScene,
  ay as registerCustomFont,
  az as registerCustomFonts,
  aA as relayoutPages,
  aB as renamePage,
  renumberPagesInArray,
  aC as reorderPageMembers,
  aD as replaceImageFromUrl,
  h as resetPsdIdCounter,
  aE as resizePage,
  aF as resolveBrandKit,
  aG as resolveInsertPageId,
  aH as restoreScene,
  aI as sendMemberToBack,
  aJ as serializeScene,
  aK as setAsBackground,
  aL as setPageBackgroundColor,
  aM as setPageLocked,
  aN as setPageNotes,
  aO as setPageSkipped,
  aP as setPageTransition,
  aQ as setVideoPoster,
  s2 as splitPostScriptFont,
  aR as storedScenePageCount,
  aS as usePageThumbnails
};
//# sourceMappingURL=index.js.map
