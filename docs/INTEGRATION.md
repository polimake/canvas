# Integrar `@studio/canvas2`

Este documento es **un** ejemplo de integración, no la forma obligatoria. El
paquete define los componentes; dónde los colocas y cómo los conectas con tu
backend es tuyo. Studio los monta en una pestaña de una página de contenido;
otro consumidor puede montarlos a pantalla completa, en una ventana de Electron
o en un panel propio.

## Lo mínimo que funciona

```tsx
import dynamic from 'next/dynamic';

// Excalidraw toca `window` al importarse: el editor SIEMPRE va tras una
// frontera de solo-cliente. En Next es esto; en Vite/Electron basta con no
// importarlo desde código que corra en Node.
const Canvas2 = dynamic(
  () => import('@studio/canvas2').then((m) => m.Canvas2Editor),
  { ssr: false },
);

export function MiEditor({ escena, onGuardar }) {
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <Canvas2
        initialScene={escena}
        onSceneChange={onGuardar}
        pages
        layers
      />
    </div>
  );
}
```

Con eso ya tienes lienzo, páginas, capas, menú, exportación y tipografías. Lo
que **no** tienes es biblioteca de medios ni componentes reutilizables: eso son
ranuras, y hay que rellenarlas.

Dos detalles que parecen menores y no lo son:

- **El contenedor necesita altura y `position: relative`.** El cromo se posiciona
  respecto a él.
- **`initialScene` no es controlada.** Cambiarla después no reinicia el editor.
  Para cargar otro diseño, cambia la `key` del componente.

## Ejemplo completo

Así lo monta studio hoy. Cada ranura lleva anotado qué pasa si la dejas vacía.

```tsx
<Canvas2
  // Recargar el editor entero al cambiar de diseño.
  key={designId}

  // ── Escena ──────────────────────────────────────────────────────────
  initialScene={escena}
  fontOverrides={fuentesDelDiseño}
  onSceneChange={autoguardado.onSceneChanged}
  onReady={setApi}
  theme={tema}

  // ── Páginas ─────────────────────────────────────────────────────────
  pages
  layers
  pageThumbnails
  pageSize={tamañoSegunTipoDeContenido}
  // Sin este mapa, las páginas con imagen remota salen SIN miniatura:
  // rasterizar con la URL contamina el canvas.
  pageThumbnailFiles={ficherosHidratados}
  // Necesario para insertar en la página correcta.
  onActivePageChange={setPáginaActiva}

  // ── Solo lectura ────────────────────────────────────────────────────
  viewMode={modo === 'comentar'}

  // ── Exportación ─────────────────────────────────────────────────────
  // Se piden los bytes EN EL MOMENTO, no se reutiliza un mapa publicado
  // antes: podría no incluir una imagen recién añadida y el export saldría
  // incompleto sin avisar.
  hydrateFiles={hidratarFicheros}
  // Escena con imágenes remotas ⇒ el diálogo nativo revienta. Ver COMPONENTS.md.
  nativeImageExport={false}

  // ── Identidad de marca ──────────────────────────────────────────────
  // El blob CRUDO de la BD. Se traduce dentro del editor.
  brandKit={proyecto.brandKit}

  // ── Ranuras del host ────────────────────────────────────────────────
  labels={misTraducciones}

  // Biblioteca. `null` = no se dibuja el panel. Studio la saca a su propia
  // columna en vez de flotarla sobre el diseño.
  library={null}

  // Componentes del proyecto: el marco lo pone canvas2, la rejilla tú.
  componentsPanel={<MiSelectorDeComponentes onInsert={insertarComponente} />}
  onSaveComponent={guardarPáginaComoComponente}

  // Soltar desde tu biblioteca. canvas2 no interpreta el payload.
  onMediaDrop={soltarMedia}
  mediaDropType={MI_TIPO_DE_DROP}
  // Ficheros del sistema. Sin esto, Excalidraw los mete como base64 en la escena.
  onFilesDrop={subirLuegoInsertar}

  // Vídeo: la fuente y la subida del póster son tuyas.
  resolveVideoSrc={resolverVídeo}
  releaseVideoSrc={liberarVídeo}
  onPickVideoFrame={subirPóster}
/>
```

