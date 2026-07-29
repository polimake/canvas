/**
 * Constantes de disposición de páginas.
 *
 * Módulo deliberadamente SIN dependencias: lo importan tanto `pages.ts` (que
 * habla con Excalidraw) como `legacy.ts` (el convertidor, que es puro y se
 * testea en node sin el editor). Si esto viviera en pages.ts, el convertidor
 * arrastraría @excalidraw/excalidraw y dejaría de poder testearse aislado.
 */

/**
 * Separación entre páginas contiguas, en unidades de escena.
 *
 * Estaban a 0 (hojas pegadas, el borde del papel como única separación), pero
 * con varias páginas cuesta ver dónde acaba una y empieza la siguiente, sobre
 * todo si dos seguidas comparten color de fondo. Un carril estrecho las separa
 * sin que dejen de leerse como un documento continuo.
 *
 * Todo lo que coloque páginas —`relayoutPages`, `addPage`, `duplicatePage`,
 * `resizePage` y el convertidor desde el editor legacy— tiene que usar ESTE
 * valor: si cada sitio elige el suyo, las páginas dejan de alinearse.
 */
export const PAGE_GAP = 48;
