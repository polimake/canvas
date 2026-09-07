import type { ExcalidrawImperativeAPI } from './excal';
import { type PartialLabels } from './labels';
export interface PageActionsProps {
    api: ExcalidrawImperativeAPI;
    activePageId?: string | null;
    theme?: 'light' | 'dark';
    onActiveChange?: (id: string) => void;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
export declare function PageActions({ api, activePageId, theme, onActiveChange, labels: labelsProp, }: PageActionsProps): import("react").JSX.Element | null;
//# sourceMappingURL=PageActions.d.ts.map