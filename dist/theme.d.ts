/** La paleta —en estilos en linea— del cromo propio de canvas2: PageNavigator,
 *  AssetSidebar, LayersPanel.
 *
 *  Antes copiaba las superficies de Excalidraw para que los paneles no
 *  desentonaran con su interfaz, y con ellas venia su morado (#6965db). Ahora
 *  son los colores de Polimake: los paneles son nuestros, y lo de Excalidraw
 *  que se queda es el lienzo, que no se toca.
 *
 *  El claro y el oscuro van separados a mano y NO salen de `var()`, porque
 *  quien elige aqui es el tema del lienzo, que puede no ser el de la app.
 *
 *  La excepcion son `danger` y `dangerFg`, que si pasan por token con el hex
 *  de respaldo detras. Es a proposito y tiene un precio: en un host que
 *  defina `--color-destructive` el rojo lo pone el tema de la APP, asi que un
 *  lienzo claro dentro de una app oscura se lleva el rojo oscuro. Se acepta
 *  porque es exactamente lo que el escritorio ya hacia —usaba la variable a
 *  pelo en LayersPanel y PageActions— y asi el paquete tambien pinta en un
 *  host que no declare nada. */
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
     *  la paleta base es gris y sin un color propio el aviso no se lee como tal.
     *  Es una de las tres excepciones legítimas al monocromo, con el acierto y
     *  el error. */
    warnBg: string;
    warnBorder: string;
    warnText: string;
}
export declare const palette: Record<Canvas2Theme, Palette>;
/** La app declara `--font-funnel-sans` en el `<html>`; el respaldo del `var()`
 *  deja una pila de sistema limpia para quien consuma el paquete fuera de ella. */
export declare const PANEL_FONT = "var(--font-funnel-sans, \"Funnel Sans\"), \"Funnel Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif";
//# sourceMappingURL=theme.d.ts.map