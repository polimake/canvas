'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import { type PageInfo, listPages, renamePage, movePageTo, goToPage } from './pages';
import { usePageThumbnails, type FilesMap } from './pageThumbnails';
import { PANEL_FONT, palette } from './theme';
import { LockIcon } from './icons';
import { DragPreview, hideNativeDragImage, type DragGrab } from './DragPreview';

export interface PageNavigatorProps {
  api: ExcalidrawImperativeAPI;
  theme?: 'light' | 'dark';
  /** Read-only mode: la tira sigue navegando; se ocultan renombrar y reordenar. */
  viewMode?: boolean;
  /** Controlled active page id. When provided, the strip reflects it instead of
   *  its own local state (so it can stay in sync with the LayersPanel). */
  activeId?: string | null;
  /** Notified when the user switches pages. */
  onActiveChange?: (id: string) => void;
  /**
   * Miniatura por página en los chips (como la tira del editor legacy).
   * Apagado por defecto: rasterizar cuesta, y una escena con imágenes remotas
   * necesita además el mapa hidratado (`thumbnailFiles`) o no producirá nada.
   */
  thumbnails?: boolean;
  /** Mapa de ficheros hidratado para poder rasterizar imágenes remotas. */
  thumbnailFiles?: FilesMap;
}

function pagesSignature(pages: PageInfo[]): string {
  return pages
    .map((p) => `${p.id}:${p.name}:${p.width}x${p.height}:${p.locked ? 1 : 0}`)
    .join('|');
}

/** Ancho de la miniatura del chip; el alto sale de la proporción de la página. */
const THUMB_W = 34;

/**
 * Tira de páginas, abajo y centrada — el análogo del `PageControl` de
 * polimake-canvas. Lee las páginas (marcos) en vivo de la escena y sirve para
 * NAVEGAR: cambiar de página, reordenarlas arrastrando y renombrar con doble
 * clic. Todo lo demás vive donde se opera: las acciones de la página en
 * `PageActions`, sobre el lienzo; fondo, tamaño y exportación en `CanvasMenu`.
 */
