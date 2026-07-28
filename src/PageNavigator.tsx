'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import {
  type PageInfo,
  type PageSize,
  PAGE_SIZE_PRESETS,
  listPages,
  addPage,
  deletePage,
  duplicatePage,
  renamePage,
  resizePage,
  movePage,
  setPageLocked,
  goToPage,
} from './pages';
import { exportScenePng, exportSceneSvg, exportScenePdf, downloadBlob } from './export';
import { TEXT_PRESETS, insertTextPreset } from './text';
import { getPageBackground, setPageBackgroundColor } from './background';
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
  return pages
    .map((p) => `${p.id}:${p.name}:${p.width}x${p.height}:${p.locked ? 1 : 0}`)
    .join('|');
}

function safeFilename(name: string): string {
  return (name || 'diseño').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

/** Upward popup anchored to the strip; closes via the transparent backdrop. */
function PopupMenu({
  onClose,
  children,
  bg,
  border,
}: {
  onClose: () => void;
  children: ReactNode;
  bg: string;
  border: string;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 110 }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          right: 0,
          zIndex: 120,
          minWidth: 220,
          maxHeight: 320,
          overflowY: 'auto',
          padding: 6,
          borderRadius: 10,
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        }}
      >
        {children}
      </div>
    </>
  );
}

