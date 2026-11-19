import { type XmlNode } from './xml';
export interface PptxTheme {
    colors: Record<string, string>;
    /** Slide color names (`tx1`, `bg1`…) to theme slots (`dk1`, `lt1`…). */
    map: Record<string, string>;
    majorFont?: string;
    minorFont?: string;
}
export interface PptxColor {
    hex: string;
    alpha: number;
}
export declare function readTheme(theme: XmlNode | undefined, colorMap: XmlNode | undefined): PptxTheme;
/** Reads the color inside `parent` (a `solidFill`, a style ref…), applying its modifiers. */
export declare function readColor(parent: XmlNode | undefined, theme: PptxTheme, placeholder?: PptxColor): PptxColor | undefined;
//# sourceMappingURL=pptx-theme.d.ts.map