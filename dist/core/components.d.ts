import { type CustomFontFace } from './fonts';
/**
 * Componentes de diseño reutilizables: el motor de instanciación.
 *
 * Un componente es una fila de `designs` (template=1, format='excalidraw') cuya
 * única página es la pieza a reutilizar. Este módulo la extrae, la clona con
 * identidad fresca y rellena sus huecos ("slots"). Es PURO a propósito — solo
 * tipos de ./excal, nada de DOM — porque corre en tres sitios: el navegador
 * (picker del editor), el worker (endpoint de instanciación que usa la IA por
 * MCP) y node (tests). El hermano impuro, `insertComponent.ts`, es quien habla
 * con la API de Excalidraw.
 *
 * Los slots viven en los ELEMENTOS, no en una plantilla aparte, para que un
 * componente se pueda seguir editando como cualquier diseño sin que el editor
 * sepa nada de slots:
 *
 *   - `customData: { c2: 'slot', name, maxChars? }` — forma canónica. `c2` es el
 *     mismo espacio de nombres que ya usa el papel de página ('pageBackground');
 *     nada en la ruta de guardado toca `customData`.
 *   - Azúcar de autoría: un elemento de texto cuyo contenido es exactamente
 *     `{{nombre}}` es un slot llamado `nombre`. Permite marcar huecos desde el
 *     editor de hoy, sin ninguna interfaz nueva.
 *   - Azúcar de imagen: si el componente no declara ningún slot de imagen, su
 *     imagen MÁS GRANDE es el slot implícito `foto`. Sustituir la foto es el
 *     relleno más común y las imágenes no tienen texto donde escribir `{{}}`.
 *
 * El manifiesto `componentMeta` de la fila es un ÍNDICE para elegir componente
 * sin abrir `editorConfig`; si manifiesto y escena divergen, manda la escena.
 */
/** Lo mínimo que el motor necesita saber de un elemento de escena. */
export interface ComponentElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    frameId?: string | null;
    isDeleted?: boolean;
    customData?: unknown;
}
/** Entrada del mapa `files` (compatible con BinaryFileData de Excalidraw). */
export interface ComponentFileEntry {
    id: string;
    dataURL: string;
    mimeType: string;
    created?: number;
    lastRetrieved?: number;
}
export interface ComponentSlotInfo {
    name: string;
    type: 'text' | 'image';
    elementId: string;
    maxChars?: number;
    /** true si salió del azúcar (texto `{{…}}` o imagen mayor), no de customData. */
    implicit?: boolean;
}
/** Valor de relleno: texto plano, o imagen por URL (las medidas reales, si se
 *  conocen, evitan deformar — regla dura: la foto se contiene, no se recorta). */
export type SlotValue = string | {
    url: string;
    w?: number;
    h?: number;
};
export type SlotValues = Record<string, SlotValue>;
export interface ComponentFragment {
    /** El marco de página del componente. */
    frame: ComponentElement;
    /** Miembros del marco, papel de página incluido. */
    members: ComponentElement[];
    /** Solo los ficheros que referencian los miembros (dataURL = URL remota). */
    files: Record<string, ComponentFileEntry>;
    /** Tipografías que el componente trae consigo (editorConfig.fonts). */
    fonts: CustomFontFace[];
    pageSize: {
        width: number;
        height: number;
    };
}
/**
 * Clona un grupo de elementos con ids nuevos, remapeando las referencias
 * internas (frameId, containerId, boundElements, bindings, groupIds) y,
 * opcionalmente, los fileId de las imágenes.
 *
 * Extraído de `duplicatePage` (pages.ts), que ahora delega aquí: la misma
 * mecánica sirve para duplicar una página y para instanciar un componente. Las
 * referencias a elementos FUERA del grupo se dejan tal cual (limitación
 * asumida, igual que en duplicatePage con los bindings entre páginas).
 *
 * `fileIdMap`: mapa vacío que se rellena con viejo→nuevo. Darlo activa el
 * remapeo — imprescindible al instanciar, porque `api.addFiles` de Excalidraw
 * NUNCA sobrescribe un id existente y dos inserciones del mismo componente
 * colisionarían.
 */
