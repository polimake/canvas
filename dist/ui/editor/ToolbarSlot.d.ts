import { type ReactNode, type RefObject } from 'react';
/**
 * Pinta `children` al final de la píldora de herramientas de Excalidraw.
 *
 * Excalidraw no ofrece hueco (túnel) en su barra, así que se busca la fila por
 * su clase y se monta un portal. La barra puede desmontarse y volver (modo
 * lectura, cambio a móvil), por eso se vigila el árbol y se vuelve a buscar:
 * sin fila, no se pinta nada.
 */
export declare function ToolbarSlot({ root, children }: {
    root: RefObject<HTMLElement | null>;
    children: ReactNode;
}): import("react").ReactPortal | null;
//# sourceMappingURL=ToolbarSlot.d.ts.map