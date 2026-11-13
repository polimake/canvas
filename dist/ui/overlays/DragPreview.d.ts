/**
 * Sustituye la imagen de arrastre del navegador por un nodo transparente de
 * 1×1, de modo que solo se vea nuestra tarjeta. Se llama desde `dragstart`.
 */
export declare function hideNativeDragImage(e: React.DragEvent): void;
export interface DragGrab {
    /** Desplazamiento del puntero dentro de la pieza al agarrarla, en px. */
    x: number;
    y: number;
    /** Tamaño de la pieza origen, en px: la tarjeta lo copia para que sea 1:1. */
    width: number;
    height: number;
}
export interface DragPreviewProps {
    active: boolean;
    grab: DragGrab | null;
    children: React.ReactNode;
    radius?: number;
}
export declare function DragPreview({ active, grab, children, radius }: DragPreviewProps): import("react").ReactPortal | null;
//# sourceMappingURL=DragPreview.d.ts.map