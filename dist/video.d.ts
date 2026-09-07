import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import { type InsertImageOptions } from './media';
/**
 * Vídeo en el lienzo.
 *
 * Excalidraw no tiene elemento de vídeo y no vamos a forkearlo para añadirlo
 * (ver la regla de acoplamiento en PARITY.md: todo es overlay sobre el paquete
 * de serie). Un vídeo se representa como una IMAGEN —su fotograma de portada—
 * que además recuerda de qué vídeo salió, en `customData`.
 *
 * Eso es exactamente lo que ya hacía la conversión de diseños del editor legacy
 * (`VideoLayer` → póster), pero al revés: allí se perdía el vínculo con el vídeo
 * y la portada quedaba congelada para siempre. Aquí se guarda, y por eso se
 * puede volver a elegir el fotograma cuando quieras.
 *
 * Lo que NO hace: reproducir. En un editor de piezas gráficas la portada es lo
 * que se maqueta y lo que se exporta; el vídeo se reproduce en su pestaña.
 */
/** Marca de canvas2 para un elemento que representa un vídeo. */
export declare const VIDEO_MARKER = "video";
export interface VideoMeta {
    /** Marca de canvas2; distingue esto de cualquier otro `customData`. */
    c2: typeof VIDEO_MARKER;
    /** URL reproducible del vídeo en la mediateca. */
    src: string;
    /** Id del fichero en MediaMonster, para poder volver a él. */
    mediaFileId?: string | null;
    /** Segundo del que salió la portada actual. */
    posterTime?: number;
    /** Duración conocida, para pintar la barra sin tener que cargar el vídeo. */
    durationSec?: number | null;
    name?: string | null;
}
/** ¿Este elemento representa un vídeo? */
export declare function isVideoElement(el: SceneElement): boolean;
/** Los datos del vídeo de un elemento, o `null` si no lo es. */
export declare function getVideoMeta(api: ExcalidrawImperativeAPI, elementId: string): VideoMeta | null;
/**
 * El vídeo seleccionado ahora mismo, si la selección es exactamente uno.
 *
 * Con varios seleccionados devuelve `null` a propósito: "elegir fotograma" solo
 * tiene sentido sobre uno, y aplicarlo al primero de una selección múltiple es
 * la clase de atajo que acaba cambiando la portada equivocada.
 */
export declare function getSelectedVideo(api: ExcalidrawImperativeAPI | null): {
    id: string;
    meta: VideoMeta;
} | null;
export interface InsertVideoOptions extends InsertImageOptions {
    mediaFileId?: string | null;
    durationSec?: number | null;
    name?: string | null;
    /** Segundo del que salió el póster que se está insertando. */
    posterTime?: number;
}
/**
 * Inserta un vídeo: entra su póster como imagen, marcado como vídeo.
 *
 * El póster viaja por REFERENCIA al CDN igual que cualquier imagen — los bytes
 * nunca entran en `editorConfig` (ver media.ts). El vínculo con el vídeo va en
 * `customData`, que Excalidraw serializa y devuelve intacto, así que sobrevive
 * al guardado y a la recarga sin tocar el formato de la escena.
 */
export declare function insertVideo(api: ExcalidrawImperativeAPI, posterUrl: string, videoSrc: string, opts?: InsertVideoOptions): Promise<string>;
/**
 * Cambia el fotograma de portada de un vídeo ya insertado.
 *
 * Recibe la URL del póster NUEVO (ya subido a la mediateca por el host: los
 * bytes no son cosa de este paquete) y el instante del que salió, que se guarda
 * para que la próxima vez que abras el selector la barra empiece donde la
 * dejaste, no en cero.
 *
 * Reutiliza el elemento en su sitio y con su tamaño: es un cambio de portada,
 * no una inserción — recolocarlo o redimensionarlo tiraría la maquetación.
 */
export declare function setVideoPoster(api: ExcalidrawImperativeAPI, elementId: string, poster: {
    url: string;
    timeSec: number;
    mimeType?: string;
}): boolean;
//# sourceMappingURL=video.d.ts.map