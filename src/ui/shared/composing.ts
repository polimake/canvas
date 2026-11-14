/**
 * A medio componer un carácter (japonés, chino, coreano): el Intro que lo
 * confirma no es el Intro de aceptar.
 */
export function isComposing(e: { nativeEvent: { isComposing: boolean; keyCode: number } }): boolean {
  return e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
}
