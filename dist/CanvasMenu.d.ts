import { type ExcalidrawImperativeAPI } from './excal';
import type { FilesMap } from './pageThumbnails';
import type { SvgFontFace } from './svgFonts';
import { type PartialLabels } from './labels';
/**
 * Menú principal del editor: acciones de DOCUMENTO —convertir en páginas,
 * insertar texto, guardar como componente y exportar.
 *
 * Fondo y tamaño de la página estuvieron aquí y se han ido a la pestaña Diseño
 * del dock: son ajustes de UNA página y se buscan mirándola, no dentro de un
 * icono sin rótulo en la esquina opuesta.
 *
 * Ojo al montarlo: pasar un <MainMenu> como hijo de <Excalidraw> SUSTITUYE el
 * menú de fábrica entero, no le añade cosas. Por eso abajo se reponen a mano los
 * items de serie que merece la pena conservar.
 */
export interface CanvasMenuProps {
    /** Puede llegar null en el primer render: ver el comentario del montaje en Canvas2. */
    api: ExcalidrawImperativeAPI | null;
    /** Página activa, gobernada por Canvas2Editor. */
    activePageId?: string | null;
    /** En modo lectura solo queda exportar: nada que mute el documento. */
    viewMode?: boolean;
    /**
     * Trae el mapa de ficheros hidratado justo antes de exportar.
     *
     * Con imágenes remotas el canvas queda contaminado y `toBlob` muere con
     * SecurityError. Antes eso se resolvía ESCONDIENDO el grupo Exportar y
     * dejando el botón bueno en una barra aparte del host — o sea que exportar
     * estaba en el menú salvo justo cuando hacía falta.
     *
     * Se pide en el momento, y no se recibe un mapa ya hecho, porque uno
     * publicado hace diez segundos no incluiría una imagen añadida después: el
     * export saldría incompleto sin avisar.
     */
    hydrateFiles?: (opts?: {
        output?: 'blob' | 'dataurl';
    }) => Promise<FilesMap>;
    /**
     * Tipografías de la marca, para embeberlas en el SVG. Excalidraw mete las que
     * tiene REGISTRADAS, no las que sustituimos por `@font-face`, así que sin esto
     * un SVG abierto en otro equipo sale con la fuente de serie (ver svgFonts.ts).
     */
    fontFaces?: readonly SvgFontFace[];
    /**
     * Familias de marca por rol, para que "Insertar texto" nazca ya en la
     * tipografía del cliente. Las resuelve `Canvas2Editor` desde el brand kit.
     */
    brandFamilies?: {
        heading: string | null;
        body: string | null;
    };
    /** "Guardar página como componente" — la subida la hace el host. */
    onSaveComponent?: () => void;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
export declare function CanvasMenu({ api, activePageId, viewMode, hydrateFiles, fontFaces, brandFamilies, onSaveComponent, labels: labelsProp, }: CanvasMenuProps): import("react").JSX.Element;
//# sourceMappingURL=CanvasMenu.d.ts.map