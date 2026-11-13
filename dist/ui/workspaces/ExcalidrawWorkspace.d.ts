import type { OpenPanelProps, WorkspaceAction, WorkspacePanelsProps } from './types';
/** Native drawing controls stay on the canvas; extra capabilities open on demand. */
export declare function ExcalidrawWorkspace({ panels, narrow, actions, openPanel, onOpenPanelChange }: WorkspacePanelsProps & OpenPanelProps & {
    narrow?: boolean;
    actions?: WorkspaceAction[];
}): import("react").JSX.Element;
//# sourceMappingURL=ExcalidrawWorkspace.d.ts.map