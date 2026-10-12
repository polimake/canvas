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
  workspace: {
    elements: string;
    text: string;
    brand: string;
    page: string;
    files: string;
    searchElements: string;
    noResults: string;
    rectangle: string;
    ellipse: string;
    diamond: string;
    arrow: string;
    draw: string;
    label: string;
    excalidraw: string;
    design: string;
    advanced: string;
    panels: string;
    showPanels: string;
    hidePanels: string;
    /** La herramienta de marcos de «Más herramientas»: Excalidraw no la trae en español. */
    frameTool: string;
    /** «Find on canvas» del menú principal: tampoco la trae. */
    findOnCanvas: string;
  };
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
    /** Nombre del fichero exportado (sin extensión) cuando la página no da uno. */
    exportName: string;
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
    /** Insertar justo después de la página activa (barra sobre el lienzo). */
    add: string;
    /** Añadir al final del documento (tira de páginas). */
    addAtEnd: string;
    /** Insertar en la juntura entre dos páginas de la tira. */
    insertHere: string;
    /** El intento de crear una página ha fallado (si no, el botón parece muerto). */
    addFailed: string;
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
    /**
     * Nombre de serie de una página nueva; recibe su número (1 = la primera).
     *
     * Este y los dos siguientes NO son rótulos: son el nombre que se le pone a
     * la página, y ese nombre se GUARDA con el diseño. Cambian cómo se llama lo
     * nuevo, no lo que ya está guardado. Para que una página con este nombre se
     * siga renumerando, su palabra tiene que estar entre las que reconoce
     * `core/pageNames.ts`.
     */
    defaultName: (n: number) => string;
    /** Cómo se nombra una página que no tiene nombre. */
    untitled: string;
    /** Nombre de la copia al duplicar; recibe el de la página original. */
    copyName: (name: string) => string;
  };
  layers: {
    /** La página activa no tiene ningún elemento. */
    empty: string;
    /** Rótulo de la fila de alinear cuando el panel va empotrado en una pestaña. */
    align: string;
    // Nombre de cada capa en la lista, por tipo de elemento.
    image: string;
    rectangle: string;
    ellipse: string;
    diamond: string;
    line: string;
    arrow: string;
    freedraw: string;
    /** Capa de texto sin nada escrito. */
    text: string;
    /** Capa de texto; recibe el principio de lo que tiene escrito. */
    textWith: (excerpt: string) => string;
    // Acciones de una capa de imagen.
    useAsBackground: string;
    extendToPage: string;
    // Acciones de cualquier capa.
    show: string;
    hide: string;
    lock: string;
    unlock: string;
    delete: string;
    /** Ayuda de la fila de la página, al pie del panel. */
    renameHint: string;
  };
  /** Alinear la selección con la página, por clave de alineación. */
  align: {
    left: string;
    centerX: string;
    right: string;
    top: string;
    centerY: string;
    bottom: string;
  };
  text: {
    // Rótulo de cada texto que se puede insertar.
    heading: string;
    subheading: string;
    body: string;
    /**
     * Lo que se ESCRIBE en el diseño al insertar cada uno. Como los nombres de
     * página, es dato y se guarda: cambia lo nuevo, no lo que ya hay.
     */
    headingText: string;
    subheadingText: string;
    bodyText: string;
  };
  dock: {
    /** Pestaña que reúne marca y ajustes de la página. */
    design: string;
    layers: string;
    /** Pestaña de la biblioteca de componentes del proyecto. */
    components: string;
    /**
     * Pestaña donde el host puede meter un asistente que trabaje sobre esta
     * escena. canvas2 no sabe qué es ni le habla: solo le da el sitio.
     */
    agent: string;
    /** Rótulo del bloque de ajustes de la página dentro de Diseño. */
    page: string;
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
    /** El logo no se pudo insertar y no se sabe por qué. */
    insertFailed: string;
    // Por qué no se pudo insertar, cuando se sabe: la imagen no llegó a tiempo,
    // llegó sin tamaño o no llegó (los `code` de `ImageLoadError`).
    imageTimeout: string;
    imageNoSize: string;
    imageUnreachable: string;
  };
  /** Nombres de los tamaños de página, por clave de preset. */
  sizes: Record<string, string>;
  /** Selector de modo (Ver · Comentar · Editar) del host. */
  mode: {
    group: string;
    view: string;
    comment: string;
    edit: string;
    done: string;
  };
}

