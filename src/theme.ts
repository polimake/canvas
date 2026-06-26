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
  },
  dark: {
    bg: '#232329',
    fg: '#e3e3e8',
    sub: '#9b9ba5',
    border: 'rgba(255,255,255,0.12)',
    active: '#a8a5ff',
    activeFg: '#1b1b1f',
    hover: 'rgba(255,255,255,0.07)',
  },
};

export const PANEL_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
