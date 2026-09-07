import type { SceneElement } from './excal';
import { type CustomFontFace } from './fonts';
/**
 * Conversión Photoshop (.psd/.psb) → escena de Excalidraw.
 *
 * Hermano de `legacy.ts` y con sus mismas reglas, que no son estilísticas:
 *
 *   PURO      Aquí NO se importa `ag-psd` ni `@excalidraw/*` (solo el tipo, vía
 *             ./excal). La entrada es la forma ESTRUCTURAL de un documento ya
 *             parseado —las interfaces `Psd*` de abajo son un calco del modelo
 *             de ag-psd, no un import suyo—, así que el módulo se testea en node
 *             con objetos a mano y no arrastra el lector de PSD al bundle del
 *             navegador. Quien lee bytes es `scripts/import-psd.ts`.
 *
 *   SIN DOM   Nada de canvas, Image ni measureText. Las medidas salen de lo que
 *             el PSD ya trae calculado (bbox de capa, bbox de texto, matriz de
 *             transformación), no de re-medir.
 *
 *   SIN BYTES Ninguna capa rasterizada entra en la escena como base64: la regla
 *             de `media.ts` lo prohíbe y aquí se respeta por construcción. Cada
 *             capa de píxeles se convierte en un PLACEHOLDER con la geometría y
 *             la proporción EXACTAS del original, y se anota en `assets` para
 *             que el llamante suba los píxeles a MediaMonster y los cambie
 *             después con {@link listImagePlaceholders}.
 *
 * EL OBJETIVO es no perder nada en silencio. Todo lo que Photoshop sabe y
 * Excalidraw no puede representar (modos de fusión, máscaras, degradados,
 * sombras, capas de ajuste) se convierte a lo más parecido que haya y se APUNTA
 * en `report.notes`. Una capa que desaparece sin nota es un bug de este módulo.
 */
/** Valor con unidades de Photoshop (`{units:'Pixels', value:12}`). */
export interface PsdUnits {
    units?: string;
    value?: number;
}
/**
 * El color de Photoshop llega en el espacio en el que se guardó. Ninguna clave
 * es obligatoria porque la unión de ag-psd (RGB | FRGB | CMYK | LAB | Grayscale
 * | HSB) se aplana aquí en un solo objeto laxo: `toHex` decide por presencia.
 */
export interface PsdColor {
    r?: number;
    g?: number;
    b?: number;
    a?: number;
    fr?: number;
    fg?: number;
    fb?: number;
    c?: number;
    m?: number;
    y?: number;
    k?: number;
    l?: number;
    h?: number;
    s?: number;
}
export interface PsdUnitsBounds {
    top?: PsdUnits;
    left?: PsdUnits;
    right?: PsdUnits;
    bottom?: PsdUnits;
}
export interface PsdTextStyle {
    font?: {
        name?: string;
    };
    fontSize?: number;
    fauxBold?: boolean;
    fauxItalic?: boolean;
    autoLeading?: boolean;
    leading?: number;
    tracking?: number;
    fillColor?: PsdColor;
    underline?: boolean;
    strikethrough?: boolean;
}
export interface PsdParagraphStyle {
    justification?: string;
}
export interface PsdText {
    text?: string;
    /** `[xx, xy, yx, yy, tx, ty]`. Lleva la escala real del texto. */
    transform?: number[];
    style?: PsdTextStyle;
    styleRuns?: Array<{
        length?: number;
        style?: PsdTextStyle;
    }>;
    paragraphStyle?: PsdParagraphStyle;
    paragraphStyleRuns?: Array<{
        length?: number;
        style?: PsdParagraphStyle;
    }>;
    shapeType?: 'point' | 'box';
    /** `[left, top, right, bottom]` relativo al origen de `transform`. */
    boxBounds?: number[];
    bounds?: PsdUnitsBounds;
    boundingBox?: PsdUnitsBounds;
}
export interface PsdBezierPath {
    open?: boolean;
    operation?: string;
    fillRule?: string;
    /** `points` = `[cp1x, cp1y, anchorX, anchorY, cp2x, cp2y]`, YA en píxeles. */
    knots?: Array<{
        linked?: boolean;
        points?: number[];
    }>;
}
/**
 * Un efecto de capa. Las dos banderas importan por igual y ninguna basta sola.
 *
 * Photoshop guarda TODOS los efectos de una capa en cuanto se abre su diálogo
 * de estilo, aunque no se marque ninguno: quedan con `present:false` (nunca se
 * activó) o `enabled:false` (se activó y luego se apagó). Mirar solo si el
 * array existe hacía que una capa cualquiera saliera con ocho avisos de
 * "efectos no representables" que no tenía, y eso tapa los avisos de verdad.
 */
