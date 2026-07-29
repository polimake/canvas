import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import { exportScenePng } from './export';
import { listPages } from './pages';

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

type FilesMap = Parameters<typeof exportScenePng>[1] extends { files?: infer F } ? F : never;

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

  useEffect(() => {
    if (!api || !enabled) return;
    let cancelled = false;

    const tick = async () => {
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
        const stamp = pageFingerprint(api, page.id);
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
        } catch {
          // Página que no se puede rasterizar (imagen remota sin hidratar):
          // se queda sin miniatura y el chip cae a su texto. No se reintenta
          // hasta que cambie, para no rasterizar en bucle.
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
  }, [api, enabled, files]);

  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = {};
    },
    [],
  );

  return thumbs;
}
