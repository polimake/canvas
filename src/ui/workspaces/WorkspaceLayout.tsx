'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { palette, PANEL_FONT } from '../shared/theme';
import { mergeLabels, type PartialLabels } from '../shared/labels';
import { DesignWorkspace } from './design/DesignWorkspace';
import { AdvancedWorkspace } from './advanced/AdvancedWorkspace';
import type { CanvasWorkspace, WorkspacePanel } from './types';
import './workspaces.css';

export interface WorkspaceLayoutProps {
  children: ReactNode;
  className?: string;
  workspace: CanvasWorkspace;
  onWorkspaceChange: (workspace: CanvasWorkspace) => void;
  panels: WorkspacePanel[];
  theme?: 'light' | 'dark';
  labels?: PartialLabels;
  viewMode?: boolean;
}

/** The surface stays in the same React slot across every layout change. */
export function WorkspaceLayout({ children, className, workspace, onWorkspaceChange,
  panels, theme = 'light', labels, viewMode }: WorkspaceLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const panelId = useId();
  const L = mergeLabels(labels).workspace;
  const c = palette[theme];
  const ordered = workspace === 'advanced'
    ? [...panels].sort((a, b) => Number(b.id === 'layers') - Number(a.id === 'layers'))
    : panels;
  return <div className={`canvas2-workspace ${className ?? ''}`} data-workspace={workspace}
    data-panel-collapsed={collapsed || !panels.length ? '' : undefined}
    style={{ '--workspace-bg': c.bg, '--workspace-fg': c.fg, '--workspace-border': c.border,
      '--workspace-hover': c.hover, '--workspace-accent': c.active, fontFamily: PANEL_FONT } as CSSProperties}>
    {!viewMode && <header className="canvas2-workspace-header">
      <label className="canvas2-workspace-choice">
        <span>{L.label}</span>
        <select value={workspace} onChange={event => onWorkspaceChange(event.target.value as CanvasWorkspace)}>
          <option value="design">{L.design}</option>
          <option value="advanced">{L.advanced}</option>
        </select>
      </label>
      {panels.length > 0 && <button type="button" aria-expanded={!collapsed} aria-controls={panelId}
        onClick={() => setCollapsed(value => !value)}>{collapsed ? L.showPanels : L.hidePanels}</button>}
    </header>}
    <div className="canvas2-workspace-body">
      <aside id={panelId} className="canvas2-workspace-sidebar" aria-label={L.panels}
        hidden={collapsed || !panels.length}>
        {workspace === 'design' ? <DesignWorkspace panels={ordered} /> : <AdvancedWorkspace panels={ordered} />}
      </aside>
      <div className="canvas2-workspace-surface">{children}</div>
    </div>
  </div>;
}
