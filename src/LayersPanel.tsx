'use client';

import { useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { PANEL_FONT, palette } from './theme';
import { reorderPageMembers } from './zorder';
import { setAsBackground, extendToPage } from './imageOps';
import { renamePage } from './pages';

type SceneElement = ReturnType<ExcalidrawImperativeAPI['getSceneElements']>[number];
type SceneElements = Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['elements'];

export interface LayersPanelProps {
  api: ExcalidrawImperativeAPI;
  activePageId: string | null;
  theme?: 'light' | 'dark';
}

const TYPE_GLYPH: Record<string, string> = {
  image: '🖼',
  text: 'T',
  rectangle: '▭',
  ellipse: '◯',
  diamond: '◇',
  line: '╱',
  arrow: '➔',
  freedraw: '✎',
  frame: '▢',
};

const TYPE_NAME: Record<string, string> = {
  image: 'Imagen',
  rectangle: 'Rectángulo',
  ellipse: 'Elipse',
  diamond: 'Rombo',
  line: 'Línea',
  arrow: 'Flecha',
  freedraw: 'Trazo',
};

function glyph(type: string): string {
  return TYPE_GLYPH[type] ?? '◻';
}

function displayName(el: SceneElement): string {
  if (el.type === 'text') {
    const t = (el.text ?? '').replace(/\s+/g, ' ').trim();
    return t ? `Texto: ${t.slice(0, 20)}` : 'Texto';
  }
  return TYPE_NAME[el.type] ?? el.type;
}

/** Stable string of everything the panel renders from, to gate re-renders. */
function sceneSignature(api: ExcalidrawImperativeAPI, pageId: string | null): string {
  if (!pageId) return '';
  const els = api.getSceneElements();
  const members = els.filter((e) => e.frameId === pageId);
  const sel = api.getAppState().selectedElementIds;
  const selKeys = Object.keys(sel)
    .filter((k) => sel[k])
    .join(',');
  const frame = els.find((e) => e.id === pageId);
  const frameName = frame && frame.type === 'frame' ? frame.name ?? '' : '';
  return (
    members.map((e) => `${e.id}:${e.locked ? 1 : 0}:${e.opacity}`).join('|') +
    '#' +
    selKeys +
    '#' +
    frameName
  );
}

/**
 * Right-docked layers panel — the canvas2 analogue of polimake-canvas's Capas
 * tab. Lists the active page's elements (top of stack first) with reorder /
 * visibility / lock / delete, plus image "Fondo"/"Extender" actions. Excalidraw
 * has no per-element hidden flag, so visibility is emulated with `opacity: 0`.
 */
export function LayersPanel({ api, activePageId, theme = 'light' }: LayersPanelProps) {
  const c = palette[theme];
  const [, setTick] = useState(0);
  const sigRef = useRef('');
  const dragId = useRef<string | null>(null);
  const priorOpacity = useRef(new Map<string, number>());

  useEffect(() => {
    const refresh = () => {
      const next = sceneSignature(api, activePageId);
      if (next !== sigRef.current) {
        sigRef.current = next;
        setTick((t) => t + 1);
      }
    };
    refresh();
    return api.onChange(refresh);
  }, [api, activePageId]);

  if (!activePageId) return null;

  const els = api.getSceneElements();
  const frame = els.find((e) => e.id === activePageId);
  const members = els.filter((e) => e.frameId === activePageId);
  // Array order is ascending z (bottom→top); reverse for top-first display.
  const rows = [...members].reverse();
  const selected = api.getAppState().selectedElementIds;

  const patch = (id: string, changes: Record<string, unknown>) => {
    const next = api.getSceneElements().map((e) => (e.id === id ? { ...e, ...changes } : e));
    api.updateScene({
      elements: next as SceneElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const remove = (id: string) => {
    const next = api
      .getSceneElements()
      .filter((e) => e.id !== id && (e as { containerId?: string }).containerId !== id);
    api.updateScene({
      elements: next as SceneElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const selectOnCanvas = (id: string) => {
    api.updateScene({
      appState: { selectedElementIds: { [id]: true } },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };

  const toggleVisibility = (el: SceneElement) => {
    if (el.opacity === 0) {
      patch(el.id, { opacity: priorOpacity.current.get(el.id) ?? 100 });
    } else {
      priorOpacity.current.set(el.id, el.opacity);
      patch(el.id, { opacity: 0 });
    }
  };

  const handleDrop = (targetId: string) => {
    const fromId = dragId.current;
    dragId.current = null;
    if (!fromId || fromId === targetId) return;
    const topFirst = rows.map((r) => r.id);
    const from = topFirst.indexOf(fromId);
    const to = topFirst.indexOf(targetId);
    if (from < 0 || to < 0) return;
    topFirst.splice(to, 0, topFirst.splice(from, 1)[0]);
    const bottomFirst = [...topFirst].reverse();
    api.updateScene({
      elements: reorderPageMembers(api, activePageId, bottomFirst),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const iconBtn = (label: string, onClick: () => void, node: string, danger = false) => (
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
        fontSize: 13,
        lineHeight: 1,
        padding: '3px 4px',
        borderRadius: 4,
        color: danger ? '#e03131' : 'inherit',
        opacity: 0.8,
      }}
    >
      {node}
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        right: 12,
        bottom: 76,
        zIndex: 4,
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        fontFamily: PANEL_FONT,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: c.sub,
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        Capas
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 4 }}>
        {rows.length === 0 && (
          <div style={{ padding: 12, fontSize: 12, color: c.sub }}>
            Esta página está vacía.
          </div>
        )}

        {rows.map((el) => {
          const isSel = !!selected[el.id];
          const hidden = el.opacity === 0;
          return (
            <div
              key={el.id}
              draggable
              onDragStart={() => {
                dragId.current = el.id;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(el.id)}
              onClick={() => selectOnCanvas(el.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 6px',
                borderRadius: 8,
                cursor: 'pointer',
                background: isSel ? c.active : 'transparent',
                color: isSel ? c.activeFg : c.fg,
                opacity: hidden ? 0.5 : 1,
              }}
            >
              <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>
                {glyph(el.type)}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName(el)}
              </span>

              {el.type === 'image' &&
                iconBtn('Usar como fondo', () => setAsBackground(api, el.id, activePageId), '⤢')}
              {el.type === 'image' &&
                iconBtn('Extender a la página', () => extendToPage(api, el.id, activePageId), '⛶')}

              {iconBtn(
                hidden ? 'Mostrar' : 'Ocultar',
                () => toggleVisibility(el),
                hidden ? '🚫' : '👁',
              )}
              {iconBtn(
                el.locked ? 'Desbloquear' : 'Bloquear',
                () => patch(el.id, { locked: !el.locked }),
                el.locked ? '🔒' : '🔓',
              )}
              {iconBtn('Eliminar', () => remove(el.id), '🗑', true)}
            </div>
          );
        })}
      </div>

      {/* Root / page row */}
      <div
        onDoubleClick={() => {
          if (!frame || frame.type !== 'frame') return;
          const name = window.prompt('Nombre de la página', frame.name ?? '');
          if (name && name.trim()) renamePage(api, activePageId, name.trim());
        }}
        title="Doble clic para renombrar la página"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderTop: `1px solid ${c.border}`,
          fontSize: 12,
          color: c.sub,
          cursor: 'default',
        }}
      >
        <span style={{ width: 16, textAlign: 'center' }}>▢</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {frame && frame.type === 'frame' ? frame.name ?? 'Página' : 'Página'}
        </span>
      </div>
    </div>
  );
}

export default LayersPanel;
