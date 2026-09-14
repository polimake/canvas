export interface XmlNode {
    name: string;
    attrs: Record<string, string>;
    children: XmlNode[];
    value: string;
}
/** Namespace prefixes may vary. Keep qualified attributes (id and r:id differ). */
export declare function xml(text: string): XmlNode;
export declare const child: (node: XmlNode | undefined, name: string) => XmlNode | undefined;
export declare const children: (node: XmlNode | undefined, name: string) => XmlNode[];
export declare function descendants(node: XmlNode | undefined, name: string): XmlNode[];
export declare const value: (node: XmlNode | undefined) => string;
export declare function relationId(node: XmlNode, localName: string): string | undefined;
//# sourceMappingURL=xml.d.ts.map