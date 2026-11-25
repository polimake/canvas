import { useId, useRef } from 'react';
import type { OpenPanelProps, WorkspaceAction, WorkspacePanelsProps } from './types';

/**
 * El inspector de la derecha en la vista Excalidraw.
 *
 * En escritorio, cerrado, es UNA flecha a la altura del ☰ (25/11): la tira de
 * iconos (Marca · Página · Capas) obligaba a adivinar qué era cada uno. La
 * flecha abre el panel en la última pestaña usada; dentro, las pestañas en
 * texto cambian de panel —los nuestros y los del host, como Comentarios o IA—
 * y la ✕ lo cierra. En móvil sigue la tira de iconos: allí no hay sitio para
 * un panel que tape medio lienzo sin saber antes cuál se abre.
 */
export function ExcalidrawWorkspace({ panels, narrow = false, actions = [], openPanel, onOpenPanelChange, closeLabel = 'Cerrar', openLabel = 'Abrir el panel' }: WorkspacePanelsProps & OpenPanelProps & { narrow?: boolean; actions?: WorkspaceAction[]; closeLabel?: string; openLabel?: string }) {
  const active = panels.find(panel => panel.id === openPanel);
  const id = useId();
  // Los del inspector (en móvil, también los de la píldora).
  const strip = panels.filter(panel => narrow || !panel.inToolbar);
  const lastRef = useRef<string | null>(null);
  if (active && strip.some(panel => panel.id === active.id)) lastRef.current = active.id;
  const reopen = strip.find(panel => panel.id === lastRef.current) ?? strip[0];
  // Uno de la píldora (Componentes) lleva su título a secas; los del inspector, pestañas.
  const tabbed = Boolean(active && strip.some(panel => panel.id === active.id) && strip.length > 1);
  return <>
    {narrow ? (
      <div className="canvas2-native-tools" role="toolbar" aria-orientation="vertical">
        {strip.map(panel => <button key={panel.id} type="button" title={panel.title}
          aria-label={panel.title} aria-pressed={active?.id === panel.id}
          aria-controls={active?.id === panel.id ? id : undefined}
          onClick={() => onOpenPanelChange(active?.id === panel.id ? null : panel.id)}>
          {panel.icon}
        </button>)}
        {actions.map(action => <button key={action.id} type="button" title={action.label}
          aria-label={action.label} aria-pressed={action.pressed ?? undefined}
          onClick={action.onSelect}>
          {action.icon}
        </button>)}
      </div>
    ) : !active && reopen ? (
      <div className="canvas2-native-tools" data-arrow="">
        <button type="button" className="canvas2-panel-arrow" title={openLabel} aria-label={openLabel}
          aria-expanded={false} onClick={() => onOpenPanelChange(reopen.id)}>
          {/* Un panel a la derecha: dice qué se abre mejor que una flecha. */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M14.5 4v16" /></svg>
        </button>
      </div>
    ) : null}
    {active && <section id={id} className="canvas2-resource-panel" role="region" aria-label={active.title}>
      <header className="canvas2-resource-heading" data-tabbed={tabbed ? '' : undefined}>
        {tabbed
          ? <div className="canvas2-resource-tabs" role="tablist" aria-label={active.title}>
              {strip.map(panel => <button key={panel.id} type="button" role="tab"
                aria-selected={panel.id === active.id}
                onClick={() => onOpenPanelChange(panel.id)}>
                {panel.title}
              </button>)}
            </div>
          : <span>{active.title}</span>}
        <button type="button" className="canvas2-resource-close" aria-label={closeLabel} title={closeLabel}
          onClick={() => onOpenPanelChange(null)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div className="canvas2-workspace-panel" data-bleed={active.bleed ? '' : undefined}>{active.content}</div>
    </section>}
  </>;
}
