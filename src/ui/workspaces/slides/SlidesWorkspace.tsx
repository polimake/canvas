'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CaptureUpdateAction, type ExcalidrawImperativeAPI } from '../../../core/excal';
import { insertPagesIntoScene } from '../../../core/insertPages';
import { DEFAULT_PAGE_SIZE, movePageTo, PAGE_SIZE_PRESETS, type PageSize } from '../../../core/pages';
import { alignToPage, PAGE_ALIGNMENTS } from '../../../core/align';
import { boxOnScreen, currentViewport, fitBoxInRect, fitPageInRect, pageBox, type ScreenRect } from '../../../core/slideView';
import { usePageThumbnails, type FilesMap } from '../../hooks/pageThumbnails';
import { runCanvasExport, type ExportContext, type ExportKind } from '../../shared/exportActions';
import type { Canvas2Labels } from '../../shared/labels';
import type { CanvasWorkspace, WorkspacePanel } from '../types';
import { useDeck } from './useDeck';
import { Filmstrip } from './Filmstrip';
import { SlidesToolbar, type SlidesTool, type ToolbarPanel } from './SlidesToolbar';
import { SlidesMenuBar, type MenuBarMenu } from './SlidesMenuBar';
import { SlidesMenu, type MenuEntry } from './SlidesMenu';
import { SlidesPanels } from './SlidesPanels';
import { SlidesGrid } from './SlidesGrid';
import { SpeakerNotes } from './SpeakerNotes';
import { PresentMode } from './PresentMode';
import { PresentButton } from './PresentButton';
import { SlidesIcon } from './icons';
import { SlideMask } from './SlideMask';
import {
  canDeleteSlide, deleteSlide, duplicateSlide, moveSlide, newSlide, resizeAllSlides,
  runCanvasKey, selectAllInSlide, shortcutLabel, toggleSkip,
} from './slideCommands';
import './slides.css';

/** Lo que el host puede añadir al espacio (todo opcional). */
export interface SlidesHostOptions {
  /** Nombre de la presentación, en la fila de menús. */
  title?: string;
  /** Botón «Detalles» de la tira derecha: el host enseña los datos de la pieza. */
  onDetails?: () => void;
  detailsOpen?: boolean;
  /** «Importar tema» en el panel Tema. */
  onImportTheme?: () => void;
  /** Botón de comentar de la barra. */
  onComment?: () => void;
  /** Archivo › Importar diapositivas: el host lee el fichero, sube sus imágenes y lo convierte. */
  importSlides?: SlidesImport;
}

/**
 * Importar diapositivas a la presentación abierta. El host hace lo que solo él
 * puede (subir las imágenes a su almacén, resolver las fuentes) y devuelve las
 * páginas ya convertidas (`documentToScene`); el espacio las añade detrás de la
 * activa en una sola entrada de deshacer (`insertPagesIntoScene`).
 */
export interface SlidesImport {
  /** Lo que admite el selector de ficheros (`.pptx,.pdf`). */
  accept: string;
  load: (file: File) => Promise<{ elements: readonly unknown[]; files?: Record<string, unknown> } | null>;
}

export interface SlidesWorkspaceProps {
  api: ExcalidrawImperativeAPI;
  /** El envoltorio `[data-canvas2]`: dentro está Excalidraw. */
  rootRef: RefObject<HTMLDivElement | null>;
  activePageId: string | null;
  onActiveChange: (id: string) => void;
  /** Los paneles de siempre (Canvas2.tsx): aquí se abren a la derecha. */
  panels: WorkspacePanel[];
  labels: Canvas2Labels;
  /** Tamaño de una página nueva si aún no hay ninguna (las demás heredan el de la activa). */
  pageSize?: PageSize;
  thumbnailFiles?: FilesMap;
  hydrateFiles?: ExportContext['hydrateFiles'];
  fontFaces?: ExportContext['fontFaces'];
  viewMode?: boolean;
  workspace: CanvasWorkspace;
  onWorkspaceChange?: (workspace: CanvasWorkspace) => void;
  workspaces: readonly CanvasWorkspace[];
  onSaveComponent?: () => void;
  host?: SlidesHostOptions;
  /** Idioma de los textos al exportar a PowerPoint (`es-ES`). */
  lang?: string;
  /** El panel abierto del editor (`Canvas2`), el mismo en todos los espacios. */
  openPanel?: string | null;
  onOpenPanelChange?: (id: string | null) => void;
}

