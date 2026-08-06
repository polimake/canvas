'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import { LayersPanel } from './LayersPanel';
import { DesignPanel } from './DesignPanel';
import { PANEL_FONT, palette } from './theme';
import type { BrandKitInput } from './brand';
import { mergeLabels, type PartialLabels } from './labels';

/**
 * Pastilla flotante del lado derecho, arriba, con pestañas.
 *
 * Reúne todo lo que modifica lo que estás mirando: Diseño (marca + tamaño y
 * fondo de la página), Capas y Componentes. Son pestañas y no secciones
 * apiladas: se ve una cada vez y el sitio es predecible.
 *
 * Flota, no se ancla. Anclarla al borde encogería la superficie de Excalidraw y
 * obligaría a recentrar la tira de páginas cada vez que se abre; flotando, el
 * lienzo no se entera y la pastilla en reposo es solo su fila de pestañas.
 *
 * Estaba abajo a la derecha con Capas y Marca. Se sube por dos motivos: esa
 * esquina queda reservada, y con la tira de páginas justo al lado el panel
 * competía con ella por la misma franja.
 */

type Tab = 'diseno' | 'capas' | 'componentes';

export interface RightDockProps {
  api: ExcalidrawImperativeAPI | null;
  activePageId: string | null;
  theme?: 'light' | 'dark';
  viewMode?: boolean;
  /** `projects.brandKit` crudo, para la pestaña Diseño. */
  brandKit?: BrandKitInput | null;
  /** Capas requiere el modelo de páginas: sin él no hay página activa que listar. */
  layers?: boolean;
  /** Diseño requiere el modelo de páginas: tamaño y fondo son de UNA página. */
  design?: boolean;
  /** Rejilla de componentes del proyecto; la aporta el host. Sin ella, no hay pestaña. */
  componentsPanel?: ReactNode;
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
  design = false,
  componentsPanel,
  labels: labelsProp,
}: RightDockProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [tab, setTab] = useState<Tab>('diseno');
  // Arranca PLEGADO, como pediste: en reposo es solo la fila de pestañas. Con
  // una escena de muchas capas, abierto se comía media pantalla nada más entrar.
  const [abierto, setAbierto] = useState(false);

  const hayDiseno = design && !viewMode;
  const hayComponentes = Boolean(componentsPanel) && !viewMode;
  const disponibles: Tab[] = [
    ...(hayDiseno ? (['diseno'] as Tab[]) : []),
    ...(layers ? (['capas'] as Tab[]) : []),
    ...(hayComponentes ? (['componentes'] as Tab[]) : []),
  ];

  if (!api || disponibles.length === 0) return null;
  const activa = disponibles.includes(tab) ? tab : disponibles[0];

  const rotulo: Record<Tab, string> = {
    diseno: L.dock.design,
    capas: L.dock.layers,
    componentes: L.dock.components,
  };

  const tabStyle = (t: Tab): CSSProperties => ({
    all: 'unset',
    cursor: 'pointer',
    padding: '4px 9px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: abierto && activa === t ? c.fg : c.sub,
    background: abierto && activa === t ? c.hover : 'transparent',
  });

  return (
    <div
      data-testid="canvas2-right-dock"
      data-canvas2-dock=""
      style={{
        position: 'absolute',
        right: 12,
        // POR DEBAJO de la fila de herramientas, no a su altura. Medido en el
        // navegador: `.App-menu_top` ocupa de y=18 a y=67, y la barra de
        // herramientas va centrada y mide ~610px, así que abierta (248px) esta
        // pastilla se metía debajo de su extremo derecho. 76 deja la fila
        // entera para Excalidraw y ~9px de aire.
        top: 76,
        zIndex: 95,
        width: abierto ? 248 : 'auto',
        // Hasta justo encima de la tira de páginas, que vive abajo y centrada.
        maxHeight: 'calc(100% - 192px)',
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
          gap: 2,
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
              // Pulsar la pestaña que ya está abierta la cierra: mismo gesto
              // para ir y para volver, sin tener que apuntar a la flecha.
              if (abierto && activa === t) {
                setAbierto(false);
                return;
              }
              setTab(t);
              setAbierto(true);
            }}
            style={tabStyle(t)}
          >
            {rotulo[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          title={abierto ? L.dock.collapse : L.dock.expand}
          aria-label={abierto ? L.dock.collapse : L.dock.expand}
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
          ) : activa === 'componentes' ? (
            <div style={{ width: '100%', minHeight: 0, overflowY: 'auto' }}>{componentsPanel}</div>
          ) : (
            <DesignPanel
              api={api}
              activePageId={activePageId}
              theme={theme}
              viewMode={viewMode}
              brandKit={brandKit}
              labels={labelsProp}
            />
          )}
        </div>
      )}
    </div>
  );
}
