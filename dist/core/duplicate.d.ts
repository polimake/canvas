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
export declare function indexDuplicates<T extends {
    readonly id: string;
    readonly index: string | null;
}>(next: readonly T[], prev: readonly T[]): T[];
//# sourceMappingURL=duplicate.d.ts.map