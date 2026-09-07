import type { ExcalidrawImperativeAPI } from './excal';
import { type BrandKitInput } from './brand';
import { type PartialLabels } from './labels';
export interface DesignPanelProps {
    api: ExcalidrawImperativeAPI;
    activePageId: string | null;
    theme?: 'light' | 'dark';
    viewMode?: boolean;
    /** `projects.brandKit` crudo; lo traduce `BrandGallery`. */
    brandKit?: BrandKitInput | null;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
export declare function DesignPanel({ api, activePageId, theme, viewMode, brandKit, labels: labelsProp, }: DesignPanelProps): import("react").JSX.Element;
//# sourceMappingURL=DesignPanel.d.ts.map