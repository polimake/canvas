/** Shared inline-style palette for canvas2's own chrome (PageNavigator,
 *  AssetSidebar, LayersPanel). Values mirror Excalidraw's light/dark surfaces so
 *  our panels sit visually alongside its UI. */

export type Canvas2Theme = 'light' | 'dark';

export interface Palette {
  bg: string;
  fg: string;
  sub: string;
  border: string;
  active: string;
  activeFg: string;
  hover: string;
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
    active: '#6965db',
    activeFg: '#ffffff',
    hover: 'rgba(0,0,0,0.05)',
    warnBg: '#fff8e6',
    warnBorder: 'rgba(180,120,0,0.35)',
    warnText: '#6b4a00',
  },
  dark: {
    bg: '#232329',
    fg: '#e3e3e8',
    sub: '#9b9ba5',
    border: 'rgba(255,255,255,0.12)',
    active: '#a8a5ff',
    activeFg: '#1b1b1f',
    hover: 'rgba(255,255,255,0.07)',
    warnBg: '#3a3324',
    warnBorder: 'rgba(255,196,84,0.35)',
    warnText: '#f5dfae',
  },
};

export const PANEL_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
