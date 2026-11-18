import { child, type XmlNode } from './xml';

export interface PptxTheme {
  colors: Record<string, string>;
  /** Slide color names (`tx1`, `bg1`…) to theme slots (`dk1`, `lt1`…). */
  map: Record<string, string>;
  majorFont?: string;
  minorFont?: string;
}
export interface PptxColor { hex: string; alpha: number }

const COLOR_NODES = new Set(['srgbClr', 'schemeClr', 'sysClr', 'prstClr']);
const NAMED: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080' };
const DEFAULT_MAP: Record<string, string> = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };

const nodeHex = (node: XmlNode | undefined) => node && (node.name === 'sysClr' ? node.attrs.lastClr : node.attrs.val);

export function readTheme(theme: XmlNode | undefined, colorMap: XmlNode | undefined): PptxTheme {
  const elements = child(child(theme, 'theme'), 'themeElements');
  const colors: Record<string, string> = {};
  for (const slot of child(elements, 'clrScheme')?.children ?? []) {
    const hex = nodeHex(slot.children[0]);
    if (hex) colors[slot.name] = hex;
  }
  const fonts = child(elements, 'fontScheme');
  return {
    colors,
    map: { ...DEFAULT_MAP, ...colorMap?.attrs },
    majorFont: child(child(fonts, 'majorFont'), 'latin')?.attrs.typeface,
    minorFont: child(child(fonts, 'minorFont'), 'latin')?.attrs.typeface,
  };
}

function toHsl([r, g, b]: number[]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]: number[]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, m = l - c / 2, sector = h * 6;
  const x = c * (1 - Math.abs((sector % 2) - 1));
  const table = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(sector) % 6];
  return table.map(v => v + m);
}
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Reads the color inside `parent` (a `solidFill`, a style ref…), applying its modifiers. */
export function readColor(parent: XmlNode | undefined, theme: PptxTheme, placeholder?: PptxColor): PptxColor | undefined {
  const node = parent?.children.find(n => COLOR_NODES.has(n.name));
  if (!node) return undefined;
  const usesPlaceholder = node.name === 'schemeClr' && node.attrs.val === 'phClr';
  let hex: string | undefined;
  if (usesPlaceholder) hex = placeholder?.hex.slice(1);
  else if (node.name === 'schemeClr') hex = theme.colors[theme.map[node.attrs.val] ?? node.attrs.val];
  else if (node.name === 'prstClr') hex = NAMED[node.attrs.val?.toLowerCase()];
  else hex = nodeHex(node);
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  let rgb = [0, 2, 4].map(i => parseInt(hex!.slice(i, i + 2), 16) / 255);
  let alpha = usesPlaceholder ? placeholder!.alpha : 1;
  for (const mod of node.children) {
    const amount = Number(mod.attrs.val) / 100000;
    if (!Number.isFinite(amount)) continue;
    if (mod.name === 'alpha') alpha = amount;
    else if (mod.name === 'alphaMod') alpha *= amount;
    else if (mod.name === 'shade') rgb = rgb.map(v => v * amount);
    else if (mod.name === 'tint') rgb = rgb.map(v => v + (1 - v) * (1 - amount));
    else if (['lumMod', 'lumOff', 'satMod'].includes(mod.name)) {
      const hsl = toHsl(rgb);
      if (mod.name === 'lumMod') hsl[2] = clamp(hsl[2] * amount);
      if (mod.name === 'lumOff') hsl[2] = clamp(hsl[2] + amount);
      if (mod.name === 'satMod') hsl[1] = clamp(hsl[1] * amount);
      rgb = fromHsl(hsl);
    }
  }
  return { hex: `#${rgb.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('')}`, alpha };
}
