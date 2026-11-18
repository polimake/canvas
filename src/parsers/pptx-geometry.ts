import { child, children, type XmlNode } from './xml';

export type Point = [number, number];

const CURVE_STEPS = 16;
const closePath = (path: Point[]) => {
  const [x, y] = path[0], last = path[path.length - 1];
  return Math.abs(last[0] - x) < 1e-6 && Math.abs(last[1] - y) < 1e-6 ? path : [...path, path[0]];
};

/**
 * One outline for several sub-paths: each is reached and left through the same
 * zero-width bridge, so a glyph keeps its holes and its separate parts.
 */
function joinPaths(paths: Point[][]): Point[] {
  const [first, ...rest] = paths.filter(path => path.length > 1).map(closePath);
  if (!first) return [];
  const joined = [...first];
  for (const path of rest) joined.push(...path, first[0]);
  return joined;
}

function curve(from: Point, controls: Point[], out: Point[]) {
  for (let step = 1; step <= CURVE_STEPS; step++) {
    const t = step / CURVE_STEPS;
    let points = [from, ...controls];
    while (points.length > 1) points = points.slice(1).map((p, i) => [points[i][0] + (p[0] - points[i][0]) * t, points[i][1] + (p[1] - points[i][1]) * t] as Point);
    out.push(points[0]);
  }
}

/**
 * Flattens a `custGeom` to points inside a `width`×`height` box; null if it uses
 * guides we cannot read. A lone open path stays open unless it is going to be filled.
 */
export function customGeometry(geometry: XmlNode, width: number, height: number, filled: boolean): Point[] | null {
  const paths: Point[][] = [];
  let closed = false;
  for (const path of children(child(geometry, 'pathLst'), 'path')) {
    const pathWidth = Number(path.attrs.w) || 0, pathHeight = Number(path.attrs.h) || 0;
    const sx = pathWidth ? width / pathWidth : 1, sy = pathHeight ? height / pathHeight : 1;
    let current: Point[] = [], position: Point = [0, 0], unreadable = false;
    const read = (node: XmlNode): Point => {
      const x = Number(node.attrs.x), y = Number(node.attrs.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) unreadable = true;
      return [x * sx, y * sy];
    };
    for (const command of path.children) {
      if (command.name === 'moveTo') {
        if (current.length) paths.push(current);
        position = read(command.children[0]); current = [position];
      } else if (command.name === 'lnTo') {
        position = read(command.children[0]); current.push(position);
      } else if (command.name === 'cubicBezTo' || command.name === 'quadBezTo') {
        const controls = command.children.map(read);
        curve(position, controls, current); position = controls[controls.length - 1];
      } else if (command.name === 'arcTo') {
        const rx = Number(command.attrs.wR) * sx, ry = Number(command.attrs.hR) * sy;
        const start = Number(command.attrs.stAng) / 60000 * Math.PI / 180, sweep = Number(command.attrs.swAng) / 60000 * Math.PI / 180;
        if (![rx, ry, start, sweep].every(Number.isFinite)) { unreadable = true; continue; }
        const cx = position[0] - rx * Math.cos(start), cy = position[1] - ry * Math.sin(start);
        for (let step = 1; step <= CURVE_STEPS; step++) {
          const angle = start + sweep * step / CURVE_STEPS;
          position = [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]; current.push(position);
        }
      } else if (command.name === 'close' && current.length) {
        paths.push(current); current = []; closed = true;
      }
    }
    if (unreadable) return null;
    if (current.length) paths.push(current);
  }
  if (paths.length === 1 && !closed && !filled) return paths[0].length > 1 ? paths[0] : null;
  const joined = joinPaths(paths);
  return joined.length ? joined : null;
}

function moon(width: number, height: number): Point[] {
  const points: Point[] = [], steps = 36;
  for (let i = 0; i <= steps; i++) { const a = Math.PI / 2 + Math.PI * i / steps; points.push([width + width * Math.cos(a), height / 2 + height / 2 * Math.sin(a)]); }
  for (let i = steps; i >= 0; i--) { const a = Math.PI / 2 + Math.PI * i / steps; points.push([width + width / 2 * Math.cos(a), height / 2 + height / 2 * Math.sin(a)]); }
  return closePath(points);
}

