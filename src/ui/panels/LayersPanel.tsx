'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  CaptureUpdateAction,
  type ExcalidrawImperativeAPI,
  type SceneElement,
} from '../../core/excal';
import { commitElements, patchElement } from '../../core/mutate';
import { PANEL_FONT, palette } from '../shared/theme';
import { reorderPageMembers } from '../../core/zorder';
import { setAsBackground, extendToPage } from '../../core/imageOps';
import { renamePage } from '../../core/pages';
import { isPageBackground } from '../../core/background';
import { PAGE_ALIGNMENTS, alignToPage, type PageAlignment } from '../../core/align';
import {
  AlignBottomIcon,
  AlignCenterHIcon,
  AlignCenterVIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  ArrowIcon,
  CircleIcon,
  CoverIcon,
  DiamondIcon,
  DrawIcon,
  EyeIcon,
  EyeOffIcon,
  FrameIcon,
  ImageIcon,
  LineIcon,
  LockIcon,
  SquareIcon,
  StretchIcon,
  TextIcon,
  TrashIcon,
  UnlockIcon,
} from '../shared/icons';

export interface LayersPanelProps {
  api: ExcalidrawImperativeAPI;
  activePageId: string | null;
  theme?: 'light' | 'dark';
  /** Read-only mode: rows become click-to-select only, no mutations. */
  viewMode?: boolean;
  /** Dentro de una pestaña de la barra lateral: sin flotar, sin marco propio. */
  embedded?: boolean;
}

