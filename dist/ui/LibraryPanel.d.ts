import { type ReactNode } from 'react';
import { type PartialLabels } from './labels';
/**
 * Marco del panel de biblioteca, arriba a la derecha del lienzo.
 *
 * Es DELIBERADAMENTE un marco vacío: canvas2 pone la posición, la cabecera y el
 * plegado, y el host mete dentro su propia mediateca. El motivo es que la UI de
 * media ya existe —`@polimake/ui` publica la parte presentacional y
 * `features/media-library` la compone con la capa de datos de studio— y este
 * paquete no puede importar de `apps/web` ni conocer proyectos, carpetas ni
 * autenticación. Mismo seam que `MediaFetcher`, `MediaUploader` y
 * `hydrateFiles`: canvas2 pide, el host resuelve.
 *
 * Sustituye a la Biblioteca de fábrica de Excalidraw (sus ficheros
 * `.excalidrawlib` no tienen nada que ver con la mediateca del proyecto), cuyo
 * disparador se oculta desde canvas2.css.
 */
export interface LibraryPanelProps {
    /** Contenido: la mediateca del host. Sin él, el panel no se dibuja. */
    children?: ReactNode;
    title?: string;
    theme?: 'light' | 'dark';
    /** En modo lectura no se muestra: solo sirve para insertar. */
    viewMode?: boolean;
    /**
     * Arranca plegada, como un botón. Por defecto SÍ: abierta ocupa casi toda la
     * altura del lado derecho, y tapar el diseño nada más entrar es peor que un
     * clic de más.
     */
    defaultCollapsed?: boolean;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
    /**
     * Anclaje vertical del panel/botón. Por defecto va en la FILA superior, el
     * hueco que ocupaba el disparador de la Biblioteca de Excalidraw (que se
     * oculta desde canvas2.css): es un botón de 36px y ahí no estorba a la barra
     * de herramientas. El dock de Diseño/Capas/Componentes vive bajo esa fila, a
     * 76, así que las dos piezas del lado derecho no se pisan.
     */
    anchorTop?: number;
    /** Icono del botón plegado; por defecto, el de la mediateca. */
    icon?: ReactNode;
    testId?: string;
}
export declare function LibraryPanel({ children, title, theme, viewMode, defaultCollapsed, labels: labelsProp, anchorTop, icon, testId, }: LibraryPanelProps): import("react").JSX.Element | null;
//# sourceMappingURL=LibraryPanel.d.ts.map