export { Canvas2Editor, Canvas2, default } from './ui/editor/Canvas2';
export type { Canvas2EditorProps, Canvas2Scene, Canvas2Api } from './ui/editor/Canvas2';
export type { CanvasWorkspace } from './ui/workspaces/types';
// Tipo de dataTransfer para soltar media de la biblioteca sobre el lienzo.
export { MEDIA_DROP_TYPE } from './ui/editor/Canvas2';

// ─── Pages / artboards (frames-as-pages) ──────────────────────────────────────
export { PageNavigator } from './ui/navigation/PageNavigator';
export type { PageNavigatorProps } from './ui/navigation/PageNavigator';
// Tarjeta que sigue al cursor al arrastrar, con el mismo gesto que el
// calendario. Se exporta por si un host quiere el mismo levantado.
export { DragPreview, hideNativeDragImage } from './ui/overlays/DragPreview';
export type { DragPreviewProps, DragGrab } from './ui/overlays/DragPreview';
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
  adoptStrayFramesInArray,
  movePage,
  movePageTo,
  isPageLocked,
  setPageLocked,
  goToPage,
  focusLayer,
} from './core/pages';
export type { PageInfo, PageSize, PageSizePreset } from './core/pages';
// Paginar una escena que llegó sin páginas (importada, pegada, arrastrada).
export {
  convertToPages,
  adoptLooseIntoPage,
  paginateSceneInArray,
  clusterLooseElements,
  looseElements,
} from './core/paginate';
export type { PaginateOptions, PaginateResult } from './core/paginate';
// Separación entre páginas. El host la necesita para razonar sobre el layout
// sin duplicar el número.
export { PAGE_GAP } from './core/layout';
export { patchElement, commitElements } from './core/mutate';
// Miniaturas por página para tiras de navegación (host o PageNavigator).
export { usePageThumbnails } from './ui/hooks/pageThumbnails';
export type { FilesMap } from './ui/hooks/pageThumbnails';

// ─── Export: hidratación de imágenes remotas ─────────────────────────────────
export { buildHydratedFiles, clearHydrationCache } from './core/exportHydrate';
export type { MediaFetcher, HydratedFiles } from './core/exportHydrate';

// ─── Conversión desde el editor legacy ───────────────────────────────────────
export { legacyToScene, parseLegacyText } from './converters/legacy';
export type { ConversionReport, ConversionTier, ConversionNote, LegacyScene } from './converters/legacy';

// ─── Importación desde Photoshop ─────────────────────────────────────────────
// El convertidor es PURO: recibe un documento ya parseado, no bytes. Quien lee
// los bytes está en la entrada separada `@pm/canvas/parsers`.
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
} from './converters/psd';
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
} from './converters/psd';
export type { CaptureMode } from './core/mutate';
export { PAGE_ALIGNMENTS, alignToPage } from './core/align';
export type { PageAlignment } from './core/align';

// ─── Layers panel + image ops ─────────────────────────────────────────────────
export { LayersPanel } from './ui/panels/LayersPanel';
export type { LayersPanelProps } from './ui/panels/LayersPanel';
// Menú principal del editor (fondo de página, tamaño, exportar). Lo monta
// Canvas2Editor; se exporta para hosts que compongan su propio editor.
export { CanvasMenu } from './ui/navigation/CanvasMenu';
export type { CanvasMenuProps } from './ui/navigation/CanvasMenu';
// Acciones de la página activa, flotando sobre el lienzo junto a su nombre.
export { PageActions } from './ui/navigation/PageActions';
export type { PageActionsProps } from './ui/navigation/PageActions';
export { setAsBackground, extendToPage } from './core/imageOps';
export { reorderPageMembers, sendMemberToBack } from './core/zorder';
export { palette, PANEL_FONT } from './ui/shared/theme';
// Contrato de textos: canvas2 no lleva i18n dentro, el host inyecta.
export { DEFAULT_LABELS, mergeLabels } from './ui/shared/labels';
export type { Canvas2Labels, PartialLabels } from './ui/shared/labels';
export type { Palette, Canvas2Theme } from './ui/shared/theme';

