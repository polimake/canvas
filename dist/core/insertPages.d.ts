import type { ExcalidrawImperativeAPI } from './excal';
/**
 * Añadir a la escena viva páginas que vienen de fuera —las de un .pptx o un
 * .pdf ya convertidas por `documentToScene`— detrás de `afterPageId` (por
 * defecto, al final), en UNA entrada de deshacer.
 *
 * Las páginas llegan colocadas a partir de x = 0; aquí se desplazan detrás de
 * la de referencia y `packPagesInArray` las asienta en la fila con el orden del
 * documento. Un id que ya exista en la escena se renombra (y con él las
 * referencias de sus elementos), así que importar dos veces el mismo fichero
 * no pisa nada. Los ficheros de imagen van por `addFiles`. Devuelve los ids de
 * las páginas nuevas, en su orden.
 */
export interface IncomingPages {
    elements: readonly unknown[];
    files?: Record<string, unknown>;
}
export declare function insertPagesIntoScene(api: ExcalidrawImperativeAPI, incoming: IncomingPages, { afterPageId }?: {
    afterPageId?: string | null;
}): string[];
//# sourceMappingURL=insertPages.d.ts.map