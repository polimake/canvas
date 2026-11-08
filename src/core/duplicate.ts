/**
 * Índice fraccionario propio para lo que acaba de nacer de un duplicado.
 *
 * El Ctrl+D de Excalidraw 0.18.1 (`actionDuplicateSelection`) copia cada
 * elemento con `duplicateElement`, que le da id nuevo pero le deja el `index`,
 * la versión y el `versionNonce` del original, y mete la copia justo detrás de
 * él SIN pasar por `syncMovedIndices` (pegar y Alt+arrastrar sí pasan). Confía
 * en que `Scene.replaceAllElements` lo arregle con `syncInvalidIndices`... pero
 * antes de eso llama a `validateIndicesThrottled`, que en la build de
 * desarrollo de Excalidraw (la del dev y la del banco del lienzo) LANZA ante
 * dos índices iguales. Está estrangulado a una vez por minuto, así que casi
 * siempre se lo salta y el fallo sale al azar: el Ctrl+D que cae en esa ventana
 * escribe «Fractional indices invariant has been compromised» y no duplica nada.
 *
 * Excalidraw da la salida: llama a `onDuplicate(siguientes, anteriores)` antes
 * de devolver la escena. Aquí cada elemento nuevo (id que no estaba) que no
 * quepa entre sus vecinos recibe una clave entre el de antes y el de después,
 * con el mismo formato de `fractional-indexing` (la parte entera del de antes y
 * una fracción más larga en base 62). Lo que ya estaba no se toca, y una copia
 * cuyo índice ya vale (Alt+arrastrar deja la copia en el hueco del original)
 * tampoco.
 */
export function indexDuplicates<T extends { readonly id: string; readonly index: string | null }>(
  next: readonly T[],
  prev: readonly T[],
): T[] {
  const before = new Set(prev.map((el) => el.id));
  const out = next.slice();
  for (let i = 0; i < out.length; i++) {
    const el = out[i];
    if (before.has(el.id)) continue;
    const lower = out[i - 1]?.index ?? null;
    // Sin vecino de abajo con índice no hay de dónde partir: lo deja para el
    // `syncInvalidIndices` de Excalidraw (una copia siempre va detrás de algo).
    if (lower === null) continue;
    // El techo es el siguiente que YA estaba (las otras copias de la tanda
    // aún llevan el índice heredado), y solo si va por encima: si no, también
    // está mal (lo que Alt+arrastrar manda al final) y lo recoloca el
    // `syncMovedIndices` que Excalidraw corre detrás.
    let j = i + 1;
    while (j < out.length && !before.has(out[j].id)) j++;
    const following = out[j]?.index ?? null;
    const upper = following !== null && following > lower ? following : null;
    const index = el.index;
    if (index && lower < index && (upper === null || index < upper)) continue;
    out[i] = { ...el, index: keyAfter(lower, upper) } as T;
  }
  return out;
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Una clave `k` con `lower < k < upper` (o `lower < k` sin `upper`): `lower`
 * más una fracción. Vale como clave de `fractional-indexing` porque alarga la
 * fracción de `lower` sin acabar en `0`.
 */
function keyAfter(lower: string, upper: string | null): string {
  // Si `upper` no empieza por `lower`, cualquier cola sirve: difieren antes.
  const tail = upper !== null && upper.startsWith(lower) ? upper.slice(lower.length) : null;
  return lower + midpoint('', tail);
}

/**
 * El punto medio en base 62 entre dos fracciones (`b` nula = sin techo), como
 * `midpoint` de `fractional-indexing`: nunca acaba en `0`.
 */
function midpoint(a: string, b: string | null): string {
  const zero = DIGITS[0];
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? zero) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round(0.5 * (digitA + digitB))];
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}
