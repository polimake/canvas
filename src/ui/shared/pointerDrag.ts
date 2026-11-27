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

const UMBRAL = 5;

export interface PointerDragHandlers {
  /** El puntero ya se ha movido lo bastante: empieza el arrastre. */
  onStart: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  /** Escape, o el sistema canceló el puntero. */
  onCancel: () => void;
}

export function startPointerDrag(e: React.PointerEvent, handlers: PointerDragHandlers): void {
  // Solo el botón principal (o el dedo o el lápiz).
  if (e.button !== 0 || typeof window === 'undefined') return;
  const pointerId = e.pointerId;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let started = false;
  let userSelect = '';

  const finish = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', cancel, true);
    window.removeEventListener('keydown', key, true);
    if (started) document.body.style.userSelect = userSelect;
  };
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (!started) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < UMBRAL) return;
      started = true;
      // Que arrastrar no vaya seleccionando el texto de alrededor.
      userSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      handlers.onStart(x0, y0);
    }
    ev.preventDefault();
    handlers.onMove(ev.clientX, ev.clientY);
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const wasDragging = started;
    finish();
    if (!wasDragging) return;
    // El clic que viene detrás del `pointerup` no es un clic: es el final del arrastre.
    const swallow = (c: MouseEvent) => {
      c.stopPropagation();
      c.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener('click', swallow, true), 0);
    handlers.onDrop(ev.clientX, ev.clientY);
  };
  const cancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const wasDragging = started;
    finish();
    if (wasDragging) handlers.onCancel();
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape' || !started) return;
    ev.preventDefault();
    ev.stopPropagation();
    finish();
    handlers.onCancel();
  };

  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', cancel, true);
  window.addEventListener('keydown', key, true);
}
