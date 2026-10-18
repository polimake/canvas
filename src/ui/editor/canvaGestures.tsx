/**
 * Acciones de teclado que el lienzo registra sobre Excalidraw para que deshacer
 * y Mayúsculas+flecha se comporten como en Canva. La lógica vive en
 * core/gestures.ts; aquí solo están las acciones y los botones.
 *
 * `undo` y `redo` sustituyen POR NOMBRE a las de Excalidraw (`registerAction`
 * guarda por nombre). Si convivieran, dos acciones responderían a Ctrl+Z y
 * Excalidraw, al ver dos, no ejecutaría ninguna. Al sustituirlas se pierde su
 * botón, así que se repone con el mismo marcado (`ToolButton`) y el mismo
 * icono: el CSS del lienzo y el de Excalidraw lo siguen pintando igual.
 */
import { useEffect, useReducer } from 'react';
import { CaptureUpdateAction, useI18n, type ExcalidrawImperativeAPI, type SceneElement } from '../../core/excal';
import {
  ARROW_OFFSETS,
  SHIFT_NUDGE_PX,
  hasRealEntry,
  nudgeSelection,
  performHistory,
  type AppLike,
  type ArrowKey,
  type HistoryDirection,
} from '../../core/gestures';

type Action = Parameters<ExcalidrawImperativeAPI['registerAction']>[0];

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const ctrlOrCmd = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);

/** Como `matchKey` de Excalidraw: la letra, o su tecla física si el teclado no es latino. */
const matchLetter = (e: KeyboardEvent, letter: string) =>
  e.key.toLowerCase() === letter || (!/^[a-z]$/i.test(e.key) && e.code === `Key${letter.toUpperCase()}`);

export const isUndoKey = (e: KeyboardEvent) => ctrlOrCmd(e) && !e.shiftKey && !e.altKey && matchLetter(e, 'z');
export const isRedoKey = (e: KeyboardEvent) =>
  (ctrlOrCmd(e) && e.shiftKey && !e.altKey && matchLetter(e, 'z')) ||
  (!isMac && e.ctrlKey && !e.shiftKey && !e.altKey && matchLetter(e, 'y'));

const ICON_PATH: Record<HistoryDirection, string> = {
  undo: 'M7.5 10.833 4.167 7.5 7.5 4.167M4.167 7.5h9.166a3.333 3.333 0 0 1 0 6.667H12.5',
  redo: 'M12.5 10.833 15.833 7.5 12.5 4.167M15.833 7.5H6.667a3.333 3.333 0 1 0 0 6.667H7.5',
};

function HistoryButton({ direction, app, updateData, size }: {
  direction: HistoryDirection;
  app: AppLike | undefined;
  updateData: () => void;
  size?: string;
}) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const { t } = useI18n();
  useEffect(() => app?.history?.onHistoryChangedEmitter?.on(rerender), [app]);
  const stack = direction === 'undo' ? app?.history?.undoStack : app?.history?.redoStack;
  const disabled = !hasRealEntry(stack);
  const label = t(direction === 'undo' ? 'buttons.undo' : 'buttons.redo');
  return (
    <button
      type="button"
      className={`ToolIcon_type_button ToolIcon_size_${size ?? 'medium'} ToolIcon_type_button--show ToolIcon`}
      aria-label={label}
      title={label}
      data-testid={`button-${direction}`}
      disabled={disabled}
      onClick={() => updateData()}
    >
      <div className="ToolIcon__icon" aria-hidden="true" aria-disabled={disabled}>
        <svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 20 20" width="20" height="20"
          fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON_PATH[direction]} strokeWidth="1.25" />
        </svg>
      </div>
    </button>
  );
}

function historyAction(direction: HistoryDirection): Action {
  return {
    name: direction,
    label: direction === 'undo' ? 'buttons.undo' : 'buttons.redo',
    viewMode: false,
    trackEvent: false,
    keyTest: (event: KeyboardEvent) => (direction === 'undo' ? isUndoKey(event) : isRedoKey(event)),
    perform: (elements: readonly SceneElement[], appState: any, _value: unknown, app: unknown) => {
      const result = performHistory(direction, elements, appState, app as AppLike);
      // Igual que Excalidraw: aplicar la historia no es un cambio nuevo.
      if (!result) return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
      return { ...result, captureUpdate: CaptureUpdateAction.NEVER };
    },
    PanelComponent: ({ updateData, data, app }: any) => (
      <HistoryButton direction={direction} app={app as AppLike} updateData={updateData} size={data?.size} />
    ),
  } as unknown as Action;
}

function shiftNudgeAction(key: ArrowKey): Action {
  const [ux, uy] = ARROW_OFFSETS[key];
  return {
    name: `canvas2:shiftNudge${key}`,
    label: 'Mover 10 px',
    viewMode: false,
    trackEvent: false,
    keyTest: (event: KeyboardEvent, appState: any, _elements: unknown, app: unknown) =>
      event.key === key &&
      event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
      // Con la cuadrícula puesta manda su paso: eso lo sigue haciendo Excalidraw.
      !(app as AppLike | undefined)?.getEffectiveGridSize?.() &&
      !appState.editingLinearElement && !appState.editingTextElement &&
      Object.values(appState.selectedElementIds ?? {}).some(Boolean),
    perform: (elements: readonly SceneElement[], appState: any) => {
      const next = nudgeSelection(elements, appState.selectedElementIds ?? {}, ux * SHIFT_NUDGE_PX, uy * SHIFT_NUDGE_PX);
      if (!next) return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
      // Cada toque es un paso de deshacer, como en Canva.
      return { elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY };
    },
  } as unknown as Action;
}

/** Las acciones que registra el lienzo, en el orden en que se registran. */
export function canvaGestureActions(): Action[] {
  return [
    historyAction('undo'),
    historyAction('redo'),
    ...(Object.keys(ARROW_OFFSETS) as ArrowKey[]).map(shiftNudgeAction),
  ];
}

/**
 * Registra los gestos. Tiene que ir DESPUÉS de que Excalidraw registre los
 * suyos: el `excalidrawAPI` se entrega dentro de su constructor, antes de que
 * registre `undo` y `redo`, así que registrarlos ahí los dejaría pisados. Por
 * eso Canvas2 lo llama desde un efecto.
 */
export function installCanvaGestures(api: Pick<ExcalidrawImperativeAPI, 'registerAction'>): void {
  for (const action of canvaGestureActions()) api.registerAction(action);
}
