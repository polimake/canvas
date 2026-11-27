import type { SceneElement } from '../core/excal';
import type { ImportDocument } from '../documents/model';
/**
 * Escena → modelo de documento: lo inverso de `documentToScene`.
 *
 * Es el primer paso para exportar a un formato de oficina (`documentToPptx`):
 * cada página es una diapositiva, con su fondo, sus notas, si se salta y su
 * transición. Puro: ni Excalidraw ni DOM. Las imágenes tienen que llegar con
 * sus bytes (`files` con `data:`), que es lo que hidrata el host antes de
 * exportar; una imagen sin bytes no se inventa: se avisa y se queda fuera.
 */
/** Lo que Excalidraw guarda de un fichero de imagen. */
export interface SceneFile {
    id?: string;
    dataURL?: string;
    mimeType?: string;
}
export interface SceneToDocumentOptions {
    /**
     * Nombre de familia de un `fontFamily` numérico de la escena. Las familias
     * propias llevan un id derivado de su nombre (`customFontFamilyId`); quien
     * tiene el registro (el editor) lo resuelve. Sin respuesta, las de serie de
     * Excalidraw y, si no, ninguna: la aplicación de destino pone la suya.
     */
    fontName?: (id: number) => string | undefined;
    /** Tamaño natural de una imagen (para el recorte), por id de fichero. */
    imageSize?: (fileId: string) => {
        width: number;
        height: number;
    } | undefined;
}
/** Bytes de un `data:` URL (base64 o texto). */
export declare function dataUrlBytes(dataURL: string): {
    bytes: Uint8Array;
    mimeType: string;
} | null;
export declare function sceneToDocument(elements: readonly SceneElement[], files: Readonly<Record<string, SceneFile>>, options?: SceneToDocumentOptions): ImportDocument;
//# sourceMappingURL=sceneToDocument.d.ts.map