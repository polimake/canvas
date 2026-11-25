'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExcalidrawImperativeAPI } from '../../core/excal';
import {
  listPages,
  movePage,
  duplicatePage,
  deletePage,
  setPageLocked,
  goToPage,
  renamePage,
  type PageInfo,
} from '../../core/pages';
import { displayPageName, isDefaultPageName } from '../../core/pageNames';
import { PANEL_FONT, palette } from '../shared/theme';
import { mergeLabels, type PartialLabels } from '../shared/labels';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DuplicateIcon,
  LockIcon,
  TrashIcon,
  UnlockIcon,
} from '../shared/icons';

/**
 * El rótulo de cada página y las acciones de la activa, flotando sobre el
 * lienzo encima de su marco.
 *
 * El rótulo lo pintaba Excalidraw dentro del lienzo, en Helvetica gris y con
 * estos botones montados encima. Ahora es nuestro (Canvas2 le apaga el suyo con
 * `frameRendering.name`): el número de la página en una ficha, el nombre con la
 * letra del Studio, y doble clic para renombrar —el mismo gesto que tenía el de
 * Excalidraw—. Un clic la hace activa.
 *
 * Las acciones estaban en la tira de abajo, que es el sitio equivocado por dos
 * motivos: te obliga a mirar al otro extremo de la pantalla para operar sobre
 * lo que tienes delante, y el nombre de la página —lo que identifica sobre qué
 * estás actuando— está aquí arriba, no allí.
 */

/** Alto reservado sobre el marco para que el rótulo no tape su contenido. */
const OFFSET_Y = 30;
/** Lo que ocupan las acciones a la derecha del rótulo de la página activa. */
const ACTIONS_W = 132;

export interface PageActionsProps {
  api: ExcalidrawImperativeAPI;
  activePageId?: string | null;
  theme?: 'light' | 'dark';
  onActiveChange?: (id: string) => void;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

interface Placed {
  left: number;
  top: number;
  width: number;
  page: PageInfo;
}

/** «1. Portada» → «Portada»: el número ya va en la ficha. */
function withoutNumber(name: string): string {
  return name.replace(/^\s*\d+\s*[.)·:-]\s*/, '').trim() || name;
}