// Medidas de la maqueta aprobada (px de pantalla).
const MENUBAR_H = 34;
const TOOLBAR_H = 52;
const FILMSTRIP_W = 224;
const RAIL_W = 68;
const PANEL_W = 336;
const NOTES_H = 96;
const STAGE_PAD = 16;
/**
 * Herramientas con las que Excalidraw NO saca sus opciones de formato. Con
 * cualquier otra (rectángulo, texto, línea…) las saca para el próximo elemento,
 * igual que con una selección, y ocupan el hueco derecho de la barra.
 */
const NO_PROPS_TOOLS = new Set(['selection', 'hand', 'eraser', 'laser']);
/** Píldora: margen exterior y relleno interior, para colocar las opciones de formato. */
const PILL_INSET = 16 + 8;

/**
 * El espacio «Presentación»: el lienzo de siempre con la distribución de Slides.
 *
 * Todo el cromo va ENCIMA de Excalidraw, en capas, en vez de encogerlo: su caja
 * recorta lo que sale de ella, y las opciones de formato de la selección (que
 * son suyas) tienen que caer dentro de nuestra barra. Por eso el encuadre de la
 * diapositiva se calcula para el hueco que dejan las capas (`slideView.ts`) y
 * las vecinas se tapan con el color de la mesa.
 *
 * No hay datos nuevos salvo las notas, saltar y la transición (`slideMeta.ts`):
 * cada diapositiva es una página, y todas las órdenes son las de `core`.
 */
