'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { palette, PANEL_FONT } from '../shared/theme';
import { mergeLabels, type PartialLabels } from '../shared/labels';
import { DesignWorkspace } from './design/DesignWorkspace';
import { AdvancedWorkspace } from './advanced/AdvancedWorkspace';
import { ExcalidrawWorkspace } from './ExcalidrawWorkspace';
import type { CanvasWorkspace, WorkspacePanel } from './types';
import './workspaces.css';

export interface WorkspaceLayoutProps {
  children: ReactNode;
  className?: string;
  workspace: CanvasWorkspace;
  panels: WorkspacePanel[];
  theme?: 'light' | 'dark';
  labels?: PartialLabels;
}

/** The surface stays in the same React slot across every layout change. */
export function WorkspaceLayout({ children, className, workspace,
  panels, theme = 'light', labels }: WorkspaceLayoutProps) {
  const L = mergeLabels(labels).workspace;
  const c = palette[theme];
  return <div className={`canvas2-workspace ${className ?? ''}`} data-workspace={workspace}
    data-panel-collapsed={!panels.length ? '' : undefined}
    style={{ '--workspace-bg': c.bg, '--workspace-fg': c.fg, '--workspace-border': c.border,
      '--workspace-hover': c.hover, '--workspace-accent': c.active, fontFamily: PANEL_FONT } as CSSProperties}>
    <div className="canvas2-workspace-body">
      <aside className="canvas2-workspace-sidebar" aria-label={L.panels}
        hidden={!panels.length}>
        {workspace === 'excalidraw' ? <ExcalidrawWorkspace panels={panels} />
          : workspace === 'design' ? <DesignWorkspace panels={panels} /> : <AdvancedWorkspace panels={panels} />}
      </aside>
      <div className="canvas2-workspace-surface">{children}</div>
    </div>
  </div>;
}
