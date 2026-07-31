import type { ExcalidrawImperativeAPI, SceneElement } from './excal';
import { commitElements } from './mutate';
import { insertImageFromUrl, type InsertImageOptions } from './media';

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
export const VIDEO_MARKER = 'video';

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

function readMeta(el: SceneElement): VideoMeta | null {
  const data = (el as { customData?: unknown }).customData;
  if (!data || typeof data !== 'object') return null;
  const meta = data as Partial<VideoMeta>;
  if (meta.c2 !== VIDEO_MARKER || typeof meta.src !== 'string' || !meta.src) return null;
  return meta as VideoMeta;
}

/** ¿Este elemento representa un vídeo? */
export function isVideoElement(el: SceneElement): boolean {
  return readMeta(el) !== null;
}

/** Los datos del vídeo de un elemento, o `null` si no lo es. */
export function getVideoMeta(
  api: ExcalidrawImperativeAPI,
  elementId: string,
): VideoMeta | null {
  const el = api.getSceneElements().find((e) => e.id === elementId);
  return el ? readMeta(el) : null;
}

/**
 * El vídeo seleccionado ahora mismo, si la selección es exactamente uno.
 *
 * Con varios seleccionados devuelve `null` a propósito: "elegir fotograma" solo
 * tiene sentido sobre uno, y aplicarlo al primero de una selección múltiple es
 * la clase de atajo que acaba cambiando la portada equivocada.
 */
export function getSelectedVideo(
  api: ExcalidrawImperativeAPI | null,
): { id: string; meta: VideoMeta } | null {
  if (!api) return null;
  const seleccion = Object.keys(
    (api.getAppState() as unknown as { selectedElementIds?: Record<string, boolean> })
      .selectedElementIds ?? {},
  );
  if (seleccion.length !== 1) return null;
  const el = api.getSceneElements().find((e) => e.id === seleccion[0]);
  if (!el) return null;
  const meta = readMeta(el);
  return meta ? { id: el.id, meta } : null;
}

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
export async function insertVideo(
  api: ExcalidrawImperativeAPI,
  posterUrl: string,
  videoSrc: string,
  opts: InsertVideoOptions = {},
): Promise<string> {
  const id = await insertImageFromUrl(api, posterUrl, opts);
  const meta: VideoMeta = {
    c2: VIDEO_MARKER,
    src: videoSrc,
    mediaFileId: opts.mediaFileId ?? null,
    posterTime: opts.posterTime ?? 0,
    durationSec: opts.durationSec ?? null,
    name: opts.name ?? null,
  };
  const elements = api.getSceneElements();
  commitElements(
    api,
    elements.map((e) =>
      e.id === id ? ({ ...e, customData: meta, version: e.version + 1 } as SceneElement) : e,
    ),
  );
  return id;
}

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
export function setVideoPoster(
  api: ExcalidrawImperativeAPI,
  elementId: string,
  poster: { url: string; timeSec: number; mimeType?: string },
): boolean {
  const elements = api.getSceneElements();
  const el = elements.find((e) => e.id === elementId);
  const meta = el ? readMeta(el) : null;
  if (!el || !meta) return false;

  // Fichero NUEVO en vez de reescribir el existente: `addFiles` de Excalidraw
  // ignora los ids que ya conoce (hace `continue`), así que reutilizar el id
  // dejaría la portada vieja en pantalla aunque la escena dijera otra cosa.
  const fileId = `c2v_${elementId}_${Math.round(poster.timeSec * 1000)}`;
  api.addFiles([
    {
      id: fileId,
      mimeType: poster.mimeType ?? 'image/webp',
      dataURL: poster.url,
      created: 0,
      lastRetrieved: 0,
    } as never,
  ]);

  commitElements(
    api,
    elements.map((e) =>
      e.id === elementId
        ? ({
            ...e,
            fileId,
            status: 'saved',
            customData: { ...meta, posterTime: poster.timeSec },
            version: e.version + 1,
            // Vía `unknown`: `fileId` solo existe en el elemento imagen y el
            // tipo unión de Excalidraw no lo admite en un literal, aunque en
            // ejecución el elemento SEA una imagen (lo garantiza `readMeta`).
          } as unknown as SceneElement)
        : e,
    ),
  );
  return true;
}
