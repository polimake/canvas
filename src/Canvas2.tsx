'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './canvas2.css';
import {
  Excalidraw,
  viewportCoordsToSceneCoords,
  getNonDeletedElements,
  getVisibleSceneBounds,
  type ExcalidrawImperativeAPI,
  type ExcalidrawInitialDataState,
  type SceneElement,
} from './excal';
import { PageNavigator } from './PageNavigator';
import { LooseWarning } from './LooseWarning';
import { VideoFramePicker } from './VideoFramePicker';
import { CanvasMenu } from './CanvasMenu';
import { PageActions } from './PageActions';
import { RightDock } from './RightDock';
import { LibraryPanel } from './LibraryPanel';
import type { FilesMap } from './pageThumbnails';
import { addPage, createBlankScene, goToPage, listPages, relayoutPages, type PageSize } from './pages';
import { ensurePagePapers } from './background';
import { resolveBrandKit, type BrandKitInput, type Canvas2Brand } from './brand';
import { buildFontFaceCss, dedupeFontFaces, type CustomFontFace } from './fonts';
import { fontFamilyId, registerCustomFonts } from './fontRegistry';
import { mergeLabels, type PartialLabels } from './labels';
import { DuplicateIcon } from './icons';

/**
 * A serializable snapshot of the canvas. Same shape Excalidraw accepts as
 * `initialData`, so a scene emitted by {@link Canvas2EditorProps.onSceneChange}
 * can be fed straight back in as {@link Canvas2EditorProps.initialScene}.
 */
export type Canvas2Scene = ExcalidrawInitialDataState;

/** The Excalidraw imperative API handed to `onReady` (updateScene, export, …). */
export type Canvas2Api = ExcalidrawImperativeAPI;

