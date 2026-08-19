/** Shared inline-style palette for canvas2's own chrome (PageNavigator,
 *  AssetSidebar, LayersPanel). Surfaces sit alongside Excalidraw's light/dark
 *  UI, while the accent and the destructive colour track @polimake/tokens
 *  (--primary, --destructive). */

export type Canvas2Theme = 'light' | 'dark';

export interface Palette {
  bg: string;
  fg: string;
  sub: string;
  border: string;
  active: string;
  activeFg: string;
  hover: string;
  /** Acciones destructivas (borrar página, borrar capa) y fallos. `--destructive`
   *  de @polimake/tokens, en hex porque las demás ranuras también lo son. */
  danger: string;
  /** Encima de `danger` cuando es relleno y no texto. En oscuro el rojo es claro,
   *  así que va tinta negra: el blanco de siempre se quedaba en 2,9:1. */
  dangerFg: string;
  /** Aviso no bloqueante (elementos fuera de página). Ámbar en los dos temas:
   *  la paleta base es gris y sin un color propio el aviso no se lee como tal. */
  warnBg: string;
  warnBorder: string;
  warnText: string;
}

export const palette: Record<Canvas2Theme, Palette> = {
  light: {
    bg: '#ffffff',
    fg: '#1b1b1f',
    sub: '#5b5b66',
    border: 'rgba(0,0,0,0.12)',
    active: '#3a39f5',
    activeFg: '#ffffff',
    hover: 'rgba(0,0,0,0.05)',
    danger: '#e7000b',
    dangerFg: '#ffffff',
    warnBg: '#fff8e6',
    warnBorder: 'rgba(180,120,0,0.35)',
    warnText: '#6b4a00',
  },
  dark: {
    bg: '#232329',
    fg: '#e3e3e8',
    sub: '#9b9ba5',
    border: 'rgba(255,255,255,0.12)',
    active: '#6c86ff',
    activeFg: '#1a1a1a',
    hover: 'rgba(255,255,255,0.07)',
    danger: '#ff6467',
    dangerFg: '#1a1a1a',
    warnBg: '#3a3324',
    warnBorder: 'rgba(255,196,84,0.35)',
    warnText: '#f5dfae',
  },
};

/** La app declara `--font-funnel-sans` en el `<html>`; el respaldo del `var()`
 *  deja una pila de sistema limpia para quien consuma el paquete fuera de ella. */
export const PANEL_FONT =
  'var(--font-funnel-sans, system-ui), system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
