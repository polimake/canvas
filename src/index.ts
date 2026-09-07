export { Canvas2Editor, Canvas2, default } from './Canvas2';
export type { Canvas2EditorProps, Canvas2Scene, Canvas2Api } from './Canvas2';
// Tipo de dataTransfer para soltar media de la biblioteca sobre el lienzo.
export { MEDIA_DROP_TYPE } from './Canvas2';

// ─── Pages / artboards (frames-as-pages) ──────────────────────────────────────
export { PageNavigator } from './PageNavigator';
export type { PageNavigatorProps } from './PageNavigator';
// Tarjeta que sigue al cursor al arrastrar, con el mismo gesto que el
// calendario. Se exporta por si un host quiere el mismo levantado.
export { DragPreview, hideNativeDragImage } from './DragPreview';
export type { DragPreviewProps, DragGrab } from './DragPreview';
export {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_PRESETS,
  createBlankScene,
  listPages,
  getPageSize,
  addPage,
  deletePage,
  fitAllPages,
  renamePage,
  duplicatePage,
  resizePage,
  relayoutPages,
  packPagesInArray,
  renumberPagesInArray,
  movePage,
  movePageTo,
  isPageLocked,
  setPageLocked,
  goToPage,
} from './pages';
export type { PageInfo, PageSize, PageSizePreset } from './pages';
// Paginar una escena que llegó sin páginas (importada, pegada, arrastrada).
export {
  convertToPages,
  adoptLooseIntoPage,
  paginateSceneInArray,
  clusterLooseElements,
  looseElements,
} from './paginate';
export type { PaginateOptions, PaginateResult } from './paginate';
// Separación entre páginas. El host la necesita para razonar sobre el layout
// sin duplicar el número.
export { PAGE_GAP } from './layout';
export { patchElement, commitElements } from './mutate';
// Miniaturas por página para tiras de navegación (host o PageNavigator).
export { usePageThumbnails } from './pageThumbnails';
export type { FilesMap } from './pageThumbnails';

// ─── Export: hidratación de imágenes remotas ─────────────────────────────────
export { buildHydratedFiles, clearHydrationCache } from './exportHydrate';
export type { MediaFetcher, HydratedFiles } from './exportHydrate';

// ─── Conversión desde el editor legacy ───────────────────────────────────────
export { legacyToScene, parseLegacyText } from './legacy';
export type { ConversionReport, ConversionTier, ConversionNote, LegacyScene } from './legacy';

// ─── Importación desde Photoshop ─────────────────────────────────────────────
// El convertidor es PURO: recibe un documento ya parseado, no bytes. Quien lee
// el .psd es `scripts/import-psd.ts`, que es el único sitio con `ag-psd`.
// `listImagePlaceholders` es la otra mitad del contrato: localiza los huecos que
// dejó la importación para cambiarlos por fotos de MediaMonster.
export {
  psdToScene,
  listImagePlaceholders,
  psdColorToHex,
  splitPostScriptFont,
  flattenBezierPath,
  groupStyleRuns,
  resetPsdIdCounter,
  postScriptStyleToCss,
  countSubpaths,
  PSD_IMAGE_MARKER,
  DEFAULT_MAX_SUBPATHS,
} from './psd';
export type {
  PsdDocument,
  PsdLayer,
  PsdScene,
  PsdReport,
  PsdNote,
  PsdTier,
  PsdAssetSlot,
  PsdImportOptions,
  PsdImagePlaceholder,
  PsdFontSource,
} from './psd';
export type { CaptureMode } from './mutate';
export { PAGE_ALIGNMENTS, alignToPage } from './align';
export type { PageAlignment } from './align';

// ─── Layers panel + image ops ─────────────────────────────────────────────────
export { LayersPanel } from './LayersPanel';
export type { LayersPanelProps } from './LayersPanel';
// Menú principal del editor (fondo de página, tamaño, exportar). Lo monta
// Canvas2Editor; se exporta para hosts que compongan su propio editor.
export { CanvasMenu } from './CanvasMenu';
export type { CanvasMenuProps } from './CanvasMenu';
// Acciones de la página activa, flotando sobre el lienzo junto a su nombre.
export { PageActions } from './PageActions';
export type { PageActionsProps } from './PageActions';
export { setAsBackground, extendToPage } from './imageOps';
export { reorderPageMembers, sendMemberToBack } from './zorder';
export { palette, PANEL_FONT } from './theme';
// Contrato de textos: canvas2 no lleva i18n dentro, el host inyecta.
export { DEFAULT_LABELS, mergeLabels } from './labels';
export type { Canvas2Labels, PartialLabels } from './labels';
export type { Palette, Canvas2Theme } from './theme';

