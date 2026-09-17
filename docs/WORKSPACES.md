# Espacios de trabajo

Canvas ofrece tres distribuciones sobre una misma sesión de Excalidraw:

| Espacio | Organización | Uso |
| --- | --- | --- |
| `excalidraw` (predeterminado) | Controles nativos y una barra de recursos a la derecha, cerrados hasta que se necesitan | Dibujo libre con acceso a todas las capacidades habilitadas |
| `design` (Canva) | Barra izquierda con iconos y paneles de elementos, texto, marca, página, capas y contenido del host | Composición guiada, una tarea a la vez |
| `advanced` (Experta) | Herramientas a la izquierda, opciones arriba y panel derecho con pestañas y capas fijas | Editar con una distribución compacta inspirada en Photoshop |

Los tres conservan las herramientas del motor y la navegación inferior por páginas.
En Diseño, pulsar una sección abre su panel; repetir la pulsación lo cierra.
Elementos permite buscar e insertar formas centradas en la página, y Texto ofrece
títulos, subtítulos y cuerpo con las fuentes de la marca. Cada inserción conserva
selección, pertenencia a la página e historial de deshacer.
Las propiedades de la selección usan los controles nativos en una barra horizontal
en escritorio; en pantallas estrechas conservan su distribución móvil.
El fondo exterior de las páginas es gris suave para distinguir el papel del entorno.
Solo aparecen paneles cuyas capacidades o ranuras estén habilitadas. `layers`
requiere `pages`; biblioteca y componentes reciben contenido React del host.
En lectura se ocultan las opciones de espacio y las herramientas de edición; se conserva el
dock de capas de consulta si está habilitado.

## Elegir y recordar

El menú principal permite elegir el espacio y guarda la preferencia en
`localStorage`, clave `pm-canvas-workspace-v2`, con valores `excalidraw`, `design` o `advanced`.
Sin un valor válido, el editor comienza en `excalidraw`. `defaultWorkspace` permite
cambiar ese valor inicial:

```tsx
<Canvas2Editor initialScene={scene} pages layers defaultWorkspace="advanced" />
```

Un host puede controlar la elección:

```tsx
import { useState } from 'react';
import { Canvas2Editor, type CanvasWorkspace } from '@pm/canvas/ui';

function Editor({ scene }) {
  const [workspace, setWorkspace] = useState<CanvasWorkspace>('design');
  return <Canvas2Editor initialScene={scene} pages layers
    workspace={workspace} onWorkspaceChange={setWorkspace} />;
}
```

La preferencia guardada tiene prioridad sobre `defaultWorkspace`, que se lee al
montar. En modo controlado, el callback solicita un cambio y el host debe actualizar
`workspace`; solo se guarda el valor aceptado. Si el almacenamiento está bloqueado,
la elección funciona durante la sesión. Nunca uses `key={workspace}`: desmontaría el motor y perdería
su sesión. Para abrir otro documento sí se puede usar `key={documentId}`.

La elección no invoca operaciones de escena: conserva elementos, archivos,
selección y deshacer. Al cambiar el espacio disponible, el motor vuelve a medir
su superficie. La biblioteca del host puede remontarse al cambiar la
distribución; su estado duradero debe vivir en el host.

## Carpetas y extensión

`ui/workspaces/WorkspaceLayout.tsx` mantiene el panel lateral y una
superficie estable. `design/DesignWorkspace.tsx` presenta un panel activo;
`advanced/AdvancedWorkspace.tsx` mantiene las capas visibles junto al panel elegido. Reciben la misma
lista de paneles, definida en `types.ts`. La composición de capacidades pertenece
a `ui/editor/Canvas2.tsx`; cada panel reutilizable vive en `ui/panels/`.

Para añadir otra distribución, amplía `CanvasWorkspace`, implementa su marco
en una carpeta propia y añade su opción y etiquetas al menú. Conserva la
superficie y la sesión en el mismo lugar del árbol React. Las operaciones de
edición se implementan en `core`, y se reutilizan desde cada UI.

Los textos `labels.workspace` admiten traducción. Diseño respeta `theme`; Avanzado usa un cromo oscuro y mantiene los colores originales del documento. La cuadrícula queda desactivada en Avanzado. No hay cabecera de espacios ni botón para ocultar paneles. Hasta 900 px
de contenedor, la barra de iconos permanece visible y su panel se superpone al
lienzo entre las herramientas superiores e inferiores. En Avanzado, los paneles pasan a un dock inferior en pantallas estrechas.

Estos espacios organizan las capacidades actuales. No añaden retoque raster,
máscaras, filtros de Photoshop ni fidelidad adicional al importar PSD/AI/PPTX.

## Comprobar

`pnpm test` incluye cambios de espacio con una sesión montada, modo controlado,
persistencia, traducciones y vista de lectura. El test de sesión verifica
la misma instancia, elementos y selección, sin nuevas escrituras al historial;
usa un doble del motor. Para probar el motor real ejecuta `pnpm dev:workspaces`
y abre la URL indicada por Vite. Comprueba dibujo, selección, alternancia,
deshacer, arrastre y ancho reducido.



El cambio de clave deja de heredar el antiguo valor `design`, que se guardaba automáticamente. No modifica documentos ni historiales. Canva usa una barra de 56 px y un ancho total de 288 px con el panel abierto; Excalidraw ocupa 40 px cerrado y 272 px abierto.
