import type { CSSProperties, ReactNode } from 'react';

/**
 * Tiny inline SVG icon set for canvas2's own chrome (page strip, layers
 * panel). Self-contained on purpose: no icon-library dependency, strokes use
 * currentColor so the host theme colors them.
 */

function Svg({ children, size = 13 }: { children: ReactNode; size?: number }) {
  const style: CSSProperties = { display: 'block', flexShrink: 0 };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ChevronLeftIcon = () => (
  <Svg>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);

export const ChevronRightIcon = () => (
  <Svg>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);

export const CaretDownIcon = () => (
  <Svg size={10}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const DuplicateIcon = () => (
  <Svg>
    <rect x="9" y="9" width="12" height="12" rx="1" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

export const PencilIcon = () => (
  <Svg>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Svg>
);

export const LockIcon = () => (
  <Svg>
    <rect x="3" y="11" width="18" height="11" rx="1" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Svg>
);

export const UnlockIcon = () => (
  <Svg>
    <rect x="3" y="11" width="18" height="11" rx="1" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </Svg>
);

export const TrashIcon = () => (
  <Svg>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const EyeIcon = () => (
  <Svg>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOffIcon = () => (
  <Svg>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
    <path d="M2 2l20 20" />
  </Svg>
);

export const PlusIcon = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const TextIcon = () => (
  <Svg>
    <path d="M4 6V4h16v2" />
    <path d="M12 4v16" />
    <path d="M9 20h6" />
  </Svg>
);

export const FillIcon = () => (
  <Svg>
    <path d="M19 11L9 1 2.5 7.5a2 2 0 0 0 0 2.8l6.2 6.2a2 2 0 0 0 2.8 0L19 11Z" />
    <path d="M21 16s2 2.2 2 3.5a2 2 0 1 1-4 0c0-1.3 2-3.5 2-3.5Z" />
  </Svg>
);

export const ExportIcon = () => (
  <Svg>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M4 21h16" />
  </Svg>
);

export const CoverIcon = () => (
  <Svg>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const StretchIcon = () => (
  <Svg>
    <path d="M3 12h18" />
    <path d="M6 9l-3 3 3 3" />
    <path d="M18 9l3 3-3 3" />
  </Svg>
);

// ─── Layer-type icons ─────────────────────────────────────────────────────────

export const ImageIcon = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </Svg>
);

export const SquareIcon = () => (
  <Svg>
    <rect x="4" y="4" width="16" height="16" />
  </Svg>
);

export const CircleIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
  </Svg>
);

export const DiamondIcon = () => (
  <Svg>
    <path d="M12 2l10 10-10 10L2 12Z" />
  </Svg>
);

export const LineIcon = () => (
  <Svg>
    <path d="M5 19L19 5" />
  </Svg>
);

export const ArrowIcon = () => (
  <Svg>
    <path d="M5 19L19 5" />
    <path d="M11 5h8v8" />
  </Svg>
);

export const DrawIcon = () => (
  <Svg>
    <path d="M3 17c3-6 6 4 9-2s6 2 9-4" />
  </Svg>
);

export const FrameIcon = () => (
  <Svg>
    <path d="M6 2v20M18 2v20M2 6h20M2 18h20" />
  </Svg>
);

// ─── Align-to-page icons ──────────────────────────────────────────────────────

export const AlignLeftIcon = () => (
  <Svg>
    <path d="M4 3v18" />
    <rect x="8" y="8" width="10" height="8" />
  </Svg>
);

export const AlignCenterHIcon = () => (
  <Svg>
    <path d="M12 3v4M12 17v4" />
    <rect x="5" y="7" width="14" height="10" />
  </Svg>
);

export const AlignRightIcon = () => (
  <Svg>
    <path d="M20 3v18" />
    <rect x="6" y="8" width="10" height="8" />
  </Svg>
);

export const AlignTopIcon = () => (
  <Svg>
    <path d="M3 4h18" />
    <rect x="8" y="8" width="8" height="10" />
  </Svg>
);

export const AlignCenterVIcon = () => (
  <Svg>
    <path d="M3 12h4M17 12h4" />
    <rect x="7" y="5" width="10" height="14" />
  </Svg>
);

export const AlignBottomIcon = () => (
  <Svg>
    <path d="M3 20h18" />
    <rect x="8" y="6" width="8" height="10" />
  </Svg>
);

/** Ver todas las páginas: cuatro esquinas apuntando hacia fuera. */
export const FitAllIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 0 0-2 2v4" />
    <path d="M15 3h4a2 2 0 0 1 2 2v4" />
    <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
    <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
  </svg>
);