export interface PsdEffect {
    present?: boolean;
    enabled?: boolean;
}
export interface PsdVectorContent {
    type?: string;
    color?: PsdColor;
    /** Degradado: se lee la primera parada para no dejar la forma sin color. */
    gradient?: {
        colorStops?: Array<{
            color?: PsdColor;
            location?: number;
        }>;
    };
}
export interface PsdLayer {
    id?: number;
    name?: string;
    hidden?: boolean;
    /** 0..1 en ag-psd, no 0..100. */
    opacity?: number;
    fillOpacity?: number;
    blendMode?: string;
    clipping?: boolean;
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
    children?: PsdLayer[];
    text?: PsdText;
    vectorFill?: PsdVectorContent;
    vectorStroke?: {
        strokeEnabled?: boolean;
        fillEnabled?: boolean;
        lineWidth?: PsdUnits;
        lineDashSet?: PsdUnits[];
        content?: PsdVectorContent;
    };
    vectorMask?: {
        disable?: boolean;
        paths?: PsdBezierPath[];
    };
    vectorOrigination?: {
        keyDescriptorList?: Array<{
            keyOriginType?: number;
            keyOriginShapeBoundingBox?: PsdUnitsBounds;
            keyOriginRRectRadii?: {
                topLeft?: PsdUnits;
                topRight?: PsdUnits;
                bottomLeft?: PsdUnits;
                bottomRight?: PsdUnits;
            };
        }>;
    };
    effects?: {
        disabled?: boolean;
        dropShadow?: PsdEffect[];
        innerShadow?: PsdEffect[];
        outerGlow?: PsdEffect;
        innerGlow?: PsdEffect;
        bevel?: PsdEffect;
        satin?: PsdEffect;
        patternOverlay?: PsdEffect;
        gradientOverlay?: PsdEffect[];
        solidFill?: Array<PsdEffect & {
            color?: PsdColor;
            opacity?: number;
        }>;
        stroke?: Array<PsdEffect & {
            size?: PsdUnits;
            color?: PsdColor;
            position?: string;
        }>;
    };
    mask?: {
        disabled?: boolean;
        top?: number;
        left?: number;
        bottom?: number;
        right?: number;
    };
    adjustment?: {
        type?: string;
    } & Record<string, unknown>;
    placedLayer?: {
        type?: string;
        name?: string;
    };
    artboard?: {
        rect?: {
            top?: number;
            left?: number;
            bottom?: number;
            right?: number;
        };
        presetName?: string;
        color?: PsdColor;
        backgroundType?: number;
    };
    /** Presencia = la capa tiene píxeles propios. No se leen nunca aquí. */
    imageData?: unknown;
    canvas?: unknown;
    sectionDivider?: {
        type?: number;
    };
}
export interface PsdDocument {
    width?: number;
    height?: number;
    children?: PsdLayer[];
    imageData?: unknown;
    canvas?: unknown;
}
/** Marcador de `customData.c2` de un hueco de imagen. Ver la cabecera. */
export declare const PSD_IMAGE_MARKER = "psdImage";
/**
 * Una capa de píxeles del PSD que la escena representa con un placeholder.
 *
 * `address` es el camino de índices desde `psd.children` hasta la capa, y es lo
 * que permite al script CLI volver a por sus píxeles sin que este módulo los
 * haya tocado: `psd.children[a][b]…`.
 */
