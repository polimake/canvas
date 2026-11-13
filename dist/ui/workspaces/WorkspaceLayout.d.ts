import { type ReactNode } from 'react';
import { type PartialLabels } from '../shared/labels';
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
export declare function WorkspaceLayout({ children, className, workspace, panels, theme, labels, narrow, actions, openPanel, onOpenPanelChange }: WorkspaceLayoutProps): import("react").JSX.Element;
//# sourceMappingURL=WorkspaceLayout.d.ts.map