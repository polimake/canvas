# Componentes y API de `@studio/canvas2`

Inventario de todo lo que exporta el paquete. **Esto define qué existe; dónde
colocarlo es decisión del consumidor.**

Todo sale de tres entradas:

```ts
import { ... } from '@studio/canvas2';             // editor, paneles, escena, media
import { ... } from '@studio/canvas2/components';  // motor de componentes, puro (vale en Node)
import { ... } from '@studio/canvas2/fonts';       // ids de familia, puro (vale en Node)
```

Los dos subpaths son **puros**: no tocan `window` ni importan Excalidraw, así que
se pueden usar en un worker o en un script de Node. El barrel principal **sí**
arrastra Excalidraw, que toca `window` al importarse — móntalo siempre tras una
frontera de solo-cliente (en Next: `dynamic(..., { ssr: false })`).

---

## 1. El editor completo

### `<Canvas2Editor>` (alias: `Canvas2`, y export por defecto)

El editor entero, con todo su cromo montado y coordinado. Es el camino normal:
un solo componente y ya tienes páginas, capas, marca, menú y exportación.

Props, agrupadas por lo que hacen. Todas son opcionales salvo donde se diga.

**Escena y ciclo de vida**

| Prop | Tipo | Nota |
| --- | --- | --- |
| `initialScene` | `Canvas2Scene \| null` | Escena de partida. No es controlada: cambiarla después no reinicia el editor (usa `key` para eso). |
| `onSceneChange` | `(scene) => void` | Instantánea tras cada cambio, con debounce. **No** incluye cámara ni selección. Persistirla es cosa tuya. |
| `changeDebounceMs` | `number` | Por defecto `400`. |
| `onReady` | `(api) => void` | Te entrega la API imperativa de Excalidraw al montar. |
| `viewMode` | `boolean` | Solo lectura: oculta todo control que mute. |
| `theme` | `'light' \| 'dark'` | |
| `langCode` | `string` | Por defecto `'es-ES'`. |
| `className` | `string` | |

**Páginas (artboards)**

| Prop | Tipo | Nota |
| --- | --- | --- |
| `pages` | `boolean` | Activa el modelo de páginas de tamaño fijo. Apagado = lienzo infinito. |
| `pageSize` | `PageSize` | Por defecto IG 4:5, 1080×1350. |
| `layers` | `boolean` | Panel de capas. **Requiere `pages`**: se acota a la página activa. |
| `pageThumbnails` | `boolean` | Miniaturas en la tira. Apagado por defecto: rasterizar cuesta. |
| `pageThumbnailFiles` | `FilesMap` | Necesario si hay imágenes remotas, o saldrán sin miniatura. |
| `onActivePageChange` | `(pageId) => void` | Necesario si el host inserta cosas: sin esto no sabe en qué página. |

**Identidad de marca y tipografías**

| Prop | Tipo | Nota |
| --- | --- | --- |
| `brandKit` | `BrandKitInput \| null` | El blob **crudo** de la BD. Se traduce dentro. Solo afecta a elementos NUEVOS. |
| `fontOverrides` | `CustomFontFace[]` | Tipografías propias, registradas como familias nuevas de Excalidraw. |

`brandKit` recibe el crudo a propósito: si el host tuviera que llamar a
`resolveBrandKit()` importaría un valor del barrel y arrastraría Excalidraw a su
bundle de servidor (`window is not defined`). Pasando datos, eso no pasa.

**Exportación**

| Prop | Tipo | Nota |
| --- | --- | --- |
| `hydrateFiles` | `(opts?) => Promise<FilesMap>` | Trae los bytes remotos antes de exportar. Sin esto, exportar muere con canvas contaminado. |
| `nativeImageExport` | `boolean` | Por defecto `true`. **Ponlo a `false` si la escena puede tener imágenes por URL remota.** |

Sobre `nativeImageExport`: el diálogo propio de Excalidraw carga las imágenes con
`new Image()` sin `crossOrigin`, contamina el canvas, y revienta con
`SecurityError` mientras pinta la vista previa — antes de que el usuario pueda
hacer nada. Quien sirva imágenes remotas se trae también su propio camino de
exportación.

