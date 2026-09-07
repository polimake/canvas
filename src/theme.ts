/** La paleta —en estilos en linea— del cromo propio de canvas2: PageNavigator,
 *  AssetSidebar, LayersPanel.
 *
 *  Antes copiaba las superficies de Excalidraw para que los paneles no
 *  desentonaran con su interfaz, y con ellas venia su morado (#6965db). Ahora
 *  son los colores de Polimake: los paneles son nuestros, y lo de Excalidraw
 *  que se queda es el lienzo, que no se toca.
 *
 *  El claro y el oscuro siguen separados a mano en vez de salir de `var()`
 *  porque quien elige aqui es el tema del lienzo, que puede no ser el de la
 *  app. */

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
   *  la paleta base es gris y sin un color propio el aviso no se lee como tal.
   *  Es una de las tres excepciones legítimas al monocromo, con el acierto y
   *  el error. */
  warnBg: string;
  warnBorder: string;
  warnText: string;
}

export const palette: Record<Canvas2Theme, Palette> = {
  light: {
    bg: '#ffffff',
    fg: '#1a1a1a',
    sub: '#4a4a4f',
    border: '#d7d7da',
    active: '#3a39f5',
    activeFg: '#ffffff',
    hover: '#e2e1e2',
    warnBg: 'rgba(138,90,0,0.10)',
    warnBorder: 'rgba(138,90,0,0.35)',
    warnText: '#8a5a00',
  },
  // El azul de marca es ilegal sobre negro: #3a39f5 sobre #1a1a1a saca 2,56.
  // En oscuro el acento sube a #6e6ef8.
  dark: {
    bg: '#1b1b1f',
    fg: '#ffffff',
    sub: '#9a9aa2',
    border: '#2c2c32',
    active: '#6e6ef8',
    activeFg: '#0d0d18',
    hover: '#26262b',
    warnBg: 'rgba(227,163,58,0.12)',
    warnBorder: 'rgba(227,163,58,0.35)',
    warnText: '#e3a33a',
  },
};

export const PANEL_FONT =
  '"Funnel Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
