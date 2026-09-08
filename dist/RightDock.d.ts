import { type ReactNode } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import type { BrandKitInput } from './brand';
import { type PartialLabels } from './labels';
export interface RightDockProps {
    api: ExcalidrawImperativeAPI | null;
    activePageId: string | null;
    theme?: 'light' | 'dark';
    /** Excalidraw está en su distribución de móvil: ver `narrow.ts`. */
    narrow?: boolean;
    viewMode?: boolean;
    /** `projects.brandKit` crudo, para la pestaña Diseño. */
    brandKit?: BrandKitInput | null;
    /** Capas requiere el modelo de páginas: sin él no hay página activa que listar. */
    layers?: boolean;
    /** Diseño requiere el modelo de páginas: tamaño y fondo son de UNA página. */
    design?: boolean;
    /** Rejilla de componentes del proyecto; la aporta el host. Sin ella, no hay pestaña. */
    componentsPanel?: ReactNode;
    /**
     * Un asistente que trabaje sobre esta escena; lo aporta el host. Sin él, no
     * hay pestaña.
     *
     * Mismo trato que `componentsPanel`: canvas2 pone el marco y no sabe qué
     * hay dentro. Lo único que cambia es el ancho —una conversación en 248px no
     * se lee— así que esta pestaña abre la pastilla más ancha que las otras.
     */
    agentPanel?: ReactNode;
    /** Textos, inyectados por el host (ver labels.ts). */
    labels?: PartialLabels;
}
export declare function RightDock({ api, activePageId, theme, narrow, viewMode, brandKit, layers, design, componentsPanel, agentPanel, labels: labelsProp, }: RightDockProps): import("react").JSX.Element | null;
//# sourceMappingURL=RightDock.d.ts.map