export interface Canvas2EditorProps {
  /** Optional className for the wrapper. The wrapper fills its parent (100% ×
   *  100%), so the parent MUST establish a concrete height. */
  className?: string;
  /** Initial scene (elements / appState / files). Read once on mount, like
   *  Excalidraw's `initialData` — later changes do not reset the canvas. */
  initialScene?: Canvas2Scene | null;
  /**
   * Fired (debounced) when scene CONTENT changes, with a persistence-ready
   * snapshot: deleted-element tombstones are filtered out, the files map is
   * pruned to images still referenced, and viewport-only changes (pan/zoom/
   * selection) never fire. The snapshot is immutable-by-convention — persist
   * it as-is (stringify), never mutate it; camera/selection are intentionally
   * not part of it. The host owns persistence.
   */
  onSceneChange?: (scene: Canvas2Scene) => void;
  /** Read-only mode (preview / comment). Maps to `viewModeEnabled` and hides
   *  every mutating control in the canvas2 chrome (page actions, inserts). */
  viewMode?: boolean;
  /** 'light' | 'dark'. Omit to use Excalidraw's default. */
  theme?: 'light' | 'dark';
  /** UI language. Defaults to Spanish to match studio. */
  langCode?: string;
  /** Receives the imperative API once mounted (updateScene, exportToBlob, …).
   *  This is canvas2's analogue of `onRegisterEditorApi`. */
  onReady?: (api: ExcalidrawImperativeAPI) => void;
  /**
   * Excalidraw's own "save as image" dialog. Defaults to `true`.
   *
   * Set it to `false` when the scene can hold images by REMOTE URL (migrated
   * designs do — the URL lives in `files[id].dataURL`). Excalidraw loads them
   * with `new Image()` and no `crossOrigin`, which taints the canvas: its
   * dialog then dies with `SecurityError: Tainted canvases may not be exported`
   * while it renders the preview, before the user can do anything.
   *
   * The host's own export (see `withHydratedFiles` in exportHydrate.ts) swaps
   * those URLs for dataURLs first, so it is unaffected — but it cannot fix a
   * dialog it doesn't own. Hence the switch: whoever supplies remote images
   * also supplies the export path.
   */
  nativeImageExport?: boolean;
  /**
   * Tipografías propias que la escena necesita, con su fichero.
   *
   * Se REGISTRAN como familias nuevas de Excalidraw (no se secuestra ninguna de
   * las suyas): ver la cabecera de `fonts.ts` para el mecanismo y sus límites.
   * El id numérico que le toca a cada nombre lo da `customFontFamilyId`, y es
   * el mismo que estampa el convertidor `legacy.ts`, así que un diseño migrado
   * se abre con su tipografía sin más trámite.
   *
   * Un diseño guardado trae las suyas en `editorConfig.fonts` y el host las
   * pasa por aquí; las del brand kit del proyecto se añaden aparte.
   */
  fontOverrides?: CustomFontFace[];
  /** Debounce window for `onSceneChange`, in ms. Defaults to 400. */
  changeDebounceMs?: number;
  /** Enable the fixed-size multi-page artboard model (frames-as-pages) and show
   *  the bottom page navigator. When off, canvas2 is a plain infinite canvas. */
  pages?: boolean;
  /** Page/artboard size when `pages` is enabled. Defaults to IG 4:5 1080×1350. */
  pageSize?: PageSize;
  /** Show the right-side layers panel (the active page's elements). Requires
   *  `pages` (it's scoped to the active artboard). */
  layers?: boolean;
  /**
   * Miniatura por página en la tira inferior (como el editor legacy). Apagado
   * por defecto porque rasterizar cuesta; con imágenes remotas hace falta
   * además `pageThumbnailFiles` o las páginas con foto saldrán sin miniatura.
   */
  pageThumbnails?: boolean;
  /** Mapa de ficheros hidratado, para poder rasterizar imágenes remotas. */
  pageThumbnailFiles?: Parameters<typeof PageNavigator>[0]['thumbnailFiles'];
  /**
   * `projects.brandKit` tal cual sale de la base de datos. Se traduce aquí
   * dentro con `resolveBrandKit()`.
   *
   * La prop es el blob CRUDO y no la marca ya resuelta a propósito: resolverla
   * en el host obligaría a importar un valor de `@pm/canvas2`, y ese barrel
   * arrastra Excalidraw al bundle de servidor ("window is not defined"). Con el
   * crudo, el host solo pasa datos.
   *
   * Hace dos cosas: añade sus `@font-face` a los de `fontOverrides` (los de la
   * marca van DESPUÉS, así que un override explícito del host gana), y siembra
   * el `appState` inicial para que toda figura o texto que se cree nazca en
   * color y tipografía de marca en vez de en el negro por defecto.
   *
   * Solo afecta a lo NUEVO: una escena guardada trae su propio `appState` y
   * sigue mandando, o abrir un diseño antiguo le cambiaría los colores.
   */
  brandKit?: BrandKitInput | null;
  /**
   * Trae los bytes de las imágenes remotas justo antes de exportar, para que el
   * grupo Exportar del menú funcione también con escenas que apuntan al CDN.
   * Sin esto el rasterizado muere por canvas contaminado.
   */
  hydrateFiles?: (opts?: { output?: 'blob' | 'dataurl' }) => Promise<FilesMap>;
  /**
   * Ancho mínimo del editor, en px, a partir del cual la barra lateral se puede
   * anclar (el "pin" de Biblioteca).
   *
   * Excalidraw usa 1229 por defecto, pensando en un editor a pantalla completa.
   * Aquí el lienzo va empotrado en una pestaña del contenido y nunca llega a
   * esa anchura, así que el pin no hacía NADA: no está roto, está desactivado
   * por no caber. Con 820 quedan ~500 px de lienzo tras los 302 px que ocupa la
   * barra anclada, que es lo mínimo para seguir trabajando.
   */
  dockedSidebarBreakpoint?: number;
  /**
   * Contenido del panel de biblioteca (arriba a la derecha). Lo aporta el host
   * porque la mediateca vive en `apps/web`: este paquete no sabe de proyectos,
   * carpetas ni autenticación. Sin contenido, el panel no aparece.
   */
  library?: ReactNode;
  /**
   * Contenido del panel de componentes reutilizables (debajo del de biblioteca).
   * Mismo seam que `library`: el host aporta la rejilla (los componentes viven
   * en su API); canvas2 solo pone el marco. Sin contenido, no aparece.
   */
  componentsPanel?: ReactNode;
  /**
   * "Guardar página como componente" del menú. La subida es cosa del host
   * (POST a su API + miniatura); canvas2 solo ofrece la entrada de menú.
   */
  onSaveComponent?: () => void;
  /**
   * Se suelta algo de la biblioteca sobre el lienzo.
   *
   * Recibe el payload tal cual venía en el `dataTransfer` (tipo
   * {@link MEDIA_DROP_TYPE}) y el punto en coordenadas de ESCENA. canvas2 no
   * interpreta el payload: no sabe de ficheros de media, solo de dónde ha caído.
   */
  onMediaDrop?: (payload: string, at: { x: number; y: number }) => void;
  /** Tipo de dataTransfer a escuchar. Por defecto {@link MEDIA_DROP_TYPE}. */
  mediaDropType?: string;
  /**
   * Textos del editor. canvas2 no lleva i18n dentro (no puede depender del
   * `react-i18next` de apps/web), así que el host inyecta lo que tenga
   * traducido; lo que no pase se queda en español. Ver labels.ts.
   */
  labels?: PartialLabels;
  /**
   * Página activa, notificada al host. La necesita para insertar en la página
   * correcta lo que se elija en la biblioteca.
   */
  onActivePageChange?: (pageId: string | null) => void;
  /**
   * Convierte la URL de un vídeo de la mediateca en una que el `<video>` del
   * selector de fotograma pueda usar SIN contaminar el lienzo.
   *
   * Es asíncrona porque el camino real es fetch autenticado → blob del mismo
   * origen: el CDN no manda CORS y el proxy del host exige cabecera
   * `Authorization`, que un `<video src>` no puede mandar. Sin esto el selector
   * sale apagado.
   */
  resolveVideoSrc?: (src: string, signal: AbortSignal) => Promise<string>;
  /** Libera lo que devolviera `resolveVideoSrc` (revoca el object URL). */
  releaseVideoSrc?: (resolved: string) => void;
  /**
   * Captura el fotograma visible y devuelve la URL del póster YA subido a la
   * mediateca. Lo hace el host porque los bytes son cosa suya: este paquete no
   * sabe de MediaMonster, igual que no sabe de la biblioteca ni de los
   * componentes.
   */
  onPickVideoFrame?: (
    video: HTMLVideoElement,
    timeSec: number,
  ) => Promise<{ url: string; mimeType?: string } | null>;
}

