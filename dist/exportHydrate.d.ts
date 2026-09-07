import type { ExcalidrawImperativeAPI } from './excal';
/**
 * Hidratación de imágenes para poder EXPORTAR.
 *
 * Las escenas guardan la imagen como URL remota en `files[id].dataURL`
 * (Excalidraw hace `image.src = <ese campo>`, así que una URL funciona y la
 * escena pesa como un `editorConfig`, no cientos de KB en base64).
 *
 * EL PROBLEMA NO ES LA URL, ES CÓMO SE PIDE. Excalidraw carga con `new Image()`
 * y **no pone `crossOrigin` en ninguna parte** (comprobado sobre su `dist`: cero
 * ocurrencias). Sin ese atributo el navegador pide en modo *no-cors*, y entonces
 * marca el canvas como contaminado AUNQUE el servidor mande
 * `Access-Control-Allow-Origin` — esa cabecera solo se mira si la petición se
 * hizo en modo CORS. Resultado: la imagen se VE pero `toBlob()`/`toDataURL()`
 * mueren con `SecurityError`, o sea que no hay ni miniaturas ni export.
 *
 * La salida es traer los bytes por nuestra cuenta y darle a Excalidraw una URL
 * que NO contamine.
 *
 * IMPORTANTE — por qué se devuelve un mapa nuevo en vez de mutar la escena:
 * `api.addFiles()` delega en `addMissingFiles()`, que hace `continue` con todo
 * id que ya exista. Intentar reemplazar un fichero por esa vía es un NO-OP
 * silencioso: la escena se queda con la URL remota y el export sigue muriendo
 * con SecurityError. Los exportadores de Excalidraw (`exportToBlob`,
 * `exportToSvg`) reciben `files` explícitamente y son puros, así que aceptan
 * este mapa sin que la escena viva se entere.
 *
 * Que el mapa sea paralelo es además lo que hace seguro usar `blob:` aquí: un
 * `blob:` guardado en una escena la deja en blanco al reabrirla (ya pasó), pero
 * este mapa NUNCA se guarda.
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
export interface HydrateOptions {
    /**
     * Qué URL se le da a Excalidraw:
     *
     *   · `'blob'` (por defecto) — `URL.createObjectURL(blob)`. Es same-origin, no
     *     contamina, y NO hay que codificar nada: los bytes se quedan fuera del
     *     heap de JS. Vale para todo lo que acabe en un canvas (PNG y miniaturas).
     *   · `'dataurl'` — base64. Solo hace falta para `exportToSvg`, porque ahí los
     *     bytes viajan DENTRO del SVG y un `blob:` no sobreviviría al fichero.
     *
     * El base64 cuesta: infla un 33% y construye una cadena enorme a trozos en el
     * hilo principal. Por eso dejó de ser el modo por defecto.
     */
    output?: 'blob' | 'dataurl';
    /** Fuerza el `fetcher` inyectado y salta el intento directo. Para tests. */
    preferProxy?: boolean;
}
/** Vacía la caché y revoca los `blob:` vivos. Para los tests y para un "recargar imágenes". */
export declare function clearHydrationCache(): void;
/**
 * Construye un mapa de ficheros con las URLs remotas sustituidas por otras que
 * no contaminan el canvas. No toca la escena. Las que fallen se dejan tal cual y
 * se listan en `failed`, para que quien llame decida si avisa o aborta —
 * exportar con una de ellas dentro volverá a contaminar el canvas.
 */
export declare function buildHydratedFiles(api: ExcalidrawImperativeAPI, fetcher: MediaFetcher, { output, preferProxy }?: HydrateOptions): Promise<HydratedFiles>;
export {};
//# sourceMappingURL=exportHydrate.d.ts.map