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
export declare const EXCALIDRAW_BUILTIN_FAMILIES: readonly string[];
/**
 * Normaliza el nombre tal y como llega del brand kit o del HTML legacy:
 * quita comillas, colapsa espacios y recorta. Dos escrituras distintas del
 * mismo nombre ("'Montserrat'" y "Montserrat") tienen que dar la misma familia.
 */
export declare function normalizeFontName(raw: string): string;
/**
 * Quita los dígitos del nombre de la familia. NO es cosmético.
 *
 * Excalidraw arma la fuente del canvas como `` `${nombre}, Segoe UI Emoji` `` —
 * SIN comillas— y se la asigna a `ctx.font`, que es el atajo CSS `font`. En ese
 * atajo un identificador suelto con una cifra ("Source Sans 3", "Gotham 400")
 * no es un nombre de familia válido: el navegador DESCARTA la declaración
 * entera, el canvas se queda con su `10px sans-serif` por defecto y TODO el
 * texto sale diminuto en gris ignorando su `fontSize`. Se manifiesta como "la
 * fuente no carga", aunque el `@font-face` esté perfecto (ahí sí va entrecomillado).
 *
 * Se quitan por token para no perder el resto del nombre: "Source Sans 3" →
 * "Source Sans", "Archivo2Bold" → "ArchivoBold". Un token que se queda vacío
 * desaparece en lugar de dejar un espacio doble.
 *
 * Se exporta —y no solo se usa desde `fontFamilyAlias`— porque el worker la
 * necesita al SUBIR una tipografía propia: lo que se guarda en el brand kit
 * tiene que ser ya el nombre bueno. Allí no vale `fontFamilyAlias` entero: el
 * sufijo " (marca)" de las colisiones es cosa del registro en Excalidraw, no
 * del nombre que se le enseña al usuario.
 */
export declare function stripFontDigits(name: string): string;
/**
 * Nombre con el que se registra la familia: el suyo sin cifras (ver
 * `stripDigits`), salvo que choque con una de Excalidraw. Función PURA del
 * nombre — el convertidor y el editor la calculan por separado y tienen que
 * coincidir.
 */
export declare function fontFamilyAlias(name: string): string;
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
export declare function customFontFamilyId(name: string): number;
/**
 * Normaliza la URL de un fichero de fuente.
 *
 * Los diseños del editor legacy guardaron unas cuantas con `http://`, y un
 * `@font-face` en http dentro de una página https es contenido mixto: el
 * navegador lo bloquea y el texto se pinta con la de respaldo. Subirlo a https
 * no puede empeorar nada — en http ya no iba a cargar — y arregla el caso real
 * (fonts.gstatic.com, que solo sirve https).
 */
export declare function normalizeFontSrc(src: string): string;
/** `format()` correcto según la extensión: sin él algunos visores lo descartan. */
export declare function fontFormatHint(src: string): string | null;
/**
 * CSS de las `@font-face`. PURA: la usan tanto la inyección en pantalla como el
 * embebido en el SVG exportado, y así las dos declaran exactamente lo mismo.
 */
export declare function buildFontFaceCss(faces: readonly CustomFontFace[], opts?: {
    display?: string;
}): string;
/**
 * Deduplica por familia+peso+estilo conservando la ÚLTIMA declaración, que es
 * la que ganaría en CSS de todos modos. Sin esto, un diseño migrado que repita
 * la misma fuente en veinte páginas emitiría veinte `@font-face` idénticos.
 */
export declare function dedupeFontFaces(faces: readonly CustomFontFace[]): CustomFontFace[];
//# sourceMappingURL=fonts.d.ts.map