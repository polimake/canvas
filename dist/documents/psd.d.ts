/** Photoshop data model, independent of readers, converters and the editor. */
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
    /** Compressed channels from a headless ag-psd read (`useRawData`). */
    rawData?: unknown;
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
//# sourceMappingURL=psd.d.ts.map