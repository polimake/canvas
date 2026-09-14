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
        label: string;
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
    };
    /** Nombres de los tamaños de página, por clave de preset. */
    sizes: Record<string, string>;
}
export declare const DEFAULT_LABELS: Canvas2Labels;
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