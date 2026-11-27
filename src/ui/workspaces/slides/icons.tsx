import type { ReactNode } from 'react';

/**
 * Iconos del espacio Presentación: trazo fino (1,7) a 18 px, como la maqueta
 * aprobada. Propios del espacio para no tocar el juego compartido de la tira de
 * páginas (shared/icons.tsx, 13 px y trazo 2), que tiene otro tamaño.
 */
function Icon({ children, size = 18, fill = 'none', stroke = 1.7 }: {
  children: ReactNode; size?: number; fill?: string; stroke?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      focusable="false" style={{ display: 'block', flexShrink: 0 }}>
      {children}
    </svg>
  );
}

const P = (d: string) => <path d={d} />;

export const SlidesIcon = {
  search: () => <Icon><circle cx="11" cy="11" r="7" />{P('M20 20l-3.5-3.5')}</Icon>,
  plus: () => <Icon stroke={1.8}>{P('M12 5v14M5 12h14')}</Icon>,
  minus: () => <Icon stroke={1.8}>{P('M5 12h14')}</Icon>,
  caret: () => <Icon size={12} stroke={2.2}>{P('M6 9l6 6 6-6')}</Icon>,
  chevronUp: () => <Icon size={16} stroke={2}>{P('M18 15l-6-6-6 6')}</Icon>,
  chevronDown: () => <Icon size={16} stroke={2}>{P('M6 9l6 6 6-6')}</Icon>,
  chevronLeft: () => <Icon size={16} stroke={2}>{P('M15 18l-6-6 6-6')}</Icon>,
  chevronRight: () => <Icon size={16} stroke={2}>{P('M9 18l6-6-6-6')}</Icon>,
  submenu: () => <Icon size={14} stroke={2}>{P('M9 18l6-6-6-6')}</Icon>,
  undo: () => <Icon>{P('M9 14L4 9l5-5')}{P('M4 9h10.5a5.5 5.5 0 010 11H11')}</Icon>,
  redo: () => <Icon>{P('M15 14l5-5-5-5')}{P('M20 9H9.5a5.5 5.5 0 000 11H13')}</Icon>,
  zoom: () => <Icon><circle cx="11" cy="11" r="7" />{P('M20 20l-3.5-3.5M11 8v6M8 11h6')}</Icon>,
  cursor: () => <Icon size={16} fill="currentColor" stroke={0}>{P('M5 3l14 8-6 2-2 6z')}</Icon>,
  text: () => <Icon>{P('M5 6V4h14v2M12 4v16M9 20h6')}</Icon>,
  image: () => <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" />{P('M21 17l-5-5-9 8')}</Icon>,
  shape: () => <Icon><rect x="3" y="3" width="10" height="10" rx="1" /><circle cx="15.5" cy="15.5" r="5.5" /></Icon>,
  rectangle: () => <Icon><rect x="4" y="5" width="16" height="14" rx="1" /></Icon>,
  ellipse: () => <Icon><circle cx="12" cy="12" r="8" /></Icon>,
  diamond: () => <Icon>{P('M12 3l9 9-9 9-9-9z')}</Icon>,
  line: () => <Icon stroke={1.8}>{P('M5 19L19 5')}</Icon>,
  arrow: () => <Icon stroke={1.8}>{P('M5 19L19 5M10 5h9v9')}</Icon>,
  comment: () => <Icon>{P('M4 5h16v11H9l-5 4z')}{P('M12 8v5M9.5 10.5h5')}</Icon>,
  grid: () => <Icon><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></Icon>,
  close: () => <Icon stroke={1.8}>{P('M6 6l12 12M18 6L6 18')}</Icon>,
  play: () => <Icon size={14} fill="currentColor" stroke={0}>{P('M7 4.5l13 7.5-13 7.5z')}</Icon>,
  duplicate: () => <Icon><rect x="8" y="8" width="12" height="12" rx="2" />{P('M14 11v6M11 14h6')}{P('M16 8V4H4v12h4')}</Icon>,
  copy: () => <Icon><rect x="8" y="8" width="12" height="12" rx="2" />{P('M16 8V4H4v12h4')}</Icon>,
  trash: () => <Icon>{P('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')}</Icon>,
  eye: () => <Icon>{P('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z')}<circle cx="12" cy="12" r="3" /></Icon>,
  eyeOff: () => <Icon>{P('M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6')}</Icon>,
  move: () => <Icon>{P('M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4')}</Icon>,
  toStart: () => <Icon>{P('M5 4h14M12 20V9M7 13l5-5 5 5')}</Icon>,
  toEnd: () => <Icon>{P('M5 20h14M12 4v11M7 11l5 5 5-5')}</Icon>,
  background: () => <Icon>{P('M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z')}</Icon>,
  layout: () => <Icon><rect x="3" y="4" width="18" height="16" rx="1" />{P('M3 10h18M10 10v10')}</Icon>,
  transition: () => <Icon><circle cx="9" cy="12" r="6" />{P('M15 6.5a6 6 0 010 11')}</Icon>,
  size: () => <Icon><rect x="3" y="6" width="18" height="12" rx="1" /></Icon>,
  brand: () => <Icon>{P('M6 3h12v18l-6-4-6 4z')}</Icon>,
  components: () => <Icon stroke={1.6}><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></Icon>,
  elements: () => <Icon stroke={1.6}><rect x="4" y="4" width="7" height="7" /><circle cx="17.5" cy="7.5" r="3.5" />{P('M7.5 13.5L11 20H4z')}<rect x="14" y="14" width="7" height="7" rx="3.5" /></Icon>,
  layers: () => <Icon stroke={1.6}>{P('M12 3l9 5-9 5-9-5z')}{P('M3 13l9 5 9-5')}</Icon>,
  library: () => <Icon stroke={1.6}>{P('M3 6h7l2 2h9v12H3z')}</Icon>,
  page: () => <Icon stroke={1.6}>{P('M6 3h8l4 4v14H6z')}{P('M14 3v4h4')}</Icon>,
  agent: () => <Icon stroke={1.6}>{P('M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z')}</Icon>,
  details: () => <Icon stroke={1.6}><rect x="3" y="4" width="18" height="16" rx="2" />{P('M15 4v16')}</Icon>,
  notes: () => <Icon>{P('M5 4h14v16H5z')}{P('M8 9h8M8 13h8M8 17h5')}</Icon>,
  presenter: () => <Icon><rect x="3" y="4" width="18" height="12" rx="1.5" />{P('M8 20h8M12 16v4')}</Icon>,
  more: () => <Icon fill="currentColor" stroke={0}><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></Icon>,
  check: () => <Icon size={16} stroke={2}>{P('M5 12l5 5 9-10')}</Icon>,
  upload: () => <Icon>{P('M12 16V4M7 9l5-5 5 5')}{P('M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3')}</Icon>,
};

/** Icono de cada panel de la tira de la derecha, por id de panel (Canvas2.tsx). */
export function panelIcon(id: string): ReactNode {
  const map: Record<string, () => ReactNode> = {
    components: SlidesIcon.components,
    elements: SlidesIcon.elements,
    text: SlidesIcon.text,
    brand: SlidesIcon.brand,
    layers: SlidesIcon.layers,
    library: SlidesIcon.library,
    design: SlidesIcon.page,
    agent: SlidesIcon.agent,
  };
  return (map[id] ?? SlidesIcon.components)();
}
