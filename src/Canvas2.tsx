'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './canvas2.css';
import {
  Excalidraw,
  type ExcalidrawImperativeAPI,
  type ExcalidrawInitialDataState,
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
  /** Fired (debounced) on every scene change with a serializable snapshot.
   *  The host owns persistence — mirror of polimake-canvas's `onChanges`. */
  onSceneChange?: (scene: Canvas2Scene) => void;
  /** Read-only mode (preview / comment). Maps to `viewModeEnabled`. */
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
  /** Page/artboard size when `pages` is enabled. Defaults to 1640×924. */
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
  // Active page, lifted here so PageNavigator, AssetSidebar and LayersPanel all
  // agree on which artboard inserts/edits target.
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const didInitPages = useRef(false);

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

  // In pages mode, ensure the scene ends up with at least one artboard and an
  // active page. Hydration of `initialData` is asynchronous relative to the
  // imperative-API callback, so poll briefly until the scene settles before
  // deciding a legacy (frameless) scene needs a page injected.
  useEffect(() => {
    if (!pages || !api || didInitPages.current) return;
    didInitPages.current = true;

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const existing = listPages(api);
      if (existing.length > 0) {
        clearInterval(timer);
        // Legacy-scene migration: give paperless pages their sheet and pack
        // pages flush together (older scenes were laid out with a gap).
        ensurePagePapers(api);
        relayoutPages(api);
        setActivePageId((current) => {
          if (current) return current;
          goToPage(api, existing[0].id);
          return existing[0].id;
        });
        return;
      }
      // Scene hydrated with content but no frames (legacy infinite-canvas
      // scene), or genuinely empty and stable: give it its first artboard.
      const settled = tries >= 5 && api.getSceneElements().length === 0;
      const legacy = api.getSceneElements().length > 0;
      if (settled || legacy || tries >= 20) {
        clearInterval(timer);
        const id = addPage(api, pageSize);
        goToPage(api, id);
        setActivePageId(id);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pages, api, pageSize]);

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
          if (!onSceneChange) return;
          emitScene({
            elements,
            appState: { viewBackgroundColor: appState.viewBackgroundColor },
            files,
          } as Canvas2Scene);
        }}
      />
      {pages && api && (
        <PageNavigator
          api={api}
          pageSize={pageSize}
          theme={theme}
          activeId={activePageId}
          onActiveChange={setActivePageId}
        />
      )}
      {layers && api && (
        <LayersPanel api={api} activePageId={activePageId} theme={theme} />
      )}
    </div>
  );
}

/** Backwards-compatible alias — the bare wrapper is now a controlled editor. */
export const Canvas2 = Canvas2Editor;

export default Canvas2Editor;
