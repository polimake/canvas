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
  components: {
    title: string;
    empty: string;
    insert: string;
    inserted: string;
    insertFailed: string;
    save: string;
    saved: string;
    saveFailed: string;
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
    /** Acción de paginar lo que está suelto en el lienzo. */
    toPages: string;
    /** Recibe cuántos elementos sueltos hay ahora mismo. */
    toPagesHint: (count: number) => string;
    /** Recibe cuántas páginas se han creado. */
    toPagesDone: (count: number) => string;
  };
  video: {
    pickFrame: string;
    loading: string;
    useFrame: string;
    saving: string;
    cancel: string;
    failed: string;
    /** El host no ha cableado el proxy: se puede ver el vídeo, no capturar. */
    unavailable: string;
  };
  loose: {
    /** Recibe cuántos elementos están fuera de toda página. */
    warning: (count: number) => string;
    adopt: string;
    dismiss: string;
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
    /** Por qué el botón de borrar no hace nada cuando solo queda una página. */
    lastPage: string;
    fitAll: string;
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
  components: {
    title: 'Componentes',
    empty: 'Aún no hay componentes en este proyecto. Guarda una página como componente desde el menú.',
    insert: 'Insertar como página nueva',
    inserted: 'Componente insertado',
    insertFailed: 'No se pudo insertar el componente',
    save: 'Guardar página como componente',
    saved: 'Página guardada como componente',
    saveFailed: 'No se pudo guardar el componente',
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
    toPages: 'Convertir en páginas',
    toPagesHint: (count) => `${count} suelto${count === 1 ? '' : 's'}`,
    toPagesDone: (count) => `${count} página${count === 1 ? '' : 's'} creada${count === 1 ? '' : 's'}`,
  },
  video: {
    pickFrame: 'Elegir fotograma',
    loading: 'Cargando vídeo…',
    useFrame: 'Usar este',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    failed: 'No se pudo capturar el fotograma',
    unavailable: 'El selector de fotograma no está disponible aquí',
  },
  loose: {
    warning: (count) =>
      count === 1
        ? 'Hay 1 elemento fuera de toda página: no saldrá al exportar ni en la miniatura.'
        : `Hay ${count} elementos fuera de toda página: no saldrán al exportar ni en la miniatura.`,
    adopt: 'Meter en esta página',
    dismiss: 'Descartar aviso',
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
    lastPage: 'Es la única página: un diseño no puede quedarse sin ninguna',
    fitAll: 'Ver todas las páginas',
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
