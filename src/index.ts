export { Canvas2Editor, Canvas2, default } from './Canvas2';
export type { Canvas2EditorProps, Canvas2Scene, Canvas2Api } from './Canvas2';

// ─── Pages / artboards (frames-as-pages) ──────────────────────────────────────
export { PageNavigator } from './PageNavigator';
export type { PageNavigatorProps } from './PageNavigator';
export {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_PRESETS,
  createBlankScene,
  listPages,
  getPageSize,
  addPage,
  deletePage,
  renamePage,
  duplicatePage,
  resizePage,
  relayoutPages,
  movePage,
  isPageLocked,
  setPageLocked,
  goToPage,
} from './pages';
export type { PageInfo, PageSize, PageSizePreset } from './pages';
export { PAGE_ALIGNMENTS, alignToPage } from './align';
export type { PageAlignment } from './align';

// ─── Layers panel + image ops ─────────────────────────────────────────────────
export { LayersPanel } from './LayersPanel';
export type { LayersPanelProps } from './LayersPanel';
export { setAsBackground, extendToPage } from './imageOps';
export { reorderPageMembers, sendMemberToBack } from './zorder';
export { palette, PANEL_FONT } from './theme';
export type { Palette, Canvas2Theme } from './theme';

// ─── Persistence (scene ↔ JSON) ───────────────────────────────────────────────
export { serializeScene, parseScene } from './serialize';

// ─── Export (PNG / SVG / PDF / thumbnail) ─────────────────────────────────────
export {
  exportScenePng,
  exportSceneSvg,
  exportScenePdf,
  captureThumbnail,
  downloadBlob,
} from './export';
export type { ExportOptions } from './export';

// ─── Media (programmatic image insertion — MM seam) ───────────────────────────
export {
  insertImageDataURL,
  insertImageFromBlob,
  insertImageFromUrl,
} from './media';
export type { InsertImageOptions } from './media';

// ─── Text presets + page background ───────────────────────────────────────────
export { TEXT_PRESETS, insertTextPreset } from './text';
export type { TextPreset, TextPresetKey } from './text';
export { getPageBackground, setPageBackgroundColor } from './background';