// ─── Identidad de marca ───────────────────────────────────────────────────────
// `Canvas2Editor` recibe `projects.brandKit` CRUDO y lo traduce dentro: si el
// host tuviera que llamar a `resolveBrandKit`, importaría un valor de este
// barrel y arrastraría Excalidraw al bundle de servidor.
// `BrandGallery` la monta el propio editor, abajo a la derecha del lienzo.
export { resolveBrandKit, EMPTY_BRAND } from './brand';
export type { Canvas2Brand, BrandKitInput, BrandFontFace } from './brand';

// ─── Tipografías propias ──────────────────────────────────────────────────────
// El id numérico de familia es una función PURA del nombre, así que el
// convertidor (node) y el editor (navegador) calculan el mismo sin hablarse.
// Ver la cabecera de `fonts.ts` para el mecanismo completo.
export {
  customFontFamilyId,
  fontFamilyAlias,
  normalizeFontName,
  buildFontFaceCss,
  dedupeFontFaces,
  EXCALIDRAW_BUILTIN_FAMILIES,
} from './fonts';
export type { CustomFontFace } from './fonts';
export { registerCustomFont, registerCustomFonts, fontFamilyId } from './fontRegistry';
export type { RegisteredFont } from './fontRegistry';
export { BrandGallery } from './BrandGallery';
export type { BrandGalleryProps } from './BrandGallery';
// Dock inferior derecho: Capas y Marca en pestañas. Lo monta Canvas2Editor.
export { RightDock } from './RightDock';
export type { RightDockProps } from './RightDock';
// Marco de la biblioteca (arriba a la derecha). El CONTENIDO lo pone el host:
// la mediateca vive en apps/web sobre @polimake/ui.
export { LibraryPanel } from './LibraryPanel';
export type { LibraryPanelProps } from './LibraryPanel';

// ─── Persistence (scene ↔ JSON) ───────────────────────────────────────────────
export { serializeScene, parseScene, restoreScene } from './serialize';
export type { StoredScene } from './serialize';

// ─── Export (PNG / SVG / PDF / thumbnail) ─────────────────────────────────────
export {
  exportScenePng,
  exportSceneSvg,
  exportScenePdf,
  captureThumbnail,
  downloadBlob,
  // Render/contar una escena GUARDADA sin montar el editor (rejillas de
  // previsualización: la galería de /gallery, un selector de plantillas).
  exportStoredSceneSvg,
  exportStoredScenePng,
  storedScenePageCount,
} from './export';
export type { ExportOptions } from './export';

// ─── Media (imágenes: SIEMPRE en MediaMonster, nunca base64 en el diseño) ─────
// No se exporta ningún insertador por dataURL: la única forma de meter una
// imagen es por referencia remota o subiendo antes a MM. Ver media.ts.
export {
  insertImageFromBlob,
  insertImageFromUrl,
  externalizeInlineImages,
  buildPersistableFiles,
  findInlineImageIds,
  isInlineDataUrl,
  dataUrlToBlob,
} from './media';
export type {
  InsertImageOptions,
  MediaUploader,
  FileEntry,
  ExternalizeResult,
  PersistableFiles,
} from './media';

// ─── Componentes reutilizables ───────────────────────────────────────────────
// Motor puro en components.ts (lo comparte el worker vía el subpath
// '@pm/canvas2/components'); la integración con la escena viva, aquí.
export {
  cloneSceneElements,
  listSlots,
  deriveComponentMeta,
  extractComponentFragment,
  instantiateComponent,
  appendComponentToEditorConfig,
  measureWrappedText,
  fitImageInBox,
} from './components';
export type {
  ComponentElement,
  ComponentFileEntry,
  ComponentFragment,
  ComponentSlotInfo,
  InstantiatedComponent,
  SlotValue,
  SlotValues,
} from './components';
export { insertComponentIntoScene, extractPageForComponent } from './insertComponent';

// ─── Text presets + page background ───────────────────────────────────────────
export { TEXT_PRESETS, insertTextPreset, contrastTextColor } from './text';
export type { TextPreset, TextPresetKey } from './text';
export {
  getPageBackground,
  setPageBackgroundColor,
  ensurePagePapers,
  isPageBackground,
} from './background';

// Vídeo en el lienzo: un póster que recuerda de qué vídeo salió, para poder
// volver a elegir el fotograma. Ver la cabecera de video.ts.
export {
  insertVideo,
  setVideoPoster,
  isVideoElement,
  getVideoMeta,
  getSelectedVideo,
  VIDEO_MARKER,
} from './video';
export type { VideoMeta, InsertVideoOptions } from './video';
