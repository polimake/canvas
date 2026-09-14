import { useId, useState } from 'react';
import type { WorkspacePanelsProps } from '../types';

/** Guided workspace: one resource or settings panel at a time. */
export function DesignWorkspace({ panels }: WorkspacePanelsProps) {
  const [selected, setSelected] = useState<string>();
  const id = useId();
  const active = panels.find(p => p.id === selected) ?? panels[0];
  return <>
    <div className="canvas2-workspace-tabs">
      {panels.map(panel => <button key={panel.id} type="button"
        aria-pressed={panel.id === active?.id} aria-controls={id}
        onClick={() => setSelected(panel.id)}>{panel.title}</button>)}
    </div>
    <div id={id} className="canvas2-workspace-panel" role="region" aria-label={active?.title}>
      {active?.content}
    </div>
  </>;
}
