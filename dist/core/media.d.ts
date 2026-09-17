import { type ExcalidrawImperativeAPI, type SceneElement } from './excal';
/**
 * Inserción de imágenes — y LA REGLA que las gobierna.
 *
 * REGLA (decisión del usuario, no negociable): los bytes de una imagen viven
 * SIEMPRE en MediaMonster. Nunca, bajo ninguna circunstancia, se persisten
 * dentro de `designs.editorConfig` como base64.
 *
 * Por qué la regla existe, y por qué es una pared y no una preferencia:
 * Excalidraw guarda las imágenes en su mapa `files` y hace `image.src =
 * files[id].dataURL`. Ese campo acepta IGUAL de bien un `data:` que una URL
 * remota, así que las dos representaciones funcionan en pantalla — pero solo
 * una es sostenible. Con base64, una foto de 1,5 MB ocupa ~2 MB en la fila
 * (+33% de la codificación) y revienta el límite de 2 MB por valor de D1: el
 * guardado no se degrada, FALLA en seco. Con URL remota el diseño pesa lo que
 * pese su geometría, da igual cuántas fotos lleve.
 *
 * El módulo hace cumplir la regla por las dos puntas:
 *
 *   ENTRADA  Ningún export permite inlinear bytes. `insertImageFromUrl` guarda
 *            la URL; `insertImageFromBlob` EXIGE un `MediaUploader` y sube a MM
 *            antes de tocar la escena. El insertador que trabaja con dataURL es
 *            privado a propósito: si no está exportado, no hay puerta.
 *
 *   SALIDA   `buildPersistableFiles` es el filtro OBLIGATORIO antes de guardar.
 *            Devuelve solo los ficheros realmente referenciados y delata
 *            cualquier base64 superviviente en `inline`, para que el host
 *            aborte el guardado en vez de escribirlo.
 *
 * Queda una vía que NO pasa por aquí: arrastrar, pegar o usar el selector de
 * ficheros nativo de Excalidraw, que inlinea base64 sin preguntar. Para eso
 * está {@link externalizeInlineImages}, que el host ejecuta antes de guardar y
 * que convierte esos base64 en ficheros de MM. Entre externalizar y el filtro
 * de salida, no hay camino por el que un byte de imagen llegue a la base.
 *
 * @see exportHydrate.ts — el viaje inverso (URL → bytes) SOLO en memoria y solo
 * para exportar, porque el canvas se contamina con imágenes remotas.
 */
export interface InsertImageOptions {
    /**
     * Página (marco) donde dejar la imagen. Es el respaldo: con `at`, manda la
     * página bajo el punto de suelte. Sin ninguno de los dos, la primera.
     */
    pageId?: string;
    /**
     * Punto de la ESCENA donde centrar la imagen. Lo usa el arrastre desde la
     * biblioteca: sin esto todo cae en el centro de la página y soltar en un sitio
     * concreto no significaría nada. Sin él, se centra en la página.
     *
     * También DECIDE la página: se usa la que contiene el punto. Ver
     * `insertImageByReference` para por qué no basta con colocarla ahí.
     */
    at?: {
        x: number;
        y: number;
    };
}
/**
 * Sube los bytes a MediaMonster y devuelve la URL pública servible.
 *
 * Lo inyecta el host: este paquete no sabe de rutas, de proyecto ni de
 * autenticación (misma decisión que `MediaFetcher` en exportHydrate.ts).
 */
export type MediaUploader = (blob: Blob, filename: string) => Promise<string>;
/** Forma mínima de una entrada del mapa de ficheros de Excalidraw. */
export interface FileEntry {
    id: string;
    dataURL: string;
    mimeType: string;
    created?: number;
    lastRetrieved?: number;
}
/**
 * Un `data:` lleva los bytes dentro; cualquier otra cosa es una referencia.
 *
 * Devuelve `boolean` y NO `value is string` a propósito: como predicado de
 * tipo, sobre un parámetro ya tipado `string` estrecha la rama FALSA a `never`
 * y todo uso posterior de la variable deja de compilar.
 */
export declare function isInlineDataUrl(value: unknown): boolean;
/** ¿Hay alguna imagen subiéndose ahora mismo? */
export declare function hasUploadsInFlight(): boolean;
/**
 * Página donde CAERÍA una inserción con estas opciones, sin insertar nada.
 *
 * La necesita el host para decidir ANTES de empezar: si esa página está
 * bloqueada, un lote de cinco archivos tiene que rebotar con un aviso, no con
 * cinco. Usa exactamente la misma regla que la inserción real — es la misma
 * función — para que no puedan discrepar.
 */
