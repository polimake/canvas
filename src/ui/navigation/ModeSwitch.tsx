import type { Canvas2Labels } from '../shared/labels';
import type { Canvas2Theme } from '../shared/theme';

/** Qué se puede hacer con el lienzo: mirarlo, señalar en él o editarlo. */
export type Canvas2Mode = 'view' | 'comment' | 'edit';

const ORDER: Canvas2Mode[] = ['view', 'comment', 'edit'];

export interface Canvas2ModeControl {
  mode: Canvas2Mode;
  onChange: (mode: Canvas2Mode) => void;
  /**
   * Los modos a los que puede pasar quien mira (sale de su permiso: con
   * edición los tres, con comentarios Ver y Comentar, solo lectura nada más
   * que Ver). Con uno solo no se pinta nada: no hay nada que elegir.
   */
  modes: Canvas2Mode[];
}

interface ModeSwitchProps extends Canvas2ModeControl {
  theme?: Canvas2Theme;
  narrow?: boolean;
  labels: Canvas2Labels['mode'];
}

/** Iconos de Phosphor (regular), los que eligió el usuario: ojo, bocadillo, lápiz. */
const ICONS: Record<Canvas2Mode, string> = {
  view: 'M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z',
  comment: 'M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,224h0ZM216,192H80a8,8,0,0,0-5.23,1.95L40,224V64H216Z',
  edit: 'M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z',
};

/**
 * Ver · Comentar · Editar como iconos, iguales a los de la tira de arriba a la
 * derecha (Marca, Página, Capas): botones redondos de 32 px sin fondo, gris
 * cálido y el activo en tinta. Van en la misma columna, abajo, así los dos
 * grupos de iconos del borde derecho se leen como uno. El nombre, al pasar.
 */
export function ModeSwitch({ mode, onChange, modes, theme = 'light', narrow = false, labels }: ModeSwitchProps) {
  const available = ORDER.filter((m) => modes.includes(m));
  if (available.length < 2) return null;
  return (
    <div
      className="canvas2-mode-tools"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={labels.group}
      data-theme={theme}
      data-narrow={narrow ? '' : undefined}
    >
      {available.map((m) => (
        <button
          key={m}
          type="button"
          title={labels[m]}
          aria-label={labels[m]}
          aria-pressed={mode === m}
          onClick={() => {
            if (m !== mode) onChange(m);
          }}
        >
          <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d={ICONS[m]} />
          </svg>
        </button>
      ))}
    </div>
  );
}