## Las ranuras, una a una

### Biblioteca de medios (`library`)

canvas2 pone el marco (`LibraryPanel`), tú pones el contenido. El paquete no
sabe de proyectos, carpetas ni autenticación.

Para que arrastrar funcione, tu biblioteca escribe en el `dataTransfer` con el
tipo `MEDIA_DROP_TYPE` (o el tuyo vía `mediaDropType`), y canvas2 te devuelve
ese payload tal cual en `onMediaDrop` junto al punto en **coordenadas de
escena**. Con `target.replaceElementId`, la intención no era añadir sino
sustituir el archivo de esa imagen conservando su sitio.

La constante se exporta justo para que host y editor no puedan escribir cadenas
distintas y tener que descubrirlo probando.

### Imágenes: **siempre** remotas, nunca base64

Es la regla más dura del paquete y conviene entenderla antes de integrarlo.

No existe ningún insertador por dataURL. Cuando alguien suelta ficheros del
sistema, `onFilesDrop` es tuyo: **subes primero, insertas después**. Usa
`insertImageWithPreview` y el usuario no nota la espera — pinta al instante con
los bytes locales mientras la subida va en camino.

Si no pasas `onFilesDrop`, Excalidraw hace lo suyo de serie: meter la imagen en
base64 dentro de la escena. Eso hincha la fila y, en studio, aborta el guardado.

### Componentes reutilizables (`componentsPanel`)

Mismo patrón. canvas2 trae el **motor** completo en el subpath puro
`@studio/canvas2/components` (extraer un fragmento, detectar slots,
instanciarlo), y monta la pestaña; la rejilla con miniaturas la pintas tú,
porque los componentes viven en tu API.

Que el motor sea puro es lo que permite que un backend instancie componentes sin
cargar el editor.

### Textos (`labels`)

canvas2 no lleva i18n dentro: no puede depender de tu librería de traducción, y
un paquete distribuible no debería imponer idioma. Define el **contrato** de
etiquetas y tú lo rellenas desde tu sistema. Es parcial — lo que no pases se
queda en español.

### Marca (`brandKit`)

Añade sus `@font-face` y siembra el `appState` para que **lo nuevo** nazca en
color y tipografía de marca. Solo afecta a lo nuevo: una escena guardada trae su
propio `appState` y sigue mandando, o abrir un diseño antiguo le cambiaría los
colores.

## Persistencia

`onSceneChange` te da una instantánea inmutable por convención: **persístela tal
cual, no la mutes**. Cámara y selección quedan fuera a propósito.

Antes de guardar, pasa por `buildPersistableFiles` para que no se cuele ninguna
imagen inline. Y ten en cuenta que `onSceneChange` **no dispara** en cambios que
solo tocan el `appState` (por ejemplo, la selección).

## Errores que cuestan una tarde

| Síntoma | Causa |
| --- | --- |
| `window is not defined` al construir | El editor se importó desde código de servidor. Falta la frontera de solo-cliente. |
| El editor sale sin estilos | Falta el CSS del paquete, o el bundler se lo comió: `sideEffects` incluye `*.css` y `src/excal.ts`. |
| `SecurityError: Tainted canvases` al exportar | Imágenes remotas con `nativeImageExport` en `true`, o falta `hydrateFiles`. |
| Páginas con foto y sin miniatura | Falta `pageThumbnailFiles`. |
| Deshacer no revierte un cambio | Se escribió el elemento sin pasar por `patchElement`, así que no subió el `versionNonce`. |
| Texto diminuto con una fuente propia | El nombre de familia lleva dígitos. Pásalo por `normalizeFontName`. |
| El panel de capas no aparece | `layers` requiere `pages`. |
| Cargar otro diseño no cambia nada | `initialScene` no es controlada: hace falta cambiar la `key`. |
