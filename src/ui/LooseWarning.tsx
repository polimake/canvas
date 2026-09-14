import { useEffect, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '../core/excal';
import { adoptLooseIntoPage, looseElements } from '../core/paginate';
import { mergeLabels, type PartialLabels } from './labels';
import { palette } from './theme';

/**
 * Aviso de elementos fuera de toda página.
 *
 * El problema no es que se puedan quedar sueltos —el plano es infinito y a veces
 * quieres apartar cosas— sino que desaparecen sin decir nada: un elemento sin
 * página se ve en el lienzo, se guarda con el diseño, y NO sale ni en el panel
 * de capas ni en ningún export ni en la miniatura. Descubrirlo entregando el
 * PNG al cliente es tarde.
 *
 * Ya existía la vía de arreglo ("Convertir en páginas", en el menú), pero había
 * que ir a buscarla sabiendo que el problema existe. Esto lo dice.
 *
 * Deliberadamente no bloquea nada y se puede descartar: apartar cosas del
 * lienzo mientras trabajas es legítimo, y un aviso que no se calla se convierte
 * en ruido que se ignora. Al descartarlo no vuelve hasta que cambia la cuenta.
 */
export interface LooseWarningProps {
  api: ExcalidrawImperativeAPI | null;
  activePageId: string | null;
  theme?: 'light' | 'dark';
  viewMode?: boolean;
  labels?: PartialLabels;
}

export function LooseWarning({ api, activePageId, theme, viewMode, labels }: LooseWarningProps) {
  const L = mergeLabels(labels);
  const c = palette[theme ?? 'light'];
  const [loose, setLoose] = useState(0);
  /** Cuenta que el usuario ya descartó; el aviso vuelve si cambia. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    const refresh = () => setLoose(looseElements(api.getSceneElements()).length);
    refresh();
    return api.onChange(refresh);
  }, [api]);

  if (!api || viewMode || loose === 0 || loose === dismissedAt) return null;

  return (
    <div
      data-testid="canvas2-loose-warning"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 8,
        border: `1px solid ${c.warnBorder}`,
        background: c.warnBg,
        color: c.warnText,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        maxWidth: 'min(560px, 90vw)',
      }}
    >
      <span style={{ lineHeight: 1.35 }}>{L.loose.warning(loose)}</span>
      {activePageId ? (
        <button
          type="button"
          onClick={() => adoptLooseIntoPage(api, activePageId)}
          style={{
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${c.warnBorder}`,
            background: 'transparent',
            color: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {L.loose.adopt}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={L.loose.dismiss}
        title={L.loose.dismiss}
        onClick={() => setDismissedAt(loose)}
        style={{
          flexShrink: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          fontSize: 15,
          lineHeight: 1,
          cursor: 'pointer',
          opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  );
}
