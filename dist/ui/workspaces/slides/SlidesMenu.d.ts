import { type CSSProperties, type ReactNode } from 'react';
/**
 * Menú desplegable del espacio Presentación: lo usan la barra de menús
 * (Archivo, Editar…) y el clic derecho de la tira. Un único componente para
 * que los dos se vean y se manejen igual (Esc, flechas, clic fuera).
 */
export type MenuEntry = {
    kind?: 'item';
    label: string;
    icon?: ReactNode;
    shortcut?: string;
    onSelect: () => void;
    disabled?: boolean;
    /** Opción marcable (Ver › Notas del orador, el tamaño elegido…). */
    checked?: boolean;
} | {
    kind: 'separator';
} | {
    kind: 'submenu';
    label: string;
    icon?: ReactNode;
    items: MenuEntry[];
    disabled?: boolean;
};
export interface SlidesMenuProps {
    label: string;
    items: MenuEntry[];
    onClose: () => void;
    /** Posición, relativa al contenedor del espacio (position: absolute). */
    style: CSSProperties;
    /** Enfoca el primer elemento al abrir (al abrir con teclado). */
    autoFocus?: boolean;
    /**
     * Zona donde pulsar NO cierra el menú: la barra que lo abrió. Sus botones
     * ya abren, cierran o cambian de menú con su clic; si el pulsar los cerrara
     * antes, el clic volvería a abrir el mismo.
     */
    keepOpenWithin?: () => Element | null;
    /** Cambiarlo vuelve a poner el foco en el primero (↓ en un menú abierto con el ratón). */
    focusRequest?: number;
}
export declare function SlidesMenu({ label, items, onClose, style, autoFocus, keepOpenWithin, focusRequest }: SlidesMenuProps): import("react").JSX.Element;
//# sourceMappingURL=SlidesMenu.d.ts.map