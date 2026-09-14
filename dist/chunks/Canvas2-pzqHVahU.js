import { jsxs, jsx, Fragment as Fragment$1 } from "react/jsx-runtime";
import { useState, useRef, useEffect, Fragment, useMemo, useCallback } from "react";
import "@excalidraw/excalidraw/index.css";
import { CaptureUpdateAction, newElementWith, convertToExcalidrawElements, restore, serializeAsJSON, exportToCanvas, exportToBlob, exportToSvg, FONT_FAMILY, MainMenu, viewportCoordsToSceneCoords, getVisibleSceneBounds, Excalidraw, getNonDeletedElements } from "@excalidraw/excalidraw";
import { cloneSceneElements } from "../components.js";
import { P as PAGE_GAP } from "./layout-BEpoNps2.js";
import { fontFormatHint, buildFontFaceCss, fontFamilyAlias, customFontFamilyId, normalizeFontSrc, dedupeFontFaces } from "../fonts.js";
import { createPortal } from "react-dom";
const CAPTURE = {
  // One undo entry, immediately.
  undoable: CaptureUpdateAction.IMMEDIATELY,
  // Folded into the NEXT undoable capture (live previews, e.g. color drag).
  transient: CaptureUpdateAction.EVENTUALLY,
  // Invisible to history (load-time migrations) — does not advance the
  // snapshot, so it can never be "undone into".
  never: CaptureUpdateAction.NEVER
};
function patchElement(element, updates) {
  return newElementWith(element, updates);
}
function asSceneElements(elements) {
  return elements;
}
function commitElements(api, elements, capture = "undoable", appState) {
  api.updateScene({
    elements: asSceneElements(elements),
    ...appState ? { appState } : {},
    captureUpdate: CAPTURE[capture]
  });
}
function reorderMembersInArray(els, pageId, orderedMemberIdsBottomFirst) {
  const memberSlots = [];
  const byId = /* @__PURE__ */ new Map();
  els.forEach((e, i) => {
    if (e.frameId === pageId) {
      memberSlots.push(i);
      byId.set(e.id, e);
    }
  });
  if (memberSlots.length === 0) return els;
  const ordered = [];
  const seen = /* @__PURE__ */ new Set();
  for (const id of orderedMemberIdsBottomFirst) {
    const e = byId.get(id);
    if (e && !seen.has(id)) {
      ordered.push(e);
      seen.add(id);
    }
  }
  for (const slot of memberSlots) {
    const e = els[slot];
    if (!seen.has(e.id)) {
      ordered.push(e);
      seen.add(e.id);
    }
  }
  const next = els.slice();
  memberSlots.forEach((slot, k) => {
    next[slot] = ordered[k];
  });
  return next;
}
function reorderPageMembers(api, pageId, orderedMemberIdsBottomFirst) {
  return reorderMembersInArray(
    api.getSceneElements(),
    pageId,
    orderedMemberIdsBottomFirst
  );
}
function sendMemberToBack(api, elementId, pageId) {
  const currentBottomFirst = api.getSceneElements().filter((e) => e.frameId === pageId).map((e) => e.id);
  const ordered = [elementId, ...currentBottomFirst.filter((id) => id !== elementId)];
  return reorderPageMembers(api, pageId, ordered);
}
const BG_MARKER = "pageBackground";
function isPageBackground(el) {
  var _a;
  return ((_a = el.customData) == null ? void 0 : _a.c2) === BG_MARKER;
}
function buildPageBackground(pageId, bounds, color2) {
  const skeleton = [
    {
      type: "rectangle",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      backgroundColor: color2,
      fillStyle: "solid",
      strokeColor: "#d4d4d8",
      strokeWidth: 1,
      roughness: 0,
      roundness: null
    }
  ];
  return convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) => ({
    ...el,
    frameId: pageId,
    locked: true,
    customData: { c2: BG_MARKER }
  }));
}
function ensurePagePapers(api, capture = "never") {
  const elements = api.getSceneElements();
  const frames2 = elements.filter((e) => e.type === "frame");
  const withPaper = new Set(
    elements.filter((e) => e.frameId && isPageBackground(e)).map((e) => e.frameId)
  );
  const missing = frames2.filter((f) => !withPaper.has(f.id));
  if (missing.length === 0) return;
  let combined = [...elements];
  const inserted = [];
  for (const frame of missing) {
    const paper = buildPageBackground(frame.id, frame, "#ffffff");
    combined = [...combined, ...paper];
    if (paper[0]) inserted.push({ pageId: frame.id, paperId: paper[0].id });
  }
  for (const { pageId, paperId } of inserted) {
    combined = reorderMembersInArray(combined, pageId, [paperId]);
  }
  commitElements(api, combined, capture);
}
function getPageBackground(api, pageId) {
  const bg = api.getSceneElements().find((e) => e.frameId === pageId && isPageBackground(e));
  return bg ? bg.backgroundColor ?? null : null;
}
function setPageBackgroundColor(api, pageId, color2, opts = {}) {
  var _a;
  const capture = opts.capture ?? "undoable";
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e) => e.id === pageId && e.type === "frame"
  );
  if (!frame) return null;
  const existing = elements.find((e) => e.frameId === pageId && isPageBackground(e));
  if (!color2) {
    if (!existing) return null;
    commitElements(api, elements.filter((e) => e !== existing), capture);
    return null;
  }
  if (existing) {
    if (existing.backgroundColor === color2) {
      return existing.id;
    }
    const next = elements.map(
      (e) => e === existing ? patchElement(e, { backgroundColor: color2 }) : e
    );
    commitElements(api, next, capture);
    return existing.id;
  }
  const created = buildPageBackground(pageId, frame, color2);
  const id = ((_a = created[0]) == null ? void 0 : _a.id) ?? null;
  const appended = [...elements, ...created];
  const reordered = id ? reorderMembersInArray(appended, pageId, [id]) : appended;
  commitElements(api, reordered, capture);
  return id;
}
const DEFAULT_PAGE_SIZE = { width: 1080, height: 1350 };
const PAGE_SIZE_PRESETS = [
  { key: "ig-post", label: "Post 4:5", width: 1080, height: 1350 },
  { key: "square", label: "Cuadrado 1:1", width: 1080, height: 1080 },
  { key: "story", label: "Story / Reel 9:16", width: 1080, height: 1920 },
  { key: "landscape", label: "Horizontal 16:9", width: 1920, height: 1080 },
  { key: "yt-thumb", label: "Miniatura YouTube", width: 1280, height: 720 },
  { key: "a4", label: "A4", width: 794, height: 1123 },
  { key: "default", label: "Lienzo clásico", width: 1640, height: 924 }
];
const PAPER_COLOR$1 = "#ffffff";
const DEFAULT_NAME_RE = /^Página \d+$/;
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pg_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
const PAGE_MARKER = "c2page";
function pageOrderOf(el) {
  var _a, _b;
  const raw = (_b = (_a = el.customData) == null ? void 0 : _a[PAGE_MARKER]) == null ? void 0 : _b.index;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}
