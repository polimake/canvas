import { type ReactNode } from 'react';
import '../shared/canvas2.css';
import { type ExcalidrawImperativeAPI } from '../../core/excal';
import { PageNavigator } from '../navigation/PageNavigator';
import type { CanvasWorkspace } from '../workspaces/types';
import type { FilesMap } from '../hooks/pageThumbnails';
import { type PageSize } from '../../core/pages';
import { type BrandKitInput } from '../../core/brand';
import { type CustomFontFace } from '../../core/fonts';
import { type PartialLabels } from '../shared/labels';
/**
 * A serializable snapshot of the canvas. Same shape Excalidraw accepts as
 * `initialData`, so a scene emitted by {@link Canvas2EditorProps.onSceneChange}
 * can be fed straight back in as {@link Canvas2EditorProps.initialScene}.
 */
import type { Canvas2Scene } from '../../core/scene';
export type { Canvas2Scene } from '../../core/scene';
/** The Excalidraw imperative API handed to `onReady` (updateScene, export, …). */
export type Canvas2Api = ExcalidrawImperativeAPI;
export interface Canvas2EditorProps {
    /** Controlled workspace. Switching changes only the surrounding UI. */
    workspace?: CanvasWorkspace;
    /** Initial workspace when uncontrolled. Defaults to `design`. */
    defaultWorkspace?: CanvasWorkspace;
    /** The host may persist this UI preference separately from the document. */
    onWorkspaceChange?: (workspace: CanvasWorkspace) => void;
    /** Optional className for the wrapper. The wrapper fills its parent (100% ×
     *  100%), so the parent MUST establish a concrete height. */
    className?: string;
    /** Initial scene (elements / appState / files). Read once on mount, like
     *  Excalidraw's `initialData` — later changes do not reset the canvas. */
    initialScene?: Canvas2Scene | null;
    /**
     * Fired (debounced) when scene CONTENT changes, with a persistence-ready
     * snapshot: deleted-element tombstones are filtered out, the files map is
     * pruned to images still referenced, and viewport-only changes (pan/zoom/
     * selection) never fire. The snapshot is immutable-by-convention — persist
     * it as-is (stringify), never mutate it; camera/selection are intentionally
     * not part of it. The host owns persistence.
     */
    onSceneChange?: (scene: Canvas2Scene) => void;
    /** Read-only mode (preview / comment). Maps to `viewModeEnabled` and hides
     *  every mutating control in the canvas2 chrome (page actions, inserts). */
    viewMode?: boolean;
    /** 'light' | 'dark'. Omit to use Excalidraw's default. */
    theme?: 'light' | 'dark';
    /** UI language. Defaults to Spanish to match studio. */
    langCode?: string;
    /** Receives the imperative API once mounted (updateScene, exportToBlob, …).
     *  This is canvas2's analogue of `onRegisterEditorApi`. */
    onReady?: (api: ExcalidrawImperativeAPI) => void;
    /**
     * Excalidraw's own "save as image" dialog. Defaults to `true`.
     *
     * Set it to `false` when the scene can hold images by REMOTE URL (migrated
     * designs do — the URL lives in `files[id].dataURL`). Excalidraw loads them
     * with `new Image()` and no `crossOrigin`, which taints the canvas: its
     * dialog then dies with `SecurityError: Tainted canvases may not be exported`
     * while it renders the preview, before the user can do anything.
     *
     * The host's own export (see `withHydratedFiles` in exportHydrate.ts) swaps
     * those URLs for dataURLs first, so it is unaffected — but it cannot fix a
     * dialog it doesn't own. Hence the switch: whoever supplies remote images
     * also supplies the export path.
     */
    nativeImageExport?: boolean;
    /**
     * Tipografías propias que la escena necesita, con su fichero.
     *
     * Se REGISTRAN como familias nuevas de Excalidraw (no se secuestra ninguna de
     * las suyas): ver la cabecera de `fonts.ts` para el mecanismo y sus límites.
     * El id numérico que le toca a cada nombre lo da `customFontFamilyId`, y es
     * el mismo que estampa el convertidor `legacy.ts`, así que un diseño migrado
     * se abre con su tipografía sin más trámite.
     *
     * Un diseño guardado trae las suyas en `editorConfig.fonts` y el host las
     * pasa por aquí; las del brand kit del proyecto se añaden aparte.
     */
    fontOverrides?: CustomFontFace[];
    /** Debounce window for `onSceneChange`, in ms. Defaults to 400. */
    changeDebounceMs?: number;
    /** Enable the fixed-size multi-page artboard model (frames-as-pages) and show
     *  the bottom page navigator. When off, canvas2 is a plain infinite canvas. */
    pages?: boolean;
    /** Page/artboard size when `pages` is enabled. Defaults to IG 4:5 1080×1350. */
    pageSize?: PageSize;
    /** Show the right-side layers panel (the active page's elements). Requires
     *  `pages` (it's scoped to the active artboard). */
    layers?: boolean;
    /**
     * Miniatura por página en la tira inferior (como el editor legacy). Apagado
     * por defecto porque rasterizar cuesta; con imágenes remotas hace falta
     * además `pageThumbnailFiles` o las páginas con foto saldrán sin miniatura.
     */
    pageThumbnails?: boolean;
    /** Mapa de ficheros hidratado, para poder rasterizar imágenes remotas. */
    pageThumbnailFiles?: Parameters<typeof PageNavigator>[0]['thumbnailFiles'];
    /**
     * `projects.brandKit` tal cual sale de la base de datos. Se traduce aquí
     * dentro con `resolveBrandKit()`.
     *
     * La prop es el blob CRUDO y no la marca ya resuelta a propósito: resolverla
     * en el host obligaría a importar un valor de `@pm/canvas`, y ese barrel
     * arrastra Excalidraw al bundle de servidor ("window is not defined"). Con el
     * crudo, el host solo pasa datos.
     *
     * Hace dos cosas: añade sus `@font-face` a los de `fontOverrides` (los de la
     * marca van DESPUÉS, así que un override explícito del host gana), y siembra
     * el `appState` inicial para que toda figura o texto que se cree nazca en
     * color y tipografía de marca en vez de en el negro por defecto.
     *
     * Solo afecta a lo NUEVO: una escena guardada trae su propio `appState` y
     * sigue mandando, o abrir un diseño antiguo le cambiaría los colores.
     */
    brandKit?: BrandKitInput | null;
    /**
     * Trae los bytes de las imágenes remotas justo antes de exportar, para que el
     * grupo Exportar del menú funcione también con escenas que apuntan al CDN.
     * Sin esto el rasterizado muere por canvas contaminado.
     */
    hydrateFiles?: (opts?: {
        output?: 'blob' | 'dataurl';
    }) => Promise<FilesMap>;
    /**
     * Ancho mínimo del editor, en px, a partir del cual la barra lateral se puede
     * anclar (el "pin" de Biblioteca).
     *
     * Excalidraw usa 1229 por defecto, pensando en un editor a pantalla completa.
     * Aquí el lienzo va empotrado en una pestaña del contenido y nunca llega a
     * esa anchura, así que el pin no hacía NADA: no está roto, está desactivado
     * por no caber. Con 820 quedan ~500 px de lienzo tras los 302 px que ocupa la
     * barra anclada, que es lo mínimo para seguir trabajando.
     */
    dockedSidebarBreakpoint?: number;
    /**
     * Contenido del panel de biblioteca (arriba a la derecha). Lo aporta el host
     * porque la mediateca vive en `apps/web`: este paquete no sabe de proyectos,
     * carpetas ni autenticación. Sin contenido, el panel no aparece.
     */
    library?: ReactNode;
    /**
     * Contenido de la pestaña Componentes del dock de la derecha. Mismo seam que
     * `library`: el host aporta la rejilla (los componentes viven en su API);
     * canvas2 solo pone el marco. Sin contenido, no hay pestaña.
     */
    componentsPanel?: ReactNode;
    /**
     * Contenido del panel Agente en ambos espacios de trabajo, como `componentsPanel`:
     * el host trae un asistente que sepa trabajar sobre esta escena; canvas2
     * solo le da el sitio. Sin contenido, no hay pestaña.
     */
    agentPanel?: ReactNode;
    /**
     * "Guardar página como componente" del menú. La subida es cosa del host
     * (POST a su API + miniatura); canvas2 solo ofrece la entrada de menú.
     */
    onSaveComponent?: () => void;
    /**
     * Se suelta algo de la biblioteca sobre el lienzo.
     *
     * Recibe el payload tal cual venía en el `dataTransfer` (tipo
     * {@link MEDIA_DROP_TYPE}) y el punto en coordenadas de ESCENA. canvas2 no
     * interpreta el payload: no sabe de ficheros de media, solo de dónde ha caído.
     *
     * Con `replaceElementId` la intención no es añadir sino SUSTITUIR el archivo
     * de esa imagen conservando su sitio (Mayúsculas + soltar encima de una que ya
     * está). El lienzo detecta el gesto porque es quien sabe qué hay bajo el
     * puntero; qué archivo entra sigue siendo cosa del host.
     */
    onMediaDrop?: (payload: string, at: {
        x: number;
        y: number;
    }, target?: {
        replaceElementId: string;
    }) => void;
    /** Tipo de dataTransfer a escuchar. Por defecto {@link MEDIA_DROP_TYPE}. */
    mediaDropType?: string;
    /**
     * Se sueltan ficheros del SISTEMA (escritorio, otra pestaña) sobre el lienzo.
     *
     * Con este manejador puesto, canvas2 intercepta el suelte antes de que lo vea
     * Excalidraw. Lo de serie es meter la imagen como base64 dentro de la escena,
     * que aquí no vale: los bytes viven en MediaMonster y el guardado se aborta si
     * llegan a la fila. El host sube y luego inserta (ver `insertImageWithPreview`,
     * que además pinta al instante con los bytes locales).
     *
     * Solo se le pasan imágenes; lo demás se deja pasar a Excalidraw, para no
     * romper el importar una escena `.excalidraw` arrastrándola.
     */
    onFilesDrop?: (files: File[], at: {
        x: number;
        y: number;
    }) => void;
    /**
     * Textos del editor. canvas2 no lleva i18n dentro (no puede depender del
     * `react-i18next` de apps/web), así que el host inyecta lo que tenga
     * traducido; lo que no pase se queda en español. Ver labels.ts.
     */
    labels?: PartialLabels;
    /**
     * Página activa, notificada al host. La necesita para insertar en la página
     * correcta lo que se elija en la biblioteca.
     */
    onActivePageChange?: (pageId: string | null) => void;
    /**
     * Convierte la URL de un vídeo de la mediateca en una que el `<video>` del
     * selector de fotograma pueda usar SIN contaminar el lienzo.
     *
     * Es asíncrona porque el camino real es fetch autenticado → blob del mismo
     * origen: el CDN no manda CORS y el proxy del host exige cabecera
     * `Authorization`, que un `<video src>` no puede mandar. Sin esto el selector
     * sale apagado.
     */
    resolveVideoSrc?: (src: string, signal: AbortSignal) => Promise<string>;
    /** Libera lo que devolviera `resolveVideoSrc` (revoca el object URL). */
    releaseVideoSrc?: (resolved: string) => void;
    /**
     * Captura el fotograma visible y devuelve la URL del póster YA subido a la
     * mediateca. Lo hace el host porque los bytes son cosa suya: este paquete no
     * sabe de MediaMonster, igual que no sabe de la biblioteca ni de los
     * componentes.
     */
    onPickVideoFrame?: (video: HTMLVideoElement, timeSec: number) => Promise<{
        url: string;
        mimeType?: string;
    } | null>;
}
/**
 * Valores por defecto del `appState` derivados de la marca: lo que se aplica a
 * cada figura o texto NUEVO.
 *
 * No se toca el color de relleno. Rellenar por defecto toda figura nueva es un
 * cambio de comportamiento que sorprende, y el relleno está a un clic en el
 * selector; el trazo, en cambio, es también el color del texto, así que es el
 * que de verdad ahorra trabajo.
 */