export const DEFAULT_LABELS: Canvas2Labels = {
  workspace: {
    elements: 'Elementos',
    text: 'Texto',
    brand: 'Marca',
    page: 'Página',
    files: 'Archivos',
    searchElements: 'Buscar elementos',
    noResults: 'No se encontraron elementos.',
    rectangle: 'Rectángulo',
    ellipse: 'Círculo',
    diamond: 'Rombo',
    arrow: 'Flecha',
    draw: 'Dibujar',
    label: 'Espacio de trabajo',
    excalidraw: 'Excalidraw',
    design: 'Canva',
    advanced: 'Experta',
    panels: 'Paneles del editor',
    showPanels: 'Mostrar paneles',
    hidePanels: 'Ocultar paneles',
    frameTool: 'Marco',
    findOnCanvas: 'Buscar en el lienzo',
  },
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
    exportName: 'diseño',
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
    addAtEnd: 'Añadir página',
    insertHere: 'Insertar página aquí',
    addFailed: 'No se pudo crear la página',
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
    defaultName: (n) => `Página ${n}`,
    untitled: 'Página',
    copyName: (name) => `${name} (copia)`,
  },
  layers: {
    empty: 'Esta página está vacía.',
    align: 'Alinear',
    image: 'Imagen',
    rectangle: 'Rectángulo',
    ellipse: 'Elipse',
    diamond: 'Rombo',
    line: 'Línea',
    arrow: 'Flecha',
    freedraw: 'Trazo',
    text: 'Texto',
    textWith: (excerpt) => `Texto: ${excerpt}`,
    useAsBackground: 'Usar como fondo',
    extendToPage: 'Extender a la página',
    show: 'Mostrar',
    hide: 'Ocultar',
    lock: 'Bloquear',
    unlock: 'Desbloquear',
    delete: 'Eliminar',
    renameHint: 'Doble clic para renombrar la página',
  },
  align: {
    left: 'Alinear a la izquierda',
    centerX: 'Centrar horizontalmente',
    right: 'Alinear a la derecha',
    top: 'Alinear arriba',
    centerY: 'Centrar verticalmente',
    bottom: 'Alinear abajo',
  },
  text: {
    heading: 'Título',
    subheading: 'Subtítulo',
    body: 'Cuerpo de texto',
    headingText: 'Título',
    subheadingText: 'Subtítulo',
    bodyText: 'Escribe algo…',
  },
  dock: {
    design: 'Diseño',
    layers: 'Capas',
    components: 'Componentes',
    agent: 'Agente',
    page: 'Página',
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
    insertFailed: 'no se pudo insertar',
    imageTimeout: 'La imagen tardó demasiado en cargar',
    imageNoSize: 'La imagen no tiene dimensiones utilizables',
    imageUnreachable: 'No se pudo cargar la imagen',
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
  mode: {
    group: 'Modo del lienzo',
    view: 'Ver',
    comment: 'Comentar',
    edit: 'Editar',
    done: 'Listo',
  },
};

/**
 * Rótulo de un texto que se puede insertar (título, subtítulo, cuerpo).
 *
 * `sizes` se sigue mirando primero: hasta que existió la sección `text`, la
 * única forma que tenía un host de traducir estos rótulos era colarlos ahí por
 * su clave, y quien lo hiciera no debe perder su traducción.
 */
export function textPresetLabel(
  labels: Canvas2Labels,
  key: 'heading' | 'subheading' | 'body',
): string {
  return labels.sizes[key] ?? labels.text[key];
}

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
