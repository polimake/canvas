'use client';

import {
  useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { SlidesIcon } from './icons';

/**
 * Menú desplegable del espacio Presentación: lo usan la barra de menús
 * (Archivo, Editar…) y el clic derecho de la tira. Un único componente para
 * que los dos se vean y se manejen igual (Esc, flechas, clic fuera).
 */
export type MenuEntry =
  | {
      kind?: 'item';
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      onSelect: () => void;
      disabled?: boolean;
      /** Opción marcable (Ver › Notas del orador, el tamaño elegido…). */
      checked?: boolean;
    }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: string; icon?: ReactNode; items: MenuEntry[]; disabled?: boolean };

export interface SlidesMenuProps {
  label: string;
  items: MenuEntry[];
  onClose: () => void;
  /** Posición, relativa al contenedor del espacio (position: absolute). */
  style: CSSProperties;
  /** Enfoca el primer elemento al abrir (al abrir con teclado). */
  autoFocus?: boolean;
  /**
   * Zona donde pulsar NO cierra el menú: la barra que lo abrió. Sus botones
   * ya abren, cierran o cambian de menú con su clic; si el pulsar los cerrara
   * antes, el clic volvería a abrir el mismo.
   */
  keepOpenWithin?: () => Element | null;
  /** Cambiarlo vuelve a poner el foco en el primero (↓ en un menú abierto con el ratón). */
  focusRequest?: number;
}

/** Las entradas que recorren las flechas: las de primer nivel, también las que abren submenú. */
const ITEMS = ':scope > [role^="menuitem"]:not([disabled]), :scope > .canvas2-slides-menu-subwrap > [role^="menuitem"]:not([disabled])';

export function SlidesMenu({ label, items, onClose, style, autoFocus = true, keepOpenWithin, focusRequest }: SlidesMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [openSub, setOpenSub] = useState<number | null>(null);
  const [fitStyle, setFitStyle] = useState<CSSProperties>({});

  // Que no se salga por abajo del editor: si no cabe, sube lo que sobre. Se
  // mide contra el espacio entero y no contra su padre (la barra de menús
  // mide 34 px y lo subía siempre, tapando el propio botón).
  useLayoutEffect(() => {
    const el = ref.current;
    const box = (el?.closest('.canvas2-slides') ?? el?.offsetParent)?.getBoundingClientRect();
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const overflow = r.bottom - box.bottom + 8;
    if (overflow > 0) setFitStyle({ transform: `translateY(-${Math.min(overflow, Math.max(0, r.top - box.top - 8))}px)` });
  }, []);

  // Al abrir (y cuando se pide): no en cada render, o el foco saltaría al primero.
  useEffect(() => {
    if (autoFocus || focusRequest) ref.current?.querySelector<HTMLButtonElement>(ITEMS)?.focus();
  }, [focusRequest]);

  // Mientras está abierto, el editor lo sabe (las opciones de formato nativas
  // se apartan, slides.css). Al cerrar, el foco vuelve a quien lo abrió si se
  // había quedado en el menú: si no, caería en <body> y el teclado se perdería.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const host = ref.current?.closest<HTMLElement>('[data-canvas2]');
    const count = Number(host?.dataset.slidesMenu ?? 0) + 1;
    if (host) host.dataset.slidesMenu = String(count);
    const menu = ref.current;
    return () => {
      if (host) {
        const left = Number(host.dataset.slidesMenu ?? 1) - 1;
        if (left > 0) host.dataset.slidesMenu = String(left);
        else delete host.dataset.slidesMenu;
      }
      const focusLost = !document.activeElement || document.activeElement === document.body || menu?.contains(document.activeElement);
      if (focusLost && opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current || ref.current.contains(target)) return;
      if (keepOpenWithin?.()?.contains(target)) return;
      onClose();
    };
    // En captura: el clic que cierra el menú no debe llegar además al lienzo
    // como "empieza a seleccionar".
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose, keepOpenWithin]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const list = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(ITEMS) ?? []);
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      list[e.key === 'Home' ? 0 : list.length - 1]?.focus();
    }
  };

  return (
    <div ref={ref} className="canvas2-slides-menu" role="menu" aria-label={label}
      style={{ ...style, ...fitStyle }} onKeyDown={onKeyDown}>
      {items.map((entry, i) => {
        if (entry.kind === 'separator') return <div key={i} className="canvas2-slides-menu-sep" role="separator" />;
        if (entry.kind === 'submenu') {
          return (
            <div key={i} className="canvas2-slides-menu-subwrap"
              onPointerEnter={() => setOpenSub(i)} onPointerLeave={() => setOpenSub((s) => (s === i ? null : s))}>
              <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={openSub === i}
                disabled={entry.disabled}
                onClick={() => setOpenSub((s) => (s === i ? null : i))}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenSub(i);
                  }
                }}>
                <span className="canvas2-slides-menu-icon">{entry.icon}</span>
                <span className="canvas2-slides-menu-label">{entry.label}</span>
                <span className="canvas2-slides-menu-end"><SlidesIcon.submenu /></span>
              </button>
              {openSub === i && (
                <SubMenu label={entry.label} items={entry.items} onClose={onClose}
                  onBack={() => setOpenSub(null)} />
              )}
            </div>
          );
        }
        return <MenuItem key={i} entry={entry} onClose={onClose} />;
      })}
    </div>
  );
}

function MenuItem({ entry, onClose }: { entry: Extract<MenuEntry, { label: string; onSelect: () => void }>; onClose: () => void }) {
  return (
    <button type="button" role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={entry.checked} disabled={entry.disabled}
      onClick={() => { onClose(); entry.onSelect(); }}>
      <span className="canvas2-slides-menu-icon">{entry.checked ? <SlidesIcon.check /> : entry.icon}</span>
      <span className="canvas2-slides-menu-label">{entry.label}</span>
      {entry.shortcut && <span className="canvas2-slides-menu-end">{entry.shortcut}</span>}
    </button>
  );
}

/** Submenú (Mover diapositiva ›, Tamaño ›…): se abre a la derecha de su fila. */
function SubMenu({ label, items, onClose, onBack }: {
  label: string; items: MenuEntry[]; onClose: () => void; onBack: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    // Sin sitio a la derecha del editor, se abre a la izquierda.
    const el = ref.current;
    const box = el?.closest('.canvas2-slides')?.getBoundingClientRect();
    if (el && box && el.getBoundingClientRect().right > box.right - 4) setFlip(true);
  }, []);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} className="canvas2-slides-menu canvas2-slides-submenu" role="menu" aria-label={label}
      data-flip={flip ? '' : undefined}
      onKeyDown={(e) => {
        const list = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > [role^="menuitem"]:not([disabled])') ?? []);
        const at = list.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onBack();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          list[(at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
        }
      }}>
      {items.map((entry, i) =>
        entry.kind === 'separator' ? <div key={i} className="canvas2-slides-menu-sep" role="separator" />
          : entry.kind === 'submenu' ? null
            : <MenuItem key={i} entry={entry} onClose={onClose} />,
      )}
    </div>
  );
}