// ─── Identidad de marca ───────────────────────────────────────────────────────
// `Canvas2Editor` recibe `projects.brandKit` CRUDO y lo traduce dentro: si el
// host tuviera que llamar a `resolveBrandKit`, importaría un valor de este
// barrel y arrastraría Excalidraw al bundle de servidor.
// `BrandGallery` la monta el propio editor, dentro de la pestaña Diseño.
export { resolveBrandKit, EMPTY_BRAND } from './core/brand';
export type { Canvas2Brand, BrandKitInput, BrandFontFace } from './core/brand';

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
} from './core/fonts';
export type { CustomFontFace } from './core/fonts';
export { registerCustomFont, registerCustomFonts, fontFamilyId } from './core/fontRegistry';
export type { RegisteredFont } from './core/fontRegistry';
export { BrandGallery } from './ui/panels/BrandGallery';
export type { BrandGalleryProps } from './ui/panels/BrandGallery';
// Pastilla flotante de arriba a la derecha: Diseño, Capas y Componentes en
// pestañas. La monta Canvas2Editor.
export { RightDock } from './ui/panels/RightDock';
export type { RightDockProps } from './ui/panels/RightDock';
// Contenido de la pestaña Diseño: marca del cliente + tamaño y fondo de la
// página activa.
export { DesignPanel } from './ui/panels/DesignPanel';
export type { DesignPanelProps } from './ui/panels/DesignPanel';
// Marco de la biblioteca (arriba a la derecha). El CONTENIDO lo pone el host:
// la mediateca vive en apps/web sobre @polimake/ui.
export { LibraryPanel } from './ui/panels/LibraryPanel';
export type { LibraryPanelProps } from './ui/panels/LibraryPanel';

// ─── Persistence (scene ↔ JSON) ───────────────────────────────────────────────
export { serializeScene, parseScene, restoreScene } from './core/serialize';
export type { StoredScene } from './core/serialize';

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
} from './core/export';
export type { ExportOptions } from './core/export';

// ─── Media (imágenes: SIEMPRE en MediaMonster, nunca base64 en el diseño) ─────
// No se exporta ningún insertador por dataURL: la única forma de meter una
// imagen es por referencia remota o subiendo antes a MM. Ver media.ts.
export {
  insertImageFromBlob,
  insertImageFromUrl,
  insertImageWithPreview,
  replaceImageFromUrl,
  resolveInsertPageId,
  cascadePoints,
  imageAtScenePoint,
  externalizeInlineImages,
  hasUploadsInFlight,
  buildPersistableFiles,
  findInlineImageIds,
  isInlineDataUrl,
  dataUrlToBlob,
} from './core/media';
export type {
  InsertImageOptions,
  ImageHit,
  MediaUploader,
  FileEntry,
  ExternalizeResult,
  PersistableFiles,
} from './core/media';

// ─── Componentes reutilizables ───────────────────────────────────────────────
// Motor puro en components.ts (lo comparte el worker vía el subpath
// '@pm/canvas/components'); la integración con la escena viva, aquí.
export {
  cloneSceneElements,
  listSlots,
  deriveComponentMeta,
  extractComponentFragment,
  instantiateComponent,
  appendComponentToEditorConfig,
  measureWrappedText,
  fitImageInBox,
} from './core/components';
export type {
  ComponentElement,
  ComponentFileEntry,
  ComponentFragment,
  ComponentSlotInfo,
  InstantiatedComponent,
  SlotValue,
  SlotValues,
} from './core/components';
export { insertComponentIntoScene, extractPageForComponent } from './core/insertComponent';

// ─── Text presets + page background ───────────────────────────────────────────
export { TEXT_PRESETS, insertTextPreset, contrastTextColor } from './core/text';
export type { TextPreset, TextPresetKey } from './core/text';
export {
  getPageBackground,
  setPageBackgroundColor,
  ensurePagePapers,
  isPageBackground,
} from './core/background';

// Vídeo en el lienzo: un póster que recuerda de qué vídeo salió, para poder
// volver a elegir el fotograma. Ver la cabecera de video.ts.
export {
  insertVideo,
  setVideoPoster,
  isVideoElement,
  getVideoMeta,
  getSelectedVideo,
  VIDEO_MARKER,
} from './core/video';
export type { VideoMeta, InsertVideoOptions } from './core/video';
