import { dedupeFontFaces } from "../fonts.js";
const PAGE_GAP = 48;
function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
function cloneSceneElements(group, { dx = 0, dy = 0, fileIdMap } = {}) {
  const idMap = /* @__PURE__ */ new Map();
  for (const e of group) idMap.set(e.id, createId("el"));
  const groupIdMap = /* @__PURE__ */ new Map();
  const clones = group.map((e) => {
    const clone = JSON.parse(JSON.stringify(e));
    clone.id = idMap.get(e.id);
    clone.x = clone.x + dx;
    clone.y = clone.y + dy;
    clone.version = (clone.version ?? 0) + 1;
    clone.versionNonce = Math.floor(Math.random() * 2 ** 31);
    clone.updated = Date.now();
    delete clone.index;
    if (typeof clone.frameId === "string" && idMap.has(clone.frameId)) {
      clone.frameId = idMap.get(clone.frameId);
    }
    if (typeof clone.containerId === "string" && idMap.has(clone.containerId)) {
      clone.containerId = idMap.get(clone.containerId);
    }
    if (Array.isArray(clone.boundElements)) {
      clone.boundElements = clone.boundElements.map(
        (b) => idMap.has(b.id) ? { ...b, id: idMap.get(b.id) } : b
      );
    }
    for (const key of ["startBinding", "endBinding"]) {
      const binding = clone[key];
      if ((binding == null ? void 0 : binding.elementId) && idMap.has(binding.elementId)) {
        clone[key] = { ...binding, elementId: idMap.get(binding.elementId) };
      }
    }
    if (Array.isArray(clone.groupIds)) {
      clone.groupIds = clone.groupIds.map((g) => {
        if (!groupIdMap.has(g)) groupIdMap.set(g, createId("gr"));
        return groupIdMap.get(g);
      });
    }
    if (fileIdMap && typeof clone.fileId === "string") {
      if (!fileIdMap.has(clone.fileId)) fileIdMap.set(clone.fileId, createId("file"));
      clone.fileId = fileIdMap.get(clone.fileId);
    }
    return clone;
  });
  return { clones, idMap };
}
function measureWrappedText(text, { width, fontSize, lineHeight = 1.2, factor = 0.52 }) {
  const max = Math.max(6, Math.floor(width / (fontSize * factor)));
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > max && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  const kept = lines.filter((l) => l !== "" || lines.length === 1);
  return { lines: kept, text: kept.join("\n"), height: kept.length * fontSize * lineHeight };
}
function fitImageInBox(ratio, box) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5;
  let width = box.width;
  let height = box.width / safeRatio;
  if (height > box.height) {
    height = box.height;
    width = box.height * safeRatio;
  }
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height
  };
}
const SUGAR_RE = /^\{\{\s*([\w-]+)\s*\}\}$/;
function slotFromCustomData(e) {
  const data = e.customData;
  if (!data || data.c2 !== "slot" || typeof data.name !== "string" || !data.name) return null;
  const type = e.type === "image" ? "image" : e.type === "text" ? "text" : null;
  if (!type) return null;
  const maxChars = typeof data.maxChars === "number" && Number.isFinite(data.maxChars) && data.maxChars > 0 ? Math.round(data.maxChars) : void 0;
  return { name: data.name, type, elementId: e.id, maxChars };
}
function listSlots(elements) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (slot) => {
    if (seen.has(slot.name)) return;
    seen.add(slot.name);
    out.push(slot);
  };
  for (const e of elements) {
    const tagged = slotFromCustomData(e);
    if (tagged) push(tagged);
  }
  for (const e of elements) {
    if (e.type !== "text") continue;
    const match = SUGAR_RE.exec(e.text ?? "");
    if (match) push({ name: match[1], type: "text", elementId: e.id, implicit: true });
  }
  if (!out.some((s) => s.type === "image")) {
    let biggest = null;
    for (const e of elements) {
      if (e.type !== "image") continue;
      const area = (e.width ?? 0) * (e.height ?? 0);
      if (!biggest || area > (biggest.width ?? 0) * (biggest.height ?? 0)) biggest = e;
    }
    if (biggest && !seen.has("foto")) {
      out.push({ name: "foto", type: "image", elementId: biggest.id, implicit: true });
    }
  }
  return out;
}
function deriveComponentMeta(elements, { description = "", tags } = {}) {
  const slots = {};
  for (const s of listSlots(elements)) {
    slots[s.name] = { type: s.type, ...s.maxChars ? { maxChars: s.maxChars } : {} };
  }
  return {
    description,
    ...(tags == null ? void 0 : tags.length) ? { tags } : {},
    ...Object.keys(slots).length ? { slots } : {}
  };
}
function isCanvas2EditorConfig(cfg) {
  return !!cfg && typeof cfg === "object" && !Array.isArray(cfg) && Array.isArray(cfg.elements);
}
function normalizeFonts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f) => !!f && typeof f === "object" && typeof f.family === "string" && typeof f.src === "string"
  );
}
function extractComponentFragment(editorConfig, pageIndex = 0) {
  if (!isCanvas2EditorConfig(editorConfig)) return null;
  const elements = editorConfig.elements.filter(
    (e) => !e.isDeleted
  );
  const frames = elements.filter((e) => e.type === "frame").sort((a, b) => a.x - b.x);
  const frame = frames[pageIndex];
  if (!frame) return null;
  const members = elements.filter((e) => e.frameId === frame.id);
  const referenced = /* @__PURE__ */ new Set();
  for (const e of members) {
    const fileId = e.fileId;
    if (typeof fileId === "string") referenced.add(fileId);
  }
  const files = {};
  const rawFiles = editorConfig.files ?? {};
  for (const id of referenced) {
    if (rawFiles[id]) files[id] = rawFiles[id];
  }
  return {
    frame,
    members,
    files,
    fonts: normalizeFonts(editorConfig.fonts),
    pageSize: { width: frame.width, height: frame.height }
  };
}
function mimeFromUrl(url) {
  const clean = url.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
function fillSlots(clones, files, values) {
  if (!Object.keys(values).length) return { unknown: [] };
  const slots = listSlots(clones);
  const byName = new Map(slots.map((s) => [s.name, s]));
  const byId = new Map(clones.map((e) => [e.id, e]));
  const unknown = [];
  for (const [name, value] of Object.entries(values)) {
    const slot = byName.get(name);
    const el = slot ? byId.get(slot.elementId) : void 0;
    if (!slot || !el) {
      unknown.push(name);
      continue;
    }
    if (slot.type === "text") {
      const text = typeof value === "string" ? value : value.url;
      const fontSize = typeof el.fontSize === "number" ? el.fontSize : 24;
      const lineHeight = typeof el.lineHeight === "number" ? el.lineHeight : 1.2;
      const width = typeof el.width === "number" ? el.width : 400;
      const wrapped = measureWrappedText(text, { width, fontSize, lineHeight });
      el.text = wrapped.text;
      el.originalText = text;
      el.height = wrapped.height;
      el.autoResize = false;
    } else {
      const image = typeof value === "string" ? { url: value } : value;
      if (!image.url) {
        unknown.push(name);
        continue;
      }
      const fileId = createId("file");
      files[fileId] = {
        id: fileId,
        dataURL: image.url,
        mimeType: mimeFromUrl(image.url),
        created: Date.now()
      };
      el.fileId = fileId;
      if (image.w && image.h) {
        const box = {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height
        };
        Object.assign(el, fitImageInBox(image.w / image.h, box));
      }
      el.crop = null;
    }
  }
  return { unknown };
}
function instantiateComponent(fragment, { slots = {}, dx = 0, dy = 0 } = {}) {
  const fileIdMap = /* @__PURE__ */ new Map();
  const { clones, idMap } = cloneSceneElements([fragment.frame, ...fragment.members], {
    dx,
    dy,
    fileIdMap
  });
  const files = {};
  for (const [oldId, newId] of fileIdMap) {
    const entry = fragment.files[oldId];
    if (entry) files[newId] = { ...entry, id: newId };
  }
  const { unknown } = fillSlots(clones, files, slots);
  return {
    elements: clones,
    files,
    fonts: fragment.fonts,
    pageId: idMap.get(fragment.frame.id),
    pageSize: fragment.pageSize,
    unknownSlots: unknown
  };
}
function appendComponentToEditorConfig(editorConfig, fragment, { slots = {} } = {}) {
  if (!isCanvas2EditorConfig(editorConfig)) return null;
  const elements = editorConfig.elements.filter(
    (e) => !e.isDeleted
  );
  const frames = elements.filter((e) => e.type === "frame").sort((a, b) => a.x - b.x);
  const last = frames[frames.length - 1] ?? null;
  const dx = last ? last.x + last.width + PAGE_GAP - fragment.frame.x : 0;
  const dy = last ? last.y - fragment.frame.y : 0;
  const instance = instantiateComponent(fragment, { slots, dx, dy });
  const existingFiles = editorConfig.files ?? {};
  const existingFonts = normalizeFonts(editorConfig.fonts);
  const mergedFonts = dedupeFontFaces([...existingFonts, ...instance.fonts]);
  return {
    editorConfig: {
      ...editorConfig,
      elements: [...elements, ...instance.elements],
      appState: editorConfig.appState ?? {},
      files: { ...existingFiles, ...instance.files },
      ...mergedFonts.length ? { fonts: mergedFonts } : {}
    },
    pages: frames.length + 1,
    pageId: instance.pageId,
    unknownSlots: instance.unknownSlots
  };
}
export {
  PAGE_GAP as P,
  appendComponentToEditorConfig as a,
  cloneSceneElements as c,
  deriveComponentMeta as d,
  extractComponentFragment as e,
  fitImageInBox as f,
  instantiateComponent as i,
  listSlots as l,
  measureWrappedText as m
};
//# sourceMappingURL=components-DcB7nahO.js.map
