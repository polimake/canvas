import type { ExcalidrawImperativeAPI } from './excal';

/**
 * Hidratación de imágenes para poder EXPORTAR.
 *
 * Las escenas migradas guardan la imagen como URL remota en `files[id].dataURL`
 * (Excalidraw hace `image.src = <ese campo>`, así que una URL funciona y la
 * escena pesa como un `editorConfig`, no cientos de KB en base64).
 *
 * El problema aparece solo al exportar. Medido en Chromium contra el CDN real:
 *
 *   sin crossOrigin  → la imagen se ve, pero contamina el canvas y
 *                      `toDataURL` lanza `SecurityError`.
 *   con crossOrigin  → ni carga: el CDN no manda `Access-Control-Allow-Origin`.
 *
 * La salida es traer los bytes desde nuestro propio origen y construir un mapa
 * de ficheros PARALELO con los bytes inlineados, que se pasa al exportador.
 *
 * IMPORTANTE — por qué se devuelve un mapa nuevo en vez de mutar la escena:
 * `api.addFiles()` delega en `addMissingFiles()`, que hace `continue` con todo
 * id que ya exista. Intentar reemplazar un fichero por esa vía es un NO-OP
 * silencioso: la escena se queda con la URL remota y el export sigue muriendo
 * con SecurityError. Los exportadores de Excalidraw (`exportToBlob`,
 * `exportToSvg`) reciben `files` explícitamente y son puros, así que aceptan
 * este mapa sin que la escena viva se entere.
 *
 * El `fetcher` lo inyecta el host (en studio, el proxy del worker), de modo que
 * este módulo no sabe nada de rutas ni de autenticación.
 */

export type MediaFetcher = (url: string) => Promise<Blob>;

/** Forma mínima de una entrada del mapa de ficheros de Excalidraw. */
interface FileEntry {
  id: string;
  dataURL: string;
  mimeType: string;
}

export interface HydratedFiles {
  /** Mapa listo para `ExportOptions.files`. */
  files: Record<string, FileEntry>;
  /** Cuántas imágenes se inlinearon. */
  hydrated: number;
  /** URLs que no se pudieron traer. Se quedan como estaban ⇒ contaminarían. */
  failed: string[];
}

/**
 * Blob → dataURL sin `FileReader`: así funciona igual en el navegador y en los
 * tests de node. Se codifica por trozos porque `String.fromCharCode(...bytes)`
 * con una imagen entera revienta la pila de llamadas.
 */
async function blobToDataUrl(blob: Blob, fallbackMime: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || fallbackMime};base64,${btoa(binary)}`;
}

/** Un dataURL ya está inlineado; cualquier otra cosa hay que traerla. */
function needsHydration(value: unknown): value is string {
  return typeof value === 'string' && !value.startsWith('data:');
}

/**
 * Construye un mapa de ficheros con las URLs remotas convertidas a dataURL.
 * No toca la escena. Las que fallen se dejan tal cual y se listan en `failed`,
 * para que quien llame decida si avisa o aborta — exportar con una de ellas
 * dentro volverá a contaminar el canvas.
 */
export async function buildHydratedFiles(
  api: ExcalidrawImperativeAPI,
  fetcher: MediaFetcher,
): Promise<HydratedFiles> {
  const source = (api.getFiles() ?? {}) as Record<string, FileEntry>;
  const files: Record<string, FileEntry> = { ...source };
  const failed: string[] = [];
  let hydrated = 0;

  const pending = Object.values(source).filter((f) => needsHydration(f?.dataURL));
  if (pending.length === 0) return { files, hydrated, failed };

  await Promise.all(
    pending.map(async (file) => {
      try {
        const blob = await fetcher(file.dataURL);
        files[file.id] = { ...file, dataURL: await blobToDataUrl(blob, file.mimeType) };
        hydrated += 1;
      } catch {
        failed.push(file.dataURL);
      }
    }),
  );

  return { files, hydrated, failed };
}