/** Outlines, in fractions of the box, of the preset shapes that are plain polygons. */
const PRESETS: Record<string, Point[]> = {
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  rtTriangle: [[0, 0], [1, 1], [0, 1]],
  parallelogram: [[0.25, 0], [1, 0], [0.75, 1], [0, 1]],
  trapezoid: [[0.25, 0], [0.75, 0], [1, 1], [0, 1]],
  pentagon: [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  octagon: [[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]],
  homePlate: [[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1]],
  chevron: [[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]],
  rightArrow: [[0, 0.25], [0.5, 0.25], [0.5, 0], [1, 0.5], [0.5, 1], [0.5, 0.75], [0, 0.75]],
  leftArrow: [[1, 0.25], [0.5, 0.25], [0.5, 0], [0, 0.5], [0.5, 1], [0.5, 0.75], [1, 0.75]],
  upArrow: [[0.25, 1], [0.25, 0.5], [0, 0.5], [0.5, 0], [1, 0.5], [0.75, 0.5], [0.75, 1]],
  downArrow: [[0.25, 0], [0.25, 0.5], [0, 0.5], [0.5, 1], [1, 0.5], [0.75, 0.5], [0.75, 0]],
  plus: [[0.25, 0], [0.75, 0], [0.75, 0.25], [1, 0.25], [1, 0.75], [0.75, 0.75], [0.75, 1], [0.25, 1], [0.25, 0.75], [0, 0.75], [0, 0.25], [0.25, 0.25]],
};

const STAR_INNER: Record<string, number> = { star4: 0.25, star5: 0.382, star6: 0.577, star7: 0.5, star8: 0.5, star10: 0.6, star12: 0.65, star16: 0.75, star24: 0.8, star32: 0.85 };

function star(points: number, inner: number, width: number, height: number): Point[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 ? inner : 1, angle = -Math.PI / 2 + Math.PI * i / points;
    return [width / 2 * (1 + radius * Math.cos(angle)), height / 2 * (1 + radius * Math.sin(angle))] as Point;
  });
}
function oval(cx: number, cy: number, rx: number, ry: number, reverse = false): Point[] {
  return Array.from({ length: 72 }, (_, i) => { const a = (reverse ? -1 : 1) * Math.PI * i / 36; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Point; });
}
function heart(width: number, height: number): Point[] {
  const points: Point[] = [[width / 2, height * 0.25]];
  curve(points[0], [[width * 0.6, 0], [width, 0], [width, height * 0.32]], points);
  curve(points[points.length - 1], [[width, height * 0.62], [width * 0.65, height * 0.8], [width / 2, height]], points);
  curve(points[points.length - 1], [[width * 0.35, height * 0.8], [0, height * 0.62], [0, height * 0.32]], points);
  curve(points[points.length - 1], [[0, 0], [width * 0.4, 0], [width / 2, height * 0.25]], points);
  return points;
}

/** The route of a connector inside its box. */
export function connectorPoints(name: string | undefined, width: number, height: number): Point[] {
  if (name === 'bentConnector2') return [[0, 0], [width, 0], [width, height]];
  if (name?.startsWith('bentConnector')) return [[0, 0], [width / 2, 0], [width / 2, height], [width, height]];
  if (name?.startsWith('curvedConnector')) {
    const points: Point[] = [[0, 0]];
    curve([0, 0], [[width / 2, 0], [width / 2, height], [width, height]], points);
    return points;
  }
  return [[0, 0], [width, height]];
}

export function presetGeometry(name: string | undefined, width: number, height: number): Point[] | null {
  if (name === 'moon') return moon(width, height);
  if (name === 'heart') return closePath(heart(width, height));
  if (name === 'donut') {
    const ring = Math.min(width, height) * 0.25;
    return joinPaths([oval(width / 2, height / 2, width / 2, height / 2), oval(width / 2, height / 2, width / 2 - ring, height / 2 - ring, true)]);
  }
  if (name && STAR_INNER[name]) return closePath(star(Number(name.slice(4)), STAR_INNER[name], width, height));
  const preset = name ? PRESETS[name] : undefined;
  return preset ? closePath(preset.map(([x, y]) => [x * width, y * height])) : null;
}

export const flipPoints = (points: Point[], width: number, height: number, flipH: boolean, flipV: boolean): Point[] =>
  points.map(([x, y]) => [flipH ? width - x : x, flipV ? height - y : y]);

/** Width and height from the image header, for the formats a browser shows. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length > 10 && view.getUint32(0) === 0x47494638) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return undefined;
}
