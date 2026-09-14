import type { ExcalidrawImperativeAPI } from '../../core/excal';
import { type PartialLabels } from '../shared/labels';
/**
 * Aviso de elementos fuera de toda página.
 *
 * El problema no es que se puedan quedar sueltos —el plano es infinito y a veces
 * quieres apartar cosas— sino que desaparecen sin decir nada: un elemento sin
 * página se ve en el lienzo, se guarda con el diseño, y NO sale ni en el panel
 * de capas ni en ningún export ni en la miniatura. Descubrirlo entregando el
 * PNG al cliente es tarde.
 *
 * Ya existía la vía de arreglo ("Convertir en páginas", en el menú), pero había
 * que ir a buscarla sabiendo que el problema existe. Esto lo dice.
 *
 * Deliberadamente no bloquea nada y se puede descartar: apartar cosas del
 * lienzo mientras trabajas es legítimo, y un aviso que no se calla se convierte
 * en ruido que se ignora. Al descartarlo no vuelve hasta que cambia la cuenta.
 */
export interface LooseWarningProps {
    api: ExcalidrawImperativeAPI | null;
    activePageId: string | null;
    theme?: 'light' | 'dark';
    viewMode?: boolean;
    labels?: PartialLabels;
}
export declare function LooseWarning({ api, activePageId, theme, viewMode, labels }: LooseWarningProps): import("react").JSX.Element | null;
//# sourceMappingURL=LooseWarning.d.ts.map