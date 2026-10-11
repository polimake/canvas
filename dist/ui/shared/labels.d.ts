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
        useAsBackground: string;
        extendToPage: string;
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
        imageTimeout: string;
        imageNoSize: string;
        imageUnreachable: string;
    };
    /** Nombres de los tamaños de página, por clave de preset. */
    sizes: Record<string, string>;
}
export declare const DEFAULT_LABELS: Canvas2Labels;
/**
 * Rótulo de un texto que se puede insertar (título, subtítulo, cuerpo).
 *
 * `sizes` se sigue mirando primero: hasta que existió la sección `text`, la
 * única forma que tenía un host de traducir estos rótulos era colarlos ahí por
 * su clave, y quien lo hiciera no debe perder su traducción.
 */
export declare function textPresetLabel(labels: Canvas2Labels, key: 'heading' | 'subheading' | 'body'): string;
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
export declare function mergeLabels(custom?: PartialLabels | null): Canvas2Labels;
//# sourceMappingURL=labels.d.ts.map