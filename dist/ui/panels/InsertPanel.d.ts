import { type ExcalidrawImperativeAPI } from '../../core/excal';
import { type PartialLabels } from '../shared/labels';
export declare function InsertPanel({ api, pageId, text, labels, families }: {
    api: ExcalidrawImperativeAPI;
    pageId: string | null;
    text?: boolean;
    labels?: PartialLabels;
    families?: {
        heading: string | null;
        body: string | null;
    };
}): import("react").JSX.Element;
//# sourceMappingURL=InsertPanel.d.ts.map