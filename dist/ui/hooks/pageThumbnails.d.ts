import type { ExcalidrawImperativeAPI } from '../../core/excal';
import { type ExportOptions } from '../../core/export';
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
export declare function usePageThumbnails(api: ExcalidrawImperativeAPI | null, opts?: {
    enabled?: boolean;
    files?: FilesMap;
    /**
     * Lado mayor de la miniatura, en px. 64 para los chips de la tira de
     * páginas; la tira de diapositivas del espacio Presentación las pinta a
     * ~170 px y pide el doble para pantallas densas.
     */
    width?: number;
}): Record<string, string>;
//# sourceMappingURL=pageThumbnails.d.ts.map