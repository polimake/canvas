import type { ReactNode } from 'react';
/** A UI preference, never part of the serialized document. */
export type CanvasWorkspace = 'excalidraw' | 'design' | 'advanced';
export interface WorkspacePanel {
    id: string;
    title: string;
    content: ReactNode;
    icon?: ReactNode;
}
export interface WorkspacePanelsProps {
    panels: WorkspacePanel[];
}
//# sourceMappingURL=types.d.ts.map