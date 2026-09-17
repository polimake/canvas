import { type ReactNode } from 'react';
import { type PartialLabels } from '../shared/labels';
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
export declare function WorkspaceLayout({ children, className, workspace, panels, theme, labels }: WorkspaceLayoutProps): import("react").JSX.Element;
//# sourceMappingURL=WorkspaceLayout.d.ts.map