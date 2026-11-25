/**
 * Textos del editor, inyectables por el host.
 *
 * canvas2 NO lleva i18n dentro: no puede depender de `react-i18next` (vive en
 * `apps/web`) ni cargar ficheros de traducción, y un paquete que se distribuye
 * no debería imponer un idioma. Es la misma convención que ya adoptó
 * `@polimake/ui` en su 0.6.0: el componente define el CONTRATO de etiquetas y
 * quien lo monta las rellena desde su propio sistema.
 *
 * Trae de serie dos juegos, español (`DEFAULT_LABELS`) e inglés (`EN_LABELS`),
 * y elige por el `langCode` que recibe el editor, el mismo que se le pasa a
 * Excalidraw: así lo propio del paquete va en el idioma de lo de Excalidraw
 * aunque el host no traduzca todas las claves. El host los pisa con los suyos,
 * parcialmente: no hace falta pasar las 45. Sin `langCode`, español, que es el
 * idioma en el que se ha trabajado siempre.
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
    /** La flecha de la derecha que abre el inspector (Página · Capas · Marca…). */
    openPanel: string;
    showPanels: string;
    hidePanels: string;
    /** La herramienta de marcos de «Más herramientas»: Excalidraw no la trae en español. */
    frameTool: string;
    /** «Find on canvas» del menú principal: tampoco la trae. */
    findOnCanvas: string;
    /** El tema del lienzo en el menú (`themeChoice`): el grupo y sus tres opciones. */
    theme: string;
    themeApp: string;
    themeLight: string;
    themeDark: string;
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
    /** Rótulo corto bajo la ficha de añadir de la tira («Añadir»). */
    addShort: string;
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
    /** Un grupo sin texto dentro (con texto, se llama como su primer texto). */
    group: string;
    /** Desplegar y plegar un grupo de la lista. */
    expandGroup: string;
    collapseGroup: string;
    /** Cuántas capas hay dentro de un grupo, al lado de su nombre. */
    groupCount: (n: number) => string;
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
    /** Rótulo de la fila de alinear cuando el panel va empotrado en el dock. */
    alignHeading: string;
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
    openPanel: 'Abrir el panel',
    showPanels: 'Mostrar paneles',
    hidePanels: 'Ocultar paneles',
    frameTool: 'Marco',
    findOnCanvas: 'Buscar en el lienzo',
    theme: 'Tema del lienzo',
    themeApp: 'Como la app',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
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
    addShort: 'Añadir',
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
    image: 'Imagen',
    rectangle: 'Rectángulo',
    ellipse: 'Elipse',
    diamond: 'Rombo',
    line: 'Línea',
    arrow: 'Flecha',
    freedraw: 'Trazo',
    text: 'Texto',
    textWith: (excerpt) => `Texto: ${excerpt}`,
    group: 'Grupo',
    expandGroup: 'Ver lo que hay dentro',
    collapseGroup: 'Plegar el grupo',
    groupCount: (n) => (n === 1 ? '1 capa' : `${n} capas`),
    useAsBackground: 'Usar como fondo',
    extendToPage: 'Extender a la página',
    show: 'Mostrar',
    hide: 'Ocultar',
    lock: 'Bloquear',
    unlock: 'Desbloquear',
    delete: 'Eliminar',
    renameHint: 'Doble clic para renombrar la página',
    alignHeading: 'Alinear',
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
 * Los mismos textos en inglés. Lo que también traduce la web
 * (`apps/web/src/shared/lib/i18n/locales/en/canvas2.json`) va con sus mismas
 * palabras, para que el editor no cambie de voz de una clave a la de al lado.
 */
