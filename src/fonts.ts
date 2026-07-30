/**
 * Tipografías propias en Excalidraw: registrar una familia NUEVA en vez de
 * secuestrar una de las suyas.
 *
 * LO QUE SE CREÍA Y POR QUÉ ERA FALSO
 *
 * Hasta ahora este paquete daba por imposible registrar una fuente porque
 * `Fonts.register` es `private static` y la clase `Fonts` no se exporta del
 * paquete npm. Es cierto, pero `Fonts.register` NO es el mecanismo que decide
 * con qué tipografía se pinta un texto. El que decide es:
 *
 *   getFontFamilyString({fontFamily}) →
 *     for (const [nombre, id] of Object.entries(FONT_FAMILY))
 *       if (id === fontFamily) return `${nombre}, Segoe UI Emoji`;
 *     return 'Segoe UI Emoji';
 *
 * y ese `FONT_FAMILY` es un objeto JS corriente que el paquete SÍ exporta desde
 * su índice público (por eso `excal.ts` puede reexportarlo), no está congelado,
 * y se lee entero en cada llamada. Añadirle una entrada basta para que
 * un id numérico nuevo se resuelva a un nombre de familia nuestro; el navegador
 * hace el resto en cuanto exista un `@font-face` con ese nombre.
 *
 * Lo que `Fonts.register` aporta de más es la METADATA (métricas verticales y
 * el icono del selector). Sin ella:
 *   · `getLineHeight()`  → cae a las métricas de Excalifont (1.25). Irrelevante:
 *      todos nuestros textos llevan `lineHeight` explícito.
 *   · `getVerticalOffset()` → cae a las de Virgil (unitsPerEm 1000, ascender
 *      886). Desplaza la línea base unas décimas de em frente a las métricas
 *      reales de la fuente. Es una aproximación acotada y uniforme, no un fallo.
 *   · el selector de fuentes de Excalidraw no lista nuestras familias. Es lo
 *      correcto: quien elige la tipografía de marca es el panel de canvas2, no
 *      la lista de fuentes dibujadas a mano de Excalidraw.
 * Nada de eso rompe: `FontPickerList` filtra por `Fonts.registered`, así que una
 * familia desconocida simplemente no aparece, y `restoreElement` deja pasar el
 * `fontFamily` sin normalizarlo, así que el id sobrevive a guardar y reabrir.
 *
 * Y lo que sí funciona sin tocar nada: `Fonts.loadSceneFonts()` recorre los
 * `fontFamily` que USA la escena (no los registrados), construye la cadena con
 * `getFontFamilyString` — que ya resuelve la nuestra — y llama a
 * `document.fonts.load(...)`. O sea: Excalidraw carga nuestra fuente y
 * reinvalida las formas él solo. Sin ese detalle habría que forzar el
 * repintado a mano, porque un canvas 2D NO dispara la carga diferida de un
 * `@font-face` declarado en CSS.
 *
 * ESTE MÓDULO ES PURO a propósito (no importa `./excal`): lo necesitan tanto el
 * editor como el convertidor `legacy.ts`, que corre en node dentro de los
 * scripts de migración. Los dos tienen que calcular EL MISMO id para el mismo
 * nombre de fuente o un diseño migrado se abriría con la tipografía de
 * respaldo. La escritura en `FONT_FAMILY` — lo único que necesita Excalidraw
 * delante — vive en `fontRegistry.ts`.
 */

/** Una fuente propia: nombre de familia CSS y de dónde bajar el fichero. */
export interface CustomFontFace {
  /** Nombre de familia con el que se declara el `@font-face` (ya normalizado). */
  family: string;
  /** URL del woff2/woff/otf/ttf, o un data URI ya resuelto. */
  src: string;
  weight?: string;
  style?: string;
}

/**
 * Las familias que Excalidraw 0.18 trae de serie, incluidos los dos respaldos.
 *
 * Se duplica aquí el conjunto de NOMBRES (no los ids: los ids no hacen falta y
 * son lo que sí podría cambiar) para poder detectar colisiones sin importar
 * Excalidraw, que es lo que mantiene puro este módulo. `__tests__/fonts.test.ts`
 * compara esta lista contra el `.d.ts` que se instala en `node_modules`, así
 * que una subida de versión que añada o quite familias rompe el build en vez de
 * degradar en silencio.
 */
export const EXCALIDRAW_BUILTIN_FAMILIES: readonly string[] = [
  'Virgil',
  'Helvetica',
  'Cascadia',
  'Excalifont',
  'Nunito',
  'Lilita One',
  'Comic Shanns',
  'Liberation Sans',
  // FONT_FAMILY_FALLBACKS
  'Xiaolai',
  'Segoe UI Emoji',
];

const BUILTIN = new Set(EXCALIDRAW_BUILTIN_FAMILIES.map((f) => f.toLowerCase()));

/**
 * Sufijo para una fuente de marca que se llame igual que una de Excalidraw.
 *
 * Si el brand kit trae "Nunito" con su propio fichero, NO se puede registrar
 * bajo ese nombre: `FONT_FAMILY.Nunito` ya existe y sobrescribirlo dejaría la
 * Nunito de serie inalcanzable para cualquier diseño que la usara. Se registra
 * como "Nunito (marca)" y se declara el `@font-face` con ese nombre. Visualmente
 * es la misma tipografía — es el fichero del cliente — y las dos conviven.
 */
