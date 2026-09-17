import { useId, useState } from 'react';
import type { WorkspacePanelsProps } from './types';

/** Native drawing controls stay on the canvas; extra capabilities open on demand. */
export function ExcalidrawWorkspace({ panels }: WorkspacePanelsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = panels.find(panel => panel.id === selected);
  const id = useId();
  return <>
    <div className="canvas2-native-tools" role="toolbar" aria-orientation="vertical">
      {panels.map(panel => <button key={panel.id} type="button" title={panel.title}
        aria-label={panel.title} aria-pressed={active?.id === panel.id}
        aria-controls={active?.id === panel.id ? id : undefined}
        onClick={() => setSelected(active?.id === panel.id ? null : panel.id)}>
        {panel.icon}
      </button>)}
    </div>
    {active && <section id={id} className="canvas2-resource-panel" role="region" aria-label={active.title}>
      <header className="canvas2-resource-heading">{active.title}</header>
      <div className="canvas2-workspace-panel">{active.content}</div>
    </section>}
  </>;
}
