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

export type Tamanos = ReadonlyMap<string, { width: number; height: number }>;

/**
 * Los elementos con el recorte de cada imagen reescalado a su tamaño en
 * `tamanos` (por `fileId`). Los demás, y los que ya están a su tamaño, tal
 * cual (los mismos objetos).
 */
export function recortesALaImagen<E extends ConRecorte>(elements: readonly E[], tamanos: Tamanos): E[] {
  return elements.map((e) => {
    const crop = e.crop;
    if (e.type !== 'image' || !crop || typeof e.fileId !== 'string') return e;
    const tamano = tamanos.get(e.fileId);
    if (!tamano || tamano.width <= 0 || tamano.height <= 0) return e;
    if (!(crop.naturalWidth > 0) || !(crop.naturalHeight > 0)) return e;
    if (tamano.width === crop.naturalWidth && tamano.height === crop.naturalHeight) return e;
    const sx = tamano.width / crop.naturalWidth;
    const sy = tamano.height / crop.naturalHeight;
    return {
      ...e,
      crop: {
        ...crop,
        x: crop.x * sx,
        y: crop.y * sy,
        width: crop.width * sx,
        height: crop.height * sy,
        naturalWidth: tamano.width,
        naturalHeight: tamano.height,
      },
    };
  });
}

/** El tamaño de una imagen por su dirección, decodificándola. */
function medir(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((listo) => {
    if (typeof Image === 'undefined') return listo(null);
    const img = new Image();
    img.onload = () => listo(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => listo(null);
    img.src = src;
  });
}

/**
 * Los elementos para exportar con `files` (el mapa que da el host): solo se
 * miden las imágenes recortadas, y una que no se deja medir se queda con su
 * recorte de siempre.
 */
export async function elementosParaExportar<E extends ConRecorte>(
  elements: readonly E[],
  files: Readonly<Record<string, { dataURL?: unknown } | undefined>>,
  medirImagen: (src: string) => Promise<{ width: number; height: number } | null> = medir,
): Promise<E[]> {
  const ids = new Set<string>();
  for (const e of elements) {
    if (e.type === 'image' && e.crop && typeof e.fileId === 'string') ids.add(e.fileId);
  }
  if (ids.size === 0) return [...elements];
  const tamanos = new Map<string, { width: number; height: number }>();
  await Promise.all(
    [...ids].map(async (id) => {
      const src = files[id]?.dataURL;
      if (typeof src !== 'string' || !src) return;
      const tamano = await medirImagen(src).catch(() => null);
      if (tamano) tamanos.set(id, tamano);
    }),
  );
  return recortesALaImagen(elements, tamanos);
}