const ALIAS_SUFFIX = ' (marca)';

/** Rango reservado para nuestras familias.
 *
 * Excalidraw usa 1..9 para las suyas (con el 4 muerto por historia), 100 para
 * Xiaolai y 1000 para el emoji de Windows. Empezar en 10_000 deja sitio de
 * sobra a que añadan familias y respaldos nuevos sin pisarnos.
 */
const ID_MIN = 10_000;
const ID_MAX = 1_000_000;

/**
 * Normaliza el nombre tal y como llega del brand kit o del HTML legacy:
 * quita comillas, colapsa espacios y recorta. Dos escrituras distintas del
 * mismo nombre ("'Montserrat'" y "Montserrat") tienen que dar la misma familia.
 */
export function normalizeFontName(raw: string): string {
  // El recorte va ANTES de quitar comillas: con `  'Inter'  ` los anclajes ^ y
  // $ caen sobre los espacios y las comillas se quedaban dentro del nombre.
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombre con el que se registra la familia: el suyo, salvo que choque con una
 * de Excalidraw. Función PURA del nombre — el convertidor y el editor la
 * calculan por separado y tienen que coincidir.
 */
export function fontFamilyAlias(name: string): string {
  const limpio = normalizeFontName(name);
  if (!limpio) return '';
  return BUILTIN.has(limpio.toLowerCase()) ? `${limpio}${ALIAS_SUFFIX}` : limpio;
}

/**
 * Id numérico de una familia propia, derivado SOLO de su nombre.
 *
 * Es determinista a propósito y no un contador: el id se guarda dentro de cada
 * elemento de texto de la escena, así que tiene que salir igual en el script de
 * migración (node, hoy) y en el editor (navegador, dentro de dos años). Un
 * contador daría un id distinto según el orden de registro y los diseños
 * guardados se abrirían con la tipografía de respaldo.
 *
 * FNV-1a de 32 bits plegado al rango reservado. Dos nombres distintos pueden
 * colisionar (1 entre ~990.000); el efecto sería que, en una escena que use las
 * dos, una se pinta con la otra. `fontRegistry.ts` lo detecta al registrar.
 */
export function customFontFamilyId(name: string): number {
  const alias = fontFamilyAlias(name);
  if (!alias) return 0;
  let hash = 2166136261;
  for (let i = 0; i < alias.length; i += 1) {
    hash ^= alias.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ID_MIN + ((hash >>> 0) % (ID_MAX - ID_MIN));
}

/**
 * Normaliza la URL de un fichero de fuente.
 *
 * Los diseños del editor legacy guardaron unas cuantas con `http://`, y un
 * `@font-face` en http dentro de una página https es contenido mixto: el
 * navegador lo bloquea y el texto se pinta con la de respaldo. Subirlo a https
 * no puede empeorar nada — en http ya no iba a cargar — y arregla el caso real
 * (fonts.gstatic.com, que solo sirve https).
 */
export function normalizeFontSrc(src: string): string {
  const limpio = src.trim();
  return limpio.startsWith('http://') ? `https://${limpio.slice('http://'.length)}` : limpio;
}

/** `format()` correcto según la extensión: sin él algunos visores lo descartan. */
export function fontFormatHint(src: string): string | null {
  const limpio = src.split('?')[0].toLowerCase();
  if (limpio.endsWith('.woff2')) return 'woff2';
  if (limpio.endsWith('.woff')) return 'woff';
  if (limpio.endsWith('.otf')) return 'opentype';
  if (limpio.endsWith('.ttf')) return 'truetype';
  // Un data URI trae el tipo dentro; dejar `format()` fuera es mejor que mentir.
  return null;
}

/**
 * CSS de las `@font-face`. PURA: la usan tanto la inyección en pantalla como el
 * embebido en el SVG exportado, y así las dos declaran exactamente lo mismo.
 */
export function buildFontFaceCss(
  faces: readonly CustomFontFace[],
  opts?: { display?: string },
): string {
  return faces
    .filter((f) => f.family && f.src)
    .map((f) => {
      const hint = fontFormatHint(f.src);
      const src = hint ? `url("${f.src}") format("${hint}")` : `url("${f.src}")`;
      return (
        `@font-face{font-family:"${f.family}";src:${src};` +
        `font-weight:${f.weight ?? 'normal'};font-style:${f.style ?? 'normal'};` +
        (opts?.display ? `font-display:${opts.display};` : '') +
        '}'
      );
    })
    .join('\n');
}

/**
 * Deduplica por familia+peso+estilo conservando la ÚLTIMA declaración, que es
 * la que ganaría en CSS de todos modos. Sin esto, un diseño migrado que repita
 * la misma fuente en veinte páginas emitiría veinte `@font-face` idénticos.
 */
export function dedupeFontFaces(faces: readonly CustomFontFace[]): CustomFontFace[] {
  const porClave = new Map<string, CustomFontFace>();
  for (const f of faces) {
    if (!f.family || !f.src) continue;
    porClave.set(`${f.family}|${f.weight ?? 'normal'}|${f.style ?? 'normal'}`, f);
  }
  return [...porClave.values()];
}
