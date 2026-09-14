'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from '../core/excal';
import {
  type PageInfo,
  type PageSize,
  addPage,
  listPages,
  renamePage,
  movePageTo,
  goToPage,
  fitAllPages,
} from '../core/pages';
import { usePageThumbnails, type FilesMap } from './pageThumbnails';
import { PANEL_FONT, palette } from './theme';
import { FitAllIcon, LockIcon, PlusIcon } from './icons';
import { mergeLabels, type PartialLabels } from './labels';
import { DragPreview, hideNativeDragImage, type DragGrab } from './DragPreview';

export interface PageNavigatorProps {
  api: ExcalidrawImperativeAPI;
  theme?: 'light' | 'dark';
  /** Read-only mode: la tira sigue navegando; se ocultan renombrar y reordenar. */
  viewMode?: boolean;
  /** Excalidraw está en su distribución de móvil: ver `narrow.ts`. */
  narrow?: boolean;
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
  /** Tamaño de respaldo para "Añadir página" cuando no hay ninguna de la que heredar. */
  pageSize?: PageSize;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

function pagesSignature(pages: PageInfo[]): string {
  return pages
    .map((p) => `${p.id}:${p.name}:${p.width}x${p.height}:${p.locked ? 1 : 0}`)
    .join('|');
}

/** Ancho de la miniatura del chip; el alto sale de la proporción de la página. */
const THUMB_W = 34;

/**
 * Tira de páginas, abajo y centrada. Lee las páginas (marcos) en vivo de la
 * escena y sirve para NAVEGAR: cambiar de página, reordenarlas arrastrando y
 * renombrar con doble clic. Todo lo demás vive donde se opera: las acciones de la página en
 * `PageActions`, sobre el lienzo; fondo, tamaño y exportación en `CanvasMenu`.
 */
export function PageNavigator({
  api,
  theme = 'light',
  viewMode = false,
  narrow = false,
  activeId: controlledActiveId,
  onActiveChange,
  labels: labelsProp,
  thumbnails = false,
  thumbnailFiles,
  pageSize,
}: PageNavigatorProps) {
  const c = palette[theme];
  const L = mergeLabels(labelsProp);
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
  /** Se ha intentado crear una página y ha fallado (ver `createPage`). */
  const [addFailed, setAddFailed] = useState(false);
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

  /**
   * Crear una página sin dejar el botón mudo.
   *
   * Un fallo dentro de `addPage` escapaba del manejador, y React NO recoge los
   * errores de eventos (los error boundaries solo ven el render): el editor
   * seguía en pie y el botón parecía simplemente muerto, sin nada que mirar. Se
   * captura, se deja rastro en consola para quien depure y se dice en pantalla.
   */
  const createPage = (size: PageSize | undefined, opts?: { beforePageId?: string }) => {
    try {
      setAddFailed(false);
      select(addPage(api, size, opts));
    } catch (err) {
      console.error('[canvas2] no se ha podido crear la página', err);
      setAddFailed(true);
    }
  };

  // El renombrado se dispara con doble clic en el chip; el marco del lienzo
  // también se puede renombrar de forma nativa, y ambos escriben el mismo campo.
  const startRename = (page: PageInfo) => setRenaming({ id: page.id, value: page.name });
  const commitRename = () => {
    if (renaming && renaming.value.trim()) renamePage(api, renaming.id, renaming.value.trim());
    setRenaming(null);
  };

  // Proporción de la ficha "añadir": la de la última página, para que el hueco
  // que se ve al final sea del tamaño de lo que se va a crear.
  const ultima = pages[pages.length - 1];
  const ghostRatio = ultima
    ? { width: ultima.width, height: ultima.height }
    : (pageSize ?? { width: 1080, height: 1350 });

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
        // 16 se solapaba con la isla inferior de Excalidraw en su distribución
        // de móvil: medido en un iPhone de 390, la isla ocupa de y=781 a y=830 y
        // la tira iba de 745 a 829 — encima, y además con más z-index, así que
        // la tapaba. 74 la deja justo por arriba.
        bottom: narrow ? 74 : 16,
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
          // Sin hueco propio: la separación entre páginas la pone el insertor
          // (10px) más el relleno de cada ficha. Con `gap` además, dos páginas
          // acababan a 24px una de otra y la tira se leía como una lista suelta.
          gap: 0,
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
      {pages.map((page) => {
        const isActive = page.id === activeId;
        const isRenaming = renaming?.id === page.id;
        const thumb = pageThumbs[page.id];
        const gap = !viewMode ? (
          // Juntura ANTES de esta página: en reposo es un hueco de 12px y al
          // pasar el ratón enseña el "+". Es el camino para insertar EN MEDIO,
          // que antes obligaba a crear al final y arrastrar hasta su sitio.
          <button
            key={`gap-${page.id}`}
            type="button"
            className="canvas2-page-insert"
            data-testid="canvas2-insert-page"
            aria-label={L.pages.insertHere}
            title={L.pages.insertHere}
            onClick={() =>
              createPage({ width: page.width, height: page.height }, { beforePageId: page.id })
            }
            style={{
              all: 'unset',
              alignSelf: 'stretch',
              flexShrink: 0,
              width: 10,
              cursor: 'pointer',
              display: 'grid',
              placeContent: 'center',
              position: 'relative',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: c.active,
                color: c.activeFg,
                display: 'grid',
                placeContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1,
                // Invisible en reposo: la tira tiene que leerse como una fila de
                // páginas, no como una fila de botones entre páginas.
                opacity: 0,
                transform: 'scale(0.6)',
                transition: 'opacity 120ms ease, transform 120ms ease',
              }}
            >
              +
            </span>
          </button>
        ) : null;
        // La miniatura respeta la proporción real de la página, así que una
        // story alargada y un cuadrado se distinguen de un vistazo aunque
        // todavía no se haya rasterizado ninguna de las dos.
        const thumbH = Math.round(THUMB_W * (page.height / Math.max(1, page.width)));
        const isDropTarget = dragOverId === page.id && draggingId !== page.id;
        return (
          <Fragment key={page.id}>
          {gap}
          <div
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
          </Fragment>
        );
      })}

      {/* Añadir al FINAL. Es una ficha del tamaño de una miniatura y con el
          borde a puntos: se lee como "aquí va la siguiente página", no como un
          botón más de una barra de herramientas. Sustituye al botón con texto
          que cerraba la tira, que ocupaba el ancho de dos páginas para decir
          algo que la propia forma ya dice.

          Va DENTRO del carril, al final, como en Canva: con muchas páginas hay
          que desplazarse hasta él, pero para eso está la juntura, que siempre
          tienes al lado de la página que estás mirando. */}
      {!viewMode && (
        <button
          type="button"
          data-testid="canvas2-add-page"
          aria-label={L.pages.addAtEnd}
          title={L.pages.addAtEnd}
          onClick={() => {
            const last = pages[pages.length - 1];
            createPage(last ? { width: last.width, height: last.height } : pageSize);
          }}
          style={{
            all: 'unset',
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: 4,
            borderRadius: 8,
            color: c.sub,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <span
            className="canvas2-page-ghost"
            style={{
              width: THUMB_W,
              height: Math.round(THUMB_W * (ghostRatio.height / Math.max(1, ghostRatio.width))),
              borderRadius: 3,
              border: `1.5px dashed ${c.border}`,
              display: 'grid',
              placeContent: 'center',
              lineHeight: 0,
            }}
          >
            <PlusIcon />
          </span>
          {/* El número que le tocaría: la ficha dice qué página vas a crear, y
              de paso la caja mide lo mismo que la de un chip. */}
          <span aria-hidden="true">{pages.length + 1}</span>
        </button>
      )}
      </div>

      {/* Ver todas. Va PEGADO al carril y fuera de su scroll horizontal: en un
          diseño de 20 páginas el botón se iría a la derecha con la tira y
          justo entonces es cuando más falta hace. Con una sola página no
          aporta nada sobre el encuadre que ya tienes.

          Separado por un filo: es lo único de la tira que NO es una página, y
          sin la línea se leía como una ficha más del carril. */}
      {pages.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            paddingLeft: 8,
            marginLeft: 6,
            borderLeft: `1px solid ${c.border}`,
          }}
        >
          <button
            type="button"
            aria-label={L.pages.fitAll}
            title={L.pages.fitAll}
            onClick={() => fitAllPages(api)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 5px',
              borderRadius: 6,
              color: c.sub,
            }}
          >
            <FitAllIcon />
          </button>
        </div>
      )}

      {/* Por qué no ha aparecido la página. Va sobre la tira y no dentro del
          carril: el carril tiene scroll horizontal y el aviso acabaría fuera de
          la vista justo cuando hace falta. Se va solo al siguiente intento. */}
      {addFailed && (
        <div
          role="status"
          data-testid="canvas2-add-page-failed"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: c.dangerFg,
            background: c.danger,
          }}
        >
          {L.pages.addFailed}
        </div>
      )}

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
