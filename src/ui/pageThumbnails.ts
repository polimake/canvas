import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '../core/excal';
import { exportScenePng, type ExportOptions } from '../core/export';
import { listPages } from '../core/pages';

/**
 * Miniaturas por página para el navegador — lo que el editor legacy muestra en
 * su tira de páginas.
 *
 * Rasteriza cada frame a un ancho diminuto y cachea por `pageId` + huella de la
 * página. La huella son las versiones de los elementos QUE PERTENECEN a esa
 * página, así que editar la página 3 no invalida las miniaturas de las otras:
 * con documentos de varias páginas eso es la diferencia entre repintar una y
 * repintar todas en cada pulsación.
 *
 * Las escenas migradas guardan las imágenes por URL remota, que contaminan el
 * canvas. Por eso `files` es un parámetro: el host pasa el mapa hidratado
 * (`buildHydratedFiles`) y, si no lo pasa, las páginas con imagen remota
 * simplemente no producen miniatura en vez de reventar el navegador entero.
 */

const THUMB_WIDTH = 64;
/** Espaciado entre recálculos: editar no debe disparar un render por tecla. */
const DEBOUNCE_MS = 600;

/**
 * Mapa de ficheros hidratado que acepta el exportador.
 *
 * Se saca de `ExportOptions` y NO de `Parameters<typeof exportScenePng>[1]`:
 * ese parámetro es opcional, así que su tipo incluye `undefined`, y
 * `{…} | undefined extends { files?: infer F }` no encaja y colapsa a `never` —
 * con lo que la prop `thumbnailFiles` solo admitía `undefined` y era imposible
 * pasarle el mapa de verdad.
 */
export type FilesMap = NonNullable<ExportOptions['files']>;

function pageFingerprint(api: ExcalidrawImperativeAPI, pageId: string): string {
  return api
    .getSceneElements()
    .filter((e) => e.id === pageId || e.frameId === pageId)
    .map((e) => `${e.id}:${e.version}`)
    .join(',');
}

export function usePageThumbnails(
  api: ExcalidrawImperativeAPI | null,
  opts?: { enabled?: boolean; files?: FilesMap },
): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  /** pageId → huella con la que se generó la miniatura viva. */
  const stampsRef = useRef<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const enabled = opts?.enabled ?? true;
  const files = opts?.files;

  /**
   * Identidad ESTABLE del mapa de ficheros, por sus claves.
   *
   * Entra en la huella de cada página, y ese detalle es el que arregla el fallo
   * de "las miniaturas nunca aparecen": en el primer tick el mapa hidratado aún
   * no ha llegado, rasterizar revienta por canvas contaminado y el `catch`
   * marcaba la página como hecha para no reintentar en bucle. Cuando la
   * hidratación llegaba, la huella seguía siendo la misma, así que se saltaba
   * todas las páginas y no se rasterizaba ninguna nunca más.
   *
   * Se usan las CLAVES y no la identidad del objeto porque el host publica un
   * mapa nuevo en cada captura (cada 10 s): con la identidad, todas las páginas
   * se rerasterizarían en cada latido.
   */
  const filesToken = files ? Object.keys(files).sort().join(',') : '';
  // El mapa se lee por referencia dentro del tick para que el efecto NO dependa
  // de su identidad, solo de `filesToken`.
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    if (!api || !enabled) return;
    let cancelled = false;

    const tick = async () => {
      const files = filesRef.current;
      const pages = listPages(api);
      const live = new Set(pages.map((p) => p.id));

      // Soltar las miniaturas de páginas borradas.
      for (const id of Object.keys(urlsRef.current)) {
        if (!live.has(id)) {
          URL.revokeObjectURL(urlsRef.current[id]);
          delete urlsRef.current[id];
          delete stampsRef.current[id];
        }
      }

      for (const page of pages) {
        const stamp = `${pageFingerprint(api, page.id)}|${filesToken}`;
        if (stampsRef.current[page.id] === stamp) continue;
        try {
          const blob = await exportScenePng(api, {
            pageId: page.id,
            maxWidthOrHeight: THUMB_WIDTH,
            background: true,
            ...(files ? { files } : {}),
          });
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          const prev = urlsRef.current[page.id];
          urlsRef.current[page.id] = next;
          stampsRef.current[page.id] = stamp;
          if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1_000);
        } catch (err) {
          // Una página que no rasteriza se queda sin miniatura y el chip cae a
          // su marco vacío. No se reintenta con la MISMA huella para no
          // rasterizar en bucle; al llegar el mapa hidratado la huella cambia y
          // se vuelve a intentar sola.
          console.warn(
            `[canvas2] miniatura de página fallida (${page.name}) · ficheros hidratados: ${
              files ? Object.keys(files).length : 0
            }`,
            err,
          );
          stampsRef.current[page.id] = stamp;
        }
      }
      if (!cancelled) setThumbs({ ...urlsRef.current });
    };

    void tick();
    const id = setInterval(() => void tick(), DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // `filesToken` y no `files`: el host publica un objeto nuevo en cada
    // captura, y con su identidad este efecto se reiniciaría cada 10 segundos.
  }, [api, enabled, filesToken]);

  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = {};
    },
    [],
  );

  return thumbs;
}