export declare function cloneSceneElements<T extends ComponentElement>(group: readonly T[], { dx, dy, fileIdMap }?: {
    dx?: number;
    dy?: number;
    fileIdMap?: Map<string, string>;
}): {
    clones: T[];
    idMap: Map<string, string>;
};
/**
 * Parte el texto en líneas que caben, midiendo a ojo por ancho medio de glifo,
 * y devuelve la altura resultante.
 *
 * No hay canvas donde medir de verdad (esto corre también en el worker): 0.52
 * de ancho medio por em es la misma heurística con la que se generaron los
 * diseños del sandbox, validada a ojo sobre cientos de piezas. Quien rellena
 * un slot con texto MUY por encima de `maxChars` se lleva un desbordamiento —
 * la medición aproximada no es un corrector de contenido.
 */
export declare function measureWrappedText(text: string, { width, fontSize, lineHeight, factor }: {
    width: number;
    fontSize: number;
    lineHeight?: number;
    factor?: number;
}): {
    lines: string[];
    text: string;
    height: number;
};
/**
 * Encaja una imagen ENTERA dentro de una caja, centrada — contain, nunca cover.
 * Regla dura del proyecto: ni recorte ni deformación; el hueco que sobre lo
 * ocupa el fondo.
 */
export declare function fitImageInBox(ratio: number, box: {
    x: number;
    y: number;
    width: number;
    height: number;
}): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * Slots de un conjunto de elementos, en orden estable (customData primero,
 * azúcar después). Con nombres repetidos gana la primera aparición: dos
 * elementos anunciando el mismo hueco sería ambigüedad, no funcionalidad.
 */
export declare function listSlots(elements: readonly ComponentElement[]): ComponentSlotInfo[];
/**
 * Manifiesto `componentMeta` derivado de la escena — lo que "Guardar como
 * componente" siembra para que la IA tenga algo que buscar desde el minuto
 * uno. La descripción la pone el autor (o la IA) después; aquí solo se
 * inventaría lo verificable: los slots.
 */
export declare function deriveComponentMeta(elements: readonly ComponentElement[], { description, tags }?: {
    description?: string;
    tags?: string[];
}): {
    description: string;
    tags?: string[];
    slots?: Record<string, {
        type: 'text' | 'image';
        maxChars?: number;
    }>;
};
/**
 * Extrae la página `pageIndex` (por orden visual, izquierda→derecha) de un
 * `editorConfig` de canvas2 como fragmento instanciable. Devuelve null si el
 * config no es de canvas2 o no tiene marcos: un componente sin página no es
 * instanciable y tratarlo como "todos los elementos sueltos" escondería el
 * error de autoría.
 */
export declare function extractComponentFragment(editorConfig: unknown, pageIndex?: number): ComponentFragment | null;
export interface InstantiatedComponent {
    /** Marco clonado primero, miembros después — listos para concatenar. */
    elements: ComponentElement[];
    /** Ficheros nuevos (ids recién acuñados) que la escena destino debe adoptar. */
    files: Record<string, ComponentFileEntry>;
    /** Tipografías del componente, para fusionar en `editorConfig.fonts`. */
    fonts: CustomFontFace[];
    pageId: string;
    pageSize: {
        width: number;
        height: number;
    };
    /** Slots pedidos que el componente no tiene — se reporta, no se inventa. */
    unknownSlots: string[];
}
/**
 * Clona el fragmento con identidad fresca (elementos Y ficheros), lo desplaza
 * a (dx, dy) y rellena los slots. Puro: el resultado se integra después, sea
 * vía `commitElements` (navegador) o concatenando en `editorConfig` (worker).
 */
export declare function instantiateComponent(fragment: ComponentFragment, { slots, dx, dy }?: {
    slots?: SlotValues;
    dx?: number;
    dy?: number;
}): InstantiatedComponent;
/**
 * Añade un componente como página nueva AL FINAL de un `editorConfig` de
 * canvas2, sin API de Excalidraw: es la mitad del motor que usa el endpoint
 * `/insert-component` (y por él, la IA vía MCP).
 *
 * No re-empaqueta las páginas existentes — solo coloca la nueva tras la última
 * (mismo `PAGE_GAP`), fusiona ficheros (los ids son recién acuñados: no puede
 * haber colisión) y deduplica tipografías. Devuelve null si el config no es de
 * canvas2: el endpoint convierte eso en un 400, no en una página perdida.
 */
export declare function appendComponentToEditorConfig(editorConfig: unknown, fragment: ComponentFragment, { slots }?: {
    slots?: SlotValues;
}): {
    editorConfig: {
        elements: ComponentElement[];
        appState: unknown;
        files: Record<string, ComponentFileEntry>;
        fonts?: CustomFontFace[];
    };
    pages: number;
    pageId: string;
    unknownSlots: string[];
} | null;
//# sourceMappingURL=components.d.ts.map