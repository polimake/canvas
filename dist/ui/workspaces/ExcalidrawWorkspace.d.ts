import type { OpenPanelProps, WorkspaceAction, WorkspacePanelsProps } from './types';
/**
 * El inspector de la derecha en la vista Excalidraw.
 *
 * En escritorio, cerrado, es UNA flecha a la altura del ☰ (25/11): la tira de
 * iconos (Marca · Página · Capas) obligaba a adivinar qué era cada uno. La
 * flecha abre el panel en la última pestaña usada; dentro, las pestañas en
 * texto cambian de panel —los nuestros y los del host, como Comentarios o IA—
 * y la ✕ lo cierra. En móvil sigue la tira de iconos: allí no hay sitio para
 * un panel que tape medio lienzo sin saber antes cuál se abre.
 */
export declare function ExcalidrawWorkspace({ panels, narrow, actions, openPanel, onOpenPanelChange, closeLabel, openLabel }: WorkspacePanelsProps & OpenPanelProps & {
    narrow?: boolean;
    actions?: WorkspaceAction[];
    closeLabel?: string;
    openLabel?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=ExcalidrawWorkspace.d.ts.map