/**
 * Tipo de `dataTransfer` con el que la biblioteca del host marca lo que se
 * arrastra. Se exporta para que host y editor no puedan escribir cadenas
 * distintas y tener que descubrirlo probando.
 */
export declare const MEDIA_DROP_TYPE = "application/x-canvas2-media";
/**
 * Controlled wrapper around the Excalidraw infinite-canvas editor.
 *
 * Excalidraw touches `window` on import and must run client-side only — keep
 * this behind a `next/dynamic(..., { ssr: false })` boundary in the host app
 * (see apps/web/src/app/canvas/page.tsx).
 */
export declare function Canvas2Editor({ workspace: workspaceProp, defaultWorkspace, onWorkspaceChange, className, initialScene, onSceneChange, viewMode, theme, langCode, onReady, nativeImageExport, fontOverrides, changeDebounceMs, pages, pageSize, layers, pageThumbnails, pageThumbnailFiles, brandKit, hydrateFiles, dockedSidebarBreakpoint, library, componentsPanel, agentPanel, onSaveComponent, onActivePageChange, onMediaDrop, mediaDropType, onFilesDrop, labels, resolveVideoSrc, releaseVideoSrc, onPickVideoFrame, }: Canvas2EditorProps): import("react").JSX.Element;
/** Backwards-compatible alias — the bare wrapper is now a controlled editor. */
export declare const Canvas2: typeof Canvas2Editor;
export default Canvas2Editor;
//# sourceMappingURL=Canvas2.d.ts.map