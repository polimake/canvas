import { type XmlNode } from './xml';
export type Point = [number, number];
/**
 * Flattens a `custGeom` to points inside a `width`×`height` box; null if it uses
 * guides we cannot read. A lone open path stays open unless it is going to be filled.
 */
export declare function customGeometry(geometry: XmlNode, width: number, height: number, filled: boolean): Point[] | null;
/** The route of a connector inside its box. */
export declare function connectorPoints(name: string | undefined, width: number, height: number): Point[];
export declare function presetGeometry(name: string | undefined, width: number, height: number): Point[] | null;
export declare const flipPoints: (points: Point[], width: number, height: number, flipH: boolean, flipV: boolean) => Point[];
/** Width and height from the image header, for the formats a browser shows. */
export declare function imageSize(bytes: Uint8Array): {
    width: number;
    height: number;
} | undefined;
//# sourceMappingURL=pptx-geometry.d.ts.map