function framesInArray(elements) {
  const frames2 = elements.filter((e) => e.type === "frame");
  const marked = frames2.length > 0 && frames2.every((f) => pageOrderOf(f) !== null);
  return frames2.slice().sort(
    marked ? (a, b) => pageOrderOf(a) - pageOrderOf(b) : (a, b) => a.x - b.x
  );
}
const MIN_PAGE_SIDE = 16;
function usableSize(size) {
  const side = (v, fallback) => typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.max(MIN_PAGE_SIDE, v) : fallback;
  return {
    width: side(size == null ? void 0 : size.width, DEFAULT_PAGE_SIZE.width),
    height: side(size == null ? void 0 : size.height, DEFAULT_PAGE_SIZE.height)
  };
}
function getFrames(api) {
  return framesInArray(api.getSceneElements());
}
function packPagesInArray(elements, orderedFrameIds) {
  const known = framesInArray(elements);
  if (known.length === 0) return elements;
  const order = orderedFrameIds ? orderedFrameIds.map((id) => known.find((f) => f.id === id)).filter((f) => Boolean(f)) : known;
  if (order.length === 0) return elements;
  const moves = /* @__PURE__ */ new Map();
  const anchorY = order[0].y;
  let cursor = Math.min(...order.map((f) => f.x));
  order.forEach((frame, index) => {
    const dx = cursor - frame.x;
    const dy = anchorY - frame.y;
    cursor += frame.width + PAGE_GAP;
    const stale = pageOrderOf(frame) !== index;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || stale) {
      moves.set(frame.id, { dx, dy, index });
    }
  });
  if (moves.size === 0) return elements;
  return elements.map((e) => {
    const isFrame = e.type === "frame";
    const move = moves.get(isFrame ? e.id : e.frameId ?? "");
    if (!move) return e;
    const updates = {};
    if (Math.abs(move.dx) > 0.01) updates.x = e.x + move.dx;
    if (Math.abs(move.dy) > 0.01) updates.y = e.y + move.dy;
    if (isFrame && pageOrderOf(e) !== move.index) {
      updates.customData = {
        ...e.customData ?? {},
        [PAGE_MARKER]: { index: move.index }
      };
    }
    return Object.keys(updates).length ? patchElement(e, updates) : e;
  });
}
function adoptStrayFramesInArray(elements) {
  const frames2 = elements.filter((e) => e.type === "frame");
  const strays = frames2.filter((f) => pageOrderOf(f) === null);
  if (strays.length === 0 || strays.length === frames2.length) return elements;
  const strayIds = new Set(strays.map((f) => f.id));
  let n = 0;
  return elements.map(
    (e) => strayIds.has(e.id) ? (
      // El número da igual: al llevar el patrón por defecto, `renumberPagesInArray`
      // le pone el de su posición real en el mismo commit.
      patchElement(e, { name: `Página ${++n}` })
    ) : e
  );
}
function renumberPagesInArray(elements, orderedFrameIds) {
  const nameById = new Map(orderedFrameIds.map((id, i) => [id, `Página ${i + 1}`]));
  let changed = false;
  const next = elements.map((e) => {
    if (e.type !== "frame") return e;
    const target = nameById.get(e.id);
    const current = e.name ?? "";
    if (!target || target === current || !DEFAULT_NAME_RE.test(current)) return e;
    changed = true;
    return patchElement(e, { name: target });
  });
  return changed ? next : elements;
}
function createBlankScene(pageSize = DEFAULT_PAGE_SIZE) {
  const size = usableSize(pageSize);
  const id = createId();
  const skeleton = [
    {
      type: "frame",
      id,
      name: "Página 1",
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      children: [],
      customData: { [PAGE_MARKER]: { index: 0 } }
    }
  ];
  const frame = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const paper = buildPageBackground(
    id,
    { x: 0, y: 0, width: size.width, height: size.height },
    PAPER_COLOR$1
  );
  return {
    elements: asSceneElements([...frame, ...paper])
  };
}
function listPages(api) {
  return getFrames(api).map((f, index) => ({
    id: f.id,
    name: f.name ?? `Página ${index + 1}`,
    index,
    width: Math.round(f.width),
    height: Math.round(f.height),
    locked: Boolean(f.locked),
    x: f.x,
    y: f.y
  }));
}
function getPageSize(api, pageId) {
  const frame = getFrames(api).find((f) => f.id === pageId);
  return frame ? { width: Math.round(frame.width), height: Math.round(frame.height) } : null;
}
function addPage(api, pageSize = DEFAULT_PAGE_SIZE, opts = {}) {
  var _a;
  const size = usableSize(pageSize);
  const elements = api.getSceneElements();
  const frames2 = framesInArray(elements);
  const anchorId = opts.afterPageId ?? opts.beforePageId;
  const source = anchorId ? frames2.find((f) => f.id === anchorId) : void 0;
  const before = source ? !opts.afterPageId : false;
  const id = createId();
  const x = source ? before ? source.x : source.x + source.width : frames2.length ? Math.max(...frames2.map((f) => f.x + f.width)) + PAGE_GAP : 0;
  const y = source ? source.y : ((_a = frames2[0]) == null ? void 0 : _a.y) ?? 0;
  const order = frames2.map((f) => f.id);
  const insertAt = source ? order.indexOf(source.id) + (before ? 0 : 1) : order.length;
  order.splice(insertAt, 0, id);
  const skeleton = [
    {
      type: "frame",
      id,
      name: `Página ${insertAt + 1}`,
      x,
      y,
      width: size.width,
      height: size.height,
      children: []
    }
  ];
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const paper = buildPageBackground(id, { x, y, width: size.width, height: size.height }, PAPER_COLOR$1);
  let combined = [
    ...elements,
    ...created,
    ...paper
  ];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined, opts.capture ?? "undoable");
  return id;
}
const PAGE_VIEWPORT_COVERAGE = 0.72;
function goToPage(api, pageId, opts) {
  const frame = api.getSceneElements().find((e) => e.id === pageId);
  if (!frame) return;
  api.scrollToContent(frame, {
    fitToViewport: true,
    viewportZoomFactor: Math.min(1, Math.max(0.1, (opts == null ? void 0 : opts.coverage) ?? PAGE_VIEWPORT_COVERAGE)),
    animate: true,
    duration: 300
  });
}
function renamePage(api, pageId, name) {
  const next = api.getSceneElements().map(
    (e) => e.id === pageId && e.type === "frame" ? patchElement(e, { name }) : e
  );
  commitElements(api, next);
}
function fitAllPages(api, opts) {
  const marcos = framesInArray(api.getSceneElements());
  if (!marcos.length) return;
  api.scrollToContent(marcos, {
    fitToViewport: true,
    viewportZoomFactor: Math.min(1, Math.max(0.1, (opts == null ? void 0 : opts.coverage) ?? 0.9)),
    animate: true,
    duration: 300
  });
}
function deletePage(api, pageId) {
  const elements = api.getSceneElements();
  if (framesInArray(elements).length <= 1) return false;
  let remaining = elements.filter(
    (e) => e.id !== pageId && e.frameId !== pageId
  );
  const order = framesInArray(remaining).map((f) => f.id);
  remaining = packPagesInArray(remaining, order);
  remaining = renumberPagesInArray(remaining, order);
  commitElements(api, remaining);
  return true;
}
function relayoutPages(api, capture = "undoable") {
  const elements = api.getSceneElements();
  let next = adoptStrayFramesInArray(elements);
  next = packPagesInArray(next);
  next = renumberPagesInArray(next, framesInArray(next).map((f) => f.id));
  if (next === elements) return;
  commitElements(api, next, capture);
}
function isPageLocked(api, pageId) {
  const frame = getFrames(api).find((f) => f.id === pageId);
  return Boolean(frame == null ? void 0 : frame.locked);
}
function setPageLocked(api, pageId, locked) {
  const next = api.getSceneElements().map(
    (e) => e.id === pageId || e.frameId === pageId ? patchElement(e, { locked }) : e
  );
  commitElements(api, next);
}
function movePageTo(api, pageId, targetIndex) {
  const elements = api.getSceneElements();
  const frames2 = framesInArray(elements);
  const from = frames2.findIndex((f) => f.id === pageId);
  if (from < 0) return;
  const to = Math.max(0, Math.min(frames2.length - 1, Math.trunc(targetIndex)));
  if (to === from) return;
  const order = frames2.map((f) => f.id);
  order.splice(to, 0, ...order.splice(from, 1));
  let next = packPagesInArray(elements, order);
  next = renumberPagesInArray(next, order);
  commitElements(api, next);
}
function movePage(api, pageId, direction) {
  const elements = api.getSceneElements();
  const frames2 = framesInArray(elements);
  const idx = frames2.findIndex((f) => f.id === pageId);
  if (idx < 0 || !frames2[idx + direction]) return;
  const order = frames2.map((f) => f.id);
  [order[idx], order[idx + direction]] = [order[idx + direction], order[idx]];
  let next = packPagesInArray(elements, order);
  next = renumberPagesInArray(next, order);
  commitElements(api, next);
}
function resizePage(api, pageId, size, opts = {}) {
  const scaleContent = opts.scaleContent ?? true;
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e) => e.id === pageId && e.type === "frame"
  );
  if (!frame) return;
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
  if (size.width <= 0 || size.height <= 0) return;
  const sx = size.width / frame.width;
  const sy = size.height / frame.height;
  const k = Math.min(sx, sy);
  const resized = elements.map((e) => {
    if (e.id === pageId && e.type === "frame") {
      return patchElement(e, { width: size.width, height: size.height });
    }
    if (e.frameId !== pageId) return e;
    if (isPageBackground(e)) {
      return patchElement(e, {
        x: frame.x,
        y: frame.y,
        width: size.width,
        height: size.height
      });
    }
    if (!scaleContent) return e;
    const cx = frame.x + (e.x + e.width / 2 - frame.x) * sx;
    const cy = frame.y + (e.y + e.height / 2 - frame.y) * sy;
    const width = Math.max(1, e.width * k);
    const height = Math.max(1, e.height * k);
    const updates = {
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height
    };
    if (e.type === "text") {
      const text = e;
      if (typeof text.fontSize === "number") {
        updates.fontSize = Math.max(4, text.fontSize * k);
      }
    }
    return patchElement(e, updates);
  });
  commitElements(api, packPagesInArray(resized));
}
function duplicatePage(api, pageId) {
  const elements = api.getSceneElements();
  const source = elements.find(
    (e) => e.id === pageId && e.type === "frame"
  );
  if (!source) return null;
  const members = elements.filter((e) => e.frameId === pageId);
  const { clones, idMap } = cloneSceneElements([source, ...members], {
    dx: source.width + PAGE_GAP
  });
  const cloneId = idMap.get(pageId);
  if (!cloneId) return null;
  for (const clone of clones) {
    if (clone.id === cloneId) {
      clone.name = `${source.name ?? "Página"} (copia)`;
    }
  }
  const order = framesInArray(elements).map((f) => f.id);
  order.splice(order.indexOf(pageId) + 1, 0, cloneId);
  let combined = [...elements, ...clones];
  combined = packPagesInArray(combined, order);
  combined = renumberPagesInArray(combined, order);
  commitElements(api, combined);
  return cloneId;
}
function serializeScene(api) {
  return serializeAsJSON(
    api.getSceneElements(),
    api.getAppState(),
    api.getFiles(),
    "local"
  );
}
function parseScene(json) {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    return {
      elements: data.elements ?? [],
      appState: data.appState ?? {},
      files: data.files ?? {}
    };
  } catch {
    return null;
  }
}
function restoreScene(scene) {
  const restored = restore(
    {
      elements: Array.isArray(scene.elements) ? scene.elements : [],
      appState: scene.appState ?? {},
      files: scene.files ?? {}
    },
    null,
    null,
    { refreshDimensions: true, repairBindings: true }
  );
  return {
    elements: restored.elements,
    appState: scene.appState ?? {},
    files: restored.files ?? {}
  };
}
async function blobToDataUrl$1(blob, mime) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  const CHUNK = 32768;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binario += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binario)}`;
}
function mimeFor(src) {
  switch (fontFormatHint(src)) {
    case "woff2":
      return "font/woff2";
    case "woff":
      return "font/woff";
    case "opentype":
      return "font/otf";
    case "truetype":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}
async function inlineFontFaces(faces, fetcher) {
  const failed = [];
  const resueltas = await Promise.all(
    faces.map(async (f) => {
      if (f.src.startsWith("data:")) return f;
      try {
        return { ...f, src: await blobToDataUrl$1(await fetcher(f.src), mimeFor(f.src)) };
      } catch {
        failed.push(f.family);
        return f;
      }
    })
  );
  return { faces: resueltas, failed };
}
function appendFontFacesToSvg(svg, css) {
  if (!css.trim()) return svg;
  const doc = svg.ownerDocument;
  const NS = "http://www.w3.org/2000/svg";
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = doc.createElementNS(NS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const style = doc.createElementNS(NS, "style");
  style.setAttribute("data-canvas2-fonts", "");
  style.textContent = css;
  defs.appendChild(style);
  return svg;
}
function dimensions(opts) {
  const scale = (opts == null ? void 0 : opts.scale) ?? 1;
  return (width, height) => ({
    width: width * scale,
    height: height * scale,
    scale
  });
}
function frames$2(api) {
  return api.getSceneElements().filter((e) => e.type === "frame").slice().sort((a, b) => a.x - b.x);
}
function findFrame(api, pageId) {
  if (!pageId) return null;
  return frames$2(api).find((f) => f.id === pageId) ?? null;
}
function exportAppState(api, opts) {
  return {
    exportBackground: (opts == null ? void 0 : opts.background) ?? true,
    exportWithDarkMode: (opts == null ? void 0 : opts.darkMode) ?? false,
    viewBackgroundColor: api.getAppState().viewBackgroundColor
  };
}
function exportScenePng(api, opts) {
  return exportToBlob({
    elements: api.getSceneElements(),
    appState: exportAppState(api, opts),
    files: (opts == null ? void 0 : opts.files) ?? api.getFiles(),
    exportingFrame: findFrame(api, opts == null ? void 0 : opts.pageId),
    ...(opts == null ? void 0 : opts.maxWidthOrHeight) ? { maxWidthOrHeight: opts.maxWidthOrHeight } : { getDimensions: dimensions(opts) },
    mimeType: "image/png"
  });
}
async function exportSceneSvg(api, opts) {
  const svg = await sinRuidoDeFuentes(
    () => exportToSvg({
      elements: api.getSceneElements(),
      appState: exportAppState(api, opts),
      files: (opts == null ? void 0 : opts.files) ?? api.getFiles(),
      exportingFrame: findFrame(api, opts == null ? void 0 : opts.pageId)
    })
  );
  const faces = (opts == null ? void 0 : opts.fontFaces) ?? [];
  if (!faces.length) return svg;
  const resueltas = (opts == null ? void 0 : opts.fontFetcher) ? (await inlineFontFaces(faces, opts.fontFetcher)).faces : faces;
  return appendFontFacesToSvg(svg, buildFontFaceCss(resueltas));
}
let exportacionesSilenciadas = 0;
let consoleErrorReal = null;
async function sinRuidoDeFuentes(fn) {
  if (exportacionesSilenciadas === 0) {
    consoleErrorReal = console.error;
    console.error = (...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("Couldn't find registered fonts for font-family")) {
        return;
      }
      consoleErrorReal == null ? void 0 : consoleErrorReal(...args);
    };
  }
  exportacionesSilenciadas += 1;
  try {
    return await fn();
  } finally {
    exportacionesSilenciadas -= 1;
    if (exportacionesSilenciadas === 0 && consoleErrorReal) {
      console.error = consoleErrorReal;
      consoleErrorReal = null;
    }
  }
}
async function exportStoredSceneSvg(scene, opts) {
  var _a;
  const restored = restoreScene(scene);
  const elements = restored.elements ?? [];
  const pages = elements.filter((e) => e.type === "frame").slice().sort((a, b) => a.x - b.x);
  const viewBackgroundColor = (_a = scene.appState) == null ? void 0 : _a.viewBackgroundColor;
  return sinRuidoDeFuentes(
    () => exportToSvg({
      elements,
      appState: {
        exportBackground: (opts == null ? void 0 : opts.background) ?? true,
        exportWithDarkMode: (opts == null ? void 0 : opts.darkMode) ?? false,
        viewBackgroundColor
      },
      files: restored.files ?? {},
      exportingFrame: (opts == null ? void 0 : opts.pageIndex) === void 0 ? null : pages[opts.pageIndex] ?? null
    })
  );
}
async function exportStoredScenePng(scene, opts) {
  var _a;
  const restored = restoreScene(scene);
  const elements = restored.elements ?? [];
  const pages = elements.filter((e) => e.type === "frame").slice().sort((a, b) => a.x - b.x);
  const viewBackgroundColor = (_a = scene.appState) == null ? void 0 : _a.viewBackgroundColor;
  return sinRuidoDeFuentes(
    () => exportToBlob({
      elements,
      appState: {
        exportBackground: (opts == null ? void 0 : opts.background) ?? true,
        exportWithDarkMode: (opts == null ? void 0 : opts.darkMode) ?? false,
        viewBackgroundColor
      },
      files: (opts == null ? void 0 : opts.files) ?? restored.files ?? {},
      exportingFrame: (opts == null ? void 0 : opts.pageIndex) === void 0 ? null : pages[opts.pageIndex] ?? null,
      ...(opts == null ? void 0 : opts.maxWidthOrHeight) ? { maxWidthOrHeight: opts.maxWidthOrHeight } : { getDimensions: dimensions({ scale: 1 }) },
      mimeType: "image/png"
    })
  );
}
function storedScenePageCount(scene) {
  if (!Array.isArray(scene.elements)) return 0;
  return scene.elements.filter(
    (e) => (e == null ? void 0 : e.type) === "frame" && !e.isDeleted
  ).length;
}
function captureThumbnail(api, opts) {
  var _a;
  const pageId = (opts == null ? void 0 : opts.pageId) ?? ((_a = frames$2(api)[0]) == null ? void 0 : _a.id);
  return exportScenePng(api, {
    pageId,
    scale: 1,
    maxWidthOrHeight: (opts == null ? void 0 : opts.maxSize) ?? 512,
    background: true
  });
}
function downloadBlob(blob, filename) {
  const url2 = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url2;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url2), 1e3);
}
async function exportScenePdf(api, opts) {
  const { jsPDF } = await import("jspdf");
  const elements = api.getSceneElements();
  const files = (opts == null ? void 0 : opts.files) ?? api.getFiles();
  const appState = exportAppState(api, opts);
  const targets = frames$2(api).length ? frames$2(api) : [null];
  let doc = null;
  const failures = [];
  for (const frame of targets) {
    try {
      const canvas = await exportToCanvas({
        elements,
        appState,
        files,
        exportingFrame: frame,
        getDimensions: dimensions(opts)
      });
      const w = canvas.width;
      const h = canvas.height;
      const orientation = w >= h ? "landscape" : "portrait";
      if (!doc) {
        doc = new jsPDF({ orientation, unit: "px", format: [w, h], hotfixes: ["px_scaling"] });
      } else {
        doc.addPage([w, h], orientation);
      }
      doc.addImage(canvas, "JPEG", 0, 0, w, h);
    } catch (err) {
      failures.push((frame == null ? void 0 : frame.name) ?? "page");
      console.error("[canvas2] PDF page export failed", frame == null ? void 0 : frame.name, err);
    }
  }
  if (!doc) {
    throw new Error(
      failures.length ? `No se pudo exportar ninguna página (${failures.join(", ")})` : "Nada que exportar"
    );
  }
  return doc.output("blob");
}
const THUMB_WIDTH = 64;
const DEBOUNCE_MS = 600;
function pageFingerprint(api, pageId) {
  return api.getSceneElements().filter((e) => e.id === pageId || e.frameId === pageId).map((e) => `${e.id}:${e.version}`).join(",");
}
function usePageThumbnails(api, opts) {
  const [thumbs, setThumbs] = useState({});
  const stampsRef = useRef({});
  const urlsRef = useRef({});
  const enabled = (opts == null ? void 0 : opts.enabled) ?? true;
  const files = opts == null ? void 0 : opts.files;
  const filesToken = files ? Object.keys(files).sort().join(",") : "";
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => {
    if (!api || !enabled) return;
    let cancelled = false;
    const tick = async () => {
      const files2 = filesRef.current;
      const pages = listPages(api);
      const live = new Set(pages.map((p) => p.id));
      for (const id2 of Object.keys(urlsRef.current)) {
        if (!live.has(id2)) {
          URL.revokeObjectURL(urlsRef.current[id2]);
          delete urlsRef.current[id2];
          delete stampsRef.current[id2];
        }
      }
      for (const page of pages) {
        const stamp = `${pageFingerprint(api, page.id)}|${filesToken}`;
        if (stampsRef.current[page.id] === stamp) continue;
        try {
          const blob = await exportScenePng(api, {
            pageId: page.id,
            maxWidthOrHeight: THUMB_WIDTH,
            background: true,
            ...files2 ? { files: files2 } : {}
          });
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          const prev = urlsRef.current[page.id];
          urlsRef.current[page.id] = next;
          stampsRef.current[page.id] = stamp;
          if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1e3);
        } catch (err) {
          console.warn(
            `[canvas2] miniatura de página fallida (${page.name}) · ficheros hidratados: ${files2 ? Object.keys(files2).length : 0}`,
            err
          );
          stampsRef.current[page.id] = stamp;
        }
      }
      if (!cancelled) setThumbs({ ...urlsRef.current });
    };
    void tick();
    const id = setInterval(() => void tick(), DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [api, enabled, filesToken]);
  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = {};
    },
    []
  );
  return thumbs;
}
const palette = {
  light: {
    bg: "#ffffff",
    fg: "#1a1a1a",
    sub: "#4a4a4f",
    border: "#d7d7da",
    active: "#3a39f5",
    activeFg: "#ffffff",
    hover: "#e2e1e2",
    danger: "var(--color-destructive, #e7000b)",
    dangerFg: "var(--color-state-ink, #ffffff)",
    warnBg: "rgba(138,90,0,0.10)",
    warnBorder: "rgba(138,90,0,0.35)",
    warnText: "#8a5a00"
  },
  // El azul de marca es ilegal sobre negro: #3a39f5 sobre #1a1a1a saca 2,56.
  // En oscuro el acento sube a #6e6ef8.
  dark: {
    bg: "#1b1b1f",
    fg: "#ffffff",
    sub: "#9a9aa2",
    border: "#2c2c32",
    active: "#6e6ef8",
    activeFg: "#0d0d18",
    hover: "#26262b",
    danger: "var(--color-destructive, #ff6467)",
    dangerFg: "var(--color-state-ink, #1a1a1a)",
    warnBg: "rgba(227,163,58,0.12)",
    warnBorder: "rgba(227,163,58,0.35)",
    warnText: "#e3a33a"
  }
};
const PANEL_FONT = 'var(--font-funnel-sans, "Funnel Sans"), "Funnel Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
function Svg({ children, size = 13 }) {
  const style = { display: "block", flexShrink: 0 };
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style,
      "aria-hidden": "true",
      children
    }
  );
}
const ChevronLeftIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M15 18l-6-6 6-6" }) });
const ChevronRightIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M9 18l6-6-6-6" }) });
const DuplicateIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("rect", { x: "9", y: "9", width: "12", height: "12", rx: "1" }),
  /* @__PURE__ */ jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
] });
const LockIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("rect", { x: "3", y: "11", width: "18", height: "11", rx: "1" }),
  /* @__PURE__ */ jsx("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
] });
const UnlockIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("rect", { x: "3", y: "11", width: "18", height: "11", rx: "1" }),
  /* @__PURE__ */ jsx("path", { d: "M7 11V7a5 5 0 0 1 9.9-1" })
] });
const TrashIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M3 6h18" }),
  /* @__PURE__ */ jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }),
  /* @__PURE__ */ jsx("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
] });
const EyeIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" }),
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" })
] });
const EyeOffIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" }),
  /* @__PURE__ */ jsx("path", { d: "M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61" }),
  /* @__PURE__ */ jsx("path", { d: "M2 2l20 20" })
] });
const PlusIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" }) });
const TextIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M4 6V4h16v2" }),
  /* @__PURE__ */ jsx("path", { d: "M12 4v16" }),
  /* @__PURE__ */ jsx("path", { d: "M9 20h6" })
] });
const CoverIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }),
  /* @__PURE__ */ jsx("path", { d: "M16 3h3a2 2 0 0 1 2 2v3" }),
  /* @__PURE__ */ jsx("path", { d: "M8 21H5a2 2 0 0 1-2-2v-3" }),
  /* @__PURE__ */ jsx("path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" })
] });
const StretchIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M3 12h18" }),
  /* @__PURE__ */ jsx("path", { d: "M6 9l-3 3 3 3" }),
  /* @__PURE__ */ jsx("path", { d: "M18 9l3 3-3 3" })
] });
const ImageIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "1" }),
  /* @__PURE__ */ jsx("circle", { cx: "9", cy: "9", r: "2" }),
  /* @__PURE__ */ jsx("path", { d: "M21 15l-5-5L5 21" })
] });
const SquareIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("rect", { x: "4", y: "4", width: "16", height: "16" }) });
const CircleIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }) });
const DiamondIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M12 2l10 10-10 10L2 12Z" }) });
const LineIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M5 19L19 5" }) });
const ArrowIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M5 19L19 5" }),
  /* @__PURE__ */ jsx("path", { d: "M11 5h8v8" })
] });
const DrawIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M3 17c3-6 6 4 9-2s6 2 9-4" }) });
const FrameIcon = () => /* @__PURE__ */ jsx(Svg, { children: /* @__PURE__ */ jsx("path", { d: "M6 2v20M18 2v20M2 6h20M2 18h20" }) });
const AlignLeftIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M4 3v18" }),
  /* @__PURE__ */ jsx("rect", { x: "8", y: "8", width: "10", height: "8" })
] });
const AlignCenterHIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M12 3v4M12 17v4" }),
  /* @__PURE__ */ jsx("rect", { x: "5", y: "7", width: "14", height: "10" })
] });
const AlignRightIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M20 3v18" }),
  /* @__PURE__ */ jsx("rect", { x: "6", y: "8", width: "10", height: "8" })
] });
const AlignTopIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M3 4h18" }),
  /* @__PURE__ */ jsx("rect", { x: "8", y: "8", width: "8", height: "10" })
] });
const AlignCenterVIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M3 12h4M17 12h4" }),
  /* @__PURE__ */ jsx("rect", { x: "7", y: "5", width: "10", height: "14" })
] });
const AlignBottomIcon = () => /* @__PURE__ */ jsxs(Svg, { children: [
  /* @__PURE__ */ jsx("path", { d: "M3 20h18" }),
  /* @__PURE__ */ jsx("rect", { x: "8", y: "6", width: "8", height: "10" })
] });
const FitAllIcon = () => /* @__PURE__ */ jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", children: [
  /* @__PURE__ */ jsx("path", { d: "M9 3H5a2 2 0 0 0-2 2v4" }),
  /* @__PURE__ */ jsx("path", { d: "M15 3h4a2 2 0 0 1 2 2v4" }),
  /* @__PURE__ */ jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2v-4" }),
  /* @__PURE__ */ jsx("path", { d: "M15 21h4a2 2 0 0 0 2-2v-4" })
] });
const DEFAULT_LABELS = {
  library: {
    title: "Biblioteca",
    close: "Cerrar"
  },
  components: {
    title: "Componentes",
    empty: "Aún no hay componentes en este proyecto. Guarda una página como componente desde el menú.",
    insert: "Insertar como página nueva",
    inserted: "Componente insertado",
    insertFailed: "No se pudo insertar el componente",
    save: "Guardar página como componente",
    saved: "Página guardada como componente",
    saveFailed: "No se pudo guardar el componente"
  },
  menu: {
    background: "Fondo de la página",
    backgroundOther: "Otro color…",
    backgroundRemove: "Quitar fondo",
    size: "Tamaño de la página",
    width: "Ancho",
    height: "Alto",
    apply: "Aplicar",
    scaleContent: "Escalar el contenido",
    insertText: "Insertar texto",
    export: "Exportar",
    exporting: "Exportando…",
    exportFailed: "Exportar · falló",
    exportPngPage: "PNG · página actual",
    exportPngAll: "PNG · todas las páginas",
    exportSvg: "SVG · página actual",
    exportPdf: "PDF · todas las páginas",
    toPages: "Convertir en páginas",
    toPagesHint: (count) => `${count} suelto${count === 1 ? "" : "s"}`,
    toPagesDone: (count) => `${count} página${count === 1 ? "" : "s"} creada${count === 1 ? "" : "s"}`
  },
  video: {
    pickFrame: "Elegir fotograma",
    loading: "Cargando vídeo…",
    useFrame: "Usar este",
    saving: "Guardando…",
    cancel: "Cancelar",
    failed: "No se pudo capturar el fotograma",
    unavailable: "El selector de fotograma no está disponible aquí"
  },
  loose: {
    warning: (count) => count === 1 ? "Hay 1 elemento fuera de toda página: no saldrá al exportar ni en la miniatura." : `Hay ${count} elementos fuera de toda página: no saldrán al exportar ni en la miniatura.`,
    adopt: "Meter en esta página",
    dismiss: "Descartar aviso"
  },
  pages: {
    add: "Agregar página después",
    addAtEnd: "Añadir página",
    insertHere: "Insertar página aquí",
    addFailed: "No se pudo crear la página",
    duplicate: "Duplicar página",
    rename: "Renombrar página",
    lock: "Bloquear página",
    unlock: "Desbloquear página",
    delete: "Eliminar página",
    confirmDelete: "¿Eliminar?",
    moveLeft: "Mover a la izquierda",
    moveRight: "Mover a la derecha",
    lastPage: "Es la única página: un diseño no puede quedarse sin ninguna",
    fitAll: "Ver todas las páginas"
  },
  dock: {
    design: "Diseño",
    layers: "Capas",
    components: "Componentes",
    page: "Página",
    brand: "Marca",
    collapse: "Contraer",
    expand: "Desplegar"
  },
  brand: {
    title: "Marca",
    defaultColor: "color por defecto",
    applyToSelection: (color2) => `Aplicar ${color2} a la selección`,
    applied: (count) => `${count} elemento${count === 1 ? "" : "s"}`,
    insertLogo: (label) => `Insertar ${label.toLowerCase()}`,
    logoInserted: "logo insertado",
    logo: "Logo",
    black: "Negro",
    white: "Blanco"
  },
  sizes: {
    "ig-post": "Post 4:5",
    square: "Cuadrado 1:1",
    story: "Story / Reel 9:16",
    landscape: "Horizontal 16:9",
    "yt-thumb": "Miniatura YouTube",
    a4: "A4",
    default: "Lienzo clásico"
  }
};
function mergeLabels(custom) {
  if (!custom) return DEFAULT_LABELS;
  const out = {};
  for (const key of Object.keys(DEFAULT_LABELS)) {
    const base = DEFAULT_LABELS[key];
    const over = custom[key] ?? {};
    const merged = { ...base };
    for (const k of Object.keys(over)) {
      const v = over[k];
      if (v === void 0 || v === null || v === "") continue;
      merged[k] = v;
    }
    out[key] = merged;
  }
  return out;
}
let transparentDragImage = null;
function hideNativeDragImage(e) {
  if (typeof document === "undefined") return;
  if (!transparentDragImage) {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(el);
    transparentDragImage = el;
  }
  try {
    e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
  } catch {
  }
}
function DragPreview({ active, grab, children, radius = 8 }) {
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!active || !grab) return;
    const move = (ev) => {
      const card = cardRef.current;
      if (!card || ev.clientX === 0 && ev.clientY === 0) return;
      card.style.transform = `translate3d(${ev.clientX - grab.x}px, ${ev.clientY - grab.y}px, 0) scale(1.06)`;
    };
    document.addEventListener("dragover", move);
    return () => document.removeEventListener("dragover", move);
  }, [active, grab]);
  if (!mounted || !active || !grab) return null;
  return createPortal(
    /* @__PURE__ */ jsx(
      "div",
      {
        "aria-hidden": true,
        ref: cardRef,
        style: {
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 2e3,
          width: grab.width,
          height: grab.height,
          borderRadius: radius,
          overflow: "hidden",
          pointerEvents: "none",
          boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
          transition: "none",
          willChange: "transform"
        },
        children
      }
    ),
    document.body
  );
}
function pagesSignature(pages) {
  return pages.map((p) => `${p.id}:${p.name}:${p.width}x${p.height}:${p.locked ? 1 : 0}`).join("|");
}
const THUMB_W = 34;
function PageNavigator({
  api,
  theme = "light",
  viewMode = false,
  narrow = false,
  activeId: controlledActiveId,
  onActiveChange,
  labels: labelsProp,
  thumbnails = false,
  thumbnailFiles,
  pageSize
}) {
  const c = palette[theme];
  const L = mergeLabels(labelsProp);
  const [pages, setPages] = useState(() => listPages(api));
  const [localActiveId, setLocalActiveId] = useState(
    () => {
      var _a;
      return ((_a = listPages(api)[0]) == null ? void 0 : _a.id) ?? null;
    }
  );
  const activeId = controlledActiveId !== void 0 ? controlledActiveId : localActiveId;
  const [renaming, setRenaming] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [grab, setGrab] = useState(null);
  const [addFailed, setAddFailed] = useState(false);
  const chipRefs = useRef(/* @__PURE__ */ new Map());
  const pageThumbs = usePageThumbnails(api, { enabled: thumbnails, files: thumbnailFiles });
  const lastElementsRef = useRef(null);
  useEffect(() => {
    const refresh = () => {
      const elements = api.getSceneElements();
      if (elements === lastElementsRef.current) return;
      lastElementsRef.current = elements;
      setPages((prev) => {
        const next = listPages(api);
        return pagesSignature(prev) === pagesSignature(next) ? prev : next;
      });
    };
    lastElementsRef.current = null;
    refresh();
    const unsubscribe = api.onChange(refresh);
    return unsubscribe;
  }, [api]);
  useEffect(() => {
    var _a;
    if (!activeId) return;
    (_a = chipRefs.current.get(activeId)) == null ? void 0 : _a.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId]);
  const select = (id) => {
    setLocalActiveId(id);
    onActiveChange == null ? void 0 : onActiveChange(id);
    goToPage(api, id);
  };
  const createPage = (size, opts) => {
    try {
      setAddFailed(false);
      select(addPage(api, size, opts));
    } catch (err) {
      console.error("[canvas2] no se ha podido crear la página", err);
      setAddFailed(true);
    }
  };
  const startRename = (page) => setRenaming({ id: page.id, value: page.name });
  const commitRename = () => {
    if (renaming && renaming.value.trim()) renamePage(api, renaming.id, renaming.value.trim());
    setRenaming(null);
  };
  const ultima = pages[pages.length - 1];
  const ghostRatio = ultima ? { width: ultima.width, height: ultima.height } : pageSize ?? { width: 1080, height: 1350 };
  const inputStyle = {
    width: 64,
    padding: "4px 6px",
    borderRadius: 6,
    border: `1px solid ${c.border}`,
    background: "transparent",
    color: c.fg,
    fontSize: 12,
    fontFamily: PANEL_FONT
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-canvas2-pages": "",
      style: {
        position: "absolute",
        // 16 se solapaba con la isla inferior de Excalidraw en su distribución
        // de móvil: medido en un iPhone de 390, la isla ocupa de y=781 a y=830 y
        // la tira iba de 745 a 829 — encima, y además con más z-index, así que
        // la tapaba. 74 la deja justo por arriba.
        bottom: narrow ? 74 : 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 4,
        maxWidth: "min(920px, 94%)",
        padding: 6,
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        fontFamily: PANEL_FONT
      },
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              // Sin hueco propio: la separación entre páginas la pone el insertor
              // (10px) más el relleno de cada ficha. Con `gap` además, dos páginas
              // acababan a 24px una de otra y la tira se leía como una lista suelta.
              gap: 0,
              minWidth: 0,
              overflowX: "auto"
            },
            children: [
              pages.map((page) => {
                const isActive = page.id === activeId;
                const isRenaming = (renaming == null ? void 0 : renaming.id) === page.id;
                const thumb = pageThumbs[page.id];
                const gap = !viewMode ? (
                  // Juntura ANTES de esta página: en reposo es un hueco de 12px y al
                  // pasar el ratón enseña el "+". Es el camino para insertar EN MEDIO,
                  // que antes obligaba a crear al final y arrastrar hasta su sitio.
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      className: "canvas2-page-insert",
                      "data-testid": "canvas2-insert-page",
                      "aria-label": L.pages.insertHere,
                      title: L.pages.insertHere,
                      onClick: () => createPage({ width: page.width, height: page.height }, { beforePageId: page.id }),
                      style: {
                        all: "unset",
                        alignSelf: "stretch",
                        flexShrink: 0,
                        width: 10,
                        cursor: "pointer",
                        display: "grid",
                        placeContent: "center",
                        position: "relative"
                      },
                      children: /* @__PURE__ */ jsx(
                        "span",
                        {
                          "aria-hidden": "true",
                          style: {
                            width: 15,
                            height: 15,
                            borderRadius: "50%",
                            background: c.active,
                            color: c.activeFg,
                            display: "grid",
                            placeContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1,
                            // Invisible en reposo: la tira tiene que leerse como una fila de
                            // páginas, no como una fila de botones entre páginas.
                            opacity: 0,
                            transform: "scale(0.6)",
                            transition: "opacity 120ms ease, transform 120ms ease"
                          },
                          children: "+"
                        }
                      )
                    },
                    `gap-${page.id}`
                  )
                ) : null;
                const thumbH = Math.round(THUMB_W * (page.height / Math.max(1, page.width)));
                const isDropTarget = dragOverId === page.id && draggingId !== page.id;
                return /* @__PURE__ */ jsxs(Fragment, { children: [
                  gap,
                  /* @__PURE__ */ jsxs(
                    "div",
                    {
                      ref: (el) => {
                        if (el) chipRefs.current.set(page.id, el);
                        else chipRefs.current.delete(page.id);
                      },
                      role: "button",
                      tabIndex: 0,
                      title: page.name,
                      draggable: !viewMode && !isRenaming,
                      onDragStart: (e) => {
                        setDraggingId(page.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", page.id);
                        const box = e.currentTarget.getBoundingClientRect();
                        setGrab({
                          x: e.clientX - box.left,
                          y: e.clientY - box.top,
                          width: box.width,
                          height: box.height
                        });
                        hideNativeDragImage(e);
                      },
                      onDragOver: (e) => {
                        if (!draggingId || draggingId === page.id) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverId(page.id);
                      },
                      onDragLeave: () => setDragOverId((prev) => prev === page.id ? null : prev),
                      onDrop: (e) => {
                        e.preventDefault();
                        if (draggingId && draggingId !== page.id) {
                          movePageTo(api, draggingId, page.index);
                          select(draggingId);
                        }
                        setDraggingId(null);
                        setDragOverId(null);
                        setGrab(null);
                      },
                      onDragEnd: () => {
                        setDraggingId(null);
                        setDragOverId(null);
                        setGrab(null);
                      },
                      onClick: () => select(page.id),
                      onDoubleClick: (e) => {
                        if (viewMode) return;
                        e.stopPropagation();
                        startRename(page);
                      },
                      onKeyDown: (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(page.id);
                        }
                      },
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        cursor: draggingId === page.id ? "grabbing" : "pointer",
                        padding: 4,
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0,
                        color: c.fg,
                        // La página activa se distingue SOLO por opacidad: la miniatura ya
                        // es el contenido, y un fondo de color encima competía con ella.
                        opacity: draggingId === page.id ? 0.3 : isActive ? 1 : 0.45,
                        // El destino de un arrastre se marca con un filo, no moviendo las
                        // páginas: que la tira baile mientras arrastras hace imposible
                        // apuntar. Se queda en gris, como el resto de la tira.
                        boxShadow: isDropTarget ? `inset 3px 0 0 ${c.fg}` : "none",
                        transition: "opacity 120ms ease"
                      },
                      children: [
                        /* @__PURE__ */ jsxs(
                          "div",
                          {
                            style: {
                              position: "relative",
                              width: THUMB_W,
                              height: thumbH,
                              borderRadius: 3,
                              border: `1px solid ${c.border}`,
                              background: c.hover,
                              overflow: "hidden",
                              flexShrink: 0
                            },
                            children: [
                              thumb ? (
                                // Es un <img> a secas y no next/image a propósito: el paquete no
                                // depende de Next, y la fuente es un blob URL local.
                                /* @__PURE__ */ jsx(
                                  "img",
                                  {
                                    src: thumb,
                                    alt: "",
                                    style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }
                                  }
                                )
                              ) : null,
                              page.locked && // El candado va sobre la miniatura: es ESTADO de la página y hay
                              // que verlo sin tener que activarla primero.
                              /* @__PURE__ */ jsx(
                                "span",
                                {
                                  style: {
                                    position: "absolute",
                                    right: 1,
                                    bottom: 1,
                                    display: "inline-flex",
                                    color: c.fg,
                                    background: c.bg,
                                    borderRadius: 3,
                                    padding: 1,
                                    lineHeight: 0
                                  },
                                  children: /* @__PURE__ */ jsx(LockIcon, {})
                                }
                              )
                            ]
                          }
                        ),
                        isRenaming ? /* @__PURE__ */ jsx(
                          "input",
                          {
                            autoFocus: true,
                            value: renaming.value,
                            onClick: (e) => e.stopPropagation(),
                            onChange: (e) => setRenaming({ id: page.id, value: e.target.value }),
                            onKeyDown: (e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") setRenaming(null);
                            },
                            onBlur: commitRename,
                            style: { ...inputStyle, width: THUMB_W + 24 }
                          }
                        ) : /* @__PURE__ */ jsx("span", { children: page.index + 1 })
                      ]
                    }
                  )
                ] }, page.id);
              }),
              !viewMode && /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  "data-testid": "canvas2-add-page",
                  "aria-label": L.pages.addAtEnd,
                  title: L.pages.addAtEnd,
                  onClick: () => {
                    const last = pages[pages.length - 1];
                    createPage(last ? { width: last.width, height: last.height } : pageSize);
                  },
                  style: {
                    all: "unset",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: 4,
                    borderRadius: 8,
                    color: c.sub,
                    fontSize: 11,
                    fontWeight: 600
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "canvas2-page-ghost",
                        style: {
                          width: THUMB_W,
                          height: Math.round(THUMB_W * (ghostRatio.height / Math.max(1, ghostRatio.width))),
                          borderRadius: 3,
                          border: `1.5px dashed ${c.border}`,
                          display: "grid",
                          placeContent: "center",
                          lineHeight: 0
                        },
                        children: /* @__PURE__ */ jsx(PlusIcon, {})
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: pages.length + 1 })
                  ]
                }
              )
            ]
          }
        ),
        pages.length > 1 && /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              paddingLeft: 8,
              marginLeft: 6,
              borderLeft: `1px solid ${c.border}`
            },
            children: /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                "aria-label": L.pages.fitAll,
                title: L.pages.fitAll,
                onClick: () => fitAllPages(api),
                style: {
                  all: "unset",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 5px",
                  borderRadius: 6,
                  color: c.sub
                },
                children: /* @__PURE__ */ jsx(FitAllIcon, {})
              }
            )
          }
        ),
        addFailed && /* @__PURE__ */ jsx(
          "div",
          {
            role: "status",
            "data-testid": "canvas2-add-page-failed",
            style: {
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 6,
              whiteSpace: "nowrap",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: c.dangerFg,
              background: c.danger
            },
            children: L.pages.addFailed
          }
        ),
        /* @__PURE__ */ jsx(DragPreview, { active: Boolean(draggingId), grab, radius: 8, children: (() => {
          const page = pages.find((p) => p.id === draggingId);
          if (!page) return null;
          const thumb = pageThumbs[page.id];
          return /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: 4,
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: PANEL_FONT,
                boxSizing: "border-box"
              },
              children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      width: THUMB_W,
                      height: Math.round(THUMB_W * (page.height / Math.max(1, page.width))),
                      borderRadius: 3,
                      border: `1px solid ${c.border}`,
                      background: c.hover,
                      overflow: "hidden"
                    },
                    children: thumb ? /* @__PURE__ */ jsx(
                      "img",
                      {
                        src: thumb,
                        alt: "",
                        style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }
                      }
                    ) : null
                  }
                ),
                /* @__PURE__ */ jsx("span", { children: page.index + 1 })
              ]
            }
          );
        })() })
      ]
    }
  );
}
function boxOf(el) {
  const width = Math.abs(el.width);
  const height = Math.abs(el.height);
  return {
    x: el.width < 0 ? el.x + el.width : el.x,
    y: el.height < 0 ? el.y + el.height : el.y,
    width,
    height
  };
}
function unionBox(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}
function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function looseElements(elements) {
  return elements.filter((e) => e.type !== "frame" && !e.frameId);
}
const SATELLITE_REACH = 0.25;
const SATELLITE_MAX_AREA = 0.15;
function absorbSatellites(groups, boxes) {
  if (groups.size < 2) return;
  const entries = [...groups.entries()].map(([root, indices]) => ({
    root,
    indices,
    box: unionBox(indices.map((i) => boxes[i]))
  }));
  const areas = entries.map((e) => e.box.width * e.box.height);
  const maxArea = Math.max(...areas);
  if (maxArea <= 0) return;
  const anfitriones = entries.filter((_, i) => areas[i] >= maxArea * SATELLITE_MAX_AREA);
  const satelites = entries.filter((_, i) => areas[i] < maxArea * SATELLITE_MAX_AREA);
  if (anfitriones.length === 0 || satelites.length === 0) return;
  const centro = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  for (const satelite of satelites) {
    const c = centro(satelite.box);
    let elegido = null;
    let mejor = Infinity;
    for (const anfitrion of anfitriones) {
      const { box } = anfitrion;
      const margenX = box.width * SATELLITE_REACH;
      const margenY = box.height * SATELLITE_REACH;
      const alcanza = c.x >= box.x - margenX && c.x <= box.x + box.width + margenX && c.y >= box.y - margenY && c.y <= box.y + box.height + margenY;
      if (!alcanza) continue;
      const h = centro(box);
      const d = (c.x - h.x) ** 2 + (c.y - h.y) ** 2;
      if (d < mejor) {
        mejor = d;
        elegido = anfitrion;
      }
    }
    if (!elegido) continue;
    elegido.indices.push(...satelite.indices);
    groups.delete(satelite.root);
  }
}
function clusterLooseElements(loose) {
  if (loose.length === 0) return [];
  const parent = loose.map((_, i) => i);
  const find = (i) => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let cur = i;
    while (parent[cur] !== root) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const indexById = new Map(loose.map((e, i) => [e.id, i]));
  const byGroup = /* @__PURE__ */ new Map();
  loose.forEach((el, i) => {
    const container = el.containerId;
    if (container) {
      const j = indexById.get(container);
      if (j !== void 0) union(i, j);
    }
    for (const gid of el.groupIds ?? []) {
      const bucket = byGroup.get(gid);
      if (bucket) bucket.push(i);
      else byGroup.set(gid, [i]);
    }
  });
  for (const bucket of byGroup.values()) {
    for (let k = 1; k < bucket.length; k += 1) union(bucket[0], bucket[k]);
  }
  const boxes = loose.map(boxOf);
  for (let i = 0; i < loose.length; i += 1) {
    for (let j = i + 1; j < loose.length; j += 1) {
      if (find(i) !== find(j) && overlaps(boxes[i], boxes[j])) union(i, j);
    }
  }
  const groups = /* @__PURE__ */ new Map();
  loose.forEach((_, i) => {
    const root = find(i);
    const bucket = groups.get(root);
    if (bucket) bucket.push(i);
    else groups.set(root, [i]);
  });
  absorbSatellites(groups, boxes);
  const clusters = [...groups.values()].map((indices) => ({
    elements: indices.map((i) => loose[i]),
    box: unionBox(indices.map((i) => boxes[i]))
  }));
  clusters.sort((a, b) => a.box.y - b.box.y);
  const rows = [];
  for (const cluster of clusters) {
    const row = rows[rows.length - 1];
    if (row && cluster.box.y < row.bottom) {
      row.items.push(cluster);
      row.bottom = Math.max(row.bottom, cluster.box.y + cluster.box.height);
    } else {
      rows.push({ bottom: cluster.box.y + cluster.box.height, items: [cluster] });
    }
  }
  return rows.flatMap(
    (row) => row.items.sort((a, b) => a.box.x - b.box.x).map((c) => c.elements)
  );
}
const PAPER_COLOR = "#ffffff";
function paginateSceneInArray(elements, opts = {}) {
  var _a;
  const existingFrames = elements.filter((e) => e.type === "frame").slice().sort((a, b) => a.x - b.x);
  const loose = looseElements(elements);
  const clusters = clusterLooseElements(loose);
  if (clusters.length === 0) {
    const order2 = existingFrames.map((f) => f.id);
    let next2 = packPagesInArray(elements, order2);
    next2 = renumberPagesInArray(next2, order2);
    return { elements: next2, created: 0, total: existingFrames.length };
  }
  const boxes = clusters.map((c) => unionBox(c.map(boxOf)));
  const pageSize = opts.pageSize ?? {
    width: Math.round(Math.max(...boxes.map((b) => b.width))),
    height: Math.round(Math.max(...boxes.map((b) => b.height)))
  };
  const y = ((_a = existingFrames[0]) == null ? void 0 : _a.y) ?? 0;
  let cursor = existingFrames.length ? Math.max(...existingFrames.map((f) => f.x + f.width)) + PAGE_GAP : 0;
  const looseIds = new Set(loose.map((e) => e.id));
  const out = elements.filter((e) => !looseIds.has(e.id));
  const newFrameIds = [];
  clusters.forEach((cluster, index) => {
    const box = boxes[index];
    const x = cursor;
    cursor += pageSize.width + PAGE_GAP;
    const skeleton = [
      {
        type: "frame",
        name: `Página ${existingFrames.length + index + 1}`,
        x,
        y,
        width: pageSize.width,
        height: pageSize.height,
        children: []
      }
    ];
    const [frame] = convertToExcalidrawElements(skeleton, {
      regenerateIds: true
    });
    newFrameIds.push(frame.id);
    const encaje = Math.min(pageSize.width / box.width, pageSize.height / box.height);
    const k = opts.scaleUp ? encaje : Math.min(1, encaje);
    const offsetX = x + (pageSize.width - box.width * k) / 2;
    const offsetY = y + (pageSize.height - box.height * k) / 2;
    const members = cluster.map((el) => {
      const elBox = boxOf(el);
      const updates = {
        frameId: frame.id,
        x: offsetX + (elBox.x - box.x) * k,
        y: offsetY + (elBox.y - box.y) * k
      };
      if (k !== 1) {
        updates.width = Math.max(1, elBox.width * k);
        updates.height = Math.max(1, elBox.height * k);
        const fontSize = el.fontSize;
        if (el.type === "text" && typeof fontSize === "number") {
          updates.fontSize = Math.max(4, fontSize * k);
        }
      }
      return patchElement(el, updates);
    });
    out.push(
      frame,
      ...buildPageBackground(frame.id, { x, y, ...pageSize }, opts.paperColor ?? PAPER_COLOR),
      ...members
    );
  });
  const order = [...existingFrames.map((f) => f.id), ...newFrameIds];
  let next = packPagesInArray(out, order);
  next = renumberPagesInArray(next, order);
  return { elements: next, created: clusters.length, total: order.length };
}
function convertToPages(api, opts = {}) {
  const elements = api.getSceneElements();
  const result = paginateSceneInArray(elements, opts);
  if (result.elements !== elements) {
    commitElements(api, result.elements, opts.capture ?? "undoable");
  }
  return { created: result.created, total: result.total };
}
function adoptLooseIntoPage(api, pageId, opts = {}) {
  const elements = api.getSceneElements();
  if (!elements.some((e) => e.id === pageId && e.type === "frame")) return 0;
  const filtro = opts.only ? new Set(opts.only) : null;
  const objetivo = new Set(
    looseElements(elements).filter((e) => !filtro || filtro.has(e.id)).map((e) => e.id)
  );
  if (!objetivo.size) return 0;
  for (const e of elements) {
    const contenedor = e.containerId;
    if (contenedor && objetivo.has(contenedor)) objetivo.add(e.id);
  }
  let movidos = 0;
  const siguiente = elements.map((e) => {
    if (!objetivo.has(e.id) || e.type === "frame") return e;
    movidos += 1;
    return { ...e, frameId: pageId, version: e.version + 1 };
  });
  if (!movidos) return 0;
  commitElements(api, siguiente, opts.capture ?? "undoable");
  return movidos;
}
function LooseWarning({ api, activePageId, theme, viewMode, labels }) {
  const L = mergeLabels(labels);
  const c = palette[theme ?? "light"];
  const [loose, setLoose] = useState(0);
  const [dismissedAt, setDismissedAt] = useState(null);
  useEffect(() => {
    if (!api) return;
    const refresh = () => setLoose(looseElements(api.getSceneElements()).length);
    refresh();
    return api.onChange(refresh);
  }, [api]);
  if (!api || viewMode || loose === 0 || loose === dismissedAt) return null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": "canvas2-loose-warning",
      style: {
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 6,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        borderRadius: 8,
        border: `1px solid ${c.warnBorder}`,
        background: c.warnBg,
        color: c.warnText,
        fontSize: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        maxWidth: "min(560px, 90vw)"
      },
      children: [
        /* @__PURE__ */ jsx("span", { style: { lineHeight: 1.35 }, children: L.loose.warning(loose) }),
        activePageId ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => adoptLooseIntoPage(api, activePageId),
            style: {
              flexShrink: 0,
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${c.warnBorder}`,
              background: "transparent",
              color: "inherit",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            },
            children: L.loose.adopt
          }
        ) : null,
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            "aria-label": L.loose.dismiss,
            title: L.loose.dismiss,
            onClick: () => setDismissedAt(loose),
            style: {
              flexShrink: 0,
              border: "none",
              background: "transparent",
              color: "inherit",
              fontSize: 15,
              lineHeight: 1,
              cursor: "pointer",
              opacity: 0.7
            },
            children: "×"
          }
        )
      ]
    }
  );
}
function isInlineDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:");
}
function createFileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `file_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
function frames$1(api) {
  return api.getSceneElements().filter((e) => e.type === "frame").slice().sort((a, b) => a.x - b.x);
}
const IMAGE_LOAD_TIMEOUT_MS = 2e4;
function loadImageSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const stop = () => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    const timer = setTimeout(() => {
      stop();
      img.src = "";
      reject(new Error("La imagen tardó demasiado en cargar"));
    }, IMAGE_LOAD_TIMEOUT_MS);
    img.onload = () => {
      stop();
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error("La imagen no tiene dimensiones utilizables"));
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      stop();
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = src;
  });
}
function pageAtPoint(pages, at) {
  return pages.find(
    (f) => at.x >= f.x && at.x <= f.x + f.width && at.y >= f.y && at.y <= f.y + f.height
  ) ?? null;
}
function resolvePage(api, opts) {
  const pages = frames$1(api);
  return ((opts == null ? void 0 : opts.at) ? pageAtPoint(pages, opts.at) : null) || ((opts == null ? void 0 : opts.pageId) ? pages.find((f) => f.id === opts.pageId) : null) || pages[0] || null;
}
function resolveInsertPageId(api, opts) {
  var _a;
  return ((_a = resolvePage(api, opts)) == null ? void 0 : _a.id) ?? null;
}
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
function cascadePoints(api, at, count) {
  if (count <= 1) return [at];
  const page = resolvePage(api, { at });
  const box = page ? { x: page.x, y: page.y, w: page.width, h: page.height } : { x: at.x - 400, y: at.y - 300, w: 800, h: 600 };
  const step = Math.min(box.w, box.h) * 0.04;
  const dx = at.x > box.x + box.w / 2 ? -step : step;
  const dy = at.y > box.y + box.h / 2 ? -step : step;
  return Array.from({ length: count }, (_, i) => ({ x: at.x + dx * i, y: at.y + dy * i }));
}
function imageAtScenePoint(api, at) {
  const elements = api.getSceneElements();
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i];
    if (el.type !== "image" || el.isDeleted || !el.fileId) continue;
    if (at.x >= el.x && at.x <= el.x + el.width && at.y >= el.y && at.y <= el.y + el.height) {
      return { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height };
    }
  }
  return null;
}
function dataUrlToBlob(dataUrl) {
  var _a;
  const [header, payload] = dataUrl.split(",");
  const mime = ((_a = /data:([^;]+)/.exec(header)) == null ? void 0 : _a[1]) ?? "application/octet-stream";
  if (!/;base64/i.test(header)) {
    return new Blob([decodeURIComponent(payload ?? "")], { type: mime });
  }
  const binary = atob(payload ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
function insertImageByReference(api, file, opts) {
  var _a;
  const fileId = createFileId();
  const mimeType = ((_a = file.mimeType) == null ? void 0 : _a.startsWith("image/")) ? file.mimeType : "image/png";
  api.addFiles([
    { id: fileId, dataURL: file.url, mimeType, created: Date.now() }
  ]);
  const target = resolvePage(api, opts);
  const box = target ? { x: target.x, y: target.y, w: target.width, h: target.height } : { x: 0, y: 0, w: 800, h: 600 };
  const fit = Math.min(box.w * 0.9 / file.width, box.h * 0.9 / file.height, 1);
  const w = Math.max(1, file.width * fit);
  const h = Math.max(1, file.height * fit);
  const x = (opts == null ? void 0 : opts.at) ? clamp(opts.at.x - w / 2, box.x, box.x + box.w - w) : box.x + (box.w - w) / 2;
  const y = (opts == null ? void 0 : opts.at) ? clamp(opts.at.y - h / 2, box.y, box.y + box.h - h) : box.y + (box.h - h) / 2;
  const skeleton = [
    { type: "image", fileId, x, y, width: w, height: h, status: "saved" }
  ];
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map(
    (el) => target ? { ...el, frameId: target.id } : el
  );
  const elementId = created[0].id;
  commitElements(
    api,
    [...api.getSceneElements(), ...created],
    "undoable",
    // Seleccionada al entrar: lo que se acaba de insertar es justo lo que se va
    // a mover o redimensionar, y sin selección hay que ir a cazarla con el ratón
    // (y en una página llena, encontrarla).
    { selectedElementIds: { [elementId]: true } }
  );
  return elementId;
}
async function insertImageFromUrl(api, url2, opts) {
  if (isInlineDataUrl(url2)) {
    throw new Error(
      "insertImageFromUrl recibió un data: URL. Los bytes van a MediaMonster; usa insertImageFromBlob."
    );
  }
  const { width, height } = await loadImageSize(url2);
  const mimeType = url2.endsWith(".webp") ? "image/webp" : url2.endsWith(".png") ? "image/png" : "image/jpeg";
  return insertImageByReference(api, { url: url2, mimeType, width, height }, opts);
}
async function insertImageFromBlob(api, blob, uploader, opts) {
  if (typeof uploader !== "function") {
    throw new Error("insertImageFromBlob requiere un MediaUploader: las imágenes van a MediaMonster.");
  }
  const url2 = await uploader(blob, (opts == null ? void 0 : opts.filename) ?? `canvas-${Date.now()}.png`);
  if (isInlineDataUrl(url2)) {
    throw new Error("El MediaUploader devolvió un data: URL en vez de una URL de MediaMonster.");
  }
  return insertImageFromUrl(api, url2, opts);
}
async function replaceImageFromUrl(api, elementId, url2) {
  if (isInlineDataUrl(url2)) {
    throw new Error(
      "replaceImageFromUrl recibió un data: URL. Los bytes van a MediaMonster; sube primero."
    );
  }
  const previo = api.getSceneElements().find((e) => e.id === elementId);
  if (!previo || previo.type !== "image") return false;
  const { width, height } = await loadImageSize(url2);
  const mimeType = url2.endsWith(".webp") ? "image/webp" : url2.endsWith(".png") ? "image/png" : "image/jpeg";
  const fileId = createFileId();
  api.addFiles([
    { id: fileId, dataURL: url2, mimeType, created: Date.now() }
  ]);
  const fit = Math.min(previo.width / width, previo.height / height);
  const w = Math.max(1, width * fit);
  const h = Math.max(1, height * fit);
  const x = previo.x + (previo.width - w) / 2;
  const y = previo.y + (previo.height - h) / 2;
  commitElements(
    api,
    api.getSceneElements().map(
      (el) => el.id === elementId ? patchElement(el, { fileId, x, y, width: w, height: h }) : el
    ),
    "undoable",
    { selectedElementIds: { [elementId]: true } }
  );
  return true;
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
}
async function insertImageWithPreview(api, blob, uploader, opts) {
  if (typeof uploader !== "function") {
    throw new Error("insertImageWithPreview requiere un MediaUploader: las imágenes van a MediaMonster.");
  }
  const filename = (opts == null ? void 0 : opts.filename) ?? `canvas-${Date.now()}.png`;
  const local = await blobToDataUrl(blob);
  const { width, height } = await loadImageSize(local);
  const elementId = insertImageByReference(
    api,
    { url: local, mimeType: blob.type || "image/png", width, height },
    opts
  );
  let url2;
  try {
    url2 = await uploader(blob, filename);
    if (isInlineDataUrl(url2)) {
      throw new Error("El MediaUploader devolvió un data: URL en vez de una URL de MediaMonster.");
    }
  } catch (e) {
    commitElements(
      api,
      api.getSceneElements().filter((el) => el.id !== elementId),
      "never"
    );
    throw e;
  }
  const fileId = createFileId();
  api.addFiles([
    { id: fileId, dataURL: url2, mimeType: blob.type || "image/png", created: Date.now() }
  ]);
  commitElements(
    api,
    api.getSceneElements().map(
      (el) => el.id === elementId ? patchElement(el, { fileId }) : el
    ),
    "never"
  );
  return elementId;
}
function findInlineImageIds(files) {
  return Object.values(files ?? {}).filter((f) => f && isInlineDataUrl(f.dataURL)).map((f) => f.id);
}
async function externalizeInlineImages(api, uploader) {
  var _a;
  const files = api.getFiles() ?? {};
  const inline = Object.values(files).filter((f) => f && isInlineDataUrl(f.dataURL));
  if (inline.length === 0) return { externalized: 0, failed: [] };
  const remap = /* @__PURE__ */ new Map();
  const failed = [];
  for (const file of inline) {
    try {
      const blob = dataUrlToBlob(file.dataURL);
      const ext = (((_a = file.mimeType) == null ? void 0 : _a.split("/")[1]) ?? "png").replace(/[^a-z0-9]/gi, "");
      const url2 = await uploader(blob, `canvas-${file.id}.${ext}`);
      if (isInlineDataUrl(url2)) throw new Error("el uploader devolvió un data: URL");
      const newId = createFileId();
      api.addFiles([
        { id: newId, dataURL: url2, mimeType: file.mimeType, created: Date.now() }
      ]);
      remap.set(file.id, newId);
    } catch {
      failed.push(file.id);
    }
  }
  if (remap.size > 0) {
    const next = api.getSceneElements().map((el) => {
      const current = el.fileId;
      const replacement = current ? remap.get(current) : void 0;
      return replacement ? patchElement(el, { fileId: replacement }) : el;
    });
    commitElements(api, next, "never");
  }
  return { externalized: remap.size, failed };
}
function buildPersistableFiles(elements, files) {
  const source = files ?? {};
  const referenced = /* @__PURE__ */ new Set();
  for (const el of elements) {
    if (el.isDeleted) continue;
    const fileId = el.fileId;
    if (typeof fileId === "string" && fileId) referenced.add(fileId);
  }
  const out = {};
  const inline = [];
  for (const id of referenced) {
    const file = source[id];
    if (!file) continue;
    out[id] = file;
    if (isInlineDataUrl(file.dataURL)) inline.push(id);
  }
  return { files: out, inline };
}
const VIDEO_MARKER = "video";
function readMeta(el) {
  const data = el.customData;
  if (!data || typeof data !== "object") return null;
  const meta = data;
  if (meta.c2 !== VIDEO_MARKER || typeof meta.src !== "string" || !meta.src) return null;
  return meta;
}
function isVideoElement(el) {
  return readMeta(el) !== null;
}
function getVideoMeta(api, elementId) {
  const el = api.getSceneElements().find((e) => e.id === elementId);
  return el ? readMeta(el) : null;
}
function getSelectedVideo(api) {
  if (!api) return null;
  const seleccion = Object.keys(
    api.getAppState().selectedElementIds ?? {}
  );
  if (seleccion.length !== 1) return null;
  const el = api.getSceneElements().find((e) => e.id === seleccion[0]);
  if (!el) return null;
  const meta = readMeta(el);
  return meta ? { id: el.id, meta } : null;
}
async function insertVideo(api, posterUrl, videoSrc, opts = {}) {
  const id = await insertImageFromUrl(api, posterUrl, opts);
  const meta = {
    c2: VIDEO_MARKER,
    src: videoSrc,
    mediaFileId: opts.mediaFileId ?? null,
    posterTime: opts.posterTime ?? 0,
    durationSec: opts.durationSec ?? null,
    name: opts.name ?? null
  };
  const elements = api.getSceneElements();
  commitElements(
    api,
    elements.map(
      (e) => e.id === id ? { ...e, customData: meta, version: e.version + 1 } : e
    )
  );
  return id;
}
function setVideoPoster(api, elementId, poster) {
  const elements = api.getSceneElements();
  const el = elements.find((e) => e.id === elementId);
  const meta = el ? readMeta(el) : null;
  if (!el || !meta) return false;
  const fileId = `c2v_${elementId}_${Math.round(poster.timeSec * 1e3)}`;
  api.addFiles([
    {
      id: fileId,
      mimeType: poster.mimeType ?? "image/webp",
      dataURL: poster.url,
      created: 0,
      lastRetrieved: 0
    }
  ]);
  commitElements(
    api,
    elements.map(
      (e) => e.id === elementId ? {
        ...e,
        fileId,
        status: "saved",
        customData: { ...meta, posterTime: poster.timeSec },
        version: e.version + 1
        // Vía `unknown`: `fileId` solo existe en el elemento imagen y el
        // tipo unión de Excalidraw no lo admite en un literal, aunque en
        // ejecución el elemento SEA una imagen (lo garantiza `readMeta`).
      } : e
    )
  );
  return true;
}
function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function VideoFramePicker({
  api,
  theme,
  viewMode,
  labels,
  resolveVideoSrc,
  releaseVideoSrc,
  onPickFrame
}) {
  const L = mergeLabels(labels);
  const c = palette[theme ?? "light"];
  const videoRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [duracion, setDuracion] = useState(0);
  const [tiempo, setTiempo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [src, setSrc] = useState(null);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    if (!api) return;
    const refresh = () => setSelected(getSelectedVideo(api));
    refresh();
    return api.onChange(refresh);
  }, [api]);
  useEffect(() => {
    setAbierto(false);
    setFallo(false);
    setTiempo((selected == null ? void 0 : selected.meta.posterTime) ?? 0);
  }, [selected == null ? void 0 : selected.id]);
  const videoSrcOrigen = (selected == null ? void 0 : selected.meta.src) ?? null;
  useEffect(() => {
    if (!abierto || !videoSrcOrigen || !resolveVideoSrc) return;
    const ctrl = new AbortController();
    let resuelto = null;
    let vivo = true;
    setCargando(true);
    setFallo(false);
    resolveVideoSrc(videoSrcOrigen, ctrl.signal).then((url2) => {
      resuelto = url2;
      if (vivo) setSrc(url2);
      else releaseVideoSrc == null ? void 0 : releaseVideoSrc(url2);
    }).catch(() => {
      if (vivo) setFallo(true);
    }).finally(() => {
      if (vivo) setCargando(false);
    });
    return () => {
      vivo = false;
      ctrl.abort();
      setSrc(null);
      if (resuelto) releaseVideoSrc == null ? void 0 : releaseVideoSrc(resuelto);
    };
  }, [abierto, videoSrcOrigen, resolveVideoSrc, releaseVideoSrc]);
  if (!api || viewMode || !selected) return null;
  const puedeElegir = Boolean(onPickFrame && resolveVideoSrc);
  const confirmar = async () => {
    const video = videoRef.current;
    if (!video || !onPickFrame) return;
    setGuardando(true);
    setFallo(false);
    try {
      const poster = await onPickFrame(video, video.currentTime);
      if (!poster) {
        setFallo(true);
        return;
      }
      setVideoPoster(api, selected.id, {
        url: poster.url,
        timeSec: video.currentTime,
        mimeType: poster.mimeType
      });
      setAbierto(false);
    } finally {
      setGuardando(false);
    }
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-testid": "canvas2-video-frame",
      style: {
        position: "absolute",
        left: 12,
        bottom: 96,
        zIndex: 7,
        width: abierto ? 280 : void 0,
        padding: abierto ? 10 : "6px 10px",
        borderRadius: 10,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        fontFamily: PANEL_FONT,
        fontSize: 12
      },
      children: !abierto ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setAbierto(true),
          disabled: !puedeElegir,
          title: puedeElegir ? L.video.pickFrame : L.video.unavailable,
          style: {
            all: "unset",
            cursor: puedeElegir ? "pointer" : "not-allowed",
            opacity: puedeElegir ? 1 : 0.5,
            fontWeight: 600
          },
          children: L.video.pickFrame
        }
      ) : /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
        cargando && /* @__PURE__ */ jsx("span", { style: { color: c.sub }, children: L.video.loading }),
        src && /* @__PURE__ */ jsx(
          "video",
          {
            ref: videoRef,
            src,
            crossOrigin: "anonymous",
            muted: true,
            playsInline: true,
            preload: "auto",
            onLoadedMetadata: (e) => {
              const v = e.currentTarget;
              setDuracion(Number.isFinite(v.duration) ? v.duration : 0);
              const inicio = selected.meta.posterTime ?? 0;
              if (inicio > 0) v.currentTime = inicio;
            },
            onTimeUpdate: (e) => setTiempo(e.currentTarget.currentTime),
            onError: () => setFallo(true),
            style: { width: "100%", borderRadius: 6, background: "#000", display: "block" }
          }
        ),
        src && /* @__PURE__ */ jsxs(Fragment$1, { children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "range",
              min: 0,
              max: Math.max(0.1, duracion),
              step: 0.05,
              value: Math.min(tiempo, duracion || tiempo),
              onChange: (e) => {
                const v = Number(e.target.value);
                setTiempo(v);
                if (videoRef.current) videoRef.current.currentTime = v;
              },
              style: { width: "100%" }
            }
          ),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsxs("span", { style: { color: c.sub, fontVariantNumeric: "tabular-nums" }, children: [
              formatTime(tiempo),
              " / ",
              formatTime(duracion)
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => void confirmar(),
                disabled: guardando,
                style: {
                  all: "unset",
                  marginLeft: "auto",
                  cursor: guardando ? "progress" : "pointer",
                  padding: "4px 9px",
                  borderRadius: 6,
                  background: c.active,
                  color: c.activeFg,
                  fontWeight: 600
                },
                children: guardando ? L.video.saving : L.video.useFrame
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setAbierto(false),
                style: { all: "unset", cursor: "pointer", color: c.sub },
                children: L.video.cancel
              }
            )
          ] })
        ] }),
        fallo && /* @__PURE__ */ jsx("span", { style: { color: c.danger }, children: L.video.failed })
      ] })
    }
  );
}
const registradas = /* @__PURE__ */ new Map();
function registerCustomFont(name) {
  var _a;
  const alias = fontFamilyAlias(name);
  if (!alias) return null;
  const yaEsta = registradas.get(alias);
  if (yaEsta !== void 0) return { alias, id: yaEsta };
  const id = customFontFamilyId(alias);
  const tabla = FONT_FAMILY;
  const ocupante = (_a = Object.entries(tabla).find(([, valor]) => valor === id)) == null ? void 0 : _a[0];
  if (ocupante !== void 0 && ocupante !== alias) {
    console.error(
      `[canvas2] la tipografía "${alias}" colisiona con "${ocupante}" (id ${id}); se usará la fuente por defecto. Renombra la familia en el brand kit.`
    );
    return null;
  }
  tabla[alias] = id;
  registradas.set(alias, id);
  return { alias, id };
}
function registerCustomFonts(faces) {
  const ids = /* @__PURE__ */ new Map();
  const salida = [];
  for (const face of faces) {
    const reg = registerCustomFont(face.family);
    if (!reg) continue;
    ids.set(reg.alias, reg.id);
    salida.push({ ...face, family: reg.alias });
  }
  return { faces: salida, ids };
}
function fontFamilyId(name) {
  const alias = fontFamilyAlias(name);
  const tabla = FONT_FAMILY;
  return tabla[alias] ?? tabla[name] ?? null;
}
const TEXT_PRESETS = [
  { key: "heading", label: "Título", text: "Título", fontSize: 64, anchorY: 0.24 },
  { key: "subheading", label: "Subtítulo", text: "Subtítulo", fontSize: 40, anchorY: 0.38 },
  { key: "body", label: "Cuerpo de texto", text: "Escribe algo…", fontSize: 24, anchorY: 0.52 }
];
function frames(api) {
  return api.getSceneElements().filter((e) => e.type === "frame").slice().sort((a, b) => a.x - b.x);
}
function luminance(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return 1;
  const n = parseInt(match[1], 16);
  const r = n >> 16 & 255;
  const g = n >> 8 & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function contrastTextColor(background) {
  return luminance(background) > 0.5 ? "#1e1e1e" : "#ffffff";
}
function insertTextPreset(api, preset, opts) {
  var _a;
  const def = TEXT_PRESETS.find((p) => p.key === preset) ?? TEXT_PRESETS[0];
  const pages = frames(api);
  const target = (opts == null ? void 0 : opts.pageId) && pages.find((f) => f.id === opts.pageId) || pages[0] || null;
  const scale = target ? target.width / 1080 : 1;
  const fontSize = Math.max(8, def.fontSize * scale);
  const anchorX = target ? target.x + target.width / 2 : 0;
  const anchorY = target ? target.y + target.height * def.anchorY : 0;
  const strokeColor = contrastTextColor(
    target ? getPageBackground(api, target.id) ?? "#ffffff" : "#ffffff"
  );
  const skeleton = [
    {
      type: "text",
      text: def.text,
      fontSize,
      // 2 = Excalidraw's built-in "normal" (non hand-drawn) family; the brand
      // font wins when the project has one with a real file.
      fontFamily: ((opts == null ? void 0 : opts.fontFamily) ? fontFamilyId(opts.fontFamily) : null) ?? 2,
      strokeColor,
      x: anchorX,
      y: anchorY
    }
  ];
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) => ({
    ...el,
    // Center on the anchor now that the converter measured the text box.
    x: anchorX - el.width / 2,
    y: anchorY - el.height / 2,
    ...target ? { frameId: target.id } : {}
  }));
  const id = (_a = created[0]) == null ? void 0 : _a.id;
  if (!id) return null;
  commitElements(
    api,
    [...api.getSceneElements(), ...created],
    "undoable",
    { selectedElementIds: { [id]: true } }
  );
  return id;
}
function safeFilename(name) {
  return (name || "diseño").replace(/[\\/:*?"<>|]+/g, "-").trim() || "diseño";
}
function CanvasMenu({
  api,
  activePageId,
  viewMode = false,
  hydrateFiles,
  fontFaces,
  brandFamilies,
  onSaveComponent,
  labels: labelsProp
}) {
  const L = mergeLabels(labelsProp);
  const [pages, setPages] = useState(() => api ? listPages(api) : []);
  const [loose, setLoose] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const activePage = pages.find((p) => p.id === activePageId) ?? null;
  useEffect(() => {
    if (!api) return;
    const refresh = () => {
      setPages(listPages(api));
      setLoose(looseElements(api.getSceneElements()).length);
    };
    refresh();
    return api.onChange(refresh);
  }, [api]);
  const runExport = async (kind) => {
    var _a;
    if (!api || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const base = safeFilename((activePage == null ? void 0 : activePage.name) ?? "diseño");
      const files = hydrateFiles ? await hydrateFiles(kind === "svg" ? { output: "dataurl" } : void 0) : void 0;
      if (kind === "png") {
        downloadBlob(
          await exportScenePng(api, { pageId: activePageId ?? void 0, files }),
          `${base}.png`
        );
      } else if (kind === "png-all") {
        for (const page of pages) {
          downloadBlob(
            await exportScenePng(api, { pageId: page.id, files }),
            `${safeFilename(page.name)}.png`
          );
        }
      } else if (kind === "svg") {
        const svg = await exportSceneSvg(api, {
          pageId: activePageId ?? void 0,
          files,
          fontFaces,
          // Google sirve las fuentes con CORS abierto, así que un `fetch` normal
          // basta: no hace falta el proxy del worker (que además solo permite
          // los hosts de media). Si falla, la fuente se queda por URL y el SVG
          // se sigue viendo bien donde haya red.
          fontFetcher: (url2) => fetch(url2).then((r) => r.blob())
        });
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
        downloadBlob(blob, `${base}.svg`);
      } else {
        downloadBlob(await exportScenePdf(api, { files }), `${safeFilename(((_a = pages[0]) == null ? void 0 : _a.name) ?? "diseño")}.pdf`);
      }
    } catch (err) {
      console.error("[canvas2] export failed", err);
      setExportError(true);
      setTimeout(() => setExportError(false), 4e3);
    } finally {
      setExporting(false);
    }
  };
  if (!api) {
    return /* @__PURE__ */ jsxs(MainMenu, { children: [
      /* @__PURE__ */ jsx(MainMenu.DefaultItems.SearchMenu, {}),
      /* @__PURE__ */ jsx(MainMenu.DefaultItems.ToggleTheme, {}),
      /* @__PURE__ */ jsx(MainMenu.DefaultItems.Help, {})
    ] });
  }
  return /* @__PURE__ */ jsxs(MainMenu, { children: [
    !viewMode && loose > 0 && /* @__PURE__ */ jsx(
      MainMenu.Item,
      {
        shortcut: L.menu.toPagesHint(loose),
        onSelect: () => {
          const { created, total } = convertToPages(api, {
            // Hereda el tamaño de la página activa cuando el documento ya
            // tiene alguna; si no, lo decide el grupo más grande.
            pageSize: activePage ? { width: activePage.width, height: activePage.height } : void 0,
            // Con un tamaño heredado la intención es llenar ESE lienzo, así
            // que el contenido se escala en los dos sentidos. Un guion de
            // carrusel dibujado en miniatura sale a tamaño real, no como
            // sellos centrados en una página gigante.
            scaleUp: Boolean(activePage)
          });
          const first = listPages(api)[total - created];
          if (first) goToPage(api, first.id);
        },
        children: L.menu.toPages
      }
    ),
    !viewMode && /* @__PURE__ */ jsx(MainMenu.Group, { title: L.menu.insertText, children: TEXT_PRESETS.map((preset) => /* @__PURE__ */ jsx(
      MainMenu.Item,
      {
        shortcut: `${preset.fontSize}px`,
        textStyle: {
          fontSize: preset.key === "heading" ? 15 : preset.key === "subheading" ? 13 : 12,
          fontWeight: preset.key === "body" ? 400 : 700
        },
        onSelect: () => insertTextPreset(api, preset.key, {
          pageId: activePageId ?? void 0,
          // El cuerpo usa la tipografía de texto; título y subtítulo, la
          // de titulares — con respaldo cruzado si la marca solo trae una.
          fontFamily: preset.key === "body" ? (brandFamilies == null ? void 0 : brandFamilies.body) ?? (brandFamilies == null ? void 0 : brandFamilies.heading) : (brandFamilies == null ? void 0 : brandFamilies.heading) ?? (brandFamilies == null ? void 0 : brandFamilies.body)
        }),
        children: L.sizes[preset.key] ?? preset.label
      },
      preset.key
    )) }),
    !viewMode && onSaveComponent && /* @__PURE__ */ jsx(MainMenu.Item, { onSelect: onSaveComponent, children: L.components.save }),
    /* @__PURE__ */ jsxs(
      MainMenu.Group,
      {
        title: exporting ? L.menu.exporting : exportError ? L.menu.exportFailed : L.menu.export,
        children: [
          /* @__PURE__ */ jsx(MainMenu.Item, { onSelect: () => void runExport("png"), children: L.menu.exportPngPage }),
          /* @__PURE__ */ jsx(MainMenu.Item, { onSelect: () => void runExport("png-all"), children: L.menu.exportPngAll }),
          /* @__PURE__ */ jsx(MainMenu.Item, { onSelect: () => void runExport("svg"), children: L.menu.exportSvg }),
          /* @__PURE__ */ jsx(MainMenu.Item, { onSelect: () => void runExport("pdf"), children: L.menu.exportPdf })
        ]
      }
    ),
    /* @__PURE__ */ jsx(MainMenu.Separator, {}),
    /* @__PURE__ */ jsx(MainMenu.DefaultItems.SearchMenu, {}),
    /* @__PURE__ */ jsx(MainMenu.DefaultItems.ToggleTheme, {}),
    /* @__PURE__ */ jsx(MainMenu.DefaultItems.Help, {})
  ] });
}
const OFFSET_Y = 26;
function PageActions({
  api,
  activePageId,
  theme = "light",
  onActiveChange,
  labels: labelsProp
}) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [anchor, setAnchor] = useState(null);
  const [armedDelete, setArmedDelete] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  useEffect(() => {
    const recompute = () => {
      const pages = listPages(api);
      setPageCount(pages.length);
      const page2 = pages.find((p) => p.id === activePageId) ?? null;
      if (!page2) {
        setAnchor(null);
        return;
      }
      const { scrollX, scrollY, zoom } = api.getAppState();
      const z = (zoom == null ? void 0 : zoom.value) ?? 1;
      setAnchor({
        // Esquina superior DERECHA del marco: el nombre de la página lo dibuja
        // Excalidraw en la izquierda, así que ahí la barra lo taparía.
        left: (page2.x + page2.width + scrollX) * z,
        top: (page2.y + scrollY) * z - OFFSET_Y,
        page: page2
      });
    };
    recompute();
    return api.onChange(recompute);
  }, [api, activePageId]);
  useEffect(() => {
    if (!armedDelete) return;
    const t = setTimeout(() => setArmedDelete(false), 2500);
    return () => clearTimeout(t);
  }, [armedDelete]);
  useEffect(() => setArmedDelete(false), [activePageId]);
  if (!anchor) return null;
  const { page } = anchor;
  const select = (id) => {
    onActiveChange == null ? void 0 : onActiveChange(id);
    goToPage(api, id);
  };
  const btnDisabled = (label, icon) => /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      "aria-label": label,
      title: label,
      disabled: true,
      style: {
        all: "unset",
        cursor: "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        padding: "2px 3px",
        borderRadius: 4,
        color: c.sub,
        opacity: 0.35
      },
      children: icon
    }
  );
  const btn = (label, onClick, icon, danger = false) => /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      "aria-label": label,
      title: label,
      onClick,
      style: {
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        padding: "2px 3px",
        borderRadius: 4,
        color: danger ? c.danger : c.sub
      },
      children: icon
    }
  );
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": "canvas2-page-actions",
      style: {
        position: "absolute",
        left: anchor.left,
        top: anchor.top,
        // Anclada por su borde derecho al del marco, para que crecer o encoger
        // no la despegue de la esquina.
        transform: "translateX(-100%)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: 1,
        borderRadius: 6,
        // Discreta a propósito: acompaña al nombre de la página, no compite con
        // él. Sin sombra y con el mismo gris del rótulo del marco.
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.sub,
        fontFamily: PANEL_FONT,
        opacity: 0.9
      },
      children: [
        page.index > 0 && btn(L.pages.moveLeft, () => movePage(api, page.id, -1), /* @__PURE__ */ jsx(ChevronLeftIcon, {})),
        page.index < pageCount - 1 && btn(L.pages.moveRight, () => movePage(api, page.id, 1), /* @__PURE__ */ jsx(ChevronRightIcon, {})),
        btn(L.pages.duplicate, () => {
          const id = duplicatePage(api, page.id);
          if (id) select(id);
        }, /* @__PURE__ */ jsx(DuplicateIcon, {})),
        btn(
          page.locked ? L.pages.unlock : L.pages.lock,
          () => setPageLocked(api, page.id, !page.locked),
          page.locked ? /* @__PURE__ */ jsx(LockIcon, {}) : /* @__PURE__ */ jsx(UnlockIcon, {})
        ),
        pageCount <= 1 && !page.locked && btnDisabled(L.pages.lastPage, /* @__PURE__ */ jsx(TrashIcon, {})),
        pageCount > 1 && !page.locked && (armedDelete ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              setArmedDelete(false);
              deletePage(api, page.id);
              const fallback = listPages(api).find((p) => p.id !== page.id);
              if (fallback) select(fallback.id);
            },
            style: {
              all: "unset",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              color: c.dangerFg,
              background: c.danger
            },
            children: L.pages.confirmDelete
          }
        ) : btn(L.pages.delete, () => setArmedDelete(true), /* @__PURE__ */ jsx(TrashIcon, {}), true))
      ]
    }
  );
}
function frameFor(els, el, pageId) {
  const frames2 = els.filter((e) => e.type === "frame");
  return (pageId ? frames2.find((f) => f.id === pageId) : void 0) ?? frames2.find((f) => f.id === el.frameId) ?? frames2[0] ?? null;
}
function fitToPage(api, elementId, pageId, lock) {
  const els = api.getSceneElements();
  const el = els.find((e) => e.id === elementId);
  if (!el) return;
  const frame = frameFor(els, el, pageId);
  if (!frame) return;
  const scale = Math.max(frame.width / el.width, frame.height / el.height);
  const width = el.width * scale;
  const height = el.height * scale;
  const x = frame.x + (frame.width - width) / 2;
  const y = frame.y + (frame.height - height) / 2;
  const updated = els.map(
    (e) => e.id === elementId ? patchElement(e, {
      x,
      y,
      width,
      height,
      frameId: frame.id,
      ...lock ? { locked: true } : {}
    }) : e
  );
  const reordered = reorderMembersInArray(updated, frame.id, [elementId]);
  commitElements(api, reordered);
}
function extendToPage(api, elementId, pageId) {
  fitToPage(api, elementId, pageId, false);
}
function setAsBackground(api, elementId, pageId) {
  fitToPage(api, elementId, pageId, true);
}
const PAGE_ALIGNMENTS = [
  { key: "left", label: "Alinear a la izquierda", glyph: "⇤" },
  { key: "centerX", label: "Centrar horizontalmente", glyph: "⇹" },
  { key: "right", label: "Alinear a la derecha", glyph: "⇥" },
  { key: "top", label: "Alinear arriba", glyph: "⤒" },
  { key: "centerY", label: "Centrar verticalmente", glyph: "⇳" },
  { key: "bottom", label: "Alinear abajo", glyph: "⤓" }
];
function alignedPosition(frame, el, alignment) {
  switch (alignment) {
    case "left":
      return { x: frame.x, y: el.y };
    case "centerX":
      return { x: frame.x + (frame.width - el.width) / 2, y: el.y };
    case "right":
      return { x: frame.x + frame.width - el.width, y: el.y };
    case "top":
      return { x: el.x, y: frame.y };
    case "centerY":
      return { x: el.x, y: frame.y + (frame.height - el.height) / 2 };
    case "bottom":
      return { x: el.x, y: frame.y + frame.height - el.height };
  }
}
function alignToPage(api, pageId, alignment, elementIds) {
  const elements = api.getSceneElements();
  const frame = elements.find(
    (e) => e.id === pageId && e.type === "frame"
  );
  if (!frame) return 0;
  const selected = api.getAppState().selectedElementIds;
  const targets = new Set(
    elementIds ?? Object.keys(selected).filter((id) => selected[id])
  );
  if (targets.size === 0) return 0;
  let moved = 0;
  const next = elements.map((e) => {
    if (!targets.has(e.id) || e.frameId !== pageId || e.locked) return e;
    moved += 1;
    return patchElement(e, alignedPosition(frame, e, alignment));
  });
  if (moved === 0) return 0;
  commitElements(api, next);
  return moved;
}
const TYPE_ICON = {
  image: ImageIcon,
  text: TextIcon,
  rectangle: SquareIcon,
  ellipse: CircleIcon,
  diamond: DiamondIcon,
  line: LineIcon,
  arrow: ArrowIcon,
  freedraw: DrawIcon,
  frame: FrameIcon
};
const TYPE_NAME = {
  image: "Imagen",
  rectangle: "Rectángulo",
  ellipse: "Elipse",
  diamond: "Rombo",
  line: "Línea",
  arrow: "Flecha",
  freedraw: "Trazo"
};
const ALIGN_ICON = {
  left: AlignLeftIcon,
  centerX: AlignCenterHIcon,
  right: AlignRightIcon,
  top: AlignTopIcon,
  centerY: AlignCenterVIcon,
  bottom: AlignBottomIcon
};
function typeIcon(type) {
  const Icon = TYPE_ICON[type] ?? SquareIcon;
  return /* @__PURE__ */ jsx(Icon, {});
}
function displayName(el) {
  if (el.type === "text") {
    const t = (el.text ?? "").replace(/\s+/g, " ").trim();
    return t ? `Texto: ${t.slice(0, 20)}` : "Texto";
  }
  return TYPE_NAME[el.type] ?? el.type;
}
function sceneSignature(api, pageId) {
  if (!pageId) return "";
  const els = api.getSceneElements();
  const members = els.filter((e) => e.frameId === pageId && !isPageBackground(e));
  const sel = api.getAppState().selectedElementIds;
  const selKeys = Object.keys(sel).filter((k) => sel[k]).join(",");
  const frame = els.find((e) => e.id === pageId);
  const frameName = frame && frame.type === "frame" ? frame.name ?? "" : "";
  return members.map((e) => `${e.id}:${e.version}:${e.locked ? 1 : 0}:${e.opacity}`).join("|") + "#" + selKeys + "#" + frameName;
}
function LayersPanel({
  api,
  activePageId,
  theme = "light",
  viewMode = false,
  embedded = false
}) {
  const c = palette[theme];
  const [, setTick] = useState(0);
  const sigRef = useRef("");
  const dragId = useRef(null);
  const priorOpacity = useRef(/* @__PURE__ */ new Map());
  const lastSceneRef = useRef({
    elements: null,
    selection: null
  });
  const [renamingPage, setRenamingPage] = useState(null);
  useEffect(() => {
    const refresh = () => {
      const elements = api.getSceneElements();
      const selection = api.getAppState().selectedElementIds;
      if (elements === lastSceneRef.current.elements && selection === lastSceneRef.current.selection) {
        return;
      }
      lastSceneRef.current = { elements, selection };
      const next = sceneSignature(api, activePageId);
      if (next !== sigRef.current) {
        sigRef.current = next;
        setTick((t) => t + 1);
      }
    };
    lastSceneRef.current = { elements: null, selection: null };
    refresh();
    return api.onChange(refresh);
  }, [api, activePageId]);
  if (!activePageId) return null;
  const els = api.getSceneElements();
  const frame = els.find((e) => e.id === activePageId);
  const members = els.filter((e) => e.frameId === activePageId && !isPageBackground(e));
  const rows = [...members].reverse();
  const selected = api.getAppState().selectedElementIds;
  const files = api.getFiles();
  const thumb = (el) => {
    var _a;
    if (el.type !== "image") return void 0;
    const fileId = el.fileId;
    return fileId ? (_a = files[fileId]) == null ? void 0 : _a.dataURL : void 0;
  };
  const patch = (id, changes) => {
    const next = api.getSceneElements().map((e) => e.id === id ? patchElement(e, changes) : e);
    commitElements(api, next);
  };
  const remove = (id) => {
    const next = api.getSceneElements().filter((e) => e.id !== id && e.containerId !== id);
    commitElements(api, next);
  };
  const selectOnCanvas = (id) => {
    api.updateScene({
      appState: { selectedElementIds: { [id]: true } },
      captureUpdate: CaptureUpdateAction.NEVER
    });
  };
  const toggleVisibility = (el) => {
    if (el.opacity === 0) {
      patch(el.id, { opacity: priorOpacity.current.get(el.id) ?? 100 });
    } else {
      priorOpacity.current.set(el.id, el.opacity);
      patch(el.id, { opacity: 0 });
    }
  };
  const handleDrop = (targetId) => {
    const fromId = dragId.current;
    dragId.current = null;
    if (!fromId || fromId === targetId) return;
    const topFirst = rows.map((r) => r.id);
    const from = topFirst.indexOf(fromId);
    const to = topFirst.indexOf(targetId);
    if (from < 0 || to < 0) return;
    topFirst.splice(to, 0, topFirst.splice(from, 1)[0]);
    const paper = els.find((e) => e.frameId === activePageId && isPageBackground(e));
    const bottomFirst = [...paper ? [paper.id] : [], ...[...topFirst].reverse()];
    commitElements(api, reorderPageMembers(api, activePageId, bottomFirst));
  };
  const iconBtn = (label, onClick, node, danger = false) => /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      "aria-label": label,
      title: label,
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      style: {
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        padding: "3px 3px",
        borderRadius: 4,
        color: danger ? c.danger : "inherit",
        opacity: 0.8
      },
      children: node
    }
  );
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        // Empotrado dentro de una pestaña de la barra lateral, el panel no debe
        // flotar ni traer marco propio: la barra ya pone el suyo, y un panel
        // absoluto se saldría de la pestaña.
        // `height: '100%'` NO servía. El panel es hijo de un contenedor flex
        // cuya altura la reparte el propio flex (el dock solo declara un
        // `max-height`), y un porcentaje contra una altura `auto` no resuelve:
        // el panel crecía hasta el alto de su contenido —1313 px con una escena
        // de 45 capas—, el dock lo recortaba con su `overflow: hidden` y la
        // lista NUNCA llegaba a desbordar, así que no aparecía la barra de
        // scroll y las capas de abajo eran inalcanzables. Medido con Playwright
        // sobre una escena real, no supuesto.
        //
        // Con `flex` + `minHeight: 0` el panel se queda exactamente con el alto
        // que le da el dock y el desbordamiento cae donde toca: en la lista.
        ...embedded ? { position: "relative", width: "100%", flex: 1, minHeight: 0, maxHeight: "100%" } : {
          position: "absolute",
          top: 56,
          right: 12,
          bottom: 76,
          zIndex: 4,
          width: 240,
          borderRadius: 12,
          border: `1px solid ${c.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)"
        },
        display: "flex",
        flexDirection: "column",
        background: embedded ? "transparent" : c.bg,
        color: c.fg,
        fontFamily: PANEL_FONT,
        overflow: "hidden"
      },
      children: [
        (!embedded || !viewMode) && /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: c.sub,
              borderBottom: `1px solid ${c.border}`
            },
            children: [
              /* @__PURE__ */ jsx("span", { style: { flex: 1 }, children: embedded ? "" : "Capas" }),
              !viewMode && /* @__PURE__ */ jsx("span", { style: { display: "inline-flex", gap: 2 }, children: PAGE_ALIGNMENTS.map((a) => {
                const Icon = ALIGN_ICON[a.key];
                return /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    title: a.label,
                    onClick: () => alignToPage(api, activePageId, a.key),
                    style: {
                      all: "unset",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      lineHeight: 1,
                      padding: "2px 3px",
                      borderRadius: 4,
                      opacity: 0.8
                    },
                    children: /* @__PURE__ */ jsx(Icon, {})
                  },
                  a.key
                );
              }) })
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: 4 }, children: [
          rows.length === 0 && /* @__PURE__ */ jsx("div", { style: { padding: 12, fontSize: 12, color: c.sub }, children: "Esta página está vacía." }),
          rows.map((el) => {
            const isSel = !!selected[el.id];
            const hidden = el.opacity === 0;
            return /* @__PURE__ */ jsxs(
              "div",
              {
                draggable: !viewMode,
                onDragStart: () => {
                  if (!viewMode) dragId.current = el.id;
                },
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => {
                  if (!viewMode) handleDrop(el.id);
                },
                onClick: () => selectOnCanvas(el.id),
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 6px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isSel ? c.active : "transparent",
                  color: isSel ? c.activeFg : c.fg,
                  opacity: hidden ? 0.5 : 1
                },
                children: [
                  /* @__PURE__ */ jsx("span", { style: { width: 16, height: 16, display: "inline-flex", justifyContent: "center", alignItems: "center" }, children: thumb(el) ? /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: thumb(el),
                      alt: "",
                      draggable: false,
                      style: { width: 16, height: 16, objectFit: "cover", borderRadius: 3, display: "block" }
                    }
                  ) : typeIcon(el.type) }),
                  /* @__PURE__ */ jsx(
                    "span",
                    {
                      style: {
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      },
                      children: displayName(el)
                    }
                  ),
                  !viewMode && /* @__PURE__ */ jsxs(Fragment$1, { children: [
                    el.type === "image" && iconBtn("Usar como fondo", () => setAsBackground(api, el.id, activePageId), /* @__PURE__ */ jsx(CoverIcon, {})),
                    el.type === "image" && iconBtn("Extender a la página", () => extendToPage(api, el.id, activePageId), /* @__PURE__ */ jsx(StretchIcon, {})),
                    iconBtn(
                      hidden ? "Mostrar" : "Ocultar",
                      () => toggleVisibility(el),
                      hidden ? /* @__PURE__ */ jsx(EyeOffIcon, {}) : /* @__PURE__ */ jsx(EyeIcon, {})
                    ),
                    iconBtn(
                      el.locked ? "Desbloquear" : "Bloquear",
                      () => patch(el.id, { locked: !el.locked }),
                      el.locked ? /* @__PURE__ */ jsx(LockIcon, {}) : /* @__PURE__ */ jsx(UnlockIcon, {})
                    ),
                    iconBtn("Eliminar", () => remove(el.id), /* @__PURE__ */ jsx(TrashIcon, {}), true)
                  ] })
                ]
              },
              el.id
            );
          })
        ] }),
        /* @__PURE__ */ jsxs(
          "div",
          {
            onDoubleClick: () => {
              if (viewMode || !frame || frame.type !== "frame") return;
              setRenamingPage(frame.name ?? "");
            },
            title: viewMode ? void 0 : "Doble clic para renombrar la página",
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              borderTop: `1px solid ${c.border}`,
              fontSize: 12,
              color: c.sub,
              cursor: "default"
            },
            children: [
              /* @__PURE__ */ jsx("span", { style: { width: 16, display: "inline-flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx(FrameIcon, {}) }),
              renamingPage !== null ? /* @__PURE__ */ jsx(
                "input",
                {
                  autoFocus: true,
                  value: renamingPage,
                  onChange: (e) => setRenamingPage(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") {
                      if (renamingPage.trim()) renamePage(api, activePageId, renamingPage.trim());
                      setRenamingPage(null);
                    }
                    if (e.key === "Escape") setRenamingPage(null);
                  },
                  onBlur: () => {
                    if (renamingPage.trim()) renamePage(api, activePageId, renamingPage.trim());
                    setRenamingPage(null);
                  },
                  style: {
                    flex: 1,
                    minWidth: 0,
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: `1px solid ${c.border}`,
                    background: "transparent",
                    color: c.fg,
                    fontSize: 12,
                    fontFamily: PANEL_FONT
                  }
                }
              ) : /* @__PURE__ */ jsx("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }, children: frame && frame.type === "frame" ? frame.name ?? "Página" : "Página" })
            ]
          }
        )
      ]
    }
  );
}
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function color(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return HEX.test(v) ? v.toLowerCase() : null;
}
function url(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}
function fuente(value) {
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { name, src: null } : null;
  }
  if (value && typeof value === "object") {
    const o = value;
    const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
    const family = typeof o.family === "string" && o.family.trim() ? o.family.trim() : null;
    const etiqueta = name ?? family;
    if (!etiqueta) return null;
    return {
      name: etiqueta,
      src: url(o.url),
      style: typeof o.style === "string" && o.style !== "regular" ? o.style : void 0
    };
  }
  return null;
}
const EMPTY_BRAND = {
  mainColor: null,
  palette: [],
  headingFamily: null,
  bodyFamily: null,
  fontOverrides: [],
  logos: { small: null, black: null, white: null },
  notes: []
};
function resolveBrandKit(raw) {
  if (!raw || typeof raw !== "object") return EMPTY_BRAND;
  const bk = raw;
  const notes = [];
  const mainColor = color(bk.mainColor);
  if (bk.mainColor && !mainColor) notes.push(`color principal descartado: "${String(bk.mainColor)}" no es hex`);
  const palette2 = [];
  const push = (c) => {
    if (c && !palette2.includes(c)) palette2.push(c);
  };
  push(mainColor);
  if (Array.isArray(bk.colorPalette)) {
    for (const c of bk.colorPalette) {
      const parsed = color(c);
      if (parsed) push(parsed);
      else if (c) notes.push(`color de paleta descartado: "${String(c)}" no es hex`);
    }
  }
  const fontOverrides = [];
  let headingFamily = null;
  let bodyFamily = null;
  for (const [rol, valor] of [
    ["heading", bk.headingFont],
    ["body", bk.bodyFont]
  ]) {
    const f = fuente(valor);
    if (!f) continue;
    if (!f.src) {
      notes.push(`"${f.name}" (${rol === "heading" ? "titulares" : "texto"}) no tiene fichero en el brand kit; se usa la tipografía por defecto`);
      continue;
    }
    const family = fontFamilyAlias(f.name);
    if (!family) continue;
    fontOverrides.push({ family, src: normalizeFontSrc(f.src), style: f.style });
    if (rol === "heading") headingFamily = family;
    else bodyFamily = family;
  }
  return {
    mainColor,
    palette: palette2,
    headingFamily,
    bodyFamily,
    fontOverrides,
    logos: { small: url(bk.smallLogo), black: url(bk.logoBlack), white: url(bk.logoWhite) },
    notes
  };
}
const RELLENABLES = /* @__PURE__ */ new Set(["rectangle", "ellipse", "diamond"]);
function BrandGallery({
  api,
  brandKit,
  theme = "light",
  activePageId,
  viewMode,
  embedded = false,
  labels: labelsProp
}) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const brand = useMemo(() => resolveBrandKit(brandKit), [brandKit]);
  const [seleccion, setSeleccion] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [abierta, setAbierta] = useState(true);
  useEffect(() => {
    if (!api) return;
    return api.onChange(() => {
      const state = api.getAppState();
      const ids = Object.keys(state.selectedElementIds ?? {}).filter(
        (id) => state.selectedElementIds[id]
      );
      setSeleccion(
        (prev) => prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids
      );
    });
  }, [api]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 1800);
    return () => clearTimeout(t);
  }, [aviso]);
  const aplicarColor = useCallback(
    (color2) => {
      if (!api) return;
      const ids = new Set(seleccion);
      if (!ids.size) {
        api.updateScene({
          appState: { currentItemStrokeColor: color2, currentItemBackgroundColor: color2 },
          captureUpdate: CaptureUpdateAction.EVENTUALLY
        });
        setAviso(L.brand.defaultColor);
        return;
      }
      const elements = api.getSceneElements();
      const siguiente = elements.map(
        (el) => ids.has(el.id) ? patchElement(
          el,
          RELLENABLES.has(el.type) ? { backgroundColor: color2 } : { strokeColor: color2 }
        ) : el
      );
      commitElements(api, siguiente, "undoable");
      setAviso(L.brand.applied(ids.size));
    },
    [api, seleccion]
  );
  const insertarLogo = useCallback(
    async (url2) => {
      if (!api) return;
      try {
        await insertImageFromUrl(api, url2, { pageId: activePageId ?? void 0 });
        setAviso(L.brand.logoInserted);
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "no se pudo insertar");
      }
    },
    [api, activePageId]
  );
  const logos = [
    { url: brand.logos.small, label: L.brand.logo },
    { url: brand.logos.black, label: L.brand.black },
    { url: brand.logos.white, label: L.brand.white }
  ].filter((l) => Boolean(l.url));
  if (viewMode || !api || !brand.palette.length && !logos.length) return null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": "canvas2-brand-gallery",
      style: {
        // Empotrada en el dock no flota ni trae marco: eso lo pone el dock.
        ...embedded ? { position: "relative", width: "100%", overflowY: "auto" } : {
          position: "absolute",
          right: 12,
          bottom: 16,
          zIndex: 95,
          width: abierta ? 168 : "auto",
          borderRadius: 12,
          border: `1px solid ${c.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)"
        },
        padding: 6,
        background: embedded ? "transparent" : c.bg,
        color: c.fg,
        font: `12px ${PANEL_FONT}`
      },
      children: [
        !embedded && /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setAbierta((v) => !v),
            title: abierta ? L.dock.collapse : L.brand.title,
            style: {
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "2px 4px",
              color: c.sub,
              fontWeight: 600
            },
            children: [
              L.brand.title,
              /* @__PURE__ */ jsx("span", { style: { marginLeft: "auto", fontWeight: 400, opacity: 0.9 }, children: aviso ?? (abierta ? "▾" : "▸") })
            ]
          }
        ),
        embedded && aviso && /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", color: c.sub }, children: aviso }),
        (embedded || abierta) && /* @__PURE__ */ jsxs(Fragment$1, { children: [
          brand.palette.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, padding: "6px 4px 2px" }, children: brand.palette.map((color2) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => aplicarColor(color2),
              title: seleccion.length ? L.brand.applyToSelection(color2) : `${color2} · ${L.brand.defaultColor}`,
              "aria-label": color2,
              style: {
                width: 24,
                height: 24,
                borderRadius: 6,
                background: color2,
                border: `1px solid ${c.border}`,
                cursor: "pointer",
                padding: 0
              }
            },
            color2
          )) }),
          logos.length > 0 && /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 4,
                padding: "4px 4px 2px"
              },
              children: logos.map((logo) => /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => void insertarLogo(logo.url),
                  title: L.brand.insertLogo(logo.label),
                  style: {
                    all: "unset",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: 3,
                    borderRadius: 6,
                    border: `1px solid ${c.border}`
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        style: {
                          width: "100%",
                          height: 26,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          // Tablero de ajedrez: sin él un logo blanco sobre panel
                          // blanco parece un hueco vacío.
                          backgroundImage: "linear-gradient(45deg,rgba(128,128,128,.25) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.25) 75%),linear-gradient(45deg,rgba(128,128,128,.25) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.25) 75%)",
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 4px 4px",
                          borderRadius: 4
                        },
                        children: /* @__PURE__ */ jsx(
                          "img",
                          {
                            src: logo.url,
                            alt: "",
                            style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
                            onError: (e) => {
                              e.currentTarget.style.visibility = "hidden";
                            }
                          }
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { style: { fontSize: 10, color: c.sub }, children: logo.label })
                  ]
                },
                logo.url
              ))
            }
          )
        ] })
      ]
    }
  );
}
const SIZE_MIN = 100;
const SIZE_MAX = 8e3;
const BG_NEUTROS = ["#ffffff", "#1e1e1e"];
function DesignPanel({
  api,
  activePageId,
  theme = "light",
  viewMode = false,
  brandKit,
  labels: labelsProp
}) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [pages, setPages] = useState(() => listPages(api));
  const [scaleContent, setScaleContent] = useState(true);
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const activePage = pages.find((p) => p.id === activePageId) ?? null;
  const bgSwatches = useMemo(() => {
    const out = [];
    for (const color2 of [...resolveBrandKit(brandKit).palette, ...BG_NEUTROS]) {
      if (!out.includes(color2)) out.push(color2);
    }
    return out;
  }, [brandKit]);
  useEffect(() => {
    const refresh = () => setPages(listPages(api));
    refresh();
    return api.onChange(refresh);
  }, [api]);
  useEffect(() => {
    if (!activePage) return;
    setCustomW(String(activePage.width));
    setCustomH(String(activePage.height));
  }, [activePage == null ? void 0 : activePage.id, activePage == null ? void 0 : activePage.width, activePage == null ? void 0 : activePage.height]);
  const applyResize = (size) => {
    if (!activePageId) return;
    resizePage(api, activePageId, size, { scaleContent });
    goToPage(api, activePageId);
  };
  const customSize = (() => {
    const w = Number.parseInt(customW, 10);
    const h = Number.parseInt(customH, 10);
    const ok = Number.isInteger(w) && Number.isInteger(h) && w >= SIZE_MIN && w <= SIZE_MAX && h >= SIZE_MIN && h <= SIZE_MAX;
    return ok ? { width: w, height: h } : null;
  })();
  const rotulo = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: c.sub
  };
  const inputStyle = {
    width: "100%",
    minWidth: 0,
    padding: "4px 6px",
    borderRadius: 6,
    border: `1px solid ${c.border}`,
    background: "transparent",
    color: c.fg,
    fontSize: 12,
    fontFamily: PANEL_FONT
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": "canvas2-design-panel",
      style: {
        width: "100%",
        overflowY: "auto",
        padding: "8px 10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        font: `12px ${PANEL_FONT}`,
        color: c.fg
      },
      children: [
        /* @__PURE__ */ jsx(
          BrandGallery,
          {
            api,
            brandKit,
            theme,
            activePageId,
            viewMode,
            embedded: true,
            labels: labelsProp
          }
        ),
        !viewMode && activePage && /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 7 }, children: [
          /* @__PURE__ */ jsx("div", { style: rotulo, children: L.dock.page }),
          /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: PAGE_SIZE_PRESETS.map((preset) => {
            const puesto = activePage.width === preset.width && activePage.height === preset.height;
            return /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => applyResize(preset),
                title: `${preset.width}×${preset.height}`,
                style: {
                  all: "unset",
                  cursor: "pointer",
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: puesto ? c.activeFg : c.sub,
                  background: puesto ? c.active : "transparent",
                  border: `1px solid ${puesto ? c.active : c.border}`
                },
                children: L.sizes[preset.key] ?? preset.label
              },
              preset.key
            );
          }) }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 5 }, children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                value: customW,
                onChange: (e) => setCustomW(e.target.value),
                onKeyDown: (e) => e.key === "Enter" && customSize && applyResize(customSize),
                inputMode: "numeric",
                "aria-label": L.menu.width,
                placeholder: L.menu.width,
                style: inputStyle
              }
            ),
            /* @__PURE__ */ jsx("span", { style: { color: c.sub, fontSize: 12 }, children: "×" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                value: customH,
                onChange: (e) => setCustomH(e.target.value),
                onKeyDown: (e) => e.key === "Enter" && customSize && applyResize(customSize),
                inputMode: "numeric",
                "aria-label": L.menu.height,
                placeholder: L.menu.height,
                style: inputStyle
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => customSize && applyResize(customSize),
                disabled: !customSize,
                style: {
                  all: "unset",
                  flexShrink: 0,
                  cursor: customSize ? "pointer" : "default",
                  padding: "4px 9px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: customSize ? c.activeFg : c.sub,
                  background: customSize ? c.active : "transparent",
                  border: `1px solid ${c.border}`,
                  opacity: customSize ? 1 : 0.6
                },
                children: L.menu.apply
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(
            "label",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: c.sub,
                cursor: "pointer"
              },
              children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: scaleContent,
                    onChange: (e) => setScaleContent(e.target.checked)
                  }
                ),
                L.menu.scaleContent
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { style: { ...rotulo, marginTop: 3 }, children: L.menu.background }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }, children: [
            bgSwatches.map((color2) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                title: color2,
                "aria-label": `${L.menu.background} ${color2}`,
                onClick: () => setPageBackgroundColor(api, activePage.id, color2),
                style: {
                  all: "unset",
                  cursor: "pointer",
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: color2,
                  border: `1px solid ${c.border}`
                }
              },
              color2
            )),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "color",
                "aria-label": L.menu.backgroundOther,
                title: L.menu.backgroundOther,
                value: getPageBackground(api, activePage.id) || "#ffffff",
                onChange: (e) => (
                  // Vista previa mientras se arrastra el selector; se pliega en el
                  // commit final deshacible (capture 'transient').
                  setPageBackgroundColor(api, activePage.id, e.target.value, {
                    capture: "transient"
                  })
                ),
                onBlur: (e) => setPageBackgroundColor(api, activePage.id, e.target.value),
                style: {
                  width: 24,
                  height: 20,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: 0
                }
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setPageBackgroundColor(api, activePage.id, null),
                style: {
                  all: "unset",
                  cursor: "pointer",
                  marginLeft: "auto",
                  padding: "3px 7px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: c.sub,
                  border: `1px solid ${c.border}`
                },
                children: L.menu.backgroundRemove
              }
            )
          ] })
        ] })
      ]
    }
  );
}
function RightDock({
  api,
  activePageId,
  theme = "light",
  narrow = false,
  viewMode = false,
  brandKit,
  layers = false,
  design = false,
  componentsPanel,
  labels: labelsProp
}) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [tab, setTab] = useState("diseno");
  const [abierto, setAbierto] = useState(false);
  const hayDiseno = design && !viewMode;
  const hayComponentes = Boolean(componentsPanel) && !viewMode;
  const disponibles = [
    ...hayDiseno ? ["diseno"] : [],
    ...layers ? ["capas"] : [],
    ...hayComponentes ? ["componentes"] : []
  ];
  if (!api || disponibles.length === 0) return null;
  const activa = disponibles.includes(tab) ? tab : disponibles[0];
  const rotulo = {
    diseno: L.dock.design,
    capas: L.dock.layers,
    componentes: L.dock.components
  };
  const tabStyle = (t) => ({
    all: "unset",
    cursor: "pointer",
    padding: "4px 9px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    color: abierto && activa === t ? c.fg : c.sub,
    background: abierto && activa === t ? c.hover : "transparent"
  });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": "canvas2-right-dock",
      "data-canvas2-dock": "",
      style: {
        position: "absolute",
        // A la IZQUIERDA en estrecho. Con la distribución de móvil de Excalidraw
        // el borde derecho lo ocupa su `mobile-misc-tools-container` (medido:
        // top 85-155, pegado al borde), y esta pastilla se le echaba encima —
        // en un iPhone de 390 y también en una tableta de 820, porque el corte
        // de Excalidraw está en 861 y no en los 768 que usa la app.
        ...narrow ? { left: 12 } : { right: 12 },
        // POR DEBAJO de la fila de herramientas, no a su altura. Medido en el
        // navegador: `.App-menu_top` ocupa de y=18 a y=67, y la barra de
        // herramientas va centrada y mide ~610px, así que abierta (248px) esta
        // pastilla se metía debajo de su extremo derecho. 76 deja la fila
        // entera para Excalidraw y ~9px de aire.
        top: 76,
        zIndex: 95,
        width: abierto ? 248 : "auto",
        // Nunca más ancha que el lienzo: 248px en un teléfono de 390 se comía
        // dos tercios de la pantalla.
        maxWidth: "calc(100% - 24px)",
        // Hasta justo encima de la tira de páginas, que vive abajo y centrada.
        maxHeight: `calc(100% - ${narrow ? 250 : 192}px)`,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        font: `12px ${PANEL_FONT}`,
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 4,
              borderBottom: abierto ? `1px solid ${c.border}` : "none",
              flexShrink: 0
            },
            children: [
              disponibles.map((t) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    if (abierto && activa === t) {
                      setAbierto(false);
                      return;
                    }
                    setTab(t);
                    setAbierto(true);
                  },
                  style: tabStyle(t),
                  children: rotulo[t]
                },
                t
              )),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setAbierto((v) => !v),
                  title: abierto ? L.dock.collapse : L.dock.expand,
                  "aria-label": abierto ? L.dock.collapse : L.dock.expand,
                  style: {
                    all: "unset",
                    cursor: "pointer",
                    marginLeft: "auto",
                    padding: "2px 6px",
                    color: c.sub
                  },
                  children: abierto ? "▾" : "▸"
                }
              )
            ]
          }
        ),
        abierto && /* @__PURE__ */ jsx("div", { style: { minHeight: 0, flex: 1, overflow: "hidden", display: "flex" }, children: activa === "capas" ? /* @__PURE__ */ jsx(
          LayersPanel,
          {
            api,
            activePageId,
            theme,
            viewMode,
            embedded: true
          }
        ) : activa === "componentes" ? /* @__PURE__ */ jsx("div", { style: { width: "100%", minHeight: 0, overflowY: "auto" }, children: componentsPanel }) : /* @__PURE__ */ jsx(
          DesignPanel,
          {
            api,
            activePageId,
            theme,
            viewMode,
            brandKit,
            labels: labelsProp
          }
        ) })
      ]
    }
  );
}
function LibraryPanel({
  children,
  title,
  theme = "light",
  viewMode = false,
  defaultCollapsed = true,
  labels: labelsProp,
  anchorTop = 12,
  icon,
  testId = "canvas2-library"
}) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [abierto, setAbierto] = useState(!defaultCollapsed);
  const rotulo = title ?? L.library.title;
  if (viewMode || !children) return null;
  if (!abierto) {
    return /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        "data-testid": `${testId}-trigger`,
        onClick: () => setAbierto(true),
        title: rotulo,
        "aria-label": rotulo,
        style: {
          all: "unset",
          position: "absolute",
          top: anchorTop,
          right: 12,
          zIndex: 95,
          boxSizing: "border-box",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          borderRadius: 10,
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.14)"
        },
        children: icon ?? /* @__PURE__ */ jsx(ImageIcon, {})
      }
    );
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-testid": testId,
      "data-canvas2-library": "",
      style: {
        position: "absolute",
        top: anchorTop,
        right: 12,
        zIndex: 95,
        width: 320,
        // Baja hasta justo encima de la tira de páginas: la biblioteca es una
        // rejilla y cuanto más alta, más se ve sin desplazar. Abierta TAPA el
        // dock de Diseño/Capas/Componentes, que queda debajo — es un cajón que
        // se abre sobre el resto, y se cierra con su ✕.
        bottom: 96,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        font: `12px ${PANEL_FONT}`,
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              color: c.sub,
              fontWeight: 600,
              borderBottom: `1px solid ${c.border}`,
              flexShrink: 0
            },
            children: [
              rotulo,
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setAbierto(false),
                  title: L.library.close,
                  "aria-label": L.library.close,
                  style: {
                    all: "unset",
                    cursor: "pointer",
                    marginLeft: "auto",
                    padding: "0 4px",
                    lineHeight: 1,
                    color: c.sub
                  },
                  children: "✕"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { minHeight: 0, flex: 1, overflowY: "auto" }, children })
      ]
    }
  );
}
const EXCALIDRAW_MOBILE_BREAKPOINT = 861;
function useIsNarrow(ref) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setNarrow(el.getBoundingClientRect().width < EXCALIDRAW_MOBILE_BREAKPOINT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return narrow;
}
function copyDropEffect(effectAllowed) {
  return effectAllowed === "move" || effectAllowed === "linkMove" ? "move" : "copy";
}
const MEDIA_DROP_TYPE = "application/x-canvas2-media";
function isOverCanvas(target) {
  return target instanceof Element && Boolean(target.closest(".excalidraw"));
}
function brandDefaults(brand) {
  if (!brand) return {};
  const defaults = {};
  if (brand.mainColor) defaults.currentItemStrokeColor = brand.mainColor;
  const familia = brand.bodyFamily ?? brand.headingFamily;
  const id = familia ? fontFamilyId(familia) : null;
  if (id !== null) defaults.currentItemFontFamily = id;
  return defaults;
}
function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return useCallback(
    (...args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
}
function Canvas2Editor({
  className,
  initialScene,
  onSceneChange,
  viewMode = false,
  theme,
  langCode = "es-ES",
  onReady,
  nativeImageExport = true,
  fontOverrides,
  changeDebounceMs = 400,
  pages = false,
  pageSize,
  layers = false,
  pageThumbnails = false,
  pageThumbnailFiles,
  brandKit,
  hydrateFiles,
  dockedSidebarBreakpoint = 820,
  library,
  componentsPanel,
  onSaveComponent,
  onActivePageChange,
  onMediaDrop,
  mediaDropType = MEDIA_DROP_TYPE,
  onFilesDrop,
  labels,
  resolveVideoSrc,
  releaseVideoSrc,
  onPickVideoFrame
}) {
  var _a;
  const brand = useMemo(() => resolveBrandKit(brandKit), [brandKit]);
  const allFontOverrides = useMemo(
    () => [...fontOverrides ?? [], ...brand.fontOverrides ?? []],
    [fontOverrides, brand]
  );
  const fuentes = useMemo(() => registerCustomFonts(dedupeFontFaces(allFontOverrides)), [
    allFontOverrides
  ]);
  useEffect(() => {
    var _a2;
    if (!fuentes.faces.length) return;
    const id = "canvas2-font-overrides";
    const css = buildFontFaceCss(fuentes.faces, { display: "swap" });
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement("style");
      tag.id = id;
      document.head.appendChild(tag);
    }
    if (!((_a2 = tag.textContent) == null ? void 0 : _a2.includes(css))) {
      tag.textContent = tag.textContent ? `${tag.textContent}
${css}` : css;
    }
  }, [fuentes]);
  const apiRef = useRef(null);
  const [api, setApi] = useState(null);
  const rootRef = useRef(null);
  const narrow = useIsNarrow(rootRef);
  const [activePageId, setActivePageId] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const scenePointOf = useCallback(
    (e) => {
      var _a2;
      const state = (_a2 = apiRef.current) == null ? void 0 : _a2.getAppState();
      if (!state) return null;
      const box = e.currentTarget.getBoundingClientRect();
      return viewportCoordsToSceneCoords(
        { clientX: e.clientX, clientY: e.clientY },
        { ...state, offsetLeft: box.left, offsetTop: box.top }
      );
    },
    []
  );
  const hitAt = useCallback(
    (e) => {
      if (!e.shiftKey || !apiRef.current) return null;
      const at = scenePointOf(e);
      return at ? imageAtScenePoint(apiRef.current, at) : null;
    },
    [scenePointOf]
  );
  useEffect(() => {
    onActivePageChange == null ? void 0 : onActivePageChange(activePageId);
  }, [activePageId]);
  const didInitPages = useRef(false);
  const lastEmittedRef = useRef({
    elements: null,
    bg: null
  });
  const lastSelectionRef = useRef(null);
  const [initialData] = useState(() => {
    const base = initialScene ?? (pages ? createBlankScene(pageSize) : null);
    return {
      ...base ?? {},
      appState: {
        // Object snapping on by default — the analogue of the Canva clone's
        // alignment guidelines. A stored scene's own appState still wins.
        objectsSnapModeEnabled: true,
        // Excalidraw draws frame outlines with ROUNDED corners (no public
        // radius knob). Pages must read as straight-edged sheets, so the
        // native outline is off and each page's locked "paper" rect (sharp
        // corners, hairline border) is the page's visual instead.
        frameRendering: { enabled: true, clip: true, name: true, outline: false },
        ...brandDefaults(brand),
        ...(base == null ? void 0 : base.appState) ?? {}
      }
    };
  });
  const pendingHydration = useRef((((_a = initialData == null ? void 0 : initialData.elements) == null ? void 0 : _a.length) ?? 0) > 0);
  const emitScene = useDebouncedCallback((scene) => {
    onSceneChange == null ? void 0 : onSceneChange(scene);
  }, changeDebounceMs);
  useEffect(() => {
    if (!pages || !api || didInitPages.current) return;
    let unsub = null;
    let timer = null;
    const run = () => {
      if (didInitPages.current) return;
      if (pendingHydration.current) {
        if (api.getSceneElements().length === 0) return;
        pendingHydration.current = false;
      }
      didInitPages.current = true;
      unsub == null ? void 0 : unsub();
      if (timer) clearTimeout(timer);
      const existing = listPages(api);
      if (existing.length === 0) {
        const id = addPage(api, pageSize, { capture: "never" });
        goToPage(api, id);
        setActivePageId(id);
        return;
      }
      ensurePagePapers(api, "never");
      relayoutPages(api, "never");
      setActivePageId((current) => {
        if (current) return current;
        goToPage(api, existing[0].id);
        return existing[0].id;
      });
    };
    const RETRY_MS = 250;
    const DEADLINE_MS = 5e3;
    let waited = 0;
    const tick = () => {
      run();
      if (didInitPages.current) return;
      waited += RETRY_MS;
      if (waited < DEADLINE_MS) {
        timer = setTimeout(tick, RETRY_MS);
        return;
      }
      pendingHydration.current = false;
      const rescue = (initialData == null ? void 0 : initialData.elements) ?? [];
      if (rescue.length && api.getSceneElements().length === 0) {
        commitElements(api, rescue, "never");
      }
      run();
    };
    unsub = api.onChange(run);
    timer = setTimeout(tick, RETRY_MS);
    return () => {
      unsub == null ? void 0 : unsub();
      if (timer) clearTimeout(timer);
    };
  }, [pages, api, pageSize, initialData]);
  const normalizePages = useDebouncedCallback(() => {
    const live = apiRef.current;
    if (!live || !didInitPages.current) return;
    ensurePagePapers(live, "never");
    relayoutPages(live, "never");
  }, 600);
  useEffect(() => {
    if (!pages || !api || viewMode) return;
    return api.onChange(normalizePages);
  }, [pages, api, viewMode, normalizePages]);
  useEffect(() => {
    if (!pages || !api) return;
    let timer = null;
    const unsub = api.onScrollChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const [x1, y1, x2, y2] = getVisibleSceneBounds(api.getAppState());
        let best = null;
        for (const e of api.getSceneElements()) {
          if (e.type !== "frame") continue;
          const w = Math.min(e.x + e.width, x2) - Math.max(e.x, x1);
          const h = Math.min(e.y + e.height, y2) - Math.max(e.y, y1);
          if (w <= 0 || h <= 0) continue;
          const area = w * h;
          if (!best || area > best.area) best = { id: e.id, area };
        }
        if (best) {
          const id = best.id;
          setActivePageId((current) => current === id ? current : id);
        }
      }, 150);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [pages, api]);
  useEffect(() => {
    if (!pages || !api) return;
    const onKey = (ev) => {
      if (ev.key !== "PageUp" && ev.key !== "PageDown") return;
      const target = ev.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const appState = api.getAppState();
      if (appState.editingTextElement) return;
      const list = listPages(api);
      if (list.length < 2) return;
      ev.preventDefault();
      setActivePageId((current) => {
        const idx = Math.max(0, list.findIndex((p) => p.id === current));
        const step = ev.key === "PageDown" ? 1 : -1;
        const next = list[(idx + step + list.length) % list.length];
        goToPage(api, next.id);
        return next.id;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages, api]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: rootRef,
      className,
      "data-canvas2": "",
      "data-canvas2-narrow": narrow ? "" : void 0,
      style: { position: "relative", width: "100%", height: "100%" },
      onDragOverCapture: (e) => {
        if (!onFilesDrop || viewMode) return;
        if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
        if (!isOverCanvas(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      },
      onDropCapture: (e) => {
        if (!onFilesDrop || viewMode || !isOverCanvas(e.target)) return;
        const imagenes = Array.from(e.dataTransfer.files ?? []).filter(
          (f) => f.type.startsWith("image/")
        );
        if (imagenes.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const at = scenePointOf(e);
        if (!at) return;
        onFilesDrop(imagenes, at);
      },
      onDragOver: (e) => {
        if (!onMediaDrop || viewMode) return;
        if (!e.dataTransfer.types.includes(mediaDropType)) return;
        if (!isOverCanvas(e.target)) {
          if (swapTarget) setSwapTarget(null);
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = copyDropEffect(e.dataTransfer.effectAllowed);
        const hit = hitAt(e);
        setSwapTarget((prev) => (prev == null ? void 0 : prev.id) === (hit == null ? void 0 : hit.id) ? prev : hit);
      },
      onDragLeave: (e) => {
        if (swapTarget && !e.currentTarget.contains(e.relatedTarget)) {
          setSwapTarget(null);
        }
      },
      onDrop: (e) => {
        if (!onMediaDrop || viewMode) return;
        setSwapTarget(null);
        if (!isOverCanvas(e.target)) return;
        const payload = e.dataTransfer.getData(mediaDropType);
        if (!payload) return;
        e.preventDefault();
        const at = scenePointOf(e);
        if (!at) return;
        const hit = e.shiftKey ? hitAt(e) : null;
        onMediaDrop(payload, at, hit ? { replaceElementId: hit.id } : void 0);
      },
      children: [
        /* @__PURE__ */ jsx(
          Excalidraw,
          {
            initialData,
            viewModeEnabled: viewMode,
            langCode,
            aiEnabled: false,
            UIOptions: {
              canvasActions: { saveAsImage: nativeImageExport },
              dockedSidebarBreakpoint
            },
            ...theme ? { theme } : {},
            excalidrawAPI: (instance) => {
              apiRef.current = instance;
              setApi(instance);
              onReady == null ? void 0 : onReady(instance);
            },
            onChange: (elements, appState, files) => {
              if (pages && appState.selectedElementIds !== lastSelectionRef.current) {
                lastSelectionRef.current = appState.selectedElementIds;
                const selected = Object.keys(appState.selectedElementIds).find(
                  (id) => appState.selectedElementIds[id]
                );
                if (selected) {
                  const el = elements.find((e) => e.id === selected);
                  const frameId = el ? el.type === "frame" ? el.id : el.frameId : null;
                  if (frameId) {
                    setActivePageId((current) => current === frameId ? current : frameId);
                  }
                }
              }
              if (!onSceneChange) return;
              const bg = appState.viewBackgroundColor;
              if (elements === lastEmittedRef.current.elements && bg === lastEmittedRef.current.bg) {
                return;
              }
              lastEmittedRef.current = { elements, bg };
              const live = getNonDeletedElements(elements);
              const referenced = new Set(
                live.filter(
                  (e) => e.type === "image" && Boolean(e.fileId)
                ).map((e) => e.fileId)
              );
              const prunedFiles = files ? Object.fromEntries(Object.entries(files).filter(([id]) => referenced.has(id))) : files;
              emitScene({
                elements: live,
                appState: { viewBackgroundColor: bg },
                files: prunedFiles
              });
            },
            children: pages ? /* @__PURE__ */ jsx(
              CanvasMenu,
              {
                api,
                activePageId,
                viewMode,
                hydrateFiles,
                fontFaces: fuentes.faces,
                brandFamilies: { heading: brand.headingFamily, body: brand.bodyFamily },
                onSaveComponent,
                labels
              }
            ) : null
          }
        ),
        swapTarget && api ? (() => {
          const s = api.getAppState();
          const z = s.zoom.value;
          const acento = palette[theme ?? "light"].active;
          return /* @__PURE__ */ jsx(
            "div",
            {
              "data-testid": "canvas2-swap-target",
              style: {
                position: "absolute",
                left: (swapTarget.x + s.scrollX) * z,
                top: (swapTarget.y + s.scrollY) * z,
                width: swapTarget.width * z,
                height: swapTarget.height * z,
                border: `2px solid ${acento}`,
                borderRadius: 4,
                background: `${acento}29`,
                pointerEvents: "none",
                zIndex: 90
              }
            }
          );
        })() : null,
        /* @__PURE__ */ jsx(
          VideoFramePicker,
          {
            api,
            theme,
            viewMode,
            labels,
            resolveVideoSrc,
            releaseVideoSrc,
            onPickFrame: onPickVideoFrame
          }
        ),
        pages && /* @__PURE__ */ jsx(
          LooseWarning,
          {
            api,
            activePageId,
            theme,
            viewMode,
            labels
          }
        ),
        pages && api && /* @__PURE__ */ jsx(
          PageNavigator,
          {
            api,
            theme,
            narrow,
            viewMode,
            activeId: activePageId,
            onActiveChange: setActivePageId,
            pageSize,
            thumbnails: pageThumbnails,
            thumbnailFiles: pageThumbnailFiles,
            labels
          }
        ),
        /* @__PURE__ */ jsx(LibraryPanel, { theme, viewMode, labels, children: library }),
        /* @__PURE__ */ jsx(
          RightDock,
          {
            api,
            activePageId,
            theme,
            narrow,
            viewMode,
            brandKit,
            layers: layers && pages,
            design: pages,
            componentsPanel,
            labels
          }
        ),
        pages && api && !viewMode && /* @__PURE__ */ jsx(
          PageActions,
          {
            api,
            activePageId,
            theme,
            onActiveChange: setActivePageId,
            labels
          }
        )
      ]
    }
  );
}
const Canvas2 = Canvas2Editor;
export {
  getPageBackground as $,
  convertToPages as A,
  BrandGallery as B,
  Canvas2 as C,
  DEFAULT_LABELS as D,
  EMPTY_BRAND as E,
  createBlankScene as F,
  dataUrlToBlob as G,
  deletePage as H,
  downloadBlob as I,
  duplicatePage as J,
  ensurePagePapers as K,
  LayersPanel as L,
  MEDIA_DROP_TYPE as M,
  exportScenePdf as N,
  exportScenePng as O,
  PANEL_FONT as P,
  exportSceneSvg as Q,
  RightDock as R,
  exportStoredScenePng as S,
  TEXT_PRESETS as T,
  exportStoredSceneSvg as U,
  VideoFramePicker as V,
  extendToPage as W,
  externalizeInlineImages as X,
  findInlineImageIds as Y,
  fitAllPages as Z,
  fontFamilyId as _,
  Canvas2Editor as a,
  getPageSize as a0,
  getSelectedVideo as a1,
  getVideoMeta as a2,
  hideNativeDragImage as a3,
  imageAtScenePoint as a4,
  insertImageFromBlob as a5,
  insertImageFromUrl as a6,
  insertImageWithPreview as a7,
  insertTextPreset as a8,
  insertVideo as a9,
  setVideoPoster as aA,
  storedScenePageCount as aB,
  usePageThumbnails as aC,
  isInlineDataUrl as aa,
  isPageBackground as ab,
  isPageLocked as ac,
  isVideoElement as ad,
  listPages as ae,
  looseElements as af,
  movePage as ag,
  movePageTo as ah,
  paginateSceneInArray as ai,
  parseScene as aj,
  patchElement as ak,
  registerCustomFont as al,
  registerCustomFonts as am,
  relayoutPages as an,
  renamePage as ao,
  reorderPageMembers as ap,
  replaceImageFromUrl as aq,
  resizePage as ar,
  resolveBrandKit as as,
  resolveInsertPageId as at,
  restoreScene as au,
  sendMemberToBack as av,
  serializeScene as aw,
  setAsBackground as ax,
  setPageBackgroundColor as ay,
  setPageLocked as az,
  CanvasMenu as b,
  DesignPanel as c,
  DragPreview as d,
  LibraryPanel as e,
  PageActions as f,
  PageNavigator as g,
  buildPersistableFiles as h,
  packPagesInArray as i,
  commitElements as j,
  goToPage as k,
  DEFAULT_PAGE_SIZE as l,
  mergeLabels as m,
  PAGE_ALIGNMENTS as n,
  PAGE_SIZE_PRESETS as o,
  palette as p,
  VIDEO_MARKER as q,
  renumberPagesInArray as r,
  addPage as s,
  adoptLooseIntoPage as t,
  adoptStrayFramesInArray as u,
  alignToPage as v,
  captureThumbnail as w,
  cascadePoints as x,
  clusterLooseElements as y,
  contrastTextColor as z
};
//# sourceMappingURL=Canvas2-pzqHVahU.js.map