**Las ranuras del host** — ver [INTEGRATION.md](./INTEGRATION.md)

| Prop | Tipo | Nota |
| --- | --- | --- |
| `library` | `ReactNode` | Contenido del panel de biblioteca. Sin contenido, no hay panel. |
| `componentsPanel` | `ReactNode` | Contenido de la pestaña Componentes. Sin contenido, no hay pestaña. |
| `onSaveComponent` | `() => void` | Entrada de menú «Guardar página como componente». La subida es tuya. |
| `onMediaDrop` | `(payload, at, target?) => void` | Se suelta algo de tu biblioteca. canvas2 no interpreta el payload, solo dice dónde cayó. |
| `mediaDropType` | `string` | Por defecto `MEDIA_DROP_TYPE`. |
| `onFilesDrop` | `(files, at) => void` | Ficheros del sistema. Con esto puesto, canvas2 intercepta antes que Excalidraw. |
| `labels` | `PartialLabels` | Textos. Lo que no pases se queda en español. |
| `resolveVideoSrc` / `releaseVideoSrc` | | Convierte una URL de vídeo en algo reproducible sin contaminar el lienzo. |
| `onPickVideoFrame` | `(video, timeSec) => Promise<{url}>` | Captura el fotograma y devuelve el póster **ya subido**. |
| `dockedSidebarBreakpoint` | `number` | Por defecto `820`. |

---

## 2. Los paneles, sueltos

Si prefieres componer tu propio cromo en vez de montar `Canvas2Editor`, todos
los paneles se exportan por separado. Todos toman `api` (la API imperativa) y
casi todos `theme`, `viewMode` y `labels`.

| Componente | Qué es | Props propias |
| --- | --- | --- |
| `RightDock` | La pastilla flotante con las pestañas **Diseño / Capas / Componentes**. Decide sola qué pestañas hay según lo que reciba. | `layers`, `design`, `componentsPanel`, `brandKit`, `narrow` |
| `LayersPanel` | Lista de elementos de la página activa: seleccionar, reordenar, renombrar, bloquear, borrar. Autónomo. | `activePageId`, `embedded` |
| `DesignPanel` | Marca del cliente + tamaño y fondo de la página activa. | `activePageId`, `brandKit` |
| `BrandGallery` | Colores y logos de la marca, insertables. La monta `DesignPanel`. | `brandKit`, `activePageId`, `embedded` |
| `PageNavigator` | Tira inferior de páginas, con el «+» entre ellas. Arrastrar para reordenar. | `activeId`, `onActiveChange`, `thumbnails`, `thumbnailFiles`, `pageSize`, `narrow` |
| `PageActions` | Acciones de la página activa, flotando junto a su nombre. | `activePageId`, `onActiveChange` |
| `CanvasMenu` | Menú principal: fondo, tamaño, insertar texto, exportar. | `hydrateFiles`, `activePageId` |
| `LibraryPanel` | **Solo el marco** del panel de biblioteca. El contenido lo pones tú en `children`. | `children`, `title`, `defaultCollapsed`, `anchorTop` |
| `DragPreview` | Tarjeta que sigue al cursor al arrastrar. Se exporta por si quieres el mismo gesto en tu biblioteca. | `active`, `grab`, `radius` |

`LayersPanel` y `DesignPanel` requieren el modelo de páginas: sin página activa
no hay nada que listar, y tamaño y fondo son propiedades de *una* página.

---

## 3. Módulos de lógica

Todo lo siguiente es API programática, sin UI.

**Páginas** (`pages`, `paginate`, `layout`, `align`)
`createBlankScene`, `listPages`, `addPage`, `deletePage`, `duplicatePage`,
`movePage`, `renamePage`, `resizePage`, `relayoutPages`, `goToPage`,
`fitAllPages`, `setPageLocked`, `getPageSize` · `PAGE_SIZE_PRESETS`,
`DEFAULT_PAGE_SIZE`, `PAGE_GAP` · `alignToPage`, `PAGE_ALIGNMENTS`
`convertToPages`, `adoptLooseIntoPage`, `clusterLooseElements` — para escenas
que llegan sin páginas (importadas, pegadas, arrastradas).

