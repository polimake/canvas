import { type ExcalidrawImperativeAPI, type SceneElement } from './excal';
import { type CaptureMode } from './mutate';
import { type PageSize } from './pages';
/**
 * Elementos que NO pertenecen a ninguna página: ni son marcos ni están dentro
 * de uno. Son los candidatos a agruparse en páginas nuevas.
 */
export declare function looseElements(elements: readonly SceneElement[]): SceneElement[];
/**
 * PURA: reparte los elementos sueltos en grupos —un grupo, una página futura—
 * y los devuelve en orden de lectura (por filas, y dentro de cada fila de
 * izquierda a derecha).
 *
 * Se exporta para poder testear la agrupación sin montar el editor: es la única
 * parte con criterio discutible de toda la conversión.
 */
export declare function clusterLooseElements(loose: readonly SceneElement[]): SceneElement[][];
export interface PaginateOptions {
    /**
     * Tamaño de las páginas nuevas. Sin él se usa el del grupo más grande, que
     * para un carrusel de slides iguales es exactamente el del slide — así la
     * conversión no reencuadra nada cuando no hace falta.
     */
    pageSize?: PageSize;
    /**
     * Permitir AMPLIAR un grupo más pequeño que la página, además de reducir el
     * que no cabe.
     *
     * Por defecto no: cuando el tamaño se deduce del propio contenido, ampliar
     * solo emborronaría las imágenes sin ganar nada. Cuando el tamaño lo IMPONE
     * quien llama —el menú, que hereda el de la página activa— la intención es
     * llenar ese lienzo, y es justo lo que hace `resizePage` al cambiar el tamaño
     * de una página con "Escalar el contenido" marcado. Mismo gesto, misma
     * respuesta.
     */
    scaleUp?: boolean;
    /** Color del papel de las páginas nuevas. */
    paperColor?: string;
}
export interface PaginateResult {
    elements: readonly SceneElement[];
    /** Páginas creadas a partir de elementos sueltos. */
    created: number;
    /** Total de páginas del documento después de convertir. */
    total: number;
}
/**
 * PURA: devuelve la escena ya paginada, empaquetada y renumerada. No toca el
 * editor — quien la aplica es {@link convertToPages}, en UN solo commit.
 */
export declare function paginateSceneInArray(elements: readonly SceneElement[], opts?: PaginateOptions): PaginateResult;
/**
 * Aplica la paginación al editor en UN solo commit (una entrada de deshacer),
 * como el resto de operaciones compuestas del paquete.
 */
export declare function convertToPages(api: ExcalidrawImperativeAPI, opts?: PaginateOptions & {
    capture?: CaptureMode;
}): {
    created: number;
    total: number;
};
/**
 * Mete los elementos sueltos DENTRO de una página que ya existe, en vez de
 * crear páginas nuevas para ellos.
 *
 * Es la otra mitad de {@link convertToPages}. Aquella sirve cuando lo suelto es
 * el documento entero (un guion dibujado en el plano infinito, que hay que
 * paginar); ésta sirve para el caso pequeño y mucho más frecuente: uno o dos
 * elementos que se quedaron en el hueco entre dos páginas o justo fuera del
 * borde. Ahí no quieres una página nueva, quieres que pertenezcan a la que
 * tienes delante.
 *
 * Importa porque un elemento sin página NO SE VE en el panel de capas, NO SALE
 * en ningún export y NO SALE en la miniatura — pero sí se ve en el lienzo y sí
 * se guarda. Es decir: lo tienes en pantalla y no está en lo que entregas.
 *
 * NO los recoloca a propósito: el usuario los dejó donde están y moverlos de
 * golpe desconcierta más que el propio problema. Con pertenecer a la página ya
 * dejan de ser invisibles; si además quedan fuera del recorte del marco, eso se
 * ve en pantalla y se arregla arrastrando.
 *
 * Los hijos ligados (el texto dentro de una forma) viajan con su contenedor:
 * mover el contenedor sin su texto dejaría al texto suelto, que es justo el
 * fallo que esto viene a arreglar.
 *
 * Un solo `updateScene` = una sola entrada de deshacer. Devuelve cuántos movió.
 */
export declare function adoptLooseIntoPage(api: ExcalidrawImperativeAPI, pageId: string, opts?: {
    only?: readonly string[];
    capture?: CaptureMode;
}): number;
//# sourceMappingURL=paginate.d.ts.map