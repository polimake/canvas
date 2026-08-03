'use client';

import { useState, type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import { LayersPanel } from './LayersPanel';
import { BrandGallery } from './BrandGallery';
import { PANEL_FONT, palette } from './theme';
import type { BrandKitInput } from './brand';
import { mergeLabels, type PartialLabels } from './labels';

/**
 * Panel de la esquina inferior derecha, con pestañas.
 *
 * Capas y Marca compartían esquina y se pisaban. En vez de apilarlos —que come
 * lienzo y deja uno siempre a medias— van en un solo panel con pestañas: se ve
 * uno cada vez y el sitio es predecible.
 *
 * Capas estaba antes dentro de la barra lateral de Excalidraw; se saca porque
 * esa barra desaparece con la Biblioteca propia.
 */

type Tab = 'capas' | 'marca';

export interface RightDockProps {
  api: ExcalidrawImperativeAPI | null;
  activePageId: string | null;
  theme?: 'light' | 'dark';
  viewMode?: boolean;
  /** `projects.brandKit` crudo. Sin marca, la pestaña no aparece. */
  brandKit?: BrandKitInput | null;
  /** Capas requiere el modelo de páginas: sin él no hay página activa que listar. */
  layers?: boolean;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

export function RightDock({
  api,
  activePageId,
  theme = 'light',
  viewMode = false,
  brandKit,
  layers = false,
  labels: labelsProp,
}: RightDockProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [tab, setTab] = useState<Tab>('capas');
  // Arranca PLEGADO: en una escena con muchas capas el panel se comía media
  // pantalla nada más abrir el diseño. Se despliega al pulsar una pestaña.
  const [abierto, setAbierto] = useState(false);

  // La galería decide sola si tiene algo que enseñar (colores o logos); aquí
  // solo hace falta saber si merece una pestaña.
  const hayMarca = Boolean(brandKit && !viewMode);
  const disponibles: Tab[] = [...(layers ? (['capas'] as Tab[]) : []), ...(hayMarca ? (['marca'] as Tab[]) : [])];

  if (!api || disponibles.length === 0) return null;
  const activa = disponibles.includes(tab) ? tab : disponibles[0];

  const tabStyle = (t: Tab): CSSProperties => ({
    all: 'unset',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    color: activa === t ? c.fg : c.sub,
    background: activa === t ? c.hover : 'transparent',
  });

  return (
    <div
      data-testid="canvas2-right-dock"
      data-canvas2-dock=""
      style={{
        position: 'absolute',
        right: 12,
        bottom: 16,
        zIndex: 95,
        width: abierto ? 248 : 'auto',
        maxHeight: '52%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        font: `12px ${PANEL_FONT}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 4,
          borderBottom: abierto ? `1px solid ${c.border}` : 'none',
          flexShrink: 0,
        }}
      >
        {disponibles.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setAbierto(true);
            }}
            style={tabStyle(t)}
          >
            {t === 'capas' ? L.dock.layers : L.dock.brand}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          title={abierto ? L.dock.collapse : L.dock.expand}
          style={{
            all: 'unset',
            cursor: 'pointer',
            marginLeft: 'auto',
            padding: '2px 6px',
            color: c.sub,
          }}
        >
          {abierto ? '▾' : '▸'}
        </button>
      </div>

      {abierto && (
        <div style={{ minHeight: 0, flex: 1, overflow: 'hidden', display: 'flex' }}>
          {activa === 'capas' ? (
            <LayersPanel
              api={api}
              activePageId={activePageId}
              theme={theme}
              viewMode={viewMode}
              embedded
            />
          ) : (
            <BrandGallery
              api={api}
              brandKit={brandKit}
              theme={theme}
              activePageId={activePageId}
              viewMode={viewMode}
              embedded
              labels={labelsProp}
            />
          )}
        </div>
      )}
    </div>
  );
}