export const EN_LABELS: Canvas2Labels = {
  workspace: {
    elements: 'Elements',
    text: 'Text',
    brand: 'Brand',
    page: 'Page',
    files: 'Files',
    searchElements: 'Search elements',
    noResults: 'No elements found.',
    rectangle: 'Rectangle',
    ellipse: 'Circle',
    diamond: 'Diamond',
    arrow: 'Arrow',
    draw: 'Draw',
    label: 'Workspace',
    excalidraw: 'Excalidraw',
    design: 'Design',
    advanced: 'Advanced',
    panels: 'Editor panels',
    openPanel: 'Open the panel',
    showPanels: 'Show panels',
    hidePanels: 'Hide panels',
    frameTool: 'Frame tool',
    findOnCanvas: 'Find on canvas',
    theme: 'Canvas theme',
    themeApp: 'Same as the app',
    themeLight: 'Light',
    themeDark: 'Dark',
  },
  library: {
    title: 'Library',
    close: 'Close',
  },
  components: {
    title: 'Components',
    empty: 'No components in this project yet. Save a page as a component from the menu.',
    insert: 'Insert as a new page',
    inserted: 'Component inserted',
    insertFailed: 'Could not insert the component',
    save: 'Save page as component',
    saved: 'Page saved as a component',
    saveFailed: 'Could not save the component',
  },
  menu: {
    background: 'Page background',
    backgroundOther: 'Other colour…',
    backgroundRemove: 'Remove background',
    size: 'Page size',
    width: 'Width',
    height: 'Height',
    apply: 'Apply',
    scaleContent: 'Scale contents',
    insertText: 'Insert text',
    export: 'Export',
    exporting: 'Exporting…',
    exportFailed: 'Export · failed',
    exportPngPage: 'PNG · current page',
    exportPngAll: 'PNG · all pages',
    exportSvg: 'SVG · current page',
    exportPdf: 'PDF · all pages',
    toPages: 'Turn into pages',
    toPagesHint: (count) => `${count} loose`,
    toPagesDone: (count) => `${count} page${count === 1 ? '' : 's'} created`,
    exportName: 'design',
  },
  video: {
    pickFrame: 'Pick a frame',
    loading: 'Loading video…',
    useFrame: 'Use this one',
    saving: 'Saving…',
    cancel: 'Cancel',
    failed: 'Could not capture the frame',
    unavailable: 'The frame picker is not available here',
  },
  loose: {
    warning: (count) =>
      count === 1
        ? 'There is 1 element outside every page: it will not be exported or shown in the thumbnail.'
        : `There are ${count} elements outside every page: they will not be exported or shown in the thumbnail.`,
    adopt: 'Move into this page',
    dismiss: 'Dismiss warning',
  },
  pages: {
    add: 'Add page after',
    addAtEnd: 'Add page',
    addShort: 'Add',
    insertHere: 'Insert a page here',
    addFailed: "Couldn't create the page",
    duplicate: 'Duplicate page',
    rename: 'Rename page',
    lock: 'Lock page',
    unlock: 'Unlock page',
    delete: 'Delete page',
    confirmDelete: 'Delete?',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    lastPage: 'This is the only page: a design cannot be left without one',
    fitAll: 'See all pages',
    // «Page» es una de las palabras que reconoce `core/pageNames.ts`: una
    // página nueva en inglés se sigue renumerando como las de siempre.
    defaultName: (n) => `Page ${n}`,
    untitled: 'Page',
    copyName: (name) => `${name} (copy)`,
  },
  layers: {
    empty: 'This page is empty.',
    image: 'Image',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    diamond: 'Diamond',
    line: 'Line',
    arrow: 'Arrow',
    freedraw: 'Stroke',
    text: 'Text',
    textWith: (excerpt) => `Text: ${excerpt}`,
    group: 'Group',
    expandGroup: 'Show what is inside',
    collapseGroup: 'Collapse the group',
    groupCount: (n) => (n === 1 ? '1 layer' : `${n} layers`),
    useAsBackground: 'Use as background',
    extendToPage: 'Extend to page',
    show: 'Show',
    hide: 'Hide',
    lock: 'Lock',
    unlock: 'Unlock',
    delete: 'Delete',
    renameHint: 'Double-click to rename the page',
    alignHeading: 'Align',
  },
  align: {
    left: 'Align left',
    centerX: 'Centre horizontally',
    right: 'Align right',
    top: 'Align top',
    centerY: 'Centre vertically',
    bottom: 'Align bottom',
  },
  text: {
    heading: 'Heading',
    subheading: 'Subheading',
    body: 'Body text',
    headingText: 'Heading',
    subheadingText: 'Subheading',
    bodyText: 'Write something…',
  },
  dock: {
    design: 'Design',
    layers: 'Layers',
    components: 'Components',
    agent: 'Agent',
    page: 'Page',
    brand: 'Brand',
    collapse: 'Collapse',
    expand: 'Expand',
  },
  brand: {
    title: 'Brand',
    defaultColor: 'default colour',
    applyToSelection: (color) => `Apply ${color} to selection`,
    applied: (count) => `${count} element${count === 1 ? '' : 's'}`,
    insertLogo: (label) => `Insert ${label.toLowerCase()}`,
    logoInserted: 'logo inserted',
    logo: 'Logo',
    black: 'Black',
    white: 'White',
    insertFailed: 'could not insert it',
    imageTimeout: 'The image took too long to load',
    imageNoSize: 'The image has no usable dimensions',
    imageUnreachable: 'Could not load the image',
  },
  sizes: {
    'ig-post': 'Post 4:5',
    square: 'Square 1:1',
    story: 'Story / Reel 9:16',
    landscape: 'Landscape 16:9',
    'yt-thumb': 'YouTube thumbnail',
    a4: 'A4',
    default: 'Classic canvas',
  },
  mode: {
    group: 'Canvas mode',
    view: 'View',
    comment: 'Comment',
    edit: 'Edit',
    done: 'Done',
  },
};

/**
 * Los textos de serie para un `langCode` de Excalidraw (`en`, `es-ES`…).
 *
 * Solo hay dos juegos: cualquier inglés (`en`, `en-GB`) va al inglés y todo lo
 * demás al español, el de siempre. Un idioma que Excalidraw traduce y este
 * paquete no (el alemán, pongamos) se queda con lo propio en español hasta que
 * el host pase sus textos.
 */
export function labelsFor(langCode?: string | null): Canvas2Labels {
  return /^en(?:-|$)/i.test(langCode ?? '') ? EN_LABELS : DEFAULT_LABELS;
}

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
 * Mezcla las etiquetas del host sobre las de serie del idioma (`labelsFor`).
 *
 * La mezcla es de DOS niveles y no recursiva a propósito: el contrato tiene
 * exactamente esa forma, y una mezcla profunda genérica invitaría a añadir
 * anidamiento sin pensarlo. Un valor `undefined` o vacío NO pisa al de serie —
 * una traducción a medias debe caer al de serie de su idioma, no dejar un botón
 * sin texto.
 */
export function mergeLabels(custom?: PartialLabels | null, langCode?: string | null): Canvas2Labels {
  const defaults = labelsFor(langCode);
  if (!custom) return defaults;
  const out = {} as Canvas2Labels;
  for (const key of Object.keys(defaults) as (keyof Canvas2Labels)[]) {
    const base = defaults[key] as Record<string, unknown>;
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
