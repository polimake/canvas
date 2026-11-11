/**
 * Los recortes de las fotos, al tamaño de la imagen con la que se exporta.
 *
 * Excalidraw guarda el recorte de una imagen en PÍXELES de la imagen que tenía
 * al recortarla (`crop.x`, `crop.y`, `crop.width`, `crop.height` sobre
 * `crop.naturalWidth` × `crop.naturalHeight`) y al pintar hace
 * `drawImage(img, crop.x, crop.y, crop.width, crop.height, …)` sin escalar. Si
 * al exportar se le da otra imagen de la misma foto con otra resolución —el
 * host cambia la vista previa de Media (1500 px) por su original, para
 * exportar en calidad completa—, recortaría otro trozo. Aquí se reescala cada
 * recorte a la imagen que se va a pintar, en una copia de los elementos: la
 * escena no se toca.
 */
type ConRecorte = {
    type?: string;
    fileId?: unknown;
    crop?: {
        x: number;
        y: number;
        width: number;
        height: number;
        naturalWidth: number;
        naturalHeight: number;
    } | null;
};
export type Tamanos = ReadonlyMap<string, {
    width: number;
    height: number;
}>;
/**
 * Los elementos con el recorte de cada imagen reescalado a su tamaño en
 * `tamanos` (por `fileId`). Los demás, y los que ya están a su tamaño, tal
 * cual (los mismos objetos).
 */
export declare function recortesALaImagen<E extends ConRecorte>(elements: readonly E[], tamanos: Tamanos): E[];
/**
 * Los elementos para exportar con `files` (el mapa que da el host): solo se
 * miden las imágenes recortadas, y una que no se deja medir se queda con su
 * recorte de siempre.
 */
export declare function elementosParaExportar<E extends ConRecorte>(elements: readonly E[], files: Readonly<Record<string, {
    dataURL?: unknown;
} | undefined>>, medirImagen?: (src: string) => Promise<{
    width: number;
    height: number;
} | null>): Promise<E[]>;
export {};
//# sourceMappingURL=recortes.d.ts.map