import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '../../core/excal';
import { exportScenePng, type ExportOptions } from '../../core/export';
import { listPages } from '../../core/pages';

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

type FileLike = { dataURL?: unknown };

function pageElements(api: ExcalidrawImperativeAPI, pageId: string) {
  return api.getSceneElements().filter((e) => e.id === pageId || e.frameId === pageId);
}

/** El fichero de una imagen, si la escena ya lo tiene. */
function fileOf(api: ExcalidrawImperativeAPI, el: unknown): FileLike | undefined {
  const { type, fileId } = el as { type?: string; fileId?: string | null };
  if (type !== 'image' || !fileId) return undefined;
  return (api.getFiles() as Record<string, FileLike> | undefined)?.[fileId];
}

function pageFingerprint(api: ExcalidrawImperativeAPI, pageId: string): string {
  // Si el fichero de una imagen llega DESPUÉS que su elemento, la huella cambia
  // y la miniatura se rehace con la foto.
  return pageElements(api, pageId)
    .map((e) => {
      const { type, fileId } = e as { type?: string; fileId?: string | null };
      const pending = type === 'image' && fileId && !fileOf(api, e) ? '?' : '';
      return `${e.id}:${e.version}${pending}`;
    })
    .join(',');
}

/**
 * Si la página lleva alguna foto por URL (`http:`/`https:`: una foto vinculada
 * que sirve `http_local`, una de Media). Excalidraw la carga sin `crossOrigin`,
 * así que rasterizarla tal cual contamina el canvas y `toBlob()` muere con
 * SecurityError (#342). Un `data:` o un `blob:` no contaminan.
 */
function pageNeedsHydration(api: ExcalidrawImperativeAPI, pageId: string): boolean {
  return pageElements(api, pageId).some((e) => {
    const url = fileOf(api, e)?.dataURL;
    return typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:');
  });
}

export function usePageThumbnails(
  api: ExcalidrawImperativeAPI | null,
  opts?: {
    enabled?: boolean;
    files?: FilesMap;
    /**
     * Lado mayor de la miniatura, en px. 64 para los chips de la tira de
     * páginas; la tira de diapositivas del espacio Presentación las pinta a
     * ~170 px y pide el doble para pantallas densas.
     */
    width?: number;
    /**
     * Cómo pedirle al host el mapa hidratado cuando no lo pasa en `files`: el
     * mismo `hydrateFiles` del menú de exportar. Se llama solo si una página que
     * hay que rasterizar lleva fotos por URL, y como mucho una vez por latido.
     * Sin esto, una diapositiva con una foto vinculada salía en blanco (#342):
     * ningún host pasaba `files`, así que se rasterizaba la URL tal cual.
     */
    hydrate?: () => Promise<FilesMap>;
  },
): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  /** pageId → huella con la que se generó la miniatura viva. */
  const stampsRef = useRef<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const enabled = opts?.enabled ?? true;
  const files = opts?.files;
  const width = opts?.width ?? THUMB_WIDTH;

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
  const hydrateRef = useRef(opts?.hydrate);
  hydrateRef.current = opts?.hydrate;

  useEffect(() => {
    if (!api || !enabled) return;
    let cancelled = false;
    // El latido corre cada 600 ms mientras el editor está montado (también con
    // la pestaña en otra vista). Antes cada tick tomaba la huella de cada página
    // y guardaba un objeto nuevo aunque nada cambiase: un render del navegador
    // cada 600 ms. Ahora un tick sin cambios en la escena no hace nada.
    let lastSceneVersion = -1;
    let lastFilesCount = -1;
    let running = false;

    const tick = async () => {
      if (running || document.visibilityState === 'hidden') return;
      // Versión de la escena entera: número de elementos + suma de versiones
      // (borrar uno lo saca de la lista). Sin cambios → nada que rasterizar.
      const all = api.getSceneElements();
      let sceneVersion = all.length;
      for (const el of all) sceneVersion += el.version;
      // Los ficheros llegan aparte de los elementos: una foto cuyo fichero entra
      // después también es un cambio (ver `pageFingerprint`).
      const filesCount = Object.keys(api.getFiles() ?? {}).length;
      if (sceneVersion === lastSceneVersion && filesCount === lastFilesCount) return;
      running = true;
      let changed = false;
      const hostFiles = filesRef.current;
      /** El mapa hidratado de este latido, pedido al host la primera vez que hace falta. */
      let hydrated: Promise<FilesMap | undefined> | null = null;
      const filesFor = (pageId: string): Promise<FilesMap | undefined> => {
        if (hostFiles) return Promise.resolve(hostFiles);
        const hydrate = hydrateRef.current;
        if (!hydrate || !pageNeedsHydration(api, pageId)) return Promise.resolve(undefined);
        hydrated ??= hydrate().catch((err: unknown) => {
          console.warn('[canvas2] no se pudieron hidratar las fotos de las miniaturas', err);
          return undefined;
        });
        return hydrated;
      };
      const pages = listPages(api);
      const live = new Set(pages.map((p) => p.id));

      // Soltar las miniaturas de páginas borradas.
      for (const id of Object.keys(urlsRef.current)) {
        if (!live.has(id)) {
          URL.revokeObjectURL(urlsRef.current[id]);
          delete urlsRef.current[id];
          delete stampsRef.current[id];
          changed = true;
        }
      }

      for (const page of pages) {
        const stamp = `${pageFingerprint(api, page.id)}|${filesToken}`;
        if (stampsRef.current[page.id] === stamp) continue;
        let files: FilesMap | undefined;
        try {
          files = await filesFor(page.id);
          if (cancelled) return;
          const blob = await exportScenePng(api, {
            pageId: page.id,
            maxWidthOrHeight: width,
            background: true,
            ...(files ? { files } : {}),
          });
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          const prev = urlsRef.current[page.id];
          urlsRef.current[page.id] = next;
          stampsRef.current[page.id] = stamp;
          changed = true;
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
      running = false;
      if (cancelled) return;
      lastSceneVersion = sceneVersion;
      lastFilesCount = filesCount;
      if (changed) setThumbs({ ...urlsRef.current });
    };

    void tick();
    const id = setInterval(() => void tick(), DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // `filesToken` y no `files`: el host publica un objeto nuevo en cada
    // captura, y con su identidad este efecto se reiniciaría cada 10 segundos.
  }, [api, enabled, filesToken, width]);

  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = {};
    },
    [],
  );

  return thumbs;
}
