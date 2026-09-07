import { type ExcalidrawImperativeAPI } from './excal';
import { type BrandKitInput } from './brand';
import { type PartialLabels } from './labels';
export interface BrandGalleryProps {
    api: ExcalidrawImperativeAPI | null;
    /** `projects.brandKit` crudo; se traduce aquí (ver la prop homónima de Canvas2Editor). */
    brandKit?: BrandKitInput | null;
    theme?: 'light' | 'dark';
    /** Página activa: los logos se insertan dentro de ella. */
    activePageId?: string | null;
    /** En modo lectura la galería no se muestra: todo lo que hace es mutar. */
    viewMode?: boolean;
    /** Dentro de una pestaña del dock: sin flotar, sin marco ni cabecera propia. */
    embedded?: boolean;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
export declare function BrandGallery({ api, brandKit, theme, activePageId, viewMode, embedded, labels: labelsProp, }: BrandGalleryProps): import("react").JSX.Element | null;
//# sourceMappingURL=BrandGallery.d.ts.map