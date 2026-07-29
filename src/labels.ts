/**
 * Textos del editor, inyectables por el host.
 *
 * canvas2 NO lleva i18n dentro: no puede depender de `react-i18next` (vive en
 * `apps/web`) ni cargar ficheros de traducción, y un paquete que se distribuye
 * no debería imponer un idioma. Es la misma convención que ya adoptó
 * `@polimake/ui` en su 0.6.0: el componente define el CONTRATO de etiquetas y
 * quien lo monta las rellena desde su propio sistema.
 *
 * Los valores por defecto son en español porque es el idioma en el que se
 * trabaja hoy y así el editor funciona sin configurar nada. El host los pisa con
 * los suyos, parcialmente: no hace falta pasar las 45.
 */

export interface Canvas2Labels {
  library: {
    title: string;
    close: string;
  };
  menu: {
    background: string;
    backgroundOther: string;
    backgroundRemove: string;
    size: string;
    width: string;
    height: string;
    apply: string;
    scaleContent: string;
    insertText: string;
    export: string;
    exporting: string;
    exportFailed: string;
    exportPngPage: string;
    exportPngAll: string;
    exportSvg: string;
    exportPdf: string;
  };
  pages: {
    add: string;
    duplicate: string;
    rename: string;
    lock: string;
    unlock: string;
    delete: string;
    confirmDelete: string;
    moveLeft: string;
    moveRight: string;
  };
  dock: {
    layers: string;
    brand: string;
    collapse: string;
    expand: string;
  };
  brand: {
    title: string;
    defaultColor: string;
    /** Recibe el color: `Aplicar {color} a la selección`. */
    applyToSelection: (color: string) => string;
    /** Recibe el número de elementos pintados. */
    applied: (count: number) => string;
    insertLogo: (label: string) => string;
    logoInserted: string;
    logo: string;
    black: string;
    white: string;
  };
  /** Nombres de los tamaños de página, por clave de preset. */
  sizes: Record<string, string>;
}

export const DEFAULT_LABELS: Canvas2Labels = {
  library: {
    title: 'Biblioteca',
    close: 'Cerrar',
  },
  menu: {
    background: 'Fondo de la página',
    backgroundOther: 'Otro color…',
    backgroundRemove: 'Quitar fondo',
    size: 'Tamaño de la página',
    width: 'Ancho',
    height: 'Alto',
    apply: 'Aplicar',
    scaleContent: 'Escalar el contenido',
    insertText: 'Insertar texto',
    export: 'Exportar',
    exporting: 'Exportando…',
    exportFailed: 'Exportar · falló',
    exportPngPage: 'PNG · página actual',
    exportPngAll: 'PNG · todas las páginas',
    exportSvg: 'SVG · página actual',
    exportPdf: 'PDF · todas las páginas',
  },
  pages: {
    add: 'Agregar página después',
    duplicate: 'Duplicar página',
    rename: 'Renombrar página',
    lock: 'Bloquear página',
    unlock: 'Desbloquear página',
    delete: 'Eliminar página',
    confirmDelete: '¿Eliminar?',
    moveLeft: 'Mover a la izquierda',
    moveRight: 'Mover a la derecha',
  },
  dock: {
    layers: 'Capas',
    brand: 'Marca',
    collapse: 'Contraer',
    expand: 'Desplegar',
  },
  brand: {
    title: 'Marca',
    defaultColor: 'color por defecto',
    applyToSelection: (color) => `Aplicar ${color} a la selección`,
    applied: (count) => `${count} elemento${count === 1 ? '' : 's'}`,
    insertLogo: (label) => `Insertar ${label.toLowerCase()}`,
    logoInserted: 'logo insertado',
    logo: 'Logo',
    black: 'Negro',
    white: 'Blanco',
  },
  sizes: {
    'ig-post': 'Post 4:5',
    square: 'Cuadrado 1:1',
    story: 'Story / Reel 9:16',
    landscape: 'Horizontal 16:9',
    'yt-thumb': 'Miniatura YouTube',
    a4: 'A4',
    default: 'Lienzo clásico',
  },
};

/** Igual que `Canvas2Labels` pero con cada sección y clave opcional. */
export type PartialLabels = {
  [S in keyof Canvas2Labels]?: Partial<Canvas2Labels[S]>;
};

/**
 * Mezcla las etiquetas del host sobre las de serie.
 *
 * La mezcla es de DOS niveles y no recursiva a propósito: el contrato tiene
 * exactamente esa forma, y una mezcla profunda genérica invitaría a añadir
 * anidamiento sin pensarlo. Un valor `undefined` o vacío NO pisa al de serie —
 * una traducción a medias debe caer al español, no dejar un botón sin texto.
 */
export function mergeLabels(custom?: PartialLabels | null): Canvas2Labels {
  if (!custom) return DEFAULT_LABELS;
  const out = {} as Canvas2Labels;
  for (const key of Object.keys(DEFAULT_LABELS) as (keyof Canvas2Labels)[]) {
    const base = DEFAULT_LABELS[key] as Record<string, unknown>;
    const over = (custom[key] ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...base };
    for (const k of Object.keys(over)) {
      const v = over[k];
      if (v === undefined || v === null || v === '') continue;
      merged[k] = v;
    }
    (out as unknown as Record<string, unknown>)[key] = merged;
  }
  return out;
}