export function PageActions({
  api,
  activePageId,
  theme = 'light',
  onActiveChange,
  labels: labelsProp,
}: PageActionsProps) {
  const L = mergeLabels(labelsProp);
  // El rótulo y las acciones van sobre la MESA, no sobre el cromo: con páginas
  // la escena se monta siempre en claro (`sceneTheme`), así que van en claro
  // aunque el editor esté en oscuro. Con la paleta oscura, el nombre salía
  // blanco sobre papel cálido y no se leía.
  void theme;
  const c = palette.light;
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [armedDelete, setArmedDelete] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string; original: string } | null>(null);
  // Esc cancela: al quitar el campo, el navegador manda un blur que, sin esto,
  // guardaba el nombre a medio escribir.
  const renameDone = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Lo último pintado: si nada cambia (el caso de cada movimiento del ratón al
  // dibujar), no se repintan las etiquetas de todas las páginas.
  const placedKey = useRef('');

  // La posición depende del scroll y del zoom, que cambian en CADA tick de
  // onChange (incluido el simple paneo). Recalcular es aritmética pura sobre
  // cuatro números por página, así que sale más barato que filtrar los ticks.
  useEffect(() => {
    const recompute = () => {
      const pages = listPages(api, L.pages);
      const { scrollX, scrollY, zoom } = api.getAppState();
      const z = zoom?.value ?? 1;
      const next = pages.map((page) => ({
        left: (page.x + scrollX) * z,
        top: (page.y + scrollY) * z - OFFSET_Y,
        width: page.width * z,
        page,
      }));
      const key = next.map((p) => `${p.page.id}:${p.page.name}:${p.page.locked ? 1 : 0}:${Math.round(p.left)}:${Math.round(p.top)}:${Math.round(p.width)}`).join('|');
      if (key === placedKey.current) return;
      placedKey.current = key;
      setPlaced(next);
    };
    recompute();
    return api.onChange(recompute);
    // `L.pages` cambia de identidad en cada render; los nombres de serie no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (!armedDelete) return;
    // Una vez al armar (no en cada render: la barra se repinta con cada paneo).
    confirmRef.current?.focus();
    const t = setTimeout(() => setArmedDelete(false), 2500);
    return () => clearTimeout(t);
  }, [armedDelete]);

  // Cambiar de página desarma el borrado: si no, el "¿Eliminar?" armado en una
  // se dispararía sobre otra.
  useEffect(() => setArmedDelete(false), [activePageId]);

  if (placed.length === 0) return null;
  const pageCount = placed.length;
  const active = placed.find((p) => p.page.id === activePageId) ?? null;

  const select = (id: string) => {
    onActiveChange?.(id);
    goToPage(api, id);
  };

  const commitRename = () => {
    if (!renaming || renameDone.current) return;
    renameDone.current = true;
    const name = renaming.value.trim();
    // Sin cambios no hay nada que deshacer ni que guardar.
    if (name && name !== renaming.original) renamePage(api, renaming.id, name);
    setRenaming(null);
  };
  const cancelRename = () => {
    renameDone.current = true;
    setRenaming(null);
  };

  const iconButton = (label: string, onClick: (() => void) | null, icon: ReactNode, danger = false) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={onClick ?? undefined}
      className="canvas2-page-action"
      style={{
        all: 'unset',
        cursor: onClick ? 'pointer' : 'not-allowed',
        display: 'inline-grid',
        placeItems: 'center',
        width: 26,
        height: 26,
        borderRadius: 7,
        color: danger ? c.danger : c.sub,
        opacity: onClick ? 1 : 0.35,
      }}
    >
      {icon}
    </button>
  );

  return (
    <>
      <div data-testid="canvas2-page-labels" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 90 }}>
        {placed.map(({ left, top, width, page }) => {
          const isActive = page.id === activePageId;
          const custom = !isDefaultPageName(page.name);
          const editing = renaming?.id === page.id;
          // Con poco zoom la hoja es estrecha: el rótulo no pasa de su ancho
          // (menos lo de las acciones, en la activa) y se corta con «…».
          const maxWidth = Math.max(28, width - (isActive ? ACTIONS_W : 0));
          return (
            <div
              key={page.id}
              data-testid="canvas2-page-label"
              data-active={isActive ? '' : undefined}
              title={editing || page.locked ? undefined : L.layers.renameHint}
              onClick={() => { if (!isActive) onActiveChange?.(page.id); }}
              onDoubleClick={() => { if (!page.locked) { renameDone.current = false; setRenaming({ id: page.id, value: page.name, original: page.name }); } }}
              style={{
                position: 'absolute',
                left,
                top,
                maxWidth,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                pointerEvents: 'auto',
                cursor: 'default',
                fontFamily: PANEL_FONT,
                color: isActive ? c.fg : c.sub,
                userSelect: 'none',
              }}
            >
              {/* «Página 3» ya dice su número: la ficha va solo con un nombre propio. */}
              {custom && <span
                style={{
                  flexShrink: 0,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  boxSizing: 'border-box',
                  display: 'inline-grid',
                  placeItems: 'center',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  // Sin ficha negra en la activa (pesaba demasiado sobre la
                  // mesa): la misma ficha clara, y el número en tinta.
                  background: c.border,
                  color: isActive ? c.fg : c.sub,
                }}
              >
                {page.index + 1}
              </span>}
              {editing ? (
                <input
                  autoFocus
                  aria-label={L.pages.rename}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ id: page.id, value: e.target.value, original: renaming?.original ?? page.name })}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  onBlur={commitRename}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    font: 'inherit',
                    fontSize: 12.5,
                    color: c.fg,
                    height: 22,
                    width: Math.max(120, maxWidth - 30),
                    padding: '0 6px',
                    border: 0,
                    borderRadius: 6,
                    outline: `1.5px solid ${c.active}`,
                    background: c.bg,
                  }}
                />
              ) : (
                <span
                  style={{
                    minWidth: 0,
                    fontSize: 12.5,
                    fontWeight: isActive ? 500 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {/* Un nombre de serie se lee en el idioma de ahora («Page 2»)
                      sin cambiar el guardado («Página 2»). */}
                  {custom ? withoutNumber(page.name) : displayPageName(page.name, L.pages)}
                </span>
              )}
              {page.locked && (
                // Adorno: en la activa lo dice el botón de desbloquear.
                <span aria-hidden="true" style={{ display: 'inline-flex', color: c.sub, flexShrink: 0 }}>
                  <LockIcon />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {active && (
        <div
          data-testid="canvas2-page-actions"
          style={{
            position: 'absolute',
            left: active.left + active.width,
            top: active.top - 1,
            // Anclada por su borde derecho al del marco, para que crecer o
            // encoger no la despegue de la esquina.
            transform: 'translateX(-100%)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: c.sub,
            fontFamily: PANEL_FONT,
          }}
        >
          {active.page.index > 0 &&
            iconButton(L.pages.moveLeft, () => movePage(api, active.page.id, -1), <ChevronLeftIcon />)}
          {active.page.index < pageCount - 1 &&
            iconButton(L.pages.moveRight, () => movePage(api, active.page.id, 1), <ChevronRightIcon />)}
          {iconButton(L.pages.duplicate, () => {
            const id = duplicatePage(api, active.page.id, L.pages);
            if (id) select(id);
          }, <DuplicateIcon />)}
          {iconButton(
            active.page.locked ? L.pages.unlock : L.pages.lock,
            () => setPageLocked(api, active.page.id, !active.page.locked),
            active.page.locked ? <LockIcon /> : <UnlockIcon />,
          )}
          {/* Con una sola página el botón se queda a la vista, apagado y
              diciendo por qué: desaparecer sin explicación confunde tanto como
              un botón que no hace nada. Bloqueada sí se oculta: ahí el candado
              ya explica el estado. */}
          {pageCount <= 1 && !active.page.locked &&
            iconButton(L.pages.lastPage, null, <TrashIcon />)}
          {pageCount > 1 && !active.page.locked && (
            armedDelete ? (
              // La papelera desaparece al armar: sin llevar el foco a la
              // confirmación, un lector de pantalla se quedaba sin nada
              // enfocado y no anunciaba «¿Eliminar?» ni que era un botón.
              <button
                type="button"
                aria-label={L.pages.confirmDelete}
                title={L.pages.delete}
                ref={confirmRef}
                onClick={() => {
                  setArmedDelete(false);
                  deletePage(api, active.page.id);
                  const fallback = listPages(api).find((p) => p.id !== active.page.id);
                  if (fallback) select(fallback.id);
                }}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 700,
                  color: c.dangerFg,
                  background: c.danger,
                }}
              >
                {L.pages.confirmDelete}
              </button>
            ) : (
              iconButton(L.pages.delete, () => setArmedDelete(true), <TrashIcon />, true)
            )
          )}
        </div>
      )}
    </>
  );
}
