import { type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from '../../../core/excal';
export interface SpeakerNotesProps {
    api: ExcalidrawImperativeAPI;
    pageId: string | null;
    label: string;
    placeholder: string;
    readOnly?: boolean;
    style?: CSSProperties;
}
/**
 * La caja de notas del orador, debajo de la diapositiva.
 *
 * Se escribe en local y se guarda al salir de la caja o al cambiar de
 * diapositiva: una entrada de deshacer por edición, no una por tecla. Mientras
 * no tiene el foco sigue a la escena, para que deshacer o la llegada de otra
 * versión del diseño se vean aquí.
 */
export declare function SpeakerNotes({ api, pageId, label, placeholder, readOnly, style }: SpeakerNotesProps): import("react").JSX.Element;
//# sourceMappingURL=SpeakerNotes.d.ts.map