export function SlidesWorkspace(props: SlidesWorkspaceProps) {
  const {
    api, rootRef, activePageId, onActiveChange, panels, labels, pageSize,
    thumbnailFiles, hydrateFiles, fontFaces, viewMode, workspace, onWorkspaceChange, workspaces,
    onSaveComponent, host, lang,
  } = props;
  const L = labels.slides;
  const deck = useDeck(api, labels.pages);
  const thumbs = usePageThumbnails(api, { files: thumbnailFiles, width: 336 });

  // El panel abierto es el del editor (y del host, si lo lleva: Studio abre
  // Comentarios al pulsar una chincheta). «Transición» es solo de aquí.
  const [transitionOpen, setTransitionOpen] = useState(false);
  const hostPanel = props.openPanel ?? null;
  useEffect(() => { if (hostPanel) setTransitionOpen(false); }, [hostPanel]);
  const openPanel = transitionOpen ? 'transition' : hostPanel;
  const setOpenPanel = (next: string | null | ((p: string | null) => string | null)) => {
    const value = typeof next === 'function' ? next(openPanel) : next;
    setTransitionOpen(value === 'transition');
    props.onOpenPanelChange?.(value === 'transition' ? null : value);
  };
  const [view, setView] = useState<'slide' | 'grid'>('slide');
  const [menusHidden, setMenusHidden] = useState(false);
  const [filmstripHidden, setFilmstripHidden] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [presenting, setPresenting] = useState<{ startId: string | null; presenter: boolean } | null>(null);
  const [ctx, setCtx] = useState<{ id: string; left: number; top: number } | null>(null);
  /** Lo que dice la fila de menús a la derecha (exportar, importar), sin avisos flotantes. */
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false);
  const say = useCallback((text: string | null, ms = 0) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    if (text && ms) noticeTimer.current = setTimeout(() => setNotice(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fixedWidth, setFixedWidth] = useState(0);

  const activeIndex = deck.slides.findIndex((s) => s.id === activePageId);
  const active = deck.slides[activeIndex] ?? null;
  /** Dónde estaba la activa: si desaparece (borrar, deshacer), se queda la de su sitio. */
  const lastIndex = useRef(0);
  if (activeIndex >= 0) lastIndex.current = activeIndex;
  const activate = useCallback((id: string) => onActiveChange(id), [onActiveChange]);

  // Siempre hay una diapositiva activa que existe. En los otros espacios eso lo
  // arregla seguir la vista; aquí la vista sigue a la activa, así que si esta
  // desaparece (borrarla, deshacer su creación, otra versión del diseño) se
  // elige la que ha quedado en su sitio.
  //
  // Se pregunta a la ESCENA y no a la lista de la tira: una diapositiva recién
  // creada ya es la activa antes de que la tira se entere, y no está huérfana.
  useEffect(() => {
    if (!deck.slides.length || activeIndex >= 0) return;
    if (activePageId && pageBox(api, activePageId)) return;
    const fallback = deck.slides[Math.min(lastIndex.current, deck.slides.length - 1)];
    if (fallback) onActiveChange(fallback.id);
  }, [api, deck.slides, activeIndex, activePageId, onActiveChange]);
  // Una presentación tiene un solo tamaño: la diapositiva nueva sale como la activa.
  const newSize: PageSize = active ? { width: active.width, height: active.height } : pageSize ?? DEFAULT_PAGE_SIZE;
  const root = () => rootRef.current;

  // ── Geometría ──────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef]);

  const topH = (menusHidden ? 0 : MENUBAR_H) + TOOLBAR_H;
  const leftW = filmstripHidden ? 0 : FILMSTRIP_W;
  const rightW = RAIL_W + (openPanel ? PANEL_W : 0);
  const bottomH = showNotes ? NOTES_H : STAGE_PAD;
  const stage: ScreenRect = useMemo(() => ({
    left: leftW,
    top: topH + STAGE_PAD,
    width: Math.max(0, size.w - leftW - rightW),
    height: Math.max(0, size.h - topH - STAGE_PAD - bottomH),
  }), [leftW, topH, rightW, bottomH, size.w, size.h]);

  // La diapositiva activa, encajada en el hueco. Solo cuando cambia la
  // diapositiva, su tamaño o el hueco: acercar a mano no se deshace solo.
  const fit = useCallback(() => {
    if (activePageId && view === 'slide') fitPageInRect(api, activePageId, stage);
  }, [api, activePageId, view, stage]);
  useEffect(() => { fit(); }, [fit, active?.width, active?.height, active?.x, active?.y]);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  // Una diapositiva que aparece (insertar un componente, importar, rehacer)
  // pasa a ser la activa, como en Slides. Quien la crea suele llevar la vista
  // con `goToPage`, que anima 300 ms hacia otro encuadre: al acabar se vuelve a
  // encajar en el hueco.
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = deck.slides.map((s) => s.id);
    const before = seenIds.current;
    seenIds.current = new Set(ids);
    if (!before?.size) return;
    const added = ids.filter((id) => !before.has(id));
    if (!added.length) return;
    if (!activePageId || !added.includes(activePageId)) onActiveChange(added[0]);
    const later = setTimeout(() => fitRef.current(), 360);
    return () => clearTimeout(later);
  }, [deck.slides]);

  // Las opciones de formato de Excalidraw, dentro de la píldora (slides.css).
  // Se colocan respecto a su contenedor (`FixedSideContainer`), que Excalidraw
  // separa del borde con su propio margen: se mide en vez de suponerlo.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const side = el.querySelector('.FixedSideContainer_side_top')?.getBoundingClientRect();
    const dx = side ? side.left - box.left : 16;
    const dy = side ? side.top - box.top : 16;
    const dr = side ? box.right - side.right : 16;
    el.style.setProperty('--slides-props-top', `${(menusHidden ? 0 : MENUBAR_H) + 4 - dy}px`);
    el.style.setProperty('--slides-props-left', `${PILL_INSET + fixedWidth - dx}px`);
    el.style.setProperty('--slides-props-right', `${PILL_INSET + 40 - dr}px`);
    // El hueco de la diapositiva: lo usan el buscador de Excalidraw (su barra
    // lateral se abre bajo las barras) y el contenido del host centrado en el
    // escenario (`stageOverlay`).
    el.style.setProperty('--slides-top', `${topH}px`);
    el.style.setProperty('--slides-left', `${leftW}px`);
    el.style.setProperty('--slides-right', `${rightW}px`);
    el.style.setProperty('--slides-bottom', `${bottomH}px`);
    return () => {
      for (const p of ['--slides-props-top', '--slides-props-left', '--slides-props-right',
        '--slides-top', '--slides-left', '--slides-right', '--slides-bottom']) {
        el.style.removeProperty(p);
      }
    };
  }, [rootRef, menusHidden, fixedWidth, size.w, topH, leftW, rightW, bottomH]);

  // ── Órdenes ────────────────────────────────────────────────────────────────
  const setTool = (tool: SlidesTool) => api.setActiveTool({ type: tool });
  const togglePanel = (id: string) => setOpenPanel((p) => (p === id ? null : id));
  const has = (id: string) => panels.some((p) => p.id === id);
  const fitZoom = () => { setView('slide'); fit(); };
  const zoomTo = (z: number) => {
    const s = currentViewport(api);
    const cx = stage.left + stage.width / 2;
    const cy = stage.top + stage.height / 2;
    // Acercar o alejar sobre el centro del hueco, no sobre la esquina.
    const sceneX = cx / s.zoom - s.scrollX;
    const sceneY = cy / s.zoom - s.scrollY;
    api.updateScene({
      appState: { zoom: { value: z as never }, scrollX: cx / z - sceneX, scrollY: cy / z - sceneY },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };
  const doExport = async (kind: ExportKind) => {
    if (busy.current) return;
    busy.current = true;
    say(labels.menu.exporting);
    try {
      await runCanvasExport(api, kind, {
        activePageId, hydrateFiles, fontFaces, fallbackName: labels.menu.exportName, pageNames: labels.pages,
        title: host?.title, lang,
      });
      say(null);
    } catch (err) {
      console.error('[canvas2] export failed', err);
      say(labels.menu.exportFailed, 4000);
    } finally {
      busy.current = false;
    }
  };
  const doImport = async (file: File) => {
    const importer = host?.importSlides;
    if (!importer || busy.current) return;
    busy.current = true;
    say(L.importing);
    try {
      const pages = await importer.load(file);
      if (!pages) { say(null); return; }
      const ids = insertPagesIntoScene(api, pages, { afterPageId: activePageId });
      if (ids[0]) onActiveChange(ids[0]);
      say(L.imported(ids.length), 4000);
    } catch (err) {
      console.error('[canvas2] import failed', err);
      say(L.importFailed, 6000);
    } finally {
      busy.current = false;
    }
  };
  const present = (fromStart: boolean, presenter = false) =>
    setPresenting({ startId: fromStart ? deck.slides[0]?.id ?? null : activePageId, presenter });
  const keyWords = L.keys;

  const sizeLabel = (s: { width: number; height: number }) => {
    const preset = PAGE_SIZE_PRESETS.find((p) => p.width === s.width && p.height === s.height);
    return preset ? labels.sizes[preset.key] ?? preset.label : `${s.width} × ${s.height}`;
  };
  const currentSize = active ?? deck.slides[0] ?? null;
  const sizeItems: MenuEntry[] = PAGE_SIZE_PRESETS.map((p) => ({
    label: sizeLabel(p),
    checked: Boolean(currentSize && currentSize.width === p.width && currentSize.height === p.height),
    onSelect: () => resizeAllSlides(api, { width: p.width, height: p.height }),
  }));

  // Acciones de UNA diapositiva: el clic derecho de la tira y el menú Diapositiva.
  const slideItems = (id: string, withSize: boolean): MenuEntry[] => {
    const i = deck.slides.findIndex((s) => s.id === id);
    const slide = deck.slides[i];
    const panelItem = (panel: string, label: string, icon: ReactNode): MenuEntry[] =>
      panel === 'transition' || has(panel)
        ? [{ label, icon, onSelect: () => { activate(id); setOpenPanel(panel); } }]
        : [];
    return [
      { label: L.newSlide, icon: <SlidesIcon.plus />, shortcut: shortcutLabel('newSlide', keyWords), onSelect: () => newSlide(api, id, newSize, labels.pages, activate) },
      { label: L.duplicateSlide, icon: <SlidesIcon.duplicate />, onSelect: () => duplicateSlide(api, id, labels.pages, activate) },
      { label: L.deleteSlide, icon: <SlidesIcon.trash />, disabled: !canDeleteSlide(deck.slides), onSelect: () => deleteSlide(api, id, activate) },
      { label: slide?.skipped ? L.unskipSlide : L.skipSlide, icon: slide?.skipped ? <SlidesIcon.eye /> : <SlidesIcon.eyeOff />, onSelect: () => toggleSkip(api, id) },
      {
        kind: 'submenu', label: L.moveSlide, icon: <SlidesIcon.move />, items: [
          { label: L.moveToStart, icon: <SlidesIcon.toStart />, disabled: i <= 0, onSelect: () => moveSlide(api, id, 'start') },
          { label: L.moveUp, shortcut: shortcutLabel('moveUp', keyWords), disabled: i <= 0, onSelect: () => moveSlide(api, id, 'up') },
          { label: L.moveDown, shortcut: shortcutLabel('moveDown', keyWords), disabled: i >= deck.slides.length - 1, onSelect: () => moveSlide(api, id, 'down') },
          { label: L.moveToEnd, icon: <SlidesIcon.toEnd />, disabled: i >= deck.slides.length - 1, onSelect: () => moveSlide(api, id, 'end') },
        ],
      },
      { kind: 'separator' },
      ...panelItem('design', L.changeBackground, <SlidesIcon.background />),
      ...panelItem('components', L.applyComponent, <SlidesIcon.layout />),
      ...panelItem('transition', L.transition, <SlidesIcon.transition />),
      ...(withSize
        ? [{ kind: 'separator' } as MenuEntry, { kind: 'submenu', label: L.pageSizeCurrent(currentSize ? sizeLabel(currentSize) : ''), icon: <SlidesIcon.size />, items: sizeItems } as MenuEntry]
        : []),
      ...(has('brand') ? [{ kind: 'separator' } as MenuEntry, ...panelItem('brand', L.changeTheme, <SlidesIcon.brand />)] : []),
    ];
  };

  const keyItem = (label: string, name: Parameters<typeof runCanvasKey>[1], extra: Partial<Extract<MenuEntry, { onSelect: () => void }>> = {}): MenuEntry => ({
    label, shortcut: shortcutLabel(name, keyWords), onSelect: () => runCanvasKey(root(), name), ...extra,
  });

  const workspaceName = (w: CanvasWorkspace) => (labels.workspace as unknown as Record<string, string>)[w] ?? w;

  // Al mirar, los mismos menús que al editar: solo Exportar y Ver funcionan, lo
  // demás se ve apagado.
  const exportEntries = exportItems();
  const editMenus: MenuBarMenu[] = [
    {
      id: 'file', label: L.file, items: [
        { label: L.newSlide, icon: <SlidesIcon.plus />, shortcut: shortcutLabel('newSlide', keyWords), onSelect: () => newSlide(api, activePageId, newSize, labels.pages, activate) },
        ...(host?.importSlides ? [{ label: L.importSlides, icon: <SlidesIcon.upload />, onSelect: () => fileInput.current?.click() }] : []),
        { kind: 'separator' },
        ...exportEntries,
        ...(onSaveComponent ? [{ kind: 'separator' } as MenuEntry, { label: labels.components.save, onSelect: onSaveComponent }] : []),
        { kind: 'separator' },
        { kind: 'submenu', label: L.pageSize, icon: <SlidesIcon.size />, items: sizeItems },
      ],
    },
    {
      id: 'edit', label: L.edit, items: [
        keyItem(L.undo, 'undo', { icon: <SlidesIcon.undo /> }),
        keyItem(L.redo, 'redo', { icon: <SlidesIcon.redo /> }),
        { kind: 'separator' },
        keyItem(L.duplicate, 'duplicate', { icon: <SlidesIcon.copy />, disabled: !deck.hasSelection }),
        keyItem(L.delete, 'delete', { icon: <SlidesIcon.trash />, disabled: !deck.hasSelection }),
        { kind: 'separator' },
        { label: L.selectAll, shortcut: shortcutLabel('selectAll', keyWords), onSelect: () => selectAllInSlide(api, activePageId) },
      ],
    },
    { id: 'view', label: L.view, items: viewItems() },
    {
      id: 'insert', label: L.insert, items: [
        { label: L.textBox, icon: <SlidesIcon.text />, onSelect: () => setTool('text') },
        ...(has('library') ? [{ label: L.image, icon: <SlidesIcon.image />, onSelect: () => setOpenPanel('library') }] : []),
        {
          kind: 'submenu', label: L.shape, icon: <SlidesIcon.shape />, items: [
            { label: L.rectangle, icon: <SlidesIcon.rectangle />, onSelect: () => setTool('rectangle') },
            { label: L.ellipse, icon: <SlidesIcon.ellipse />, onSelect: () => setTool('ellipse') },
            { label: L.diamond, icon: <SlidesIcon.diamond />, onSelect: () => setTool('diamond') },
          ],
        },
        {
          kind: 'submenu', label: L.line, icon: <SlidesIcon.line />, items: [
            { label: L.line, icon: <SlidesIcon.line />, onSelect: () => setTool('line') },
            { label: L.arrow, icon: <SlidesIcon.arrow />, onSelect: () => setTool('arrow') },
          ],
        },
        { kind: 'separator' },
        { label: L.newSlide, icon: <SlidesIcon.plus />, shortcut: shortcutLabel('newSlide', keyWords), onSelect: () => newSlide(api, activePageId, newSize, labels.pages, activate) },
        ...(has('components') ? [{ label: L.applyComponent, icon: <SlidesIcon.layout />, onSelect: () => setOpenPanel('components') }] : []),
      ],
    },
    {
      id: 'format', label: L.format, items: [
        ...(has('design') ? [{ label: L.changeBackground, icon: <SlidesIcon.background />, onSelect: () => setOpenPanel('design') }] : []),
        ...(has('brand') ? [{ label: L.changeTheme, icon: <SlidesIcon.brand />, onSelect: () => setOpenPanel('brand') }] : []),
        { label: L.transition, icon: <SlidesIcon.transition />, onSelect: () => setOpenPanel('transition') },
      ],
    },
    { id: 'slide', label: L.slide, items: activePageId ? slideItems(activePageId, true) : [] },
    {
      id: 'arrange', label: L.arrange, items: [
        {
          kind: 'submenu', label: L.order, disabled: !deck.hasSelection, items: [
            keyItem(L.bringToFront, 'bringToFront'),
            keyItem(L.bringForward, 'bringForward'),
            keyItem(L.sendBackward, 'sendBackward'),
            keyItem(L.sendToBack, 'sendToBack'),
          ],
        },
        {
          kind: 'submenu', label: L.align, disabled: !deck.hasSelection || !activePageId, items: PAGE_ALIGNMENTS.map((a) => ({
            label: labels.align[a.key], onSelect: () => { if (activePageId) alignToPage(api, activePageId, a.key); },
          })),
        },
        { kind: 'separator' },
        keyItem(L.group, 'group', { disabled: !deck.hasSelection }),
        keyItem(L.ungroup, 'ungroup', { disabled: !deck.hasSelection }),
      ],
    },
  ];
  const menus: MenuBarMenu[] = viewMode
    ? editMenus.map((menu) => (menu.id === 'view' ? menu : {
      ...menu,
      items: menu.items.map((entry) => (exportEntries.includes(entry) ? entry : lockEntry(entry))),
    }))
    : editMenus;

  function exportItems(): MenuEntry[] {
    return [{
      kind: 'submenu', label: labels.menu.export, items: [
        { label: labels.menu.exportPngPage, onSelect: () => void doExport('png') },
        { label: labels.menu.exportPngAll, onSelect: () => void doExport('png-all') },
        { label: labels.menu.exportSvg, onSelect: () => void doExport('svg') },
        { label: labels.menu.exportPdf, onSelect: () => void doExport('pdf') },
        { kind: 'separator' },
        { label: labels.menu.exportPptx, onSelect: () => void doExport('pptx') },
        { label: labels.menu.exportPotx, onSelect: () => void doExport('potx') },
      ],
    }];
  }

  function viewItems(): MenuEntry[] {
    return [
      { label: L.present, icon: <SlidesIcon.play />, shortcut: shortcutLabel('present', keyWords), onSelect: () => present(false) },
      { label: L.presentFromStart, onSelect: () => present(true) },
      { label: L.presenterView, icon: <SlidesIcon.presenter />, onSelect: () => present(false, true) },
      { kind: 'separator' },
      { label: L.gridView, checked: view === 'grid', onSelect: () => setView((v) => (v === 'grid' ? 'slide' : 'grid')) },
      { label: L.showNotes, checked: showNotes, onSelect: () => setShowNotes((v) => !v) },
      { label: L.showFilmstrip, checked: !filmstripHidden, onSelect: () => setFilmstripHidden((v) => !v) },
      { kind: 'separator' },
      { label: L.zoomFit, onSelect: fitZoom },
      keyItem(L.zoomIn, 'zoomIn'),
      keyItem(L.zoomOut, 'zoomOut'),
      ...(onWorkspaceChange ? [
        { kind: 'separator' } as MenuEntry,
        {
          kind: 'submenu', label: L.workspace, items: workspaces.map((w) => ({
            label: workspaceName(w), checked: w === workspace, onSelect: () => onWorkspaceChange(w),
          })),
        } as MenuEntry,
      ] : []),
    ];
  }

  // ── Atajos de Slides ──────────────────────────────────────────────────────
  // Los manejadores, por referencia: la suscripción se hace una vez.
  const shortcuts = useRef<{
    newSlide: () => void; selectAll: () => void; present: (fromStart: boolean) => void; presenting: boolean; viewMode: boolean;
  }>({ newSlide: () => {}, selectAll: () => {}, present: () => {}, presenting: false, viewMode: false });
  shortcuts.current = {
    newSlide: () => newSlide(api, activePageId, newSize, labels.pages, activate),
    selectAll: () => selectAllInSlide(api, activePageId),
    present: (fromStart) => present(fromStart),
    presenting: Boolean(presenting),
    viewMode: Boolean(viewMode),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = shortcuts.current;
      if (now.presenting || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // Solo con el foco en el editor (o en ninguna parte): no robar atajos a la app.
      const scope = rootRef.current?.closest('.canvas2-workspace');
      // Sin el espacio montado no hay a quién darle el atajo: fuera, nunca.
      if (!scope) return;
      if (target && target !== document.body && !scope.contains(target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // La tira de diapositivas tiene su Ctrl+M, que además lleva el foco a la nueva.
      if (ctrl && key === 'm' && target?.closest?.('.canvas2-slides-filmstrip')) return;
      // Presentar también en lectura; crear y seleccionar, solo editando.
      if (ctrl && !e.altKey && e.key === 'Enter') now.present(e.shiftKey);
      else if (now.viewMode) return;
      else if (ctrl && !e.shiftKey && !e.altKey && key === 'm') now.newSlide();
      // Ctrl+A de Excalidraw seleccionaría todas las diapositivas, también las tapadas.
      else if (ctrl && !e.shiftKey && !e.altKey && key === 'a') now.selectAll();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // En captura, para ganarle al reenvío de teclado del lienzo y al propio Excalidraw.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rootRef]);

  // ── Pintado ────────────────────────────────────────────────────────────────
  const status = notice ?? undefined;

  // La caja de notas mide lo que mide la diapositiva ENCAJADA (no la que se ve
  // con zoom), como en Slides: acercar no la estira.
  const fitted = active && stage.width > 0
    ? boxOnScreen({ x: 0, y: 0, width: active.width, height: active.height },
      { ...fitBoxInRect({ x: 0, y: 0, width: active.width, height: active.height }, stage), scrollX: 0, scrollY: 0 })
    : null;
  const notesWidth = Math.round(fitted?.width ?? stage.width * 0.9);


  return (
    <div className="canvas2-slides" data-menus-hidden={menusHidden ? '' : undefined}
      data-filmstrip-hidden={filmstripHidden ? '' : undefined}
      style={{
        ['--slides-top' as string]: `${topH}px`,
        ['--slides-left' as string]: `${leftW}px`,
        ['--slides-right' as string]: `${rightW}px`,
        // La máscara y la cuadrícula, del color de la mesa que pinta el lienzo.
        ['--slides-stage' as string]: api.getAppState().viewBackgroundColor,
      }}>

      {view === 'slide' && (
        <SlideMask api={api} rootRef={rootRef} activePageId={activePageId} stage={stage}
          limits={{ top: topH, bottom: size.h }} />
      )}

      {host?.importSlides && !viewMode && (
        <input ref={fileInput} type="file" hidden accept={host.importSlides.accept}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void doImport(file);
          }} />
      )}

      {!menusHidden && (
        <SlidesMenuBar title={host?.title} menus={menus} label={L.menubar} status={status}
          end={<PresentButton labels={labels} shortcut={shortcutLabel('present', keyWords)}
            onPresent={({ fromStart, presenter }) => present(fromStart, presenter)} />} />
      )}

      <SlidesToolbar
        labels={labels}
        activeTool={deck.activeTool}
        formatting={deck.hasSelection || !NO_PROPS_TOOLS.has(deck.activeTool)}
        zoom={deck.zoom}
        openPanel={openPanel}
        available={{
          design: has('design'), components: has('components'), brand: has('brand'), transition: true,
          library: has('library'), search: typeof api.toggleSidebar === 'function', comment: Boolean(host?.onComment),
        }}
        menusHidden={menusHidden}
        viewMode={viewMode}
        onSearch={() => api.toggleSidebar({ name: 'default', tab: 'search' })}
        onNewSlide={() => newSlide(api, activePageId, newSize, labels.pages, activate)}
        onUndo={() => runCanvasKey(root(), 'undo')}
        onRedo={() => runCanvasKey(root(), 'redo')}
        onZoomFit={fitZoom}
        onZoomTo={zoomTo}
        onZoomStep={(dir) => runCanvasKey(root(), dir > 0 ? 'zoomIn' : 'zoomOut')}
        onTool={setTool}
        onImage={() => togglePanel('library')}
        onComment={host?.onComment}
        onPanel={(panel: ToolbarPanel) => togglePanel(panel)}
        onToggleMenus={() => setMenusHidden((v) => !v)}
        onFixedWidth={setFixedWidth}
      />

      {view === 'slide' && !filmstripHidden && (
        <Filmstrip
          slides={deck.slides}
          activeId={activePageId}
          thumbs={thumbs}
          labels={labels}
          viewMode={viewMode}
          onSelect={activate}
          onContextMenu={(id, at) => {
            const box = root()?.getBoundingClientRect();
            setCtx({ id, left: at.x - (box?.left ?? 0), top: at.y - (box?.top ?? 0) });
          }}
          onMove={(id, to) => movePageTo(api, id, to)}
          onNewAfter={(id) => newSlide(api, id, newSize, labels.pages, activate)}
          onDuplicate={(id) => duplicateSlide(api, id, labels.pages, activate)}
          onDelete={(id) => deleteSlide(api, id, activate)}
          onMoveBy={(id, where) => moveSlide(api, id, where)}
          onGrid={() => setView('grid')}
          onCollapse={() => setFilmstripHidden(true)}
        />
      )}
      {view === 'slide' && filmstripHidden && (
        <button type="button" className="canvas2-slides-icon-btn canvas2-slides-filmstrip-show"
          aria-label={L.showFilmstrip} title={L.showFilmstrip} onClick={() => setFilmstripHidden(false)}>
          <SlidesIcon.chevronRight />
        </button>
      )}

      {view === 'slide' && showNotes && (
        <div className="canvas2-slides-notes-wrap" style={{ left: stage.left, width: stage.width, height: NOTES_H }}>
          <span className="canvas2-slides-notes-handle" aria-hidden="true" />
          <SpeakerNotes api={api} pageId={activePageId} label={L.notes} placeholder={L.notesPlaceholder}
            readOnly={viewMode} style={{ width: notesWidth }} />
        </div>
      )}

      {view === 'grid' && (
        <SlidesGrid
          slides={deck.slides}
          activeId={activePageId}
          thumbs={thumbs}
          labels={labels}
          onSelect={activate}
          onOpen={(id) => { activate(id); setView('slide'); }}
          onContextMenu={(id, at) => {
            const box = root()?.getBoundingClientRect();
            setCtx({ id, left: at.x - (box?.left ?? 0), top: at.y - (box?.top ?? 0) });
          }}
          onBack={() => setView('slide')}
        />
      )}

      <SlidesPanels
        api={api}
        activePageId={activePageId}
        panels={panels}
        openPanel={openPanel}
        onOpenPanel={setOpenPanel}
        labels={labels}
        onDetails={host?.onDetails}
        detailsOpen={host?.detailsOpen}
        onImportTheme={host?.onImportTheme}
      />

      {ctx && (
        <SlidesMenu label={L.slideN(deck.slides.findIndex((s) => s.id === ctx.id) + 1)}
          items={viewMode ? slideItems(ctx.id, false).map(lockEntry) : slideItems(ctx.id, false)} onClose={() => setCtx(null)}
          style={{ position: 'absolute', left: ctx.left, top: ctx.top }} />
      )}

      {presenting && (
        <PresentMode api={api} slides={deck.slides} startId={presenting.startId} labels={labels}
          presenter={presenting.presenter}
          onExit={(lastId) => {
            setPresenting(null);
            if (lastId) activate(lastId);
          }} />
      )}
    </div>
  );
}

/** Una entrada de menú apagada (al mirar): se ve, pero no hace nada. */
function lockEntry(entry: MenuEntry): MenuEntry {
  return entry.kind === 'separator' ? entry : { ...entry, disabled: true };
}
