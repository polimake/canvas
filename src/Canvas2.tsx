'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './canvas2.css';
import {
  Excalidraw,
  getNonDeletedElements,
  getVisibleSceneBounds,
  type ExcalidrawImperativeAPI,
  type ExcalidrawInitialDataState,
  type SceneElement,
} from './excal';
import { PageNavigator } from './PageNavigator';
import { LayersPanel } from './LayersPanel';
import { addPage, createBlankScene, goToPage, listPages, relayoutPages, type PageSize } from './pages';
import { ensurePagePapers } from './background';

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
  changeDebounceMs = 400,
  pages = false,
  pageSize,
  layers = false,
}: Canvas2EditorProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  // Active page, lifted here so PageNavigator, inserts and LayersPanel all
  // agree on which artboard actions target. It FOLLOWS the user: chip clicks,
  // viewport panning, and selection all update it.
  const [activePageId, setActivePageId] = useState<string | null>(null);
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
        ...(base?.appState ?? {}),
      },
    } as Canvas2Scene;
  });

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
    >
      <Excalidraw
        initialData={initialData}
        viewModeEnabled={viewMode}
        langCode={langCode}
        aiEnabled={false}
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
      />
      {pages && api && (
        <PageNavigator
          api={api}
          pageSize={pageSize}
          theme={theme}
          viewMode={viewMode}
          activeId={activePageId}
          onActiveChange={setActivePageId}
        />
      )}
      {layers && api && (
        <LayersPanel api={api} activePageId={activePageId} theme={theme} viewMode={viewMode} />
      )}
    </div>
  );
}

/** Backwards-compatible alias — the bare wrapper is now a controlled editor. */
export const Canvas2 = Canvas2Editor;

export default Canvas2Editor;
