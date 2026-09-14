import type { ExcalidrawImperativeAPI } from '../core/excal';
import { type PartialLabels } from './labels';
/**
 * Selector del fotograma de portada de un vídeo.
 *
 * Aparece cuando seleccionas un vídeo del lienzo. Arrastras la barra, ves el
 * fotograma en vivo dentro del propio `<video>` y al confirmar ese fotograma se
 * convierte en la portada: se sube a la mediateca y sustituye a la imagen.
 *
 * Dos decisiones que explican el diseño:
 *
 * 1. El `<video>` NUNCA apunta al CDN. El CDN no manda CORS, así que dibujar
 *    ese vídeo en un lienzo lo contamina y `toBlob` muere con SecurityError. La
 *    fuente la resuelve el host (`resolveVideoSrc`), que además tiene que
 *    autenticarse — de ahí que sea asíncrona y haya un estado de carga.
 * 2. La captura y la subida las hace el HOST (`onPickFrame`). Este paquete no
 *    sabe de MediaMonster ni debe: es la misma frontera que la biblioteca y los
 *    componentes — canvas2 pone el marco, studio pone los datos.
 */
export interface VideoFramePickerProps {
    api: ExcalidrawImperativeAPI | null;
    theme?: 'light' | 'dark';
    viewMode?: boolean;
    labels?: PartialLabels;
    /**
     * Convierte la URL de la mediateca en una que el `<video>` pueda usar SIN
     * contaminar el lienzo. Es ASÍNCRONA porque el host tiene que descargarla con
     * su token: el proxy exige cabecera `Authorization` y un `<video src>` no la
     * manda, así que el camino real es fetch autenticado → blob del mismo origen.
     *
     * Sin esto no hay selector: se podría ver el vídeo pero no capturar nada.
     */
    resolveVideoSrc?: (src: string, signal: AbortSignal) => Promise<string>;
    /** Libera lo que devolviera `resolveVideoSrc` (revoca el object URL). */
    releaseVideoSrc?: (resolved: string) => void;
    /**
     * Captura el fotograma visible y devuelve la URL del póster ya subido a la
     * mediateca. Devolver `null` = no se pudo; el póster actual se queda.
     */
    onPickFrame?: (video: HTMLVideoElement, timeSec: number) => Promise<{
        url: string;
        mimeType?: string;
    } | null>;
}
export declare function VideoFramePicker({ api, theme, viewMode, labels, resolveVideoSrc, releaseVideoSrc, onPickFrame, }: VideoFramePickerProps): import("react").JSX.Element | null;
//# sourceMappingURL=VideoFramePicker.d.ts.map