import { convertToExcalidrawElements, CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

/**
 * Programmatic image insertion — the seam media integrations plug into.
 *
 * Excalidraw natively handles drag / paste / file-picker images, so this exists
 * for *programmatic* inserts: the MediaMonster library, AI artifacts, etc. The
 * full MM `MediaBrowser` (which needs a studio project context) reuses
 * `insertImageFromUrl` once canvas2 is embedded in a project — see the plan.
 *
 * Excalidraw stores image bytes as a dataURL in its files map (no remote-URL
 * elements), so a URL source is fetched and inlined.
 */

type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number];
type FrameElement = Extract<SceneElement, { type: 'frame' }>;
type SceneElements = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['elements'];

export interface InsertImageOptions {
  /** Place the image onto this page (frame). Defaults to the first page. */
  pageId?: string;
}

function createFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `file_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function frames(api: ExcalidrawImperativeAPI): FrameElement[] {
  return api
    .getSceneElements()
    .filter((e): e is FrameElement => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });
}

/**
 * Insert an already-decoded image (dataURL + intrinsic size) onto a page,
 * scaled to fit and centered. Returns the generated file id.
 */
export function insertImageDataURL(
  api: ExcalidrawImperativeAPI,
  file: { dataURL: string; mimeType: string; width: number; height: number },
  opts?: InsertImageOptions,
): string {
  const fileId = createFileId();
  const mimeType = file.mimeType?.startsWith('image/') ? file.mimeType : 'image/png';

  api.addFiles([
    { id: fileId, dataURL: file.dataURL, mimeType, created: Date.now() },
  ] as Parameters<ExcalidrawImperativeAPI['addFiles']>[0]);

  const pages = frames(api);
  const target = (opts?.pageId && pages.find((f) => f.id === opts.pageId)) || pages[0] || null;
  const box = target
    ? { x: target.x, y: target.y, w: target.width, h: target.height }
    : { x: 0, y: 0, w: 800, h: 600 };

  // Contain within the page with a small margin, centered.
  const fit = Math.min((box.w * 0.9) / file.width, (box.h * 0.9) / file.height, 1);
  const w = Math.max(1, file.width * fit);
  const h = Math.max(1, file.height * fit);
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;

  const skeleton = [
    { type: 'image', fileId, x, y, width: w, height: h, status: 'saved' },
  ] as Parameters<typeof convertToExcalidrawElements>[0];

  const created = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((el) =>
    target ? { ...el, frameId: target.id } : el,
  );

  api.updateScene({
    elements: [...api.getSceneElements(), ...created] as SceneElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return fileId;
}

/** Insert an image from a Blob/File (e.g. a file picker or clipboard). */
export async function insertImageFromBlob(
  api: ExcalidrawImperativeAPI,
  blob: Blob,
  opts?: InsertImageOptions,
): Promise<string> {
  const dataURL = await blobToDataURL(blob);
  const { width, height } = await loadImageSize(dataURL);
  return insertImageDataURL(api, { dataURL, mimeType: blob.type, width, height }, opts);
}

/**
 * Insert an image from a URL (e.g. a MediaMonster CDN asset). The URL must be
 * CORS-readable so its bytes can be inlined as a dataURL.
 */
export async function insertImageFromUrl(
  api: ExcalidrawImperativeAPI,
  url: string,
  opts?: InsertImageOptions,
): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  return insertImageFromBlob(api, await res.blob(), opts);
}