/**
 * Valores por defecto del `appState` derivados de la marca: lo que se aplica a
 * cada figura o texto NUEVO.
 *
 * No se toca el color de relleno. Rellenar por defecto toda figura nueva es un
 * cambio de comportamiento que sorprende, y el relleno está a un clic en el
 * selector; el trazo, en cambio, es también el color del texto, así que es el
 * que de verdad ahorra trabajo.
 */
/**
 * Tipo de `dataTransfer` con el que la biblioteca del host marca lo que se
 * arrastra. Se exporta para que host y editor no puedan escribir cadenas
 * distintas y tener que descubrirlo probando.
 */
export const MEDIA_DROP_TYPE = 'application/x-canvas2-media';

function brandDefaults(brand?: Canvas2Brand) {
  if (!brand) return {};
  const defaults: Record<string, unknown> = {};
  if (brand.mainColor) defaults.currentItemStrokeColor = brand.mainColor;
  // La familia ya está registrada (el efecto de registro corre antes de montar
  // Excalidraw), así que aquí solo hay que preguntar por su id.
  const familia = brand.bodyFamily ?? brand.headingFamily;
  const id = familia ? fontFamilyId(familia) : null;
  if (id !== null) defaults.currentItemFontFamily = id;
  return defaults;
}

/** Debounce a callback; always invokes the latest closure, clears on unmount. */
function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}

