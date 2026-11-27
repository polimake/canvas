function estimateTextHeight(text, fontSize, lineHeight, width) {
  const perLine = Math.max(1, width / (fontSize * 0.5));
  const lines = text.split("\n").reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / perLine)), 0);
  return lines * fontSize * lineHeight;
}
class DocumentImportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DocumentImportError";
  }
}
function readBytes(input, limits = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length) throw new DocumentImportError("invalid-file", "The file is empty.");
  if (bytes.length > (limits.maxFileBytes ?? 64 * 1024 * 1024)) {
    throw new DocumentImportError("limit-exceeded", "The file exceeds maxFileBytes.");
  }
  return bytes;
}
export {
  DocumentImportError as D,
  estimateTextHeight as e,
  readBytes as r
};
//# sourceMappingURL=model-Jk--sAmK.js.map
