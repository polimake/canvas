import { useState } from 'react';
import type { WorkspacePanelsProps } from '../types';

/** Inspection workspace: layers and properties can stay open together. */
export function AdvancedWorkspace({ panels }: WorkspacePanelsProps) {
  const [selected, setSelected] = useState('design');
  const resources = panels.filter(panel => panel.id !== 'layers');
  const active = resources.find(panel => panel.id === selected) ?? resources[0];
  const layers = panels.find(panel => panel.id === 'layers');
  return <div className="canvas2-advanced-panels">
    {active && <section className="canvas2-advanced-properties">
      <div className="canvas2-workspace-tabs">
        {resources.map(panel => <button key={panel.id} type="button"
          aria-pressed={active.id === panel.id} onClick={() => setSelected(panel.id)}>
          {panel.title}
        </button>)}
      </div>
      <div className="canvas2-workspace-panel" role="region" aria-label={active.title}>{active.content}</div>
    </section>}
    {layers && <section className="canvas2-advanced-layers" aria-label={layers.title}>
      <div className="canvas2-advanced-panel-heading">{layers.icon}{layers.title}</div>
      <div className="canvas2-workspace-panel">{layers.content}</div>
    </section>}
  </div>;
}
