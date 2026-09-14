import type { WorkspacePanelsProps } from '../types';

/** Inspection workspace: layers and properties can stay open together. */
export function AdvancedWorkspace({ panels }: WorkspacePanelsProps) {
  return <div className="canvas2-workspace-stack">
    {panels.map(panel => <details key={panel.id} open>
      <summary>{panel.title}</summary>
      <div className="canvas2-workspace-panel">{panel.content}</div>
    </details>)}
  </div>;
}