export function PageNavigator({
  api,
  theme = 'light',
  viewMode = false,
  activeId: controlledActiveId,
  onActiveChange,
  thumbnails = false,
  thumbnailFiles,
}: PageNavigatorProps) {
  const c = palette[theme];
  const [pages, setPages] = useState<PageInfo[]>(() => listPages(api));
  const [localActiveId, setLocalActiveId] = useState<string | null>(
    () => listPages(api)[0]?.id ?? null,
  );
  // Prefer the controlled value when the host drives active-page state.
  const activeId = controlledActiveId !== undefined ? controlledActiveId : localActiveId;
  // Inline rename (replaces window.prompt): the chip being renamed + its draft.
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  // Reordenar arrastrando: página que se arrastra + página sobre la que se suelta.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  /** Punto de agarre y tamaño de la pieza, para la tarjeta que sigue al cursor. */
  const [grab, setGrab] = useState<DragGrab | null>(null);
  const chipRefs = useRef(new Map<string, HTMLDivElement>());
  const pageThumbs = usePageThumbnails(api, { enabled: thumbnails, files: thumbnailFiles });
  const lastElementsRef = useRef<unknown>(null);

  // Keep the strip in sync with the scene. onChange fires on every commit
  // (including viewport ticks), so gate first on the elements-array REFERENCE
  // (stable across viewport-only ticks) and only then compare signatures.
  useEffect(() => {
    const refresh = () => {
      const elements = api.getSceneElements();
      if (elements === lastElementsRef.current) return;
      lastElementsRef.current = elements;
      setPages((prev) => {
        const next = listPages(api);
        return pagesSignature(prev) === pagesSignature(next) ? prev : next;
      });
    };
    lastElementsRef.current = null;
    refresh();
    const unsubscribe = api.onChange(refresh);
    return unsubscribe;
  }, [api]);

  // Auto-scroll the active chip into view (the strip scrolls with many pages).
  useEffect(() => {
    if (!activeId) return;
    chipRefs.current.get(activeId)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeId]);

  const select = (id: string) => {
    setLocalActiveId(id);
    onActiveChange?.(id);
    goToPage(api, id);
  };

  // El renombrado se dispara con doble clic en el chip; el marco del lienzo
  // también se puede renombrar de forma nativa, y ambos escriben el mismo campo.
  const startRename = (page: PageInfo) => setRenaming({ id: page.id, value: page.name });
  const commitRename = () => {
    if (renaming && renaming.value.trim()) renamePage(api, renaming.id, renaming.value.trim());
    setRenaming(null);
  };

  const inputStyle: CSSProperties = {
    width: 64,
    padding: '4px 6px',
    borderRadius: 6,
    border: `1px solid ${c.border}`,
    background: 'transparent',
    color: c.fg,
    fontSize: 12,
    fontFamily: PANEL_FONT,
  };

  return (
    <div
      // Marca para que canvas2.css pueda recentrarla cuando la barra lateral se
      // ancla y el lienzo visible deja de ser el contenedor entero.
      data-canvas2-pages=""
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: 'min(920px, 94%)',
        padding: 6,
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        fontFamily: PANEL_FONT,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
      {pages.map((page) => {
        const isActive = page.id === activeId;
        const isRenaming = renaming?.id === page.id;
        const thumb = pageThumbs[page.id];
        // La miniatura respeta la proporción real de la página, así que una
        // story alargada y un cuadrado se distinguen de un vistazo aunque
        // todavía no se haya rasterizado ninguna de las dos.
        const thumbH = Math.round(THUMB_W * (page.height / Math.max(1, page.width)));
        const isDropTarget = dragOverId === page.id && draggingId !== page.id;
        return (
          <div
            key={page.id}
            ref={(el) => {
              if (el) chipRefs.current.set(page.id, el);
              else chipRefs.current.delete(page.id);
            }}
            role="button"
            tabIndex={0}
            title={page.name}
            draggable={!viewMode && !isRenaming}
            onDragStart={(e) => {
              setDraggingId(page.id);
              e.dataTransfer.effectAllowed = 'move';
              // Firefox no inicia el arrastre sin datos en el portapapeles.
              e.dataTransfer.setData('text/plain', page.id);
              // Mismo gesto que arrastrar contenido en el calendario: se esconde
              // el fantasma del navegador y se levanta una tarjeta propia.
              const box = e.currentTarget.getBoundingClientRect();
              setGrab({
                x: e.clientX - box.left,
                y: e.clientY - box.top,
                width: box.width,
                height: box.height,
              });
              hideNativeDragImage(e);
            }}
            onDragOver={(e) => {
              if (!draggingId || draggingId === page.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverId(page.id);
            }}
            onDragLeave={() => setDragOverId((prev) => (prev === page.id ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingId && draggingId !== page.id) {
                movePageTo(api, draggingId, page.index);
                select(draggingId);
              }
              setDraggingId(null);
              setDragOverId(null);
              setGrab(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDragOverId(null);
              setGrab(null);
            }}
            onClick={() => select(page.id)}
            onDoubleClick={(e) => {
              if (viewMode) return;
              e.stopPropagation();
              startRename(page);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(page.id);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: draggingId === page.id ? 'grabbing' : 'pointer',
              padding: 4,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              color: c.fg,
              // La página activa se distingue SOLO por opacidad: la miniatura ya
              // es el contenido, y un fondo de color encima competía con ella.
              opacity:
                draggingId === page.id ? 0.3 : isActive ? 1 : 0.45,
              // El destino de un arrastre se marca con un filo, no moviendo las
              // páginas: que la tira baile mientras arrastras hace imposible
              // apuntar. Se queda en gris, como el resto de la tira.
              boxShadow: isDropTarget ? `inset 3px 0 0 ${c.fg}` : 'none',
              transition: 'opacity 120ms ease',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: THUMB_W,
                height: thumbH,
                borderRadius: 3,
                border: `1px solid ${c.border}`,
                background: c.hover,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {thumb ? (
                // Es un <img> a secas y no next/image a propósito: el paquete no
                // depende de Next, y la fuente es un blob URL local.
                <img
                  src={thumb}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : null}
              {page.locked && (
                // El candado va sobre la miniatura: es ESTADO de la página y hay
                // que verlo sin tener que activarla primero.
                <span
                  style={{
                    position: 'absolute',
                    right: 1,
                    bottom: 1,
                    display: 'inline-flex',
                    color: c.fg,
                    background: c.bg,
                    borderRadius: 3,
                    padding: 1,
                    lineHeight: 0,
                  }}
                >
                  <LockIcon />
                </span>
              )}
            </div>
            {isRenaming ? (
              <input
                autoFocus
                value={renaming.value}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenaming({ id: page.id, value: e.target.value })}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onBlur={commitRename}
                style={{ ...inputStyle, width: THUMB_W + 24 }}
              />
            ) : (
              <span>{page.index + 1}</span>
            )}
          </div>
        );
      })}
      </div>

      {/* Aquí abajo SOLO van páginas. Las acciones de la página están en
          `PageActions`, sobre el lienzo junto a su nombre; fondo, tamaño,
          insertar texto y exportar, en el menú principal (`CanvasMenu`). */}

      {/* La pieza levantada. Va fuera de la tira (es un portal a <body>) para
          que no la recorte el `overflow-x` del carril de páginas. */}
      <DragPreview active={Boolean(draggingId)} grab={grab} radius={8}>
        {(() => {
          const page = pages.find((p) => p.id === draggingId);
          if (!page) return null;
          const thumb = pageThumbs[page.id];
          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: 4,
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: PANEL_FONT,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: THUMB_W,
                  height: Math.round(THUMB_W * (page.height / Math.max(1, page.width))),
                  borderRadius: 3,
                  border: `1px solid ${c.border}`,
                  background: c.hover,
                  overflow: 'hidden',
                }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : null}
              </div>
              <span>{page.index + 1}</span>
            </div>
          );
        })()}
      </DragPreview>
    </div>
  );
}

export default PageNavigator;
