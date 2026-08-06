'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import { BrandGallery } from './BrandGallery';
import { PAGE_SIZE_PRESETS, listPages, resizePage, goToPage, type PageInfo, type PageSize } from './pages';
import { getPageBackground, setPageBackgroundColor } from './background';
import type { BrandKitInput } from './brand';
import { PANEL_FONT, palette } from './theme';
import { mergeLabels, type PartialLabels } from './labels';

/**
 * Pestaña «Diseño» del dock: la marca del cliente y los ajustes de la PÁGINA
 * activa (tamaño y fondo).
 *
 * Tamaño y fondo vivían en el menú hamburguesa, junto a exportar y a los ajustes
 * de Excalidraw. Ahí eran ajustes de documento escondidos detrás de un icono sin
 * nombre: para cambiar de 4:5 a story había que acordarse de que estaban dentro.
 * Aquí están donde ya se mira para tocar la marca, y con el mismo alcance que el
 * resto del dock — la página activa.
 */

/** Ancho de página admitido, en píxeles. */
const SIZE_MIN = 100;
const SIZE_MAX = 8000;

/** Colores de fondo a un clic; el selector cubre el resto. */
const BG_SWATCHES = ['#ffffff', '#f8f9fa', '#fff9db', '#ffe3e3', '#d3f9d8', '#d0ebff', '#1e1e1e'];

export interface DesignPanelProps {
  api: ExcalidrawImperativeAPI;
  activePageId: string | null;
  theme?: 'light' | 'dark';
  viewMode?: boolean;
  /** `projects.brandKit` crudo; lo traduce `BrandGallery`. */
  brandKit?: BrandKitInput | null;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

export function DesignPanel({
  api,
  activePageId,
  theme = 'light',
  viewMode = false,
  brandKit,
  labels: labelsProp,
}: DesignPanelProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [pages, setPages] = useState<PageInfo[]>(() => listPages(api));
  const [scaleContent, setScaleContent] = useState(true);
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  // La escena cambia por debajo (deshacer, otra pestaña, redimensionar desde el
  // lienzo), así que suscribirse sale más barato que recalcular en cada render.
  useEffect(() => {
    const refresh = () => setPages(listPages(api));
    refresh();
    return api.onChange(refresh);
  }, [api]);

  // Los campos arrancan con las medidas de la página activa, para que ajustar
  // 20px no obligue a teclear las dos cifras.
  useEffect(() => {
    if (!activePage) return;
    setCustomW(String(activePage.width));
    setCustomH(String(activePage.height));
  }, [activePage?.id, activePage?.width, activePage?.height]);

  const applyResize = (size: PageSize) => {
    if (!activePageId) return;
    resizePage(api, activePageId, size, { scaleContent });
    goToPage(api, activePageId);
  };

  const customSize = (() => {
    const w = Number.parseInt(customW, 10);
    const h = Number.parseInt(customH, 10);
    const ok =
      Number.isInteger(w) && Number.isInteger(h) &&
      w >= SIZE_MIN && w <= SIZE_MAX && h >= SIZE_MIN && h <= SIZE_MAX;
    return ok ? { width: w, height: h } : null;
  })();

  const rotulo: CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: c.sub,
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    minWidth: 0,
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
      data-testid="canvas2-design-panel"
      style={{
        width: '100%',
        overflowY: 'auto',
        padding: '8px 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        font: `12px ${PANEL_FONT}`,
        color: c.fg,
      }}
    >
      {/* Marca. Se dibuja sola si el proyecto no trae ni colores ni logos. */}
      <BrandGallery
        api={api}
        brandKit={brandKit}
        theme={theme}
        activePageId={activePageId}
        viewMode={viewMode}
        embedded
        labels={labelsProp}
      />

      {!viewMode && activePage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={rotulo}>{L.dock.page}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PAGE_SIZE_PRESETS.map((preset) => {
              const puesto =
                activePage.width === preset.width && activePage.height === preset.height;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyResize(preset)}
                  title={`${preset.width}×${preset.height}`}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: puesto ? c.activeFg : c.sub,
                    background: puesto ? c.active : 'transparent',
                    border: `1px solid ${puesto ? c.active : c.border}`,
                  }}
                >
                  {L.sizes[preset.key] ?? preset.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && customSize && applyResize(customSize)}
              inputMode="numeric"
              aria-label={L.menu.width}
              placeholder={L.menu.width}
              style={inputStyle}
            />
            <span style={{ color: c.sub, fontSize: 12 }}>×</span>
            <input
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && customSize && applyResize(customSize)}
              inputMode="numeric"
              aria-label={L.menu.height}
              placeholder={L.menu.height}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => customSize && applyResize(customSize)}
              disabled={!customSize}
              style={{
                all: 'unset',
                flexShrink: 0,
                cursor: customSize ? 'pointer' : 'default',
                padding: '4px 9px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: customSize ? c.activeFg : c.sub,
                background: customSize ? c.active : 'transparent',
                border: `1px solid ${c.border}`,
                opacity: customSize ? 1 : 0.6,
              }}
            >
              {L.menu.apply}
            </button>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: c.sub,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={scaleContent}
              onChange={(e) => setScaleContent(e.target.checked)}
            />
            {L.menu.scaleContent}
          </label>

          <div style={{ ...rotulo, marginTop: 3 }}>{L.menu.background}</div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {BG_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`${L.menu.background} ${color}`}
                onClick={() => setPageBackgroundColor(api, activePage.id, color)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: color,
                  border: `1px solid ${c.border}`,
                }}
              />
            ))}
            <input
              type="color"
              aria-label={L.menu.backgroundOther}
              title={L.menu.backgroundOther}
              value={getPageBackground(api, activePage.id) || '#ffffff'}
              onChange={(e) =>
                // Vista previa mientras se arrastra el selector; se pliega en el
                // commit final deshacible (capture 'transient').
                setPageBackgroundColor(api, activePage.id, e.target.value, {
                  capture: 'transient',
                })
              }
              onBlur={(e) => setPageBackgroundColor(api, activePage.id, e.target.value)}
              style={{
                width: 24,
                height: 20,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            <button
              type="button"
              onClick={() => setPageBackgroundColor(api, activePage.id, null)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                marginLeft: 'auto',
                padding: '3px 7px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                color: c.sub,
                border: `1px solid ${c.border}`,
              }}
            >
              {L.menu.backgroundRemove}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
