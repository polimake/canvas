/**
 * Arrastrar para reordenar con eventos de puntero, no con el arrastre HTML5.
 *
 * En la app de escritorio (Tauri en Windows, WebView2) el arrastre nativo del
 * navegador no llega a la página: la ventana lo recoge para soltar ficheros
 * (`dragDropEnabled`) y ni `dragover` ni `drop` se disparan, así que reordenar
 * diapositivas o páginas no hacía nada (polimake/desktop#371). Con punteros
 * funciona igual en el navegador, en el escritorio y con el dedo.
 *
 * Se llama desde `onPointerDown` de la pieza. El arrastre no empieza hasta que
 * el puntero se mueve `UMBRAL` px: un clic sigue siendo un clic. Al soltar tras
 * arrastrar, se traga el clic que el navegador manda después, para que soltar
 * no seleccione también. Escape cancela.
 */
export interface PointerDragHandlers {
    /** El puntero ya se ha movido lo bastante: empieza el arrastre. */
    onStart: (x: number, y: number) => void;
    onMove: (x: number, y: number) => void;
    onDrop: (x: number, y: number) => void;
    /** Escape, o el sistema canceló el puntero. */
    onCancel: () => void;
}
export declare function startPointerDrag(e: React.PointerEvent, handlers: PointerDragHandlers): void;
//# sourceMappingURL=pointerDrag.d.ts.map