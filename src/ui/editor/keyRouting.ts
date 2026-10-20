/**
 * El teclado del lienzo, aunque el foco no esté en el lienzo.
 *
 * Excalidraw solo oye el teclado con el foco DENTRO de su contenedor (el
 * `onKeyDown` de `.excalidraw`; `handleKeyboardGlobally` está apagado). Dos
 * cosas lo dejaban sordo:
 *
 *  - Al abrir un diseño el foco no está en el lienzo: la T (texto), Ctrl+Z o
 *    Supr no hacían nada hasta el primer clic que lo enfocara.
 *  - Tocar la tira de páginas, «+ página» o un botón de un panel deja el foco
 *    en ese botón, y Ctrl+Z ya no deshacía. En Canva sí.
 *
 * Lo que se pulsa fuera del lienzo, dentro del espacio de trabajo (o con el
 * foco en ninguna parte, `body`), se le reenvía al contenedor de Excalidraw:
 * se le da el foco y se le despacha una copia del evento. Nunca se reenvía lo
 * que se escribe en un campo, ni las teclas con las que se maneja el control
 * que tiene el foco (Intro, espacio, flechas, Supr… sobre un botón o una ficha).
 *
 * No se enciende `handleKeyboardGlobally`: con él Excalidraw oiría TODO el
 * documento, también el resto de la app, y el espacio de un botón activaría la
 * mano de mover la vista.
 */

/** Teclas que maneja el control con el foco (un botón, una ficha de la tira). */
const CONTROL_KEYS = new Set([
  'Enter', ' ', 'Spacebar', 'Escape', 'Tab',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Delete', 'Backspace', 'Home', 'End', 'PageUp', 'PageDown',
]);

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/** ¿Se está escribiendo en ese elemento? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'color', 'submit', 'reset', 'file', 'image'].includes(type);
  }
  return (target as HTMLElement).isContentEditable === true;
}

/**
 * ¿Hay que reenviarle esta tecla al lienzo? `canvas` es el contenedor de
 * Excalidraw y `scope` el espacio de trabajo del editor (la tira, los paneles).
 */
export function shouldForwardKey(
  event: KeyboardEvent,
  canvas: Element | null,
  scope: Element | null,
): boolean {
  if (!canvas || event.defaultPrevented || event.isComposing) return false;
  if (MODIFIERS.has(event.key)) return false;
  // Av Pág / Re Pág cambian de página: es el lienzo quien las oye en `window`.
  if (event.key === 'PageUp' || event.key === 'PageDown') return false;
  const target = event.target;
  const doc = canvas.ownerDocument;
  const nowhere = target === doc.body || target === doc.documentElement || target === doc || target === doc.defaultView;
  if (!nowhere) {
    if (!(target instanceof Node)) return false;
    // Dentro del lienzo ya lo oye Excalidraw (y su editor de texto también).
    if (canvas.contains(target)) return false;
    if (!scope || !scope.contains(target)) return false;
  }
  if (isTypingTarget(target)) return false;
  if (event.key === 'Tab') return false;
  // Sobre un control, las teclas de manejarlo son suyas; con Ctrl/Cmd ya no.
  if (!nowhere && CONTROL_KEYS.has(event.key) && !event.ctrlKey && !event.metaKey) return false;
  return true;
}

/** Le da el foco al lienzo y le despacha una copia de `event`. */
export function forwardKey(event: KeyboardEvent, canvas: HTMLElement): void {
  const doc = canvas.ownerDocument;
  const View = doc.defaultView?.KeyboardEvent ?? KeyboardEvent;
  const copy = new View('keydown', {
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    bubbles: true,
    cancelable: true,
  });
  canvas.focus({ preventScroll: true });
  // La copia tiene que subir hasta la raíz de React (que es quien reparte el
  // `onKeyDown` de Excalidraw) pero no llegar a los atajos de la app que
  // escuchan en `document` o `window`: esos ya han recibido el original.
  const body = doc.body;
  const stop = (e: Event) => {
    if (e === copy) e.stopImmediatePropagation();
  };
  body?.addEventListener('keydown', stop);
  try {
    canvas.dispatchEvent(copy);
  } finally {
    body?.removeEventListener('keydown', stop);
  }
  if (copy.defaultPrevented) event.preventDefault();
}

/**
 * Instala el reenvío en `win`. `getCanvas` y `getScope` se leen en cada tecla:
 * el contenedor de Excalidraw aparece después de montar.
 */
export function installKeyRouting(
  win: Window,
  getCanvas: () => HTMLElement | null,
  getScope: () => Element | null,
): () => void {
  const onKey = (event: KeyboardEvent) => {
    const canvas = getCanvas();
    if (!canvas || !shouldForwardKey(event, canvas, getScope())) return;
    forwardKey(event, canvas);
  };
  win.addEventListener('keydown', onKey);
  return () => win.removeEventListener('keydown', onKey);
}
