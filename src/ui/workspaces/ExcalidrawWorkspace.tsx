import { useId } from 'react';
import type { OpenPanelProps, WorkspaceAction, WorkspacePanelsProps } from './types';

/** Native drawing controls stay on the canvas; extra capabilities open on demand. */
export function ExcalidrawWorkspace({ panels, narrow = false, actions = [], openPanel, onOpenPanelChange }: WorkspacePanelsProps & OpenPanelProps & { narrow?: boolean; actions?: WorkspaceAction[] }) {
  const active = panels.find(panel => panel.id === openPanel);
  const id = useId();
  return <>
    <div className="canvas2-native-tools" role="toolbar" aria-orientation="vertical">
      {/* En móvil la píldora no se pinta: sus paneles también van aquí. */}
      {panels.filter(panel => narrow || !panel.inToolbar).map(panel => <button key={panel.id} type="button" title={panel.title}
        aria-label={panel.title} aria-pressed={active?.id === panel.id}
        aria-controls={active?.id === panel.id ? id : undefined}
        onClick={() => onOpenPanelChange(active?.id === panel.id ? null : panel.id)}>
        {panel.icon}
      </button>)}
      {actions.map(action => <button key={action.id} type="button" title={action.label}
        aria-label={action.label} aria-pressed={action.pressed ?? undefined}
        onClick={action.onSelect}>
        {action.icon}
      </button>)}
    </div>
    {active && <section id={id} className="canvas2-resource-panel" role="region" aria-label={active.title}>
      <header className="canvas2-resource-heading">{active.title}</header>
      <div className="canvas2-workspace-panel">{active.content}</div>
    </section>}
  </>;
}
