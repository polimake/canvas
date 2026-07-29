/**
 * Traduce el brand kit de un proyecto a lo que canvas2 sabe consumir.
 *
 * Módulo PURO a propósito: no importa nada de Excalidraw (ni siquiera un tipo),
 * así que se puede probar en node sin montar el editor. La consecuencia de
 * diseño es que aquí no se resuelven los IDS numéricos de familia tipográfica —
 * se devuelven NOMBRES de familia y es `Canvas2Editor`, que ya vive del lado de
 * Excalidraw, quien los convierte con el `FONT_FAMILY` real. Así la tabla de
 * constantes existe una sola vez y no puede desincronizarse.
 *
 * El brand kit llega tal cual sale de la base de datos (`projects.brandKit`, un
 * blob JSON sin esquema), así que todo se valida aquí y lo que no encaja se
 * reporta en `notes` en vez de romper o de colarse silenciosamente.
 */

/** Forma laxa de `projects.brandKit`. Todo opcional: 12 de 21 proyectos no lo tienen. */
export interface BrandKitInput {
  mainColor?: unknown;
  colorPalette?: unknown;
  headingFont?: unknown;
  bodyFont?: unknown;
  smallLogo?: unknown;
  logoBlack?: unknown;
  logoWhite?: unknown;
}

export interface BrandFontFace {
  /** Familia de Excalidraw que se secuestra. */
  family: string;
  src: string;
  weight?: string;
  style?: string;
}

export interface Canvas2Brand {
  mainColor: string | null;
  /** Paleta deduplicada, con `mainColor` al frente si es válido. */
  palette: string[];
  /** Familia secuestrada para titulares, o null si la marca no aporta fichero. */
  headingFamily: string | null;
  /** Familia secuestrada para texto corrido, o null. */
  bodyFamily: string | null;
  /** Listo para la prop `fontOverrides` de Canvas2Editor. */
  fontOverrides: BrandFontFace[];
  logos: { small: string | null; black: string | null; white: string | null };
  /** Lo que se ha descartado y por qué. Se enseña en la UI, no se traga. */
  notes: string[];
}

/**
 * Familias de Excalidraw que se secuestran, una por rol.
 *
 * Se eligen éstas y no otras por dos motivos. Primero, son nombres propios de
 * Excalidraw: ninguna hoja de estilo de la aplicación los usa, así que el
 * `@font-face` que los declara no puede filtrarse al resto de la interfaz —
 * cosa que sí pasaría secuestrando 'Helvetica'. Segundo, no son la familia a la
 * que `legacy.ts` manda todo el texto migrado (la 2, Helvetica), así que
 * secuestrarlas no reescribe de golpe los 491 diseños ya convertidos.
 *
 * Contrapartida honesta: el selector de fuentes de Excalidraw 0.18 sí las
 * ofrece. Quien elija a mano "Lilita One" verá la tipografía de titular de la
 * marca. Es reversible y, en una herramienta de marca, preferible a lo
 * contrario.
 */
export const HIJACKED_FAMILIES = {
  heading: 'Lilita One',
  body: 'Comic Shanns',
} as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Un color solo entra si es hex válido: Excalidraw pinta en negro lo que no entiende. */
function color(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return HEX.test(v) ? v.toLowerCase() : null;
}

/** Solo http(s): un `blob:` o un `data:` heredado no sobrevive a la recarga. */
function url(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

interface FuenteNormalizada {
  name: string;
  src: string | null;
  style?: string;
}

/**
 * El brand kit guarda la fuente de dos formas según la antigüedad del proyecto:
 * una cadena suelta ("Montserrat") o un objeto {name, family, style, url}.
 * Hoy el `url` viene vacío en TODOS los proyectos de producción, así que el
 * caso normal es "sé el nombre pero no tengo el fichero".
 */
function fuente(value: unknown): FuenteNormalizada | null {
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name, src: null } : null;
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : null;
    const family = typeof o.family === 'string' && o.family.trim() ? o.family.trim() : null;
    const etiqueta = name ?? family;
    if (!etiqueta) return null;
    return {
      name: etiqueta,
      src: url(o.url),
      style: typeof o.style === 'string' && o.style !== 'regular' ? o.style : undefined,
    };
  }
  return null;
}

/** Vacío pero utilizable: evita que cada consumidor tenga que comprobar null. */
export const EMPTY_BRAND: Canvas2Brand = {
  mainColor: null,
  palette: [],
  headingFamily: null,
  bodyFamily: null,
  fontOverrides: [],
  logos: { small: null, black: null, white: null },
  notes: [],
};

export function resolveBrandKit(raw: unknown): Canvas2Brand {
  if (!raw || typeof raw !== 'object') return EMPTY_BRAND;
  const bk = raw as BrandKitInput;
  const notes: string[] = [];

  const mainColor = color(bk.mainColor);
  if (bk.mainColor && !mainColor) notes.push(`color principal descartado: "${String(bk.mainColor)}" no es hex`);

  const palette: string[] = [];
  const push = (c: string | null) => {
    if (c && !palette.includes(c)) palette.push(c);
  };
  push(mainColor);
  if (Array.isArray(bk.colorPalette)) {
    for (const c of bk.colorPalette) {
      const parsed = color(c);
      if (parsed) push(parsed);
      else if (c) notes.push(`color de paleta descartado: "${String(c)}" no es hex`);
    }
  }

  const fontOverrides: BrandFontFace[] = [];
  let headingFamily: string | null = null;
  let bodyFamily: string | null = null;

  for (const [rol, valor] of [
    ['heading', bk.headingFont],
    ['body', bk.bodyFont],
  ] as const) {
    const f = fuente(valor);
    if (!f) continue;
    if (!f.src) {
      // El caso mayoritario hoy. No es un error: es un dato que falta, y decirlo
      // es lo que permite arreglarlo desde el brand kit en vez de suponer que
      // canvas2 "no soporta fuentes".
      notes.push(`"${f.name}" (${rol === 'heading' ? 'titulares' : 'texto'}) no tiene fichero en el brand kit; se usa la tipografía por defecto`);
      continue;
    }
    const family = HIJACKED_FAMILIES[rol];
    fontOverrides.push({ family, src: f.src, style: f.style });
    if (rol === 'heading') headingFamily = family;
    else bodyFamily = family;
  }

  return {
    mainColor,
    palette,
    headingFamily,
    bodyFamily,
    fontOverrides,
    logos: { small: url(bk.smallLogo), black: url(bk.logoBlack), white: url(bk.logoWhite) },
    notes,
  };
}
