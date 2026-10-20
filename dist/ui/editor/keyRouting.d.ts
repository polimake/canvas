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
/** ¿Se está escribiendo en ese elemento? */
export declare function isTypingTarget(target: EventTarget | null): boolean;
/**
 * ¿Hay que reenviarle esta tecla al lienzo? `canvas` es el contenedor de
 * Excalidraw y `scope` el espacio de trabajo del editor (la tira, los paneles).
 */
export declare function shouldForwardKey(event: KeyboardEvent, canvas: Element | null, scope: Element | null): boolean;
/** Le da el foco al lienzo y le despacha una copia de `event`. */
export declare function forwardKey(event: KeyboardEvent, canvas: HTMLElement): void;
/**
 * Instala el reenvío en `win`. `getCanvas` y `getScope` se leen en cada tecla:
 * el contenedor de Excalidraw aparece después de montar.
 */
export declare function installKeyRouting(win: Window, getCanvas: () => HTMLElement | null, getScope: () => Element | null): () => void;
//# sourceMappingURL=keyRouting.d.ts.map