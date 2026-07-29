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
 * La salida es traer los bytes desde nuestro propio origen y sustituir la URL
 * por un dataURL SOLO durante el export, restaurándola después. La escena
 * persistida nunca cambia: `restore()` devuelve el mapa original.
 *
 * El `fetcher` lo inyecta el host (en studio, el proxy del worker), de modo que
 * este módulo no sabe nada de rutas ni de autenticación.
 */

export type MediaFetcher = (url: string) => Promise<Blob>;

export interface HydrateResult {
  /** Cuántas imágenes se convirtieron a dataURL. */
  hydrated: number;
  /** URLs que no se pudieron traer (se dejan como estaban). */
  failed: string[];
  /** Restaura el mapa de ficheros original. Idempotente. */
  restore: () => void;
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
 * Sustituye las URLs remotas del mapa de ficheros por dataURLs. Devuelve un
 * `restore()` que hay que llamar SIEMPRE (en un `finally`), incluso si el
 * export falla, o la escena se quedaría con base64 y al guardarla engordaría.
 */
export async function hydrateFilesForExport(
  api: ExcalidrawImperativeAPI,
  fetcher: MediaFetcher,
): Promise<HydrateResult> {
  const files = api.getFiles();
  const originals = new Map<string, string>();
  const failed: string[] = [];

  const pending = Object.values(files ?? {}).filter((f) =>
    needsHydration((f as { dataURL?: unknown })?.dataURL),
  ) as { id: string; dataURL: string; mimeType: string }[];

  if (pending.length === 0) {
    return { hydrated: 0, failed, restore: () => {} };
  }

  const hydratedFiles: Record<string, unknown> = {};
  await Promise.all(
    pending.map(async (file) => {
      try {
        const blob = await fetcher(file.dataURL);
        const dataURL = await blobToDataUrl(blob, file.mimeType);
        originals.set(file.id, file.dataURL);
        hydratedFiles[file.id] = { ...file, dataURL };
      } catch {
        failed.push(file.dataURL);
      }
    }),
  );

  const hydrated = Object.keys(hydratedFiles).length;
  if (hydrated > 0) {
    // `addFiles` sobrescribe por id: es la vía pública para intercambiar los
    // bytes sin tocar los elementos ni generar una entrada de historial.
    api.addFiles(Object.values(hydratedFiles) as Parameters<typeof api.addFiles>[0]);
  }

  let restored = false;
  const restore = () => {
    if (restored || originals.size === 0) return;
    restored = true;
    const current = api.getFiles();
    const back = [...originals.entries()]
      .map(([id, dataURL]) => {
        const f = current?.[id];
        return f ? { ...f, dataURL } : null;
      })
      .filter(Boolean);
    if (back.length > 0) {
      api.addFiles(back as Parameters<typeof api.addFiles>[0]);
    }
  };

  return { hydrated, failed, restore };
}

/**
 * Envuelve cualquier export para que las imágenes remotas estén inlineadas
 * mientras dura, y restaura al terminar pase lo que pase.
 */
export async function withHydratedFiles<T>(
  api: ExcalidrawImperativeAPI,
  fetcher: MediaFetcher,
  run: () => Promise<T>,
): Promise<T> {
  const { restore } = await hydrateFilesForExport(api, fetcher);
  try {
    return await run();
  } finally {
    restore();
  }
}
