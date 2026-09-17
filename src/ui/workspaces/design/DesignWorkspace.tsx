import { useId, useState } from 'react';
import type { WorkspacePanelsProps } from '../types';

/** Guided workspace: one resource or settings panel at a time. */
export function DesignWorkspace({ panels }: WorkspacePanelsProps) {
  const [selected, setSelected] = useState<string>();
  const [collapsed, setCollapsed] = useState(false);
  const id = useId();
  const active = panels.find(p => p.id === selected) ?? panels[0];
  return <>
    <div className="canvas2-workspace-tabs" role="toolbar" aria-orientation="vertical">
      {panels.map(panel => <button key={panel.id} type="button"
        aria-pressed={!collapsed && panel.id === active?.id} aria-controls={id}
        onClick={() => { setCollapsed(panel.id === active?.id && !collapsed); setSelected(panel.id); }}>
        {panel.icon}<span>{panel.title}</span></button>)}
    </div>
    {!collapsed && <section id={id} className="canvas2-resource-panel" role="region" aria-label={active?.title}>
      <header className="canvas2-resource-heading">{active?.title}</header>
      <div className="canvas2-workspace-panel">{active?.content}</div>
    </section>}
  </>;
}
