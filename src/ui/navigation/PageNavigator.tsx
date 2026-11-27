'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from '../../core/excal';
import {
  type PageInfo,
  type PageSize,
  addPage,
  listPages,
  renamePage,
  movePageTo,
  goToPage,
  fitAllPages,
} from '../../core/pages';
import { usePageThumbnails, type FilesMap } from '../hooks/pageThumbnails';
import { PANEL_FONT, palette } from '../shared/theme';
import { FitAllIcon, LockIcon, PlusIcon } from '../shared/icons';
import { mergeLabels, type PartialLabels } from '../shared/labels';
import { displayPageName } from '../../core/pageNames';
import { DragPreview, type DragGrab } from '../overlays/DragPreview';
import { startPointerDrag } from '../shared/pointerDrag';
import { isComposing } from '../shared/composing';

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
const THUMB_W = 38;
/** Sombra de cada miniatura: sin ella, una página blanca no se distingue de la
 *  isla blanca de la tira. Sombra y no borde, como el resto del cromo. */
const THUMB_SHADOW = {
  light: '0 1px 3px rgba(17,17,17,0.14), 0 0 1px rgba(17,17,17,0.10)',
  dark: '0 1px 3px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.4)',
} as const;

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
  // La tira va SIN tarjeta, directamente sobre la mesa (25/11), y la mesa es
  // clara en los dos temas (con páginas la escena se monta en claro): números,
  // «Añadir» y miniaturas van en claro aunque el editor esté en oscuro, como el
  // rótulo de la página. `theme` se acepta por compatibilidad y no cambia nada.
  void theme;
  const c = palette.light;
  const L = mergeLabels(labelsProp);
  // El nombre de una página sin nombre se enseña en el chip: sale del host. Por
  // referencia, para que la suscripción de abajo no dependa de las etiquetas.
  const pageNames = useRef(L.pages);
  pageNames.current = L.pages;
  const [pages, setPages] = useState<PageInfo[]>(() => listPages(api, L.pages));
  const [localActiveId, setLocalActiveId] = useState<string | null>(
    () => listPages(api)[0]?.id ?? null,
  );
  // Prefer the controlled value when the host drives active-page state.
  const activeId = controlledActiveId !== undefined ? controlledActiveId : localActiveId;
  // Inline rename (replaces window.prompt): the chip being renamed + its draft.
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  // Reordenar arrastrando: la página que se arrastra y el puesto (índice FINAL)
  // en que caería, para que las demás se aparten y se vea el orden resultante.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  /**
   * Dónde estaba cada ficha AL EMPEZAR el arrastre. El destino se calcula
   * contra esto y no contra la ficha que hay bajo el puntero: las fichas se
   * deslizan mientras arrastras, y apuntar a algo que se mueve hacía bailar la
   * tira (por eso antes solo se marcaba un filo y nada se movía).
   */
  const slotsRef = useRef<{ left: number; center: number }[]>([]);
  /**
   * Foto de la miniatura tomada al levantarla. Las miniaturas son `blob:` que
   * se revocan al regenerarse, y la tarjeta que sigue al cursor creaba un
   * `<img>` NUEVO con esa URL: si ya estaba revocada, salía la imagen rota.
   */
  const [grabThumb, setGrabThumb] = useState<string | null>(null);
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
        const next = listPages(api, pageNames.current);
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
      select(addPage(api, size, { ...opts, names: L.pages }));
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

  const dragIndex = draggingId ? pages.findIndex((p) => p.id === draggingId) : -1;

  /** Puesto final para un puntero en `clientX`: cuántas de las DEMÁS fichas quedan a su izquierda. */
  const indexAt = (clientX: number, from: number): number => {
    let j = 0;
    slotsRef.current.forEach((slot, k) => {
      if (k !== from && slot.center < clientX) j++;
    });
    return j;
  };

  /** Cuánto se desliza la ficha `k` para enseñar el orden que quedaría al soltar. */
  const shiftFor = (k: number): number => {
    const slots = slotsRef.current;
    if (dragIndex < 0 || dropIndex === null || !slots[k]) return 0;
    let target: number;
    if (k === dragIndex) target = dropIndex;
    else {
      const rest = k - (k > dragIndex ? 1 : 0);
      target = rest + (rest >= dropIndex ? 1 : 0);
    }
    return slots[target] ? slots[target].left - slots[k].left : 0;
  };

  const endDrag = () => {
    setDraggingId(null);
    setDropIndex(null);
    setGrab(null);
    setGrabThumb(null);
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
        // En la distribución de móvil de Excalidraw la altura y el ancho los
        // pone canvas2.css: en reposo la tira baja a la fila de la isla
        // inferior (entre el menú y deshacer), y con algo elegido, cuando esa
        // isla se llena de acciones, sube por encima.
        bottom: narrow ? undefined : 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: narrow ? undefined : 'min(920px, 94%)',
        // El mismo aire a los dos lados: la juntura de delante de la primera
        // página se mete en este relleno (margen negativo, abajo) en vez de
        // sumarle 10px solo a la izquierda.
        // 7 aquí + 3 del carril = 10 a cada lado (ver el carril, abajo).
        padding: '1px 7px',
        // Sin tarjeta: las miniaturas (con su sombra) sueltas sobre la mesa.
        borderRadius: 16,
        background: 'transparent',
        color: c.fg,
        boxShadow: 'none',
        fontFamily: PANEL_FONT,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          // Sin hueco propio: la separación entre páginas la pone el insertor
          // (10px): las fichas no llevan relleno a los lados. Con `gap` además, dos páginas
          // acababan a 24px una de otra y la tira se leía como una lista suelta.
          gap: 0,
          minWidth: 0,
          overflowX: 'auto',
          // Aire para la sombra de las miniaturas: el desplazamiento recorta
          // lo que sale de su caja y la primera salía cortada por la izquierda.
          padding: 3,
        }}
      >
      {pages.map((page, index) => {
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
              // La primera, sobre el relleno de la tira: si no, la izquierda
              // tenía 10px más de aire que la derecha.
              marginLeft: index === 0 ? -10 : 0,
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
        const shift = shiftFor(index);
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
            className="canvas2-page-chip"
            title={displayPageName(page.name, L.pages)}
            // Con punteros, no con el arrastre HTML5: en el escritorio la ventana
            // se queda los `dragover` y reordenar no hacía nada (desktop#371).
            onPointerDown={(e) => {
              if (viewMode || isRenaming) return;
              const chip = e.currentTarget;
              let over = index;
              startPointerDrag(e, {
                onStart: (x, y) => {
                  setDraggingId(page.id);
                  // Dónde está cada ficha AHORA (antes de que nada se deslice).
                  slotsRef.current = pages.map((p) => {
                    const r = chipRefs.current.get(p.id)?.getBoundingClientRect();
                    return r ? { left: r.left, center: r.left + r.width / 2 } : { left: 0, center: 0 };
                  });
                  setDropIndex(index);
                  // Foto de la miniatura que YA se ve (decodificada): la tarjeta
                  // que sigue al cursor la usa en vez de volver a pedir el `blob:`.
                  const img = chip.querySelector('img');
                  let snap: string | null = null;
                  if (img && img.complete && img.naturalWidth > 0) {
                    try {
                      const canvas = document.createElement('canvas');
                      canvas.width = THUMB_W * 2;
                      canvas.height = Math.round(canvas.width * (img.naturalHeight / img.naturalWidth));
                      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      snap = canvas.toDataURL('image/png');
                    } catch {
                      // Un lienzo contaminado no se puede leer: sin foto, ficha lisa.
                      snap = null;
                    }
                  }
                  setGrabThumb(snap);
                  // Mismo gesto que arrastrar contenido en el calendario: se
                  // levanta una tarjeta propia que sigue al puntero.
                  const box = chip.getBoundingClientRect();
                  setGrab({ x: x - box.left, y: y - box.top, width: box.width, height: box.height });
                },
                // El destino se decide en el carril entero (no ficha a ficha): sirve
                // también soltar en el hueco entre dos o más allá de la última.
                onMove: (x) => {
                  over = indexAt(x, index);
                  setDropIndex((prev) => (prev === over ? prev : over));
                },
                onDrop: () => {
                  endDrag();
                  if (over !== index) {
                    movePageTo(api, page.id, over);
                    select(page.id);
                  }
                },
                onCancel: endDrag,
              });
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
              padding: '4px 0',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              color: c.fg,
              // La activa, entera; las demás, apagadas. Sin fondo ni filo
              // encima: competían con el contenido (y el cromo no lleva bordes).
              // La que se arrastra deja su hueco tenue en el puesto donde caería.
              opacity:
                draggingId === page.id ? 0.25 : isActive ? 1 : 0.55,
              // Mientras arrastras, las demás se deslizan al puesto que les
              // quedaría al soltar: se ve el orden antes de soltar. El destino
              // sale de las posiciones del principio (`slotsRef`), así que
              // deslizarse no cambia a dónde apuntas y la tira no baila.
              transform: shift ? `translateX(${shift}px)` : undefined,
              transition: draggingId
                ? 'transform 180ms cubic-bezier(0.2, 0, 0, 1), opacity 120ms ease'
                : 'opacity 120ms ease',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: THUMB_W,
                height: thumbH,
                // El contenido casi recto: la miniatura es la pieza.
                borderRadius: 2,
                background: c.hover,
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: THUMB_SHADOW.light,
              }}
            >
              {thumb ? (
                // Es un <img> a secas y no next/image a propósito: el paquete no
                // depende de Next, y la fuente es un blob URL local.
                <img
                  src={thumb}
                  alt=""
                  // Una <img> se arrastra sola por defecto: el navegador
                  // levantaba la imagen en vez de la ficha.
                  draggable={false}
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
                  if (e.key === 'Enter' && !isComposing(e)) commitRename();
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
            padding: '4px 0',
            // El mismo aire que hay entre dos páginas (la juntura mide 10):
            // pegada a la última, su sombra y la ficha se montaban.
            marginLeft: pages.length > 0 ? 10 : 0,
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
              borderRadius: 2,
              // Relleno suave, sin filo: nada del cromo lleva borde.
              background: c.hover,
              display: 'grid',
              placeContent: 'center',
              lineHeight: 0,
            }}
          >
            <PlusIcon />
          </span>
          {/* «Añadir» en palabras: el número de la siguiente página no decía
              qué hacía la ficha. */}
          <span aria-hidden="true" style={{ fontWeight: 500 }}>{L.pages.addShort}</span>
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
          // La foto tomada al levantarla, nunca el `blob:` (ver `grabThumb`).
          const thumb = grabThumb;
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
                  borderRadius: 2,
                  background: c.hover,
                  overflow: 'hidden',
                  boxShadow: THUMB_SHADOW.light,
                }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    draggable={false}
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