export declare function resolveInsertPageId(api: ExcalidrawImperativeAPI, opts?: InsertImageOptions): string | null;
/**
 * Puntos escalonados para soltar VARIOS archivos de una vez.
 *
 * Uno encima de otro no es una inserción múltiple, es una que parece fallida:
 * la de arriba tapa al resto y no hay forma de saber que entraron cuatro. Se
 * escalonan como una baraja abierta.
 *
 * El paso va en unidades de ESCENA y sale del tamaño de la página (4% del lado
 * corto), no de píxeles de pantalla: así se ve igual de abierto en una story
 * vertical que en un A4, y no depende del zoom que tengas puesto.
 *
 * La dirección la decide el cuadrante donde sueltas. Escalonando siempre hacia
 * abajo-derecha, soltar cerca de esa esquina empujaba todas las copias contra el
 * borde, donde el recorte a la página las volvía a apilar en el mismo sitio —
 * justo el amontonamiento que esto viene a evitar.
 */
export declare function cascadePoints(api: ExcalidrawImperativeAPI, at: {
    x: number;
    y: number;
}, count: number): {
    x: number;
    y: number;
}[];
/** Rectángulo de una imagen de la escena, para dibujar sobre ella. */
export interface ImageHit {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * La imagen que hay bajo un punto de la escena, si hay alguna.
 *
 * Se recorre al revés porque la escena está ordenada de atrás hacia delante:
 * la que el usuario ve bajo el puntero es la ÚLTIMA que lo contiene, no la
 * primera. Sirve para el intercambio con Mayúsculas y para dibujar el marco que
 * lo anuncia mientras arrastras.
 */
export declare function imageAtScenePoint(api: ExcalidrawImperativeAPI, at: {
    x: number;
    y: number;
}): ImageHit | null;
/** dataURL → Blob, para poder subir a MM lo que Excalidraw inlineó. */
export declare function dataUrlToBlob(dataUrl: string): Blob;
/**
 * Inserta una imagen ya alojada en MediaMonster, POR REFERENCIA.
 *
 * No descarga nada: la URL se guarda tal cual en el mapa de ficheros. (Antes
 * esta función hacía justo lo contrario —`fetch` + inline a base64—, que es
 * precisamente lo que la regla prohíbe.)
 *
 * @returns el id del ELEMENTO insertado (ver `insertImageByReference`).
 */
export declare function insertImageFromUrl(api: ExcalidrawImperativeAPI, url: string, opts?: InsertImageOptions): Promise<string>;
/**
 * Inserta una imagen desde bytes locales (selector de ficheros, portapapeles):
 * SUBE primero a MediaMonster y luego inserta la referencia.
 *
 * El `uploader` es obligatorio por diseño. Sin él no hay inserción: es lo que
 * impide que exista una ruta "rápida" que se salte MM.
 *
 * @returns el id del ELEMENTO insertado (ver `insertImageByReference`).
 */
export declare function insertImageFromBlob(api: ExcalidrawImperativeAPI, blob: Blob, uploader: MediaUploader, opts?: InsertImageOptions & {
    filename?: string;
}): Promise<string>;
/**
 * Cambia el ARCHIVO de una imagen ya colocada, conservando su sitio.
 *
 * Es rellenar un hueco de plantilla: la foto que ya está maquetada (posición,
 * tamaño, capa, página) se queda donde está y solo pasa a apuntar a otra. Sin
 * esto había que borrar, volver a insertar y recolocar a ojo.
 *
 * NO se estira la imagen nueva hasta llenar la caja vieja: una foto vertical en
 * un hueco horizontal saldría deformada, y Excalidraw no sabe recortar. Se
 * conserva el CENTRO y se mete dentro de la caja anterior con su propia
 * proporción, que es lo más parecido a "el mismo sitio, el mismo tamaño" que se
 * puede hacer sin mentir sobre la imagen.
 *
 * Como en `externalizeInlineImages`, el fichero entra con un id NUEVO:
 * `addFiles` ignora en silencio todo id que ya exista, así que reaprovechar el
 * anterior dejaría el elemento apuntando a la imagen vieja.
 *
 * @returns `false` si ese id no es una imagen de la escena.
 */
export declare function replaceImageFromUrl(api: ExcalidrawImperativeAPI, elementId: string, url: string): Promise<boolean>;
/**
 * Inserta bytes locales PINTANDO YA y cambiando a MediaMonster al terminar.
 *
 * Para lo que se arrastra desde el escritorio. `insertImageFromBlob` sube
 * primero y pinta después, que es correcto y se siente roto: sueltas una foto de
 * 8 MB y el lienzo se queda igual varios segundos, sin nada que mirar y sin
 * saber si el gesto ha contado. Aquí la foto aparece en el sitio donde la
 * soltaste con sus propios bytes, y cuando la subida termina el elemento pasa a
 * apuntar a la URL de MM sin que se note.
 *
 * NO abre un agujero en la regla, aunque lo parezca. La única forma de entrar
 * sigue siendo con un `MediaUploader`: no existe —ni se exporta— una función
 * que acepte un `data:` de fuera. Y el base64 no sobrevive al final de esta
 * función pase lo que pase: si la subida sale bien se sustituye, y si falla se
 * BORRA el elemento. Nunca queda un base64 al que el guardado tenga que
 * enfrentarse.
 *
 * La ventana en la que sí existe dura lo que la subida, y durante ella el
 * fichero queda anotado en `uploadsInFlight` para que `externalizeInlineImages`
 * NO lo toque. Sin esa marca lo subía por su cuenta y dejaba un duplicado en la
 * mediateca con el nombre `canvas-<uuid>.ext`: el guardado esperaba a que MM
 * terminara de procesar, así que la ventana siempre se agotaba y el duplicado
 * pasó de riesgo teórico a rutina.
 *
 * El cambio de fichero entra como `'never'` en el historial: es fontanería, y un
 * Ctrl+Z que devolviera el elemento al base64 recién sustituido sería justo lo
 * que la regla prohíbe.
 *
 * @returns el id del ELEMENTO, ya apuntando a MediaMonster.
 */
export declare function insertImageWithPreview(api: ExcalidrawImperativeAPI, blob: Blob, uploader: MediaUploader, opts?: InsertImageOptions & {
    filename?: string;
}): Promise<string>;
/** Ids del mapa de ficheros que todavía llevan los bytes dentro. */
export declare function findInlineImageIds(files: Record<string, FileEntry> | null | undefined): string[];
export interface ExternalizeResult {
    /** Cuántas imágenes pasaron de base64 a referencia de MediaMonster. */
    externalized: number;
    /** Ids que no se pudieron subir. Con esto ≠ 0, NO se debe guardar. */
    failed: string[];
    /**
     * Ids que se han SALTADO porque ya se están subiendo por otra vía.
     *
     * No son un fallo: terminarán solos en unos segundos. Pero tampoco se puede
     * guardar todavía, porque sus bytes siguen en la escena — quien llama debe
     * reintentar, no abortar con un error a la cara del usuario.
     */
    skipped: string[];
}
/**
 * Convierte a ficheros de MediaMonster todo el base64 que haya entrado por la
 * vía nativa de Excalidraw (arrastrar / pegar / selector).
 *
 * Se saltan los ficheros anotados en `uploadsInFlight`: esos ya van camino de
 * MM por la vía del insertador con vista previa, y subirlos aquí otra vez era la
 * causa de los duplicados `canvas-<uuid>.ext` en la mediateca. Salen en
 * `skipped`, que no es un fallo pero SÍ impide guardar todavía.
 *
 * Detalle importante: NO se reutiliza el id del fichero. `api.addFiles()`
 * delega en `addMissingFiles()`, que hace `continue` con todo id ya existente,
 * así que sobrescribir una entrada por esa vía es un NO-OP silencioso (la misma
 * trampa documentada en exportHydrate.ts). Por eso cada imagen externalizada
 * recibe un id NUEVO y se repunta el elemento que la usa.
 */
export declare function externalizeInlineImages(api: ExcalidrawImperativeAPI, uploader: MediaUploader): Promise<ExternalizeResult>;
export interface PersistableFiles {
    /** Solo los ficheros REFERENCIADOS por la escena, listos para guardar. */
    files: Record<string, FileEntry>;
    /** Ficheros que siguen llevando bytes dentro. Si no está vacío, NO guardar. */
    inline: string[];
}
/**
 * EL FILTRO DE SALIDA. Todo guardado tiene que pasar por aquí.
 *
 * Hace dos cosas: se queda solo con los ficheros que algún elemento usa de
 * verdad (Excalidraw nunca limpia el mapa, así que borrar una foto dejaba sus
 * bytes en la fila para siempre), y devuelve en `inline` cualquier base64 que
 * haya sobrevivido para que el host aborte en vez de escribirlo.
 */
export declare function buildPersistableFiles(elements: readonly SceneElement[], files: Record<string, FileEntry> | null | undefined): PersistableFiles;
//# sourceMappingURL=media.d.ts.map