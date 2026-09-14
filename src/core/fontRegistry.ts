/**
 * El único sitio que ESCRIBE en `FONT_FAMILY` de Excalidraw.
 *
 * Separado de `fonts.ts` porque aquél tiene que seguir siendo puro (lo importa
 * el convertidor `legacy.ts`, que corre en node). Aquí ya se toca Excalidraw,
 * aunque sea a través del adaptador `./excal`.
 *
 * El porqué de todo el mecanismo está en la cabecera de `fonts.ts`.
 */
import { FONT_FAMILY } from './excal';
import { customFontFamilyId, fontFamilyAlias, type CustomFontFace } from './fonts';

/** Familias que ya hemos dado de alta, para no repetir trabajo ni avisos. */
const registradas = new Map<string, number>();

export interface RegisteredFont {
  /** Nombre con el que se declara el `@font-face` (ver `fontFamilyAlias`). */
  alias: string;
  /** Id que va en `element.fontFamily`. */
  id: number;
}

/**
 * Da de alta una familia propia y devuelve el id con el que hay que marcar los
 * textos. Idempotente.
 *
 * Devuelve `null` si el nombre está vacío o si su id ya lo ocupa OTRA familia
 * (colisión de hash, ver `customFontFamilyId`): en ese caso es preferible que
 * el texto se pinte con la fuente de respaldo y quede un aviso en consola, a
 * que se pinte con la tipografía equivocada de otra marca sin decir nada.
 */
export function registerCustomFont(name: string): RegisteredFont | null {
  const alias = fontFamilyAlias(name);
  if (!alias) return null;

  const yaEsta = registradas.get(alias);
  if (yaEsta !== undefined) return { alias, id: yaEsta };

  const id = customFontFamilyId(alias);
  const tabla = FONT_FAMILY as unknown as Record<string, number>;

  const ocupante = Object.entries(tabla).find(([, valor]) => valor === id)?.[0];
  if (ocupante !== undefined && ocupante !== alias) {
    console.error(
      `[canvas2] la tipografía "${alias}" colisiona con "${ocupante}" (id ${id}); ` +
        'se usará la fuente por defecto. Renombra la familia en el brand kit.',
    );
    return null;
  }

  tabla[alias] = id;
  registradas.set(alias, id);
  return { alias, id };
}

/**
 * Registra un lote y devuelve las caras que de verdad se pueden declarar, ya
 * con el alias por familia. Lo que no se pudo registrar se cae fuera.
 */
export function registerCustomFonts(
  faces: readonly CustomFontFace[],
): { faces: CustomFontFace[]; ids: Map<string, number> } {
  const ids = new Map<string, number>();
  const salida: CustomFontFace[] = [];
  for (const face of faces) {
    const reg = registerCustomFont(face.family);
    if (!reg) continue;
    ids.set(reg.alias, reg.id);
    salida.push({ ...face, family: reg.alias });
  }
  return { faces: salida, ids };
}

/**
 * Id de una familia YA registrada (o de una de serie de Excalidraw), sin darla
 * de alta. Lo usan los presets de texto para nacer en la tipografía de marca.
 */
export function fontFamilyId(name: string): number | null {
  const alias = fontFamilyAlias(name);
  const tabla = FONT_FAMILY as unknown as Record<string, number>;
  return tabla[alias] ?? tabla[name] ?? null;
}

/** Solo para tests: olvida lo registrado en este proceso. */
export function resetFontRegistry(): void {
  registradas.clear();
}
