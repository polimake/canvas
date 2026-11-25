import type { Canvas2Labels } from '../../shared/labels';
export interface PresentButtonProps {
    labels: Canvas2Labels;
    shortcut: string;
    onPresent: (opts: {
        fromStart: boolean;
        presenter: boolean;
    }) => void;
}
/**
 * «▶ Presentar ▾», arriba a la derecha como el «Presentación» de Slides: el
 * botón presenta desde la diapositiva activa y la flecha ofrece empezar por el
 * principio o con la vista del orador.
 */
export declare function PresentButton({ labels, shortcut, onPresent }: PresentButtonProps): import("react").JSX.Element;
//# sourceMappingURL=PresentButton.d.ts.map