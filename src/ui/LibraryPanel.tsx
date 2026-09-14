'use client';

import { useState, type ReactNode } from 'react';
import { PANEL_FONT, palette } from './theme';
import { ImageIcon } from './icons';
import { mergeLabels, type PartialLabels } from './labels';

/**
 * Marco del panel de biblioteca, arriba a la derecha del lienzo.
 *
 * Es DELIBERADAMENTE un marco vacío: canvas2 pone la posición, la cabecera y el
 * plegado, y el host mete dentro su propia mediateca. El motivo es que la UI de
 * media ya existe —`@polimake/ui` publica la parte presentacional y
 * `features/media-library` la compone con la capa de datos de studio— y este
 * paquete no puede importar de `apps/web` ni conocer proyectos, carpetas ni
 * autenticación. Mismo seam que `MediaFetcher`, `MediaUploader` y
 * `hydrateFiles`: canvas2 pide, el host resuelve.
 *
 * Sustituye a la Biblioteca de fábrica de Excalidraw (sus ficheros
 * `.excalidrawlib` no tienen nada que ver con la mediateca del proyecto), cuyo
 * disparador se oculta desde canvas2.css.
 */

export interface LibraryPanelProps {
  /** Contenido: la mediateca del host. Sin él, el panel no se dibuja. */
  children?: ReactNode;
  title?: string;
  theme?: 'light' | 'dark';
  /** En modo lectura no se muestra: solo sirve para insertar. */
  viewMode?: boolean;
  /**
   * Arranca plegada, como un botón. Por defecto SÍ: abierta ocupa casi toda la
   * altura del lado derecho, y tapar el diseño nada más entrar es peor que un
   * clic de más.
   */
  defaultCollapsed?: boolean;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
  /**
   * Anclaje vertical del panel/botón. Por defecto va en la FILA superior, el
   * hueco que ocupaba el disparador de la Biblioteca de Excalidraw (que se
   * oculta desde canvas2.css): es un botón de 36px y ahí no estorba a la barra
   * de herramientas. El dock de Diseño/Capas/Componentes vive bajo esa fila, a
   * 76, así que las dos piezas del lado derecho no se pisan.
   */
  anchorTop?: number;
  /** Icono del botón plegado; por defecto, el de la mediateca. */
  icon?: ReactNode;
  testId?: string;
}

export function LibraryPanel({
  children,
  title,
  theme = 'light',
  viewMode = false,
  defaultCollapsed = true,
  labels: labelsProp,
  anchorTop = 12,
  icon,
  testId = 'canvas2-library',
}: LibraryPanelProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [abierto, setAbierto] = useState(!defaultCollapsed);
  const rotulo = title ?? L.library.title;

  if (viewMode || !children) return null;

  // Cerrada, la biblioteca es solo un botón cuadrado con el mismo tamaño y
  // tratamiento que los de la cromo de Excalidraw (la hamburguesa, el zoom):
  // ocupa lo mínimo y se reconoce como control del editor, no como panel.
  if (!abierto) {
    return (
      <button
        type="button"
        data-testid={`${testId}-trigger`}
        onClick={() => setAbierto(true)}
        title={rotulo}
        aria-label={rotulo}
        style={{
          all: 'unset',
          position: 'absolute',
          top: anchorTop,
          right: 12,
          zIndex: 95,
          boxSizing: 'border-box',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          borderRadius: 10,
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
        }}
      >
        {icon ?? <ImageIcon />}
      </button>
    );
  }

  return (
    <div
      data-testid={testId}
      data-canvas2-library=""
      style={{
        position: 'absolute',
        top: anchorTop,
        right: 12,
        zIndex: 95,
        width: 320,
        // Baja hasta justo encima de la tira de páginas: la biblioteca es una
        // rejilla y cuanto más alta, más se ve sin desplazar. Abierta TAPA el
        // dock de Diseño/Capas/Componentes, que queda debajo — es un cajón que
        // se abre sobre el resto, y se cierra con su ✕.
        bottom: 96,
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
          gap: 6,
          padding: '6px 10px',
          color: c.sub,
          fontWeight: 600,
          borderBottom: `1px solid ${c.border}`,
          flexShrink: 0,
        }}
      >
        {rotulo}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          title={L.library.close}
          aria-label={L.library.close}
          style={{
            all: 'unset',
            cursor: 'pointer',
            marginLeft: 'auto',
            padding: '0 4px',
            lineHeight: 1,
            color: c.sub,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}
