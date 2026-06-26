'use client';

import { useEffect, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  type PageInfo,
  type PageSize,
  listPages,
  addPage,
  deletePage,
  duplicatePage,
  renamePage,
  goToPage,
} from './pages';
import { PANEL_FONT, palette } from './theme';

export interface PageNavigatorProps {
  api: ExcalidrawImperativeAPI;
  pageSize?: PageSize;
  theme?: 'light' | 'dark';
  /** Controlled active page id. When provided, the strip reflects it instead of
   *  its own local state (so it can stay in sync with the LayersPanel). */
  activeId?: string | null;
  /** Notified when the user switches pages. */
  onActiveChange?: (id: string) => void;
}

function pagesSignature(pages: PageInfo[]): string {
  return pages.map((p) => `${p.id}:${p.name}`).join('|');
}

/**
 * Bottom-center page strip — the canvas2 analogue of polimake-canvas's
 * `PageControl`. Reads pages (frames) live from the scene and lets the user
 * switch / add / rename / duplicate / delete artboards.
 */
export function PageNavigator({
  api,
  pageSize,
  theme = 'light',
  activeId: controlledActiveId,
  onActiveChange,
}: PageNavigatorProps) {
  const c = palette[theme];
  const [pages, setPages] = useState<PageInfo[]>(() => listPages(api));
  const [localActiveId, setLocalActiveId] = useState<string | null>(
    () => listPages(api)[0]?.id ?? null,
  );
  // Prefer the controlled value when the host drives active-page state.
  const activeId = controlledActiveId !== undefined ? controlledActiveId : localActiveId;

  // Keep the strip in sync with the scene. onChange fires frequently, so only
  // re-render when the page set (ids/names) actually changes.
  useEffect(() => {
    const refresh = () =>
      setPages((prev) => {
        const next = listPages(api);
        return pagesSignature(prev) === pagesSignature(next) ? prev : next;
      });
    refresh();
    const unsubscribe = api.onChange(refresh);
    return unsubscribe;
  }, [api]);

  const select = (id: string) => {
    setLocalActiveId(id);
    onActiveChange?.(id);
    goToPage(api, id);
  };

  const onAdd = () => {
    const id = addPage(api, pageSize);
    select(id);
  };

  const onDuplicate = (id: string) => {
    const newId = duplicatePage(api, id);
    if (newId) select(newId);
  };

  const onRename = (page: PageInfo) => {
    const name = window.prompt('Nombre de la página', page.name);
    if (name && name.trim()) renamePage(api, page.id, name.trim());
  };

  const onDelete = (page: PageInfo) => {
    if (pages.length <= 1) return;
    if (window.confirm(`¿Eliminar "${page.name}" y su contenido?`)) {
      deletePage(api, page.id);
      const fallback = pages.find((p) => p.id !== page.id);
      if (fallback) select(fallback.id);
    }
  };

  const iconBtn = (label: string, onClick: () => void, glyph: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        all: 'unset',
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: 1,
        padding: '2px 4px',
        borderRadius: 4,
        color: 'inherit',
        opacity: 0.85,
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        maxWidth: 'min(680px, 90%)',
        overflowX: 'auto',
        padding: 6,
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        fontFamily: PANEL_FONT,
      }}
    >
      {pages.map((page) => {
        const isActive = page.id === activeId;
        return (
          <div
            key={page.id}
            role="button"
            tabIndex={0}
            onClick={() => select(page.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(page.id);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              padding: '4px 8px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              background: isActive ? c.active : 'transparent',
              color: isActive ? c.activeFg : c.fg,
            }}
          >
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                onRename(page);
              }}
              style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {page.name}
            </span>
            {isActive && (
              <span style={{ display: 'inline-flex', marginLeft: 2 }}>
                {iconBtn('Duplicar página', () => onDuplicate(page.id), '⧉')}
                {iconBtn('Renombrar página', () => onRename(page), '✎')}
                {pages.length > 1 && iconBtn('Eliminar página', () => onDelete(page), '🗑')}
              </span>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        title="Agregar página"
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          color: c.sub,
          border: `1px dashed ${c.border}`,
        }}
      >
        + Página
      </button>
    </div>
  );
}

export default PageNavigator;
