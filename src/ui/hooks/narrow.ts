'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * El ancho al que EXCALIDRAW cambia a su distribución de móvil: barra de
 * herramientas arriba y una isla de botones pegada abajo (`.App-bottom-bar`),
 * más la columna de utilidades en el borde derecho (`mobile-misc-tools-container`).
 *
 * Está en 861 medido sobre su propio contenedor, no sobre la ventana — con la
 * barra lateral de la app abierta el lienzo es bastante más estrecho que la
 * pantalla. La app tiene su propio `useIsMobile` a 768, y esa diferencia era
 * justamente el motivo de que entre 768 y 860 nuestro cromo se creyera de
 * escritorio mientras Excalidraw ya había cambiado, y se pisaran.
 */
export const EXCALIDRAW_MOBILE_BREAKPOINT = 861;

/**
 * ¿El contenedor es tan estrecho como para que Excalidraw esté en su modo
 * móvil? Se mide el contenedor con `ResizeObserver`, no `window.matchMedia`:
 * abrir o cerrar la barra lateral cambia el ancho del lienzo sin que cambie el
 * de la ventana.
 */
export function useIsNarrow(ref: RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setNarrow(el.getBoundingClientRect().width < EXCALIDRAW_MOBILE_BREAKPOINT);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return narrow;
}