**Mutación** (`mutate`, `zorder`)
`patchElement`, `commitElements` · `reorderPageMembers`, `sendMemberToBack`.
**Toda escritura sobre elementos pasa por aquí**: `patchElement` sube el
`versionNonce`, y sin eso el cambio es invisible para deshacer. Hay un test que
lo obliga.

**Persistencia** (`serialize`)
`serializeScene`, `parseScene`.

**Exportación** (`export`, `exportHydrate`)
`exportScenePng`, `exportSceneSvg`, `exportScenePdf`, `captureThumbnail`,
`downloadBlob` · `buildHydratedFiles`, `clearHydrationCache`.

**Media** (`media`) — imágenes **siempre** por referencia remota
`insertImageFromUrl`, `insertImageFromBlob`, `insertImageWithPreview`,
`replaceImageFromUrl`, `resolveInsertPageId`, `imageAtScenePoint`,
`externalizeInlineImages`, `buildPersistableFiles`, `findInlineImageIds`.

No se exporta ningún insertador por dataURL. La única forma de meter una imagen
es por URL remota o subiendo antes: `insertImageWithPreview` pinta al instante
con los bytes locales mientras la subida va en camino, así que no se nota.

**Texto y fondo** (`text`, `background`)
`TEXT_PRESETS`, `insertTextPreset`, `contrastTextColor` ·
`getPageBackground`, `setPageBackgroundColor`, `ensurePagePapers`.

**Vídeo** (`video`)
`insertVideo`, `setVideoPoster`, `isVideoElement`, `getVideoMeta`,
`getSelectedVideo`. Un vídeo en el lienzo es un póster que recuerda de qué
vídeo salió, para poder volver a elegir fotograma.

**Marca y tipografías** (`brand`, `fonts`, `fontRegistry`)
`resolveBrandKit`, `EMPTY_BRAND` · `customFontFamilyId`, `fontFamilyAlias`,
`normalizeFontName`, `buildFontFaceCss`, `dedupeFontFaces`,
`EXCALIDRAW_BUILTIN_FAMILIES` · `registerCustomFont`, `registerCustomFonts`,
`fontFamilyId`.

El id numérico de familia es **función pura del nombre**, así que un convertidor
en Node y el editor en el navegador calculan el mismo sin hablarse.
⚠️ Los nombres de familia **no pueden llevar dígitos** o el texto sale diminuto.

**Componentes reutilizables** (`components`, `insertComponent`)
`extractComponentFragment`, `listSlots`, `deriveComponentMeta`,
`instantiateComponent`, `cloneSceneElements`, `appendComponentToEditorConfig`,
`measureWrappedText`, `fitImageInBox` · `insertComponentIntoScene`,
`extractPageForComponent`.

El motor está en el subpath puro `/components` justo para que un backend pueda
instanciar componentes sin cargar el editor.

**Conversión desde el editor anterior** (`legacy`)
`legacyToScene`, `parseLegacyText`. Histórico; el editor DOM se retiró el
2026-08-06.

**Tema e i18n** (`theme`, `labels`)
`palette`, `PANEL_FONT` · `DEFAULT_LABELS`, `mergeLabels`.

---

## Sobre el aspecto visual

canvas2 **no usa Tailwind ni `@polimake/ui`**. Todo su cromo se estila con
estilos inline desde `theme.ts`, que espeja a mano los tokens de marca. Es
deliberado: el paquete se distribuye sin arrastrar un sistema de diseño entero.

Para el consumidor esto significa que **obtiene el editor completo y presentable
sin instalar nada de Polimake**. El precio es que el color de acento es una
copia, no una importación, y se desincroniza en silencio si cambian los tokens.
