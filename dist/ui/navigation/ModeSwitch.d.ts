import type { Canvas2Labels } from '../shared/labels';
import type { Canvas2Theme } from '../shared/theme';
/** Qué se puede hacer con el lienzo: mirarlo, señalar en él o editarlo. */
export type Canvas2Mode = 'view' | 'comment' | 'edit';
export interface Canvas2ModeControl {
    mode: Canvas2Mode;
    onChange: (mode: Canvas2Mode) => void;
    /**
     * Los modos a los que puede pasar quien mira (sale de su permiso: con
     * edición los tres, con comentarios Ver y Comentar, solo lectura nada más
     * que Ver). Con uno solo no se pinta nada: no hay nada que elegir.
     */
    modes: Canvas2Mode[];
}
interface ModeSwitchProps extends Canvas2ModeControl {
    theme?: Canvas2Theme;
    narrow?: boolean;
    labels: Canvas2Labels['mode'];
}
/**
 * Ver · Comentar · Editar como iconos, iguales a los de la tira de arriba a la
 * derecha (Marca, Página, Capas): botones redondos de 32 px sin fondo, gris
 * cálido y el activo en tinta. Van en la misma columna, abajo, así los dos
 * grupos de iconos del borde derecho se leen como uno. El nombre, al pasar.
 */
export declare function ModeSwitch({ mode, onChange, modes, theme, narrow, labels }: ModeSwitchProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=ModeSwitch.d.ts.map