export interface PsdAssetSlot {
    /** Id del elemento placeholder en la escena. Es la llave del intercambio. */
    id: string;
    name: string;
    page: number;
    /** Ruta de grupos hasta la capa, para nombrar el fichero de forma legible. */
    path: string[];
    /** Tamaño natural en píxeles del PSD (antes de `scale`). */
    naturalWidth: number;
    naturalHeight: number;
    /** Nombre de fichero sugerido, ya saneado y único dentro de la conversión. */
    filename: string;
    address: number[];
}
export interface PsdNote {
    page: number;
    layer: string;
    /** 'dropped' = no se pudo representar; 'lossy' = se representa distinto. */
    kind: 'dropped' | 'lossy';
    detail: string;
}
export type PsdTier = 'T1' | 'T2' | 'T3';
export interface PsdReport {
    /** Tamaño del documento tal y como venía, antes de `scale`. */
    document: {
        width: number;
        height: number;
        scale: number;
    };
    pages: number;
    tier: PsdTier;
    /**
     * Recuento de CAPAS, una capa una unidad. Los elementos van aparte porque una
     * capa puede dar varios —un texto de estilos mixtos, una forma de varios
     * subcaminos— y mezclarlos hacía que "convertidas" superara a "vistas".
     *
     * Un grupo cuenta como convertido si su contenido produjo algo; si no, no
     * suma en ningún cajón, porque sus hijos ya están contados en el suyo.
     */
    layers: {
        total: number;
        converted: number;
        hidden: number;
        dropped: number;
    };
    /** Elementos de Excalidraw que produjo la conversión, marcos y papeles aparte. */
    elements: number;
    /** Cuántas capas de cada clase se vieron (`text`, `shape`, `image`…). */
    counts: Record<string, number>;
    /** Tipografías que el diseño nombra y si se les encontró fichero. */
    fonts: Array<{
        name: string;
        resolved: boolean;
    }>;
    notes: PsdNote[];
    clean: boolean;
}
export interface PsdScene {
    elements: SceneElement[];
    /** Siempre vacío hoy: sin bytes no hay ficheros. Está por simetría con `legacy.ts`. */
    files: Record<string, unknown>;
    fonts: CustomFontFace[];
    assets: PsdAssetSlot[];
    report: PsdReport;
}
/** Fichero de una tipografía, venga de donde venga (mismo contrato que legacy). */
export interface PsdFontSource {
    url: string;
    /**
     * Sufijo de estilo ("Bold", "BoldItalic"). Si no se da, se usa el que trae el
     * nombre PostScript del PSD. Se traduce a CSS con `postScriptStyleToCss`.
     */
    style?: string;
    /** `font-weight` ya en CSS, si quien resuelve el fichero lo sabe mejor. */
    weight?: string;
}
export interface PsdImportOptions {
    /**
     * Último recurso para una fuente que el PSD nombra. Un PSD guarda el nombre
     * PostScript de la tipografía ("Montserrat-Bold") pero NUNCA el fichero, así
     * que sin esto todo el texto cae a la familia de respaldo. Se inyecta —igual
     * que en `legacy.ts`— para que el módulo siga siendo puro: el CLI lo cablea
     * al brand kit del proyecto, los tests a un mapa de mentira.
     */
    resolveFontUrl?: (name: string, style?: string) => PsdFontSource | null;
    /**
     * Factor sobre TODAS las coordenadas. Por defecto 1: un PSD de 300 ppp mide
     * miles de píxeles y reescalar por nuestra cuenta sería cambiar el diseño sin
     * que nadie lo pida. Quien quiera una página manejable lo pasa explícito.
     */
    scale?: number;
    /**
     * Incluir capas ocultas. Por defecto NO: Photoshop no las pinta, y meterlas
     * taparía el diseño con material que el autor decidió no enseñar. Se cuentan
     * igual en el informe para que se sepa lo que quedó fuera.
     */
    includeHidden?: boolean;
    /** Nombre base de los ficheros de asset. Por defecto 'capa'. */
    documentName?: string;
    /**
     * A partir de cuántos subcaminos una capa vectorial deja de vectorizarse.
     *
     * No es una optimización: es lo que separa una escena usable de una que no se
     * puede abrir. Una textura de pincel real trae 900-2700 subcaminos, y cada uno
     * sale como una polilínea de ~55 puntos — 14 MB de JSON para UNA capa, y el
     * editor se arrastra. Por encima del tope la capa se trata como imagen (que es
     * lo que es: una mancha), conservando su aspecto EXACTO y dejando la escena en
     * unos kilobytes. Por defecto 64, que deja pasar cualquier logo o icono real.
     */
    maxSubpaths?: number;
}
/**
 * Cualquier color de Photoshop → `#rrggbb`.
 *
 * El orden de las comprobaciones importa: `{r,g,b}` (0..255) y `{fr,fg,fb}`
 * (0..1) coexisten en el mismo tipo unión de ag-psd, y CMYK trae `k` igual que
 * Grayscale — por eso CMYK se mira ANTES, comprobando que estén las cuatro.
 */
export declare function psdColorToHex(color: PsdColor | undefined | null): string | null;
/**
 * Reinicia el contador para que dos llamadas con la misma entrada coincidan.
 *
 * `seed` es la sal por documento: dos PSD distintos tienen que dar ids
 * distintos, o no se pueden juntar en una escena. Ver {@link makeId}.
 */
export declare function resetPsdIdCounter(seed?: string): void;
/**
 * Nombre PostScript de Photoshop → familia + estilo.
 *
 * Un PSD guarda "Montserrat-BoldItalic", no "Montserrat" + negrita + cursiva:
 * el estilo va DENTRO del nombre. Sin separarlos, cada peso de una misma
 * tipografía se registraría como una familia distinta y `resolveFontUrl` no
 * encontraría ninguna, porque los brand kits indexan por familia.
 */
export declare function splitPostScriptFont(raw: string): {
    family: string;
    style?: string;
};
/**
 * Sufijo PostScript ("BoldItalic") → `font-weight` + `font-style` de CSS.
 *
 * No es cosmético: `buildFontFaceCss` vuelca `style` tal cual en `font-style`,
 * y ahí "Bold" no es un valor válido — el navegador descarta el descriptor y la
 * fuente se pinta con el peso que sea. El peso tiene que ir en `weight`.
 */
export declare function postScriptStyleToCss(style: string | undefined): {
    weight?: string;
    style?: string;
};
/** Tope de subcaminos por defecto. Ver {@link PsdImportOptions.maxSubpaths}. */
export declare const DEFAULT_MAX_SUBPATHS = 64;
/** Subcaminos con geometría de verdad que tiene una capa. */
export declare function countSubpaths(layer: PsdLayer): number;
/**
 * Un `BezierPath` de Photoshop → polilínea en píxeles del documento.
 *
 * Los nudos vienen `[cp_entrada, ancla, cp_salida]` (ag-psd ya los multiplica
 * por el tamaño del documento, ver `readBezierKnot`), así que el tramo entre el
 * nudo i y el i+1 es la cúbica ancla_i → salida_i → entrada_{i+1} → ancla_{i+1}.
 *
 * Un tramo cuyos dos controles coinciden con sus anclas es una recta: se emite
 * como un solo punto y no como 12, que es lo que mantiene manejable un logo con
 * cientos de esquinas.
 */
export declare function flattenBezierPath(path: PsdBezierPath): Array<[number, number]>;
interface RunGroup {
    text: string;
    style: PsdTextStyle;
}
/**
 * Parte el texto en grupos de estilo consecutivos.
 *
 * Excalidraw es UN estilo por elemento; Photoshop permite uno por carácter. Los
 * `styleRuns` que comparten tamaño, color y familia se funden, así que un texto
 * uniforme —el caso normal— sale como un único elemento y solo se trocea cuando
 * de verdad hay estilos mezclados.
 */
export declare function groupStyleRuns(text: string, textData: PsdText): RunGroup[];
/**
 * Convierte un documento de Photoshop YA PARSEADO en una escena de canvas2.
 *
 * Las mesas de trabajo (artboards) se convierten en páginas: si el PSD tiene,
 * cada una es un frame; si no, el documento entero es una página. En los dos
 * casos las páginas se colocan en fila con la separación `PAGE_GAP` del editor,
 * y cada una lleva su "papel" con el marcador que espera `background.ts`, así
 * que un diseño importado se comporta igual que uno creado a mano.
 */
export declare function psdToScene(psd: PsdDocument, options?: PsdImportOptions): PsdScene;
/** Un hueco de imagen ya colocado en la escena, listo para recibir su foto. */
export interface PsdImagePlaceholder {
    id: string;
    layer: string;
    asset: string;
    x: number;
    y: number;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
}
/**
 * Localiza en una escena los huecos que dejó la importación.
 *
 * Es la otra mitad del contrato: sin esto, el placeholder sería un callejón sin
 * salida. Con esto, el host recorre los huecos, sube cada PNG a MediaMonster y
 * llama a `insertImageFromUrl` con la geometría exacta que ya venía anotada.
 */
export declare function listImagePlaceholders(elements: readonly SceneElement[]): PsdImagePlaceholder[];
export {};
//# sourceMappingURL=psd.d.ts.map