import { type ReactNode } from 'react';
import { type MenuEntry } from './SlidesMenu';
export interface MenuBarMenu {
    id: string;
    label: string;
    items: MenuEntry[];
}
export interface SlidesMenuBarProps {
    /** Nombre de la presentación (lo da el host); sin él, solo los menús. */
    title?: string;
    menus: MenuBarMenu[];
    label: string;
    /** Texto a la derecha (p. ej. «Exportando…»). */
    status?: string;
    /** Lo que va en el extremo derecho de la fila (el botón Presentar). */
    end?: ReactNode;
}
/**
 * La fila de menús de Slides: el nombre de la presentación y Archivo, Editar,
 * Ver… Con un menú abierto, pasar el ratón por otro lo abre (como en un
 * escritorio); las flechas izquierda/derecha saltan de uno a otro.
 */
export declare function SlidesMenuBar({ title, menus, label, status, end }: SlidesMenuBarProps): import("react").JSX.Element;
//# sourceMappingURL=SlidesMenuBar.d.ts.map