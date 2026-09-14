import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { DocumentImportError } from '../documents/model';

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  value: string;
}

const parser = new XMLParser({
  preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '',
  trimValues: false, parseTagValue: false, processEntities: true,
});

/** Namespace prefixes may vary. Keep qualified attributes (id and r:id differ). */
export function xml(text: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) {
    throw new DocumentImportError('invalid-file', 'Invalid XML or unsupported DTD.');
  }
  function nodes(items: Record<string, unknown>[], depth = 0): XmlNode[] {
    if (depth > 128) throw new DocumentImportError('limit-exceeded', 'XML nesting exceeds 128 levels.');
    return items.flatMap(item => Object.keys(item).filter(k => k !== ':@').map(key => ({
      name: key.split(':').pop()!,
      attrs: Object.fromEntries(Object.entries((item[':@'] ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)])),
      children: Array.isArray(item[key]) ? nodes(item[key] as Record<string, unknown>[], depth + 1) : [],
      value: typeof item[key] === 'string' ? item[key] as string : '',
    })));
  }
  return { name: 'root', attrs: {}, value: '', children: nodes(parser.parse(text)) };
}

export const child = (node: XmlNode | undefined, name: string) => node?.children.find(n => n.name === name);
export const children = (node: XmlNode | undefined, name: string) => node?.children.filter(n => n.name === name) ?? [];
export function descendants(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.flatMap(n => [...(n.name === name ? [n] : []), ...descendants(n, name)]) : [];
}
export const value = (node: XmlNode | undefined): string => node ? node.value + node.children.map(value).join('') : '';
export function relationId(node: XmlNode, localName: string): string | undefined {
  return Object.entries(node.attrs).find(([key]) => key.endsWith(`:${localName}`))?.[1];
}
