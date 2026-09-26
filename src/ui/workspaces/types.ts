import type { ReactNode } from 'react';

/** A UI preference, never part of the serialized document. */
export type CanvasWorkspace = 'excalidraw' | 'design' | 'advanced';

export interface WorkspacePanel {
  id: string;
  title: string;
  content: ReactNode;
  icon?: ReactNode;
  /** En la vista Excalidraw se abre desde la píldora de herramientas (con su
   *  nombre en texto) y no desde la tira de iconos. */
  inToolbar?: boolean;
}

export interface WorkspacePanelsProps {
  panels: WorkspacePanel[];
}

/** Botón del host en la tira de iconos (en móvil, donde no hay píldora). */
export interface WorkspaceAction {
  id: string;
  label: string;
  pressed?: boolean;
  onSelect: () => void;
  icon?: ReactNode;
}

/** Panel abierto en la vista Excalidraw; lo controla el editor para que la
 *  píldora y la tira de iconos abran el mismo. */
export interface OpenPanelProps {
  openPanel: string | null;
  onOpenPanelChange: (id: string | null) => void;
}