function menuRowStyle(active: boolean, activeBg: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    background: active ? activeBg : 'transparent',
    textAlign: 'left',
  };
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
  const activePage = pages.find((p) => p.id === activeId) ?? null;
  const [openMenu, setOpenMenu] = useState<'size' | 'export' | 'text' | 'bg' | null>(null);
  const [scaleContent, setScaleContent] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Curated swatches for the page-background menu; the color input covers the rest.
  const BG_SWATCHES = ['#ffffff', '#f8f9fa', '#fff9db', '#ffe3e3', '#d3f9d8', '#d0ebff', '#1e1e1e'];

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
    // New pages inherit the active page's size (falling back to the host prop),
    // so a story-sized document keeps producing story-sized pages.
    const size: PageSize | undefined = activePage
      ? { width: activePage.width, height: activePage.height }
      : pageSize;
    const id = addPage(api, size);
    select(id);
  };

  const onResize = (size: PageSize) => {
    if (!activeId) return;
    resizePage(api, activeId, size, { scaleContent });
    setOpenMenu(null);
    goToPage(api, activeId);
  };

  const onResizeCustom = () => {
    const current = activePage ? `${activePage.width}x${activePage.height}` : '1080x1350';
    const raw = window.prompt('Tamaño personalizado (ancho x alto)', current);
    if (!raw) return;
    const match = /^\s*(\d{2,5})\s*[x×,]\s*(\d{2,5})\s*$/i.exec(raw);
    if (!match) return;
    onResize({ width: Number(match[1]), height: Number(match[2]) });
  };

  const runExport = async (kind: 'png' | 'png-all' | 'svg' | 'pdf') => {
    if (exporting) return;
    setOpenMenu(null);
    setExporting(true);
    try {
      const base = safeFilename(activePage?.name ?? 'diseño');
      if (kind === 'png') {
        downloadBlob(await exportScenePng(api, { pageId: activeId ?? undefined }), `${base}.png`);
      } else if (kind === 'png-all') {
        for (const page of pages) {
          downloadBlob(
            await exportScenePng(api, { pageId: page.id }),
            `${safeFilename(page.name)}.png`,
          );
        }
      } else if (kind === 'svg') {
        const svg = await exportSceneSvg(api, { pageId: activeId ?? undefined });
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
          type: 'image/svg+xml',
        });
        downloadBlob(blob, `${base}.svg`);
      } else {
        downloadBlob(await exportScenePdf(api), 'diseño.pdf');
      }
    } catch (err) {
      console.error('[canvas2] export failed', err);
    } finally {
      setExporting(false);
    }
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
        maxWidth: 'min(760px, 92%)',
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
                {page.index > 0 &&
                  iconBtn('Mover a la izquierda', () => movePage(api, page.id, -1), '◀')}
                {page.index < pages.length - 1 &&
                  iconBtn('Mover a la derecha', () => movePage(api, page.id, 1), '▶')}
                {iconBtn('Duplicar página', () => onDuplicate(page.id), '⧉')}
                {iconBtn('Renombrar página', () => onRename(page), '✎')}
                {iconBtn(
                  page.locked ? 'Desbloquear página' : 'Bloquear página',
                  () => setPageLocked(api, page.id, !page.locked),
                  page.locked ? '🔒' : '🔓',
                )}
                {pages.length > 1 &&
                  !page.locked &&
                  iconBtn('Eliminar página', () => onDelete(page), '🗑')}
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
          whiteSpace: 'nowrap',
        }}
      >
        + Página
      </button>
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', background: c.border, margin: '0 2px' }} />

      {/* Insert / size / export controls for the ACTIVE page. Rendered outside
          the scrollable strip so their upward popups are never clipped. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          title="Insertar texto"
          onClick={() => setOpenMenu(openMenu === 'text' ? null : 'text')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: c.sub,
            whiteSpace: 'nowrap',
          }}
        >
          ＋T ▾
        </button>
        <button
          type="button"
          title="Fondo de la página"
          onClick={() => setOpenMenu(openMenu === 'bg' ? null : 'bg')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: c.sub,
            whiteSpace: 'nowrap',
          }}
        >
          Fondo ▾
        </button>
        <button
          type="button"
          title="Tamaño de la página"
          onClick={() => setOpenMenu(openMenu === 'size' ? null : 'size')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: c.sub,
            whiteSpace: 'nowrap',
          }}
        >
          {activePage ? `${activePage.width}×${activePage.height}` : 'Tamaño'} ▾
        </button>
        <button
          type="button"
          title="Exportar"
          onClick={() => setOpenMenu(openMenu === 'export' ? null : 'export')}
          disabled={exporting}
          style={{
            all: 'unset',
            cursor: exporting ? 'wait' : 'pointer',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: c.sub,
            whiteSpace: 'nowrap',
            opacity: exporting ? 0.5 : 1,
          }}
        >
          {exporting ? 'Exportando…' : 'Exportar ▾'}
        </button>

        {openMenu === 'text' && (
          <PopupMenu onClose={() => setOpenMenu(null)} bg={c.bg} border={c.border}>
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  insertTextPreset(api, preset.key, { pageId: activeId ?? undefined });
                  setOpenMenu(null);
                }}
                style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
              >
                <span
                  style={{
                    color: c.fg,
                    fontSize: preset.key === 'heading' ? 15 : preset.key === 'subheading' ? 13 : 12,
                    fontWeight: preset.key === 'body' ? 400 : 700,
                  }}
                >
                  {preset.label}
                </span>
                <span style={{ color: c.sub }}>{preset.fontSize}px</span>
              </button>
            ))}
          </PopupMenu>
        )}

        {openMenu === 'bg' && (
          <PopupMenu onClose={() => setOpenMenu(null)} bg={c.bg} border={c.border}>
            <div style={{ display: 'flex', gap: 6, padding: '6px 10px', flexWrap: 'wrap' }}>
              {BG_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onClick={() => {
                    if (activeId) setPageBackgroundColor(api, activeId, color);
                    setOpenMenu(null);
                  }}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: color,
                    border: `1px solid ${c.border}`,
                  }}
                />
              ))}
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                fontSize: 12,
                color: c.fg,
                cursor: 'pointer',
              }}
            >
              Otro color…
              <input
                type="color"
                value={(activeId && getPageBackground(api, activeId)) || '#ffffff'}
                onChange={(e) => {
                  if (activeId) setPageBackgroundColor(api, activeId, e.target.value);
                }}
                style={{ marginLeft: 'auto', width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer' }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (activeId) setPageBackgroundColor(api, activeId, null);
                setOpenMenu(null);
              }}
              style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
            >
              <span style={{ color: c.sub }}>Quitar fondo</span>
            </button>
          </PopupMenu>
        )}

        {openMenu === 'size' && (
          <PopupMenu onClose={() => setOpenMenu(null)} bg={c.bg} border={c.border}>
            {PAGE_SIZE_PRESETS.map((preset) => {
              const isCurrent =
                activePage?.width === preset.width && activePage?.height === preset.height;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onResize(preset)}
                  style={{ all: 'unset', ...menuRowStyle(isCurrent, c.active) }}
                >
                  <span style={{ color: isCurrent ? c.activeFg : c.fg }}>{preset.label}</span>
                  <span style={{ color: c.sub }}>{preset.width}×{preset.height}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onResizeCustom}
              style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
            >
              <span style={{ color: c.fg }}>Personalizado…</span>
            </button>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px 4px',
                fontSize: 12,
                color: c.sub,
                cursor: 'pointer',
                borderTop: `1px solid ${c.border}`,
                marginTop: 4,
              }}
            >
              <input
                type="checkbox"
                checked={scaleContent}
                onChange={(e) => setScaleContent(e.target.checked)}
              />
              Escalar el contenido
            </label>
          </PopupMenu>
        )}

        {openMenu === 'export' && (
          <PopupMenu onClose={() => setOpenMenu(null)} bg={c.bg} border={c.border}>
            <button
              type="button"
              onClick={() => void runExport('png')}
              style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
            >
              <span style={{ color: c.fg }}>PNG · página actual</span>
            </button>
            <button
              type="button"
              onClick={() => void runExport('png-all')}
              style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
            >
              <span style={{ color: c.fg }}>PNG · todas las páginas</span>
            </button>
            <button
              type="button"
              onClick={() => void runExport('svg')}
              style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
            >
              <span style={{ color: c.fg }}>SVG · página actual</span>
            </button>
            <button
              type="button"
              onClick={() => void runExport('pdf')}
              style={{ all: 'unset', ...menuRowStyle(false, c.active) }}
            >
              <span style={{ color: c.fg }}>PDF · todas las páginas</span>
            </button>
          </PopupMenu>
        )}
      </div>
    </div>
  );
}

export default PageNavigator;