/**
 * Controlled wrapper around the Excalidraw infinite-canvas editor.
 *
 * Excalidraw touches `window` on import and must run client-side only — keep
 * this behind a `next/dynamic(..., { ssr: false })` boundary in the host app
 * (see apps/web/src/app/canvas/page.tsx).
 */
export function Canvas2Editor({
  className,
  initialScene,
  onSceneChange,
  viewMode = false,
  theme,
  langCode = 'es-ES',
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
  labels,
  resolveVideoSrc,
  releaseVideoSrc,
  onPickVideoFrame,
}: Canvas2EditorProps) {
  const brand = useMemo(() => resolveBrandKit(brandKit), [brandKit]);

  // Las fuentes de la marca se añaden DETRÁS de las del host: si ambos declaran
  // la misma familia, gana la última regla @font-face, y el host es quien sabe
  // de casos particulares.
  const allFontOverrides = useMemo(
    () => [...(fontOverrides ?? []), ...(brand.fontOverrides ?? [])],
    [fontOverrides, brand],
  );

  /**
   * Da de alta las familias en Excalidraw y declara sus `@font-face`.
   *
   * El registro va en `useMemo` y no en un efecto porque tiene que haber
   * ocurrido ANTES del primer render de `<Excalidraw>`: `brandDefaults` consulta
   * los ids para sembrar el `appState`, y la escena inicial ya trae textos con
   * esos ids. Es idempotente (`fontRegistry` lleva la cuenta), así que
   * ejecutarlo durante el render no tiene efectos observables repetidos.
   */
  const fuentes = useMemo(() => registerCustomFonts(dedupeFontFaces(allFontOverrides)), [
    allFontOverrides,
  ]);

  // El <style> va aparte y NO se limpia entre renders: el navegador cachea la
  // fuente por familia, y quitarla y reponerla provocaría un parpadeo de texto.
  useEffect(() => {
    if (!fuentes.faces.length) return;
    const id = 'canvas2-font-overrides';
    const css = buildFontFaceCss(fuentes.faces, { display: 'swap' });
    let tag = document.getElementById(id) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = id;
      document.head.appendChild(tag);
    }
    // Acumula en vez de sustituir: dos editores montados con marcas distintas
    // (p. ej. una previsualización al lado) comparten el <style>, y machacarlo
    // dejaría al primero sin su tipografía.
    if (!tag.textContent?.includes(css)) {
      tag.textContent = tag.textContent ? `${tag.textContent}\n${css}` : css;
    }
  }, [fuentes]);

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  // Active page, lifted here so PageNavigator, inserts and LayersPanel all
  // agree on which artboard actions target. It FOLLOWS the user: chip clicks,
  // viewport panning, and selection all update it.
  const [activePageId, setActivePageId] = useState<string | null>(null);

  // La página activa se decide dentro (clic en la tira, paneo, selección), así
  // que el host solo puede enterarse si se le avisa.
  useEffect(() => {
    onActivePageChange?.(activePageId);
    // Depende SOLO de la página activa: `onActivePageChange` queda fuera porque
    // un host que pase una función en línea la recrearía en cada render y esto
    // se dispararía sin parar.
  }, [activePageId]);
  const didInitPages = useRef(false);

  // Emission hygiene state: skip viewport-only onChange ticks (the elements
  // array reference is stable across them) and remember the last selection to
  // drive selection-following without extra scans.
  const lastEmittedRef = useRef<{ elements: unknown; bg: unknown }>({
    elements: null,
    bg: null,
  });
  const lastSelectionRef = useRef<unknown>(null);

  // In pages mode with NO host scene, the first artboard ships INSIDE
  // initialData — creating it post-mount raced Excalidraw's own hydration,
  // which replaced the scene and wiped the injected page.
  const [initialData] = useState<Canvas2Scene | null>(() => {
    const base: Canvas2Scene | null =
      initialScene ?? (pages ? (createBlankScene(pageSize) as Canvas2Scene) : null);
    return {
      ...(base ?? {}),
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
        ...(base?.appState ?? {}),
      },
    } as Canvas2Scene;
  });

  /**
   * ¿Queda por entrar la escena del host?
   *
   * Excalidraw aplica `initialData` de forma ASÍNCRONA (el prop admite incluso
   * una promesa), así que hay una ventana en la que el api ya existe, `onChange`
   * ya dispara y la escena TODAVÍA está vacía. Todo lo que mire la escena en esa
   * ventana llega a la conclusión contraria a la verdad.
   */
  const pendingHydration = useRef(((initialData?.elements as unknown[] | undefined)?.length ?? 0) > 0);

  const emitScene = useDebouncedCallback((scene: Canvas2Scene) => {
    onSceneChange?.(scene);
  }, changeDebounceMs);

  // Pages init — driven by Excalidraw's FIRST onChange (which only fires once
  // hydration has committed; the old 100ms settle-poll guessed at timing), with
  // a timeout fallback for scenes that never produce a change tick. Legacy
  // scenes get their paper sheets and flush packing in history-invisible
  // commits so the first Ctrl+Z can't undo the migration.
  useEffect(() => {
    if (!pages || !api || didInitPages.current) return;
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (didInitPages.current) return;
      // DESTRUCTIVO si se salta: con la escena a medio hidratar `listPages` da
      // cero, se crea una página en blanco y ese commit —`updateScene` sustituye
      // la escena ENTERA— se lleva por delante el diseño que estaba entrando. El
      // autoguardado del host lo persistía acto seguido: así se vaciaron cuatro
      // componentes de la biblioteca (quedaron en marco + papel de 1080×1350).
      // Se espera al siguiente `onChange`, que ya trae la escena puesta.
      if (pendingHydration.current) {
        if (api.getSceneElements().length === 0) return;
        pendingHydration.current = false;
      }
      didInitPages.current = true;
      unsub?.();
      if (timer) clearTimeout(timer);
      const existing = listPages(api);
      if (existing.length === 0) {
        const id = addPage(api, pageSize, { capture: 'never' });
        goToPage(api, id);
        setActivePageId(id);
        return;
      }
      ensurePagePapers(api, 'never');
      relayoutPages(api, 'never');
      setActivePageId((current) => {
        if (current) return current;
        goToPage(api, existing[0].id);
        return existing[0].id;
      });
    };
    unsub = api.onChange(run);
    timer = setTimeout(run, 1500);
    return () => {
      unsub?.();
      if (timer) clearTimeout(timer);
    };
  }, [pages, api, pageSize]);

  // Viewport-following: after a pan/zoom settles, the page occupying the most
  // visible area becomes the active page — so Exportar/Texto/Fondo/Tamaño act
  // on what the user is LOOKING at, not on the last-clicked chip.
  useEffect(() => {
    if (!pages || !api) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = api.onScrollChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const [x1, y1, x2, y2] = getVisibleSceneBounds(api.getAppState());
        let best: { id: string; area: number } | null = null;
        for (const e of api.getSceneElements()) {
          if (e.type !== 'frame') continue;
          const w = Math.min(e.x + e.width, x2) - Math.max(e.x, x1);
          const h = Math.min(e.y + e.height, y2) - Math.max(e.y, y1);
          if (w <= 0 || h <= 0) continue;
          const area = w * h;
          if (!best || area > best.area) best = { id: e.id, area };
        }
        if (best) {
          const id = best.id;
          setActivePageId((current) => (current === id ? current : id));
        }
      }, 150);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [pages, api]);

  // Keyboard page navigation: PageUp/PageDown cycle pages (skipped while a
  // text element is being edited or focus sits in a form field).
  useEffect(() => {
    if (!pages || !api) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'PageUp' && ev.key !== 'PageDown') return;
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const appState = api.getAppState() as { editingTextElement?: unknown };
      if (appState.editingTextElement) return;
      const list = listPages(api);
      if (list.length < 2) return;
      ev.preventDefault();
      setActivePageId((current) => {
        const idx = Math.max(0, list.findIndex((p) => p.id === current));
        const step = ev.key === 'PageDown' ? 1 : -1;
        const next = list[(idx + step + list.length) % list.length];
        goToPage(api, next.id);
        return next.id;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages, api]);

  return (
    <div
      className={className}
      data-canvas2=""
      style={{ position: 'relative', width: '100%', height: '100%' }}
      // Soltar desde la biblioteca. Se escucha en el envoltorio y no dentro de
      // Excalidraw porque su lienzo ya tiene su propio manejador de drop (para
      // ficheros del sistema) y no admite tipos ajenos.
      onDragOver={(e) => {
        if (!onMediaDrop || !e.dataTransfer.types.includes(mediaDropType)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        if (!onMediaDrop) return;
        const payload = e.dataTransfer.getData(mediaDropType);
        if (!payload) return;
        e.preventDefault();
        const state = api?.getAppState();
        if (!state) return;
        // El puntero llega en coordenadas de VENTANA; hay que restar el origen
        // del envoltorio antes de convertir, o la imagen cae desplazada tanto
        // como el editor esté separado del borde de la página.
        const box = e.currentTarget.getBoundingClientRect();
        const at = viewportCoordsToSceneCoords(
          { clientX: e.clientX - box.left, clientY: e.clientY - box.top },
          state,
        );
        onMediaDrop(payload, at);
      }}
    >
      <Excalidraw
        initialData={initialData}
        viewModeEnabled={viewMode}
        langCode={langCode}
        aiEnabled={false}
        UIOptions={{
          canvasActions: { saveAsImage: nativeImageExport },
          dockedSidebarBreakpoint,
        }}
        {...(theme ? { theme } : {})}
        excalidrawAPI={(instance) => {
          apiRef.current = instance;
          setApi(instance);
          onReady?.(instance);
        }}
        onChange={(elements, appState, files) => {
          // Selection-following (pages mode): selecting an element activates
          // its page. Guarded by reference identity — cheap on every tick.
          if (pages && appState.selectedElementIds !== lastSelectionRef.current) {
            lastSelectionRef.current = appState.selectedElementIds;
            const selected = Object.keys(appState.selectedElementIds).find(
              (id) => appState.selectedElementIds[id],
            );
            if (selected) {
              const el = elements.find((e) => e.id === selected);
              const frameId = el ? (el.type === 'frame' ? el.id : el.frameId) : null;
              if (frameId) {
                setActivePageId((current) => (current === frameId ? current : frameId));
              }
            }
          }

          if (!onSceneChange) return;
          // Content gate: the elements array reference is stable across
          // viewport-only ticks (pan/zoom/selection), so identity + background
          // equality means "nothing to persist".
          const bg = appState.viewBackgroundColor;
          if (
            elements === lastEmittedRef.current.elements &&
            bg === lastEmittedRef.current.bg
          ) {
            return;
          }
          lastEmittedRef.current = { elements, bg };

          // Persistence-ready snapshot: no deleted-element tombstones, and the
          // files map pruned to images that still exist (dead dataURLs
          // otherwise accumulate forever and bloat every save).
          const live = getNonDeletedElements(elements as readonly SceneElement[]);
          const referenced = new Set(
            live
              .filter(
                (e): e is SceneElement & { fileId: string } =>
                  e.type === 'image' && Boolean((e as { fileId?: unknown }).fileId),
              )
              .map((e) => e.fileId),
          );
          const prunedFiles = files
            ? Object.fromEntries(Object.entries(files).filter(([id]) => referenced.has(id)))
            : files;
          emitScene({
            elements: live,
            appState: { viewBackgroundColor: bg },
            files: prunedFiles,
          } as Canvas2Scene);
        }}
      >
        {/* Fondo de página, tamaño, insertar texto y exportación.
            Como hijo de <Excalidraw> SUSTITUYE el menú de fábrica, así que
            CanvasMenu repone los items de serie que se conservan.

            Se monta SIN esperar a `api`: Excalidraw dibuja su propio menú de
            respaldo mientras no hay un hijo que lo sustituya, y como `api` solo
            llega en un render posterior se acababan viendo DOS hamburguesas. */}
        {pages ? (
          <CanvasMenu
            api={api}
            activePageId={activePageId}
            theme={theme}
            viewMode={viewMode}
            hydrateFiles={hydrateFiles}
            // Las mismas familias (ya con su alias) que se declaran en
            // pantalla, embebidas también en el SVG exportado.
            fontFaces={fuentes.faces}
            brandFamilies={{ heading: brand.headingFamily, body: brand.bodyFamily }}
            onSaveComponent={onSaveComponent}
            labels={labels}
          />
        ) : null}
      </Excalidraw>
      {/* Selector del fotograma de portada: aparece al seleccionar un vídeo. */}
      <VideoFramePicker
        api={api}
        theme={theme}
        viewMode={viewMode}
        labels={labels}
        resolveVideoSrc={resolveVideoSrc}
        releaseVideoSrc={releaseVideoSrc}
        onPickFrame={onPickVideoFrame}
      />
      {/* Aviso de elementos fuera de toda página. Va aquí y no dentro del
          navegador de páginas porque habla del documento entero, no de una. */}
      {pages && (
        <LooseWarning
          api={api}
          activePageId={activePageId}
          theme={theme}
          viewMode={viewMode}
          labels={labels}
        />
      )}
      {pages && api && (
        <PageNavigator
          api={api}
          theme={theme}
          viewMode={viewMode}
          activeId={activePageId}
          onActiveChange={setActivePageId}
          pageSize={pageSize}
          thumbnails={pageThumbnails}
          thumbnailFiles={pageThumbnailFiles}
          labels={labels}
        />
      )}
      {/* Biblioteca: el marco es nuestro, el contenido lo pone el host. */}
      <LibraryPanel theme={theme} viewMode={viewMode} labels={labels}>
        {library}
      </LibraryPanel>
      {/* Componentes reutilizables: mismo marco, anclado bajo la biblioteca. */}
      <LibraryPanel
        theme={theme}
        viewMode={viewMode}
        labels={labels}
        title={mergeLabels(labels).components.title}
        anchorTop={100}
        icon={<DuplicateIcon />}
        testId="canvas2-components"
      >
        {componentsPanel}
      </LibraryPanel>

      {/* Capas y Marca comparten la esquina inferior derecha, en pestañas.
          Capas salió de la barra lateral de Excalidraw al sustituir su
          Biblioteca por la nuestra. */}
      <RightDock
        api={api}
        activePageId={activePageId}
        theme={theme}
        viewMode={viewMode}
        brandKit={brandKit}
        layers={layers && pages}
        labels={labels}
      />
      {pages && api && !viewMode && (
        <PageActions
          api={api}
          activePageId={activePageId}
          theme={theme}
          pageSize={pageSize}
          onActiveChange={setActivePageId}
          labels={labels}
        />
      )}
    </div>
  );
}

/** Backwards-compatible alias — the bare wrapper is now a controlled editor. */
export const Canvas2 = Canvas2Editor;

export default Canvas2Editor;
