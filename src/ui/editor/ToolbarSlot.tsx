'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** La fila de herramientas de Excalidraw, dentro de su píldora. */
const TOOLBAR_ROW = '.App-toolbar > .Stack_horizontal';

/**
 * Pinta `children` al final de la píldora de herramientas de Excalidraw.
 *
 * Excalidraw no ofrece hueco (túnel) en su barra, así que se busca la fila por
 * su clase y se monta un portal. La barra puede desmontarse y volver (modo
 * lectura, cambio a móvil), por eso se vigila el árbol y se vuelve a buscar:
 * sin fila, no se pinta nada.
 */
export function ToolbarSlot({ root, children }: { root: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [row, setRow] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const find = () => setRow(host.querySelector<HTMLElement>(TOOLBAR_ROW));
    find();
    const observer = new MutationObserver(find);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root]);
  return row ? createPortal(children, row) : null;
}
