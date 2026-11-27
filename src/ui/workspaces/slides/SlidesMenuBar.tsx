'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { SlidesMenu, type MenuEntry } from './SlidesMenu';

export interface MenuBarMenu {
  id: string;
  label: string;
  items: MenuEntry[];
}

export interface SlidesMenuBarProps {
  /** Nombre de la presentación (lo da el host); sin él, solo los menús. */
  title?: string;
  menus: MenuBarMenu[];
  label: string;
  /** Texto a la derecha (p. ej. «Exportando…»). */
  status?: string;
  /** Lo que va en el extremo derecho de la fila (el botón Presentar). */
  end?: ReactNode;
}

/**
 * La fila de menús de Slides: el nombre de la presentación y Archivo, Editar,
 * Ver… Con un menú abierto, pasar el ratón por otro lo abre (como en un
 * escritorio); las flechas izquierda/derecha saltan de uno a otro.
 */
export function SlidesMenuBar({ title, menus, label, status, end }: SlidesMenuBarProps) {
  const [open, setOpen] = useState<{ id: string; left: number; byKey: boolean; focus: number } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const openAt = (id: string, byKey = false) => {
    const button = barRef.current?.querySelector<HTMLElement>(`[data-menu-id="${id}"]`);
    const bar = barRef.current?.getBoundingClientRect();
    const r = button?.getBoundingClientRect();
    setOpen((prev) => ({ id, left: r && bar ? r.left - bar.left : 0, byKey, focus: byKey ? (prev?.focus ?? 0) + 1 : 0 }));
  };

  const step = (from: string, dir: 1 | -1) => {
    const i = menus.findIndex((m) => m.id === from);
    const next = menus[(i + dir + menus.length) % menus.length];
    openAt(next.id, true);
  };

  const current = open ? menus.find((m) => m.id === open.id) : null;
  // Estables: el menú abierto se suscribe al `pointerdown` con ellas.
  const closeMenu = useCallback(() => setOpen(null), []);
  const barElement = useCallback(() => barRef.current, []);

  return (
    <div ref={barRef} className="canvas2-slides-menubar" role="menubar" aria-label={label}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          // Dentro de un submenú las flechas son suyas (SlidesMenu las para).
          e.preventDefault();
          step(open.id, e.key === 'ArrowRight' ? 1 : -1);
        }
      }}>
      {title && <span className="canvas2-slides-title">{title}</span>}
      {menus.map((menu) => (
        <button key={menu.id} type="button" role="menuitem" data-menu-id={menu.id}
          aria-haspopup="menu" aria-expanded={open?.id === menu.id}
          onClick={() => (open?.id === menu.id ? setOpen(null) : openAt(menu.id))}
          onPointerEnter={() => { if (open && open.id !== menu.id) openAt(menu.id); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              openAt(menu.id, true);
            }
          }}>
          {menu.label}
        </button>
      ))}
      <span className="canvas2-slides-status" aria-live="polite">{status}</span>
      {end}
      {current && open && (
        <SlidesMenu key={current.id} label={current.label} items={current.items}
          onClose={closeMenu} autoFocus={open.byKey} keepOpenWithin={barElement} focusRequest={open.focus}
          style={{ position: 'absolute', top: 32, left: open.left }} />
      )}
    </div>
  );
}
