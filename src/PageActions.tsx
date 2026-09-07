'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import {
  listPages,
  movePage,
  duplicatePage,
  deletePage,
  setPageLocked,
  goToPage,
  addPage,
  type PageInfo,
  type PageSize,
} from './pages';
import { PANEL_FONT, palette } from './theme';
import { mergeLabels, type PartialLabels } from './labels';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DuplicateIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
  UnlockIcon,
} from './icons';

/**
 * Acciones de la página activa, flotando sobre el lienzo junto a su nombre.
 *
 * Estaban en la tira de abajo, que es el sitio equivocado por dos motivos: te
 * obliga a mirar al otro extremo de la pantalla para operar sobre lo que tienes
 * delante, y el nombre de la página —que es lo que identifica sobre qué estás
 * actuando— se dibuja aquí arriba, no allí.
 *
 * El renombrado NO está en esta barra: Excalidraw ya deja editar el nombre del
 * marco haciendo doble clic sobre él, justo al lado. Duplicarlo en un botón
 * sería un segundo camino para lo mismo, con su propio estado que mantener.
 */

/** Alto reservado sobre el marco para que la barra no tape su contenido. */
const OFFSET_Y = 26;

export interface PageActionsProps {
  api: ExcalidrawImperativeAPI;
  activePageId?: string | null;
  theme?: 'light' | 'dark';
  /** Tamaño para las páginas nuevas cuando no hay una activa de la que heredar. */
  pageSize?: PageSize;
  onActiveChange?: (id: string) => void;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

interface Anchor {
  left: number;
  top: number;
  page: PageInfo;
}

export function PageActions({
  api,
  activePageId,
  theme = 'light',
  pageSize,
  onActiveChange,
  labels: labelsProp,
}: PageActionsProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [armedDelete, setArmedDelete] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  // La posición depende del scroll y del zoom, que cambian en CADA tick de
  // onChange (incluido el simple paneo). Recalcular es aritmética pura sobre
  // cuatro números, así que sale más barato que intentar filtrar los ticks.
  useEffect(() => {
    const recompute = () => {
      const pages = listPages(api);
      setPageCount(pages.length);
      const page = pages.find((p) => p.id === activePageId) ?? null;
      if (!page) {
        setAnchor(null);
        return;
      }
      const { scrollX, scrollY, zoom } = api.getAppState();
      const z = zoom?.value ?? 1;
      setAnchor({
        // Esquina superior DERECHA del marco: el nombre de la página lo dibuja
        // Excalidraw en la izquierda, así que ahí la barra lo taparía.
        left: (page.x + page.width + scrollX) * z,
        top: (page.y + scrollY) * z - OFFSET_Y,
        page,
      });
    };
    recompute();
    return api.onChange(recompute);
  }, [api, activePageId]);

  useEffect(() => {
    if (!armedDelete) return;
    const t = setTimeout(() => setArmedDelete(false), 2500);
    return () => clearTimeout(t);
  }, [armedDelete]);

  // Cambiar de página desarma el borrado: si no, el "¿Eliminar?" armado en una
  // se dispararía sobre otra.
  useEffect(() => setArmedDelete(false), [activePageId]);

  if (!anchor) return null;
  const { page } = anchor;

  const select = (id: string) => {
    onActiveChange?.(id);
    goToPage(api, id);
  };

  /** Igual que `btn` pero apagado: se ve, se explica al pasar el ratón, no actúa. */
  const btnDisabled = (label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled
      style={{
        all: 'unset',
        cursor: 'not-allowed',
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        padding: '2px 3px',
        borderRadius: 4,
        color: c.sub,
        opacity: 0.35,
      }}
    >
      {icon}
    </button>
  );

  const btn = (label: string, onClick: () => void, icon: ReactNode, danger = false) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        padding: '2px 3px',
        borderRadius: 4,
        color: danger ? 'var(--color-destructive)' : c.sub,
      }}
    >
      {icon}
    </button>
  );

  return (
    <div
      data-testid="canvas2-page-actions"
      style={{
        position: 'absolute',
        left: anchor.left,
        top: anchor.top,
        // Anclada por su borde derecho al del marco, para que crecer o encoger
        // no la despegue de la esquina.
        transform: 'translateX(-100%)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: 1,
        borderRadius: 6,
        // Discreta a propósito: acompaña al nombre de la página, no compite con
        // él. Sin sombra y con el mismo gris del rótulo del marco.
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.sub,
        fontFamily: PANEL_FONT,
        opacity: 0.9,
      }}
    >
      {page.index > 0 &&
        btn(L.pages.moveLeft, () => movePage(api, page.id, -1), <ChevronLeftIcon />)}
      {page.index < pageCount - 1 &&
        btn(L.pages.moveRight, () => movePage(api, page.id, 1), <ChevronRightIcon />)}
      {btn(L.pages.duplicate, () => {
        const id = duplicatePage(api, page.id);
        if (id) select(id);
      }, <DuplicateIcon />)}
      {btn(
        page.locked ? L.pages.unlock : L.pages.lock,
        () => setPageLocked(api, page.id, !page.locked),
        page.locked ? <LockIcon /> : <UnlockIcon />,
      )}
      {btn(L.pages.add, () => {
        const size: PageSize | undefined = { width: page.width, height: page.height };
        const id = addPage(api, size ?? pageSize, { afterPageId: page.id });
        select(id);
      }, <PlusIcon />)}
      {/* Con una sola página el botón se ESCONDÍA. Desaparecer sin explicación
          confunde tanto como un botón que no hace nada, así que se queda a la
          vista, apagado y diciendo por qué. Bloqueada sí se oculta: ahí el
          candado ya explica el estado. */}
      {pageCount <= 1 && !page.locked &&
        btnDisabled(L.pages.lastPage, <TrashIcon />)}
      {pageCount > 1 && !page.locked && (
        armedDelete ? (
          <button
            type="button"
            onClick={() => {
              setArmedDelete(false);
              deletePage(api, page.id);
              const fallback = listPages(api).find((p) => p.id !== page.id);
              if (fallback) select(fallback.id);
            }}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-state-ink)',
              background: 'var(--color-destructive)',
            }}
          >
            {L.pages.confirmDelete}
          </button>
        ) : (
          btn(L.pages.delete, () => setArmedDelete(true), <TrashIcon />, true)
        )
      )}
    </div>
  );
}