const TYPE_ICON: Record<string, ComponentType> = {
  image: ImageIcon,
  text: TextIcon,
  rectangle: SquareIcon,
  ellipse: CircleIcon,
  diamond: DiamondIcon,
  line: LineIcon,
  arrow: ArrowIcon,
  freedraw: DrawIcon,
  frame: FrameIcon,
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

const ALIGN_ICON: Record<PageAlignment, ComponentType> = {
  left: AlignLeftIcon,
  centerX: AlignCenterHIcon,
  right: AlignRightIcon,
  top: AlignTopIcon,
  centerY: AlignCenterVIcon,
  bottom: AlignBottomIcon,
};

function typeIcon(type: string): ReactNode {
  const Icon = TYPE_ICON[type] ?? SquareIcon;
  return <Icon />;
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
  const members = els.filter((e) => e.frameId === pageId && !isPageBackground(e));
  const sel = api.getAppState().selectedElementIds;
  const selKeys = Object.keys(sel)
    .filter((k) => sel[k])
    .join(',');
  const frame = els.find((e) => e.id === pageId);
  const frameName = frame && frame.type === 'frame' ? frame.name ?? '' : '';
  // `version` bumps on every real element change (mutate.ts discipline), so
  // text edits / renames / restyles refresh the row labels too.
  return (
    members.map((e) => `${e.id}:${e.version}:${e.locked ? 1 : 0}:${e.opacity}`).join('|') +
    '#' +
    selKeys +
    '#' +
    frameName
  );
}

/**
 * Right-docked layers panel. Lists the active page's elements (top of stack
 * first) with reorder / visibility / lock / delete, plus image
 * "Fondo"/"Extender" actions. Excalidraw
 * has no per-element hidden flag, so visibility is emulated with `opacity: 0`.
 */
export function LayersPanel({
  api,
  activePageId,
  theme = 'light',
  viewMode = false,
  embedded = false,
}: LayersPanelProps) {
  const c = palette[theme];
  const [, setTick] = useState(0);
  const sigRef = useRef('');
  const dragId = useRef<string | null>(null);
  const priorOpacity = useRef(new Map<string, number>());
  const lastSceneRef = useRef<{ elements: unknown; selection: unknown }>({
    elements: null,
    selection: null,
  });
  // Inline rename for the page footer (replaces window.prompt).
  const [renamingPage, setRenamingPage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      // Cheap reference gate first: the elements array is stable across
      // viewport-only ticks, so most onChange calls bail before the O(n)
      // signature walk.
      const elements = api.getSceneElements();
      const selection = api.getAppState().selectedElementIds;
      if (
        elements === lastSceneRef.current.elements &&
        selection === lastSceneRef.current.selection
      ) {
        return;
      }
      lastSceneRef.current = { elements, selection };
      const next = sceneSignature(api, activePageId);
      if (next !== sigRef.current) {
        sigRef.current = next;
        setTick((t) => t + 1);
      }
    };
    lastSceneRef.current = { elements: null, selection: null };
    refresh();
    return api.onChange(refresh);
  }, [api, activePageId]);

  if (!activePageId) return null;

  const els = api.getSceneElements();
  const frame = els.find((e) => e.id === activePageId);
  // The page's paper sheet is chrome (managed by the Fondo menu), not a layer.
  const members = els.filter((e) => e.frameId === activePageId && !isPageBackground(e));
  // Array order is ascending z (bottom→top); reverse for top-first display.
  const rows = [...members].reverse();
  const selected = api.getAppState().selectedElementIds;

  // Ficheros de la escena, para pintar la miniatura de las capas de imagen.
  // `getFiles()` devuelve el mapa vivo; la url puede ser de MediaMonster o un
  // data URI heredado, y en los dos casos vale como `src`.
  const files = api.getFiles() as Record<string, { dataURL?: string } | undefined>;
  const thumb = (el: SceneElement): string | undefined => {
    if (el.type !== 'image') return undefined;
    const fileId = (el as { fileId?: string }).fileId;
    return fileId ? files[fileId]?.dataURL : undefined;
  };

  const patch = (id: string, changes: Partial<SceneElement>) => {
    const next = api
      .getSceneElements()
      .map((e) => (e.id === id ? patchElement(e, changes) : e));
    commitElements(api, next);
  };

  const remove = (id: string) => {
    const next = api
      .getSceneElements()
      .filter((e) => e.id !== id && (e as { containerId?: string }).containerId !== id);
    commitElements(api, next);
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
    // El papel de la página TAMBIÉN es miembro del marco, aunque la lista no lo
    // enseñe. No hace falta nombrarlo: `reorderPageMembers` lo hunde de oficio
    // (ver `floorFirst` en zorder.ts). Antes se colaba aquí a mano, y ese
    // recordatorio era justo lo que se le olvidaba a los demás llamantes.
    commitElements(api, reorderPageMembers(api, activePageId, [...topFirst].reverse()));
  };

  const iconBtn = (label: string, onClick: () => void, node: ReactNode, danger = false) => (
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
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        padding: '3px 3px',
        borderRadius: 4,
        color: danger ? c.danger : 'inherit',
        opacity: 0.8,
      }}
    >
      {node}
    </button>
  );

  return (
    <div
      style={{
        // Empotrado dentro de una pestaña de la barra lateral, el panel no debe
        // flotar ni traer marco propio: la barra ya pone el suyo, y un panel
        // absoluto se saldría de la pestaña.
        // `height: '100%'` NO servía. El panel es hijo de un contenedor flex
        // cuya altura la reparte el propio flex (el dock solo declara un
        // `max-height`), y un porcentaje contra una altura `auto` no resuelve:
        // el panel crecía hasta el alto de su contenido —1313 px con una escena
        // de 45 capas—, el dock lo recortaba con su `overflow: hidden` y la
        // lista NUNCA llegaba a desbordar, así que no aparecía la barra de
        // scroll y las capas de abajo eran inalcanzables. Medido con Playwright
        // sobre una escena real, no supuesto.
        //
        // Con `flex` + `minHeight: 0` el panel se queda exactamente con el alto
        // que le da el dock y el desbordamiento cae donde toca: en la lista.
        ...(embedded
          ? { position: 'relative', width: '100%', flex: 1, minHeight: 0, maxHeight: '100%' }
          : {
              position: 'absolute' as const,
              top: 56,
              right: 12,
              bottom: 76,
              zIndex: 4,
              width: 240,
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            }),
        display: 'flex',
        flexDirection: 'column',
        background: embedded ? 'transparent' : c.bg,
        color: c.fg,
        fontFamily: PANEL_FONT,
        overflow: 'hidden',
      }}
    >
      {/* Empotrado y en solo lectura esta fila se queda sin rótulo (lo pone la
          pestaña) y sin botones de alinear: sería un filo con nada dentro. */}
      {(!embedded || !viewMode) && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: c.sub,
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        {/* Empotrado, el rótulo lo pone la pestaña del dock: repetirlo dejaba
            "Capas" dos veces, una encima de la otra. La fila se queda por los
            botones de alinear, que sí son de aquí. */}
        <span style={{ flex: 1 }}>{embedded ? '' : 'Capas'}</span>
        {/* Align the current selection to the PAGE (Excalidraw's native align
            needs 2+ elements; to-artboard alignment is our overlay). */}
        {!viewMode && (
        <span style={{ display: 'inline-flex', gap: 2 }}>
          {PAGE_ALIGNMENTS.map((a) => {
            const Icon = ALIGN_ICON[a.key];
            return (
              <button
                key={a.key}
                type="button"
                title={a.label}
                onClick={() => alignToPage(api, activePageId, a.key)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 1,
                  padding: '2px 3px',
                  borderRadius: 4,
                  opacity: 0.8,
                }}
              >
                <Icon />
              </button>
            );
          })}
        </span>
        )}
      </div>
      )}

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
              draggable={!viewMode}
              onDragStart={() => {
                if (!viewMode) dragId.current = el.id;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!viewMode) handleDrop(el.id);
              }}
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
              <span style={{ width: 16, height: 16, display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                {/* La miniatura de la propia imagen en vez del icono genérico:
                    en una escena con decenas de capas es lo único que permite
                    saber CUÁL es cuál sin ir pinchando una por una. */}
                {thumb(el) ? (
                  <img
                    src={thumb(el)}
                    alt=""
                    draggable={false}
                    style={{ width: 16, height: 16, objectFit: 'cover', borderRadius: 3, display: 'block' }}
                  />
                ) : (
                  typeIcon(el.type)
                )}
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

              {!viewMode && (
                <>
                  {el.type === 'image' &&
                    iconBtn('Usar como fondo', () => setAsBackground(api, el.id, activePageId), <CoverIcon />)}
                  {el.type === 'image' &&
                    iconBtn('Extender a la página', () => extendToPage(api, el.id, activePageId), <StretchIcon />)}

                  {iconBtn(
                    hidden ? 'Mostrar' : 'Ocultar',
                    () => toggleVisibility(el),
                    hidden ? <EyeOffIcon /> : <EyeIcon />,
                  )}
                  {iconBtn(
                    el.locked ? 'Desbloquear' : 'Bloquear',
                    () => patch(el.id, { locked: !el.locked } as Partial<SceneElement>),
                    el.locked ? <LockIcon /> : <UnlockIcon />,
                  )}
                  {iconBtn('Eliminar', () => remove(el.id), <TrashIcon />, true)}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Root / page row — double-click to rename inline */}
      <div
        onDoubleClick={() => {
          if (viewMode || !frame || frame.type !== 'frame') return;
          setRenamingPage(frame.name ?? '');
        }}
        title={viewMode ? undefined : 'Doble clic para renombrar la página'}
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
        <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>
          <FrameIcon />
        </span>
        {renamingPage !== null ? (
          <input
            autoFocus
            value={renamingPage}
            onChange={(e) => setRenamingPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (renamingPage.trim()) renamePage(api, activePageId, renamingPage.trim());
                setRenamingPage(null);
              }
              if (e.key === 'Escape') setRenamingPage(null);
            }}
            onBlur={() => {
              if (renamingPage.trim()) renamePage(api, activePageId, renamingPage.trim());
              setRenamingPage(null);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '2px 6px',
              borderRadius: 6,
              border: `1px solid ${c.border}`,
              background: 'transparent',
              color: c.fg,
              fontSize: 12,
              fontFamily: PANEL_FONT,
            }}
          />
        ) : (
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {frame && frame.type === 'frame' ? frame.name ?? 'Página' : 'Página'}
          </span>
        )}
      </div>
    </div>
  );
}

export default LayersPanel;
