'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { palette, PANEL_FONT } from '../shared/theme';
import { mergeLabels, type PartialLabels } from '../shared/labels';
import { DesignWorkspace } from './design/DesignWorkspace';
import { AdvancedWorkspace } from './advanced/AdvancedWorkspace';
import { ExcalidrawWorkspace } from './ExcalidrawWorkspace';
import type { CanvasWorkspace, OpenPanelProps, WorkspaceAction, WorkspacePanel } from './types';
import './workspaces.css';

export interface WorkspaceLayoutProps extends OpenPanelProps {
  children: ReactNode;
  className?: string;
  workspace: CanvasWorkspace;
  panels: WorkspacePanel[];
  theme?: 'light' | 'dark';
  labels?: PartialLabels;
  /**
   * Excalidraw está en su distribución de móvil (ver `narrow.ts`). En la vista
   * Excalidraw la tira de iconos pasa al borde izquierdo —el derecho es de las
   * utilidades de Excalidraw— y recoge también los paneles de la píldora, que
   * en móvil no se pinta.
   */
  narrow?: boolean;
  /** Botones del host que, en móvil, van en la tira tras los paneles. */
  actions?: WorkspaceAction[];
}

/** The surface stays in the same React slot across every layout change. */
export function WorkspaceLayout({ children, className, workspace,
  panels, theme = 'light', labels, narrow = false, actions = [], openPanel, onOpenPanelChange }: WorkspaceLayoutProps) {
  const L = mergeLabels(labels).workspace;
  const c = palette[theme];
  return <div className={`canvas2-workspace ${className ?? ''}`} data-workspace={workspace}
    data-panel-collapsed={!panels.length ? '' : undefined}
    data-narrow={narrow ? '' : undefined}
    style={{ '--workspace-bg': c.bg, '--workspace-fg': c.fg, '--workspace-border': c.border,
      '--workspace-hover': c.hover, '--workspace-accent': c.active,
      '--workspace-accent-fg': c.activeFg, '--workspace-sub': c.sub, fontFamily: PANEL_FONT } as CSSProperties}>
    <div className="canvas2-workspace-body">
      <aside className="canvas2-workspace-sidebar" aria-label={L.panels}
        // En la vista Excalidraw los paneles de la píldora no ocupan la tira
        // (salvo en móvil, donde la píldora no se pinta).
        hidden={!actions.length && !panels.some(panel => workspace !== 'excalidraw' || narrow || !panel.inToolbar || panel.id === openPanel)}>
        {workspace === 'excalidraw' ? <ExcalidrawWorkspace panels={panels} narrow={narrow} actions={actions} openPanel={openPanel} onOpenPanelChange={onOpenPanelChange} />
          : workspace === 'design' ? <DesignWorkspace panels={panels} /> : <AdvancedWorkspace panels={panels} />}
      </aside>
      <div className="canvas2-workspace-surface">{children}</div>
    </div>
  </div>;
}
