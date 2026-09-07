'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tarjeta que sigue al cursor mientras se arrastra una página.
 *
 * El arrastre nativo de HTML5 entrega al navegador una foto congelada y
 * translúcida del elemento origen, a la que no se le puede aplicar CSS. Así que
 * se esconde ese fantasma (`hideNativeDragImage`) y se pinta la nuestra: un
 * portal anclado a <body> que va bajo el cursor.
 *
 * Es un hermano SIMPLIFICADO del `Drag3DPreview` de la web (calendario, kanban,
 * workflows): mismo gesto —levantar la pieza y llevarla pegada al puntero— sin
 * la física de inclinación. No se comparte código a propósito: `@pm/canvas2`
 * no puede depender de `apps/web`, y llevar el componente a un sitio común
 * obligaría al calendario a arrastrar Excalidraw en su bundle. Duplicar setenta
 * líneas sale más barato que cualquiera de las dos.
 */

/** Nodo invisible compartido, para suprimir el fantasma nativo. */
let transparentDragImage: HTMLElement | null = null;

/**
 * Sustituye la imagen de arrastre del navegador por un nodo transparente de
 * 1×1, de modo que solo se vea nuestra tarjeta. Se llama desde `dragstart`.
 */
export function hideNativeDragImage(e: React.DragEvent): void {
  if (typeof document === 'undefined') return;
  if (!transparentDragImage) {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
    transparentDragImage = el;
  }
  try {
    e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
  } catch {
    // `setDragImage` puede lanzar en estados raros; caer al fantasma nativo es
    // peor pero no rompe el arrastre.
  }
}

export interface DragGrab {
  /** Desplazamiento del puntero dentro de la pieza al agarrarla, en px. */
  x: number;
  y: number;
  /** Tamaño de la pieza origen, en px: la tarjeta lo copia para que sea 1:1. */
  width: number;
  height: number;
}

export interface DragPreviewProps {
  active: boolean;
  grab: DragGrab | null;
  children: React.ReactNode;
  radius?: number;
}

export function DragPreview({ active, grab, children, radius = 8 }: DragPreviewProps) {
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // La posición se escribe DIRECTAMENTE en el nodo, sin pasar por el estado de
  // React: `dragover` dispara decenas de veces por segundo y un setState por
  // evento haría re-renderizar la tira entera en cada muestra.
  useEffect(() => {
    if (!active || !grab) return;
    const move = (ev: DragEvent) => {
      const card = cardRef.current;
      // Al soltar, el navegador manda un último evento con coordenadas 0,0 que
      // teletransportaría la tarjeta a la esquina.
      if (!card || (ev.clientX === 0 && ev.clientY === 0)) return;
      card.style.transform = `translate3d(${ev.clientX - grab.x}px, ${ev.clientY - grab.y}px, 0) scale(1.06)`;
    };
    document.addEventListener('dragover', move);
    return () => document.removeEventListener('dragover', move);
  }, [active, grab]);

  if (!mounted || !active || !grab) return null;

  return createPortal(
    <div
      aria-hidden
      ref={cardRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2000,
        width: grab.width,
        height: grab.height,
        borderRadius: radius,
        overflow: 'hidden',
        pointerEvents: 'none',
        boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
        transition: 'none',
        willChange: 'transform',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
