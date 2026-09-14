import type { ReactNode } from 'react';

/** A UI preference, never part of the serialized document. */
export type CanvasWorkspace = 'design' | 'advanced';

export interface WorkspacePanel {
  id: string;
  title: string;
  content: ReactNode;
}

export interface WorkspacePanelsProps {
  panels: WorkspacePanel[];
}
