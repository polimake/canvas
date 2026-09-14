# Espacios de trabajo

Canvas ofrece dos distribuciones sobre una misma sesión de Excalidraw:

| Espacio | Organización | Uso |
| --- | --- | --- |
| `design` | Panel izquierdo con pestañas de biblioteca, diseño, componentes y capas disponibles | Composición guiada, una tarea a la vez |
| `advanced` | Panel derecho con secciones plegables abiertas; capas primero | Inspeccionar capas y ajustar la página sin alternar pestañas |

Ambos conservan las herramientas del motor y la navegación inferior por páginas.
Solo aparecen paneles cuyas capacidades o ranuras estén habilitadas. `layers`
requiere `pages`; biblioteca y componentes reciben contenido React del host.
En lectura se oculta el selector y las herramientas de edición; se conserva el
dock de capas de consulta si está habilitado.

## Elegir y recordar

Sin configuración, el editor comienza en `design` y gestiona el selector:

```tsx
<Canvas2Editor initialScene={scene} pages layers defaultWorkspace="advanced" />
```

Un host puede controlar la elección y persistirla como preferencia del usuario:

```tsx
import { useState } from 'react';
import { Canvas2Editor, type CanvasWorkspace } from '@pm/canvas/ui';

function Editor({ scene }) {
  const [workspace, setWorkspace] = useState<CanvasWorkspace>('design');
  return <Canvas2Editor initialScene={scene} pages layers
    workspace={workspace} onWorkspaceChange={setWorkspace} />;
}
```

`defaultWorkspace` se lee al montar. En modo controlado, el callback solicita un
cambio y el host debe actualizar `workspace`. El paquete no escribe preferencias
en almacenamiento. Nunca uses `key={workspace}`: desmontaría el motor y perdería
su sesión. Para abrir otro documento sí se puede usar `key={documentId}`.

La elección no invoca operaciones de escena: conserva elementos, archivos,
selección y deshacer. Al cambiar el espacio disponible, el motor vuelve a medir
su superficie. La biblioteca del host puede remontarse al cambiar la
distribución; su estado duradero debe vivir en el host.

## Carpetas y extensión

`ui/workspaces/WorkspaceLayout.tsx` mantiene la barra, el panel lateral y una
superficie estable. `design/DesignWorkspace.tsx` presenta un panel activo;
`advanced/AdvancedWorkspace.tsx` presenta secciones simultáneas. Reciben la misma
lista de paneles, definida en `types.ts`. La composición de capacidades pertenece
a `ui/editor/Canvas2.tsx`; cada panel reutilizable vive en `ui/panels/`.

Para añadir otra distribución, amplía `CanvasWorkspace`, implementa su marco
en una carpeta propia y añade su opción y etiquetas al selector. Conserva la
superficie y la sesión en el mismo lugar del árbol React. Las operaciones de
edición se implementan en `core`, y se reutilizan desde cada UI.

Los textos `labels.workspace` admiten traducción. Claro/oscuro se deriva de
`theme`. El botón de paneles permite aprovechar todo el ancho; hasta 900 px de
contenedor, el lateral se superpone al lienzo para mantenerlo utilizable.

Estos espacios organizan las capacidades actuales. No añaden retoque raster,
máscaras, filtros de Photoshop ni fidelidad adicional al importar PSD/AI/PPTX.

## Comprobar

`pnpm test` incluye cambios de espacio con una sesión montada, modo controlado,
paneles plegables, traducciones y vista de lectura. El test de sesión verifica
la misma instancia, elementos y selección, sin nuevas escrituras al historial;
usa un doble del motor. Para probar el motor real ejecuta `pnpm dev:workspaces`
y abre la URL indicada por Vite. Comprueba dibujo, selección, alternancia,
deshacer, arrastre y ancho reducido.
