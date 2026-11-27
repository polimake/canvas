import type { ReactNode } from 'react';
/** A UI preference, never part of the serialized document. */
export type CanvasWorkspace = 'excalidraw' | 'design' | 'advanced' | 'slides';
/** Todos, en el orden en que se ofrecen (menú ☰ y Ver › Espacio de trabajo). */
export declare const CANVAS_WORKSPACES: readonly CanvasWorkspace[];
export interface WorkspacePanel {
    id: string;
    title: string;
    content: ReactNode;
    icon?: ReactNode;
    /** En la vista Excalidraw se abre desde la píldora de herramientas (con su
     *  nombre en texto) y no desde la tira de iconos. */
    inToolbar?: boolean;
    /** Sin el relleno del panel: el contenido trae el suyo (Comentarios, IA). */
    bleed?: boolean;
    /** Al mirar: el panel se ve en la tira, apagado, para que la interfaz sea la
     *  misma que al editar. No tiene contenido que abrir. */
    locked?: boolean;
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
//# sourceMappingURL=types.d.ts.map