function normalize(text) {
  return text.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").toLowerCase();
}
function index(pages, fonts, assetIds) {
  const text = pages.map((p) => `${p.name}
${p.text}`).join("\n\n");
  return {
    version: 1,
    pages,
    text,
    fonts: [...new Set(fonts)].sort(),
    assetIds: [...new Set(assetIds)].sort(),
    tokens: [...new Set(normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [])].sort()
  };
}
function indexDocument(document) {
  return index(
    document.pages.map((page) => ({
      id: page.id,
      name: page.name,
      text: [page.extractedText ?? page.elements.filter((e) => e.kind === "text").map((e) => e.text ?? "").join("\n"), page.notes ?? ""].filter(Boolean).join("\n"),
      elementCount: page.elements.length
    })),
    document.pages.flatMap((p) => p.elements.flatMap((e) => e.fontFamily ? [e.fontFamily] : [])),
    document.assets.map((a) => a.id)
  );
}
function indexScene(scene) {
  const elements = (scene.elements ?? []).filter((e) => !e.isDeleted);
  const frames = elements.filter((e) => e.type === "frame").slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
  const frameIds = new Set(frames.map((f) => f.id));
  const pages = frames.map((f) => ({
    id: f.id,
    name: f.name ?? "",
    text: elements.filter((e) => e.frameId === f.id && e.type === "text").map((e) => e.text ?? "").join("\n"),
    elementCount: elements.filter((e) => e.frameId === f.id).length
  }));
  const loose = elements.filter((e) => e.type !== "frame" && !frameIds.has(e.frameId ?? ""));
  if (loose.length) pages.push({ id: "__unframed__", name: "Unframed", text: loose.filter((e) => e.type === "text").map((e) => e.text ?? "").join("\n"), elementCount: loose.length });
  return index(pages, elements.flatMap((e) => e.type === "text" && e.fontFamily !== void 0 ? [String(e.fontFamily)] : []), elements.flatMap((e) => e.type === "image" && e.fileId ? [e.fileId] : []));
}
function indexPsd(document, options = {}) {
  const fonts = [], assets = [], pages = [];
  const root = { id: "document", name: "Photoshop", text: "", elementCount: 0 };
  function visit(layers, parent, address = []) {
    layers.forEach((layer, i) => {
      var _a, _b, _c, _d, _e;
      if (layer.hidden && !options.includeHidden) return;
      const path = [...address, i], id = path.join(".");
      const page = layer.artboard ? { id: `artboard-${id}`, name: layer.name ?? "", text: "", elementCount: 0 } : parent;
      if (layer.artboard) pages.push(page);
      page.elementCount++;
      page.text += [layer.name, (_a = layer.text) == null ? void 0 : _a.text].filter(Boolean).join("\n") + "\n";
      for (const style of [(_b = layer.text) == null ? void 0 : _b.style, ...((_d = (_c = layer.text) == null ? void 0 : _c.styleRuns) == null ? void 0 : _d.map((r) => r.style)) ?? []]) if ((_e = style == null ? void 0 : style.font) == null ? void 0 : _e.name) fonts.push(style.font.name);
      if (layer.rawData || layer.imageData || layer.canvas || layer.placedLayer) assets.push(id);
      if (layer.children) visit(layer.children, page, path);
    });
  }
  visit(document.children ?? [], root);
  if (root.elementCount || !pages.length) pages.unshift(root);
  return index(pages, fonts, assets);
}
function searchDocument(indexed, query) {
  const terms = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) return [];
  return indexed.pages.filter((page) => {
    const text = normalize(`${page.name}
${page.text}`);
    return terms.every((term) => text.includes(term));
  });
}
export {
  indexDocument,
  indexPsd,
  indexScene,
  searchDocument
};
//# sourceMappingURL=indexers.js.map
