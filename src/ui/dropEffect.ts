/**
 * Qué `dropEffect` puede anunciar una zona de soltar sin anular el arrastre.
 *
 * La regla de HTML5 que muerde: el `dropEffect` que fija el destino tiene que
 * CABER en el `effectAllowed` que fijó el origen en `dragstart`. Si no cabe, el
 * navegador no avisa ni falla — se limita a no emitir `drop`. La zona se ilumina
 * en `dragover`, sueltas, y no pasa nada.
 *
 * Vive aparte para poder probar la regla sin montar Excalidraw.
 */

/** Los valores que `DataTransfer.effectAllowed` puede tomar. */
type EffectAllowed = string | undefined;

/**
 * Devuelve el `dropEffect` compatible para una zona que quiere COPIAR.
 *
 * Copiar es lo que se quiere: soltar un archivo en el lienzo no lo saca de la
 * biblioteca de donde viene. Solo se cede a `move` cuando el origen no admite
 * otra cosa — más vale un cursor con la flecha equivocada que un arrastre que
 * no hace nada.
 *
 * `uninitialized` y `all` admiten todo, así que caen en `copy` por el descarte.
 */
export function copyDropEffect(effectAllowed: EffectAllowed): 'copy' | 'move' {
  return effectAllowed === 'move' || effectAllowed === 'linkMove' ? 'move' : 'copy';
}
