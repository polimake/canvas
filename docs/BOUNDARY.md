# Fronteras y responsabilidades

Canvas define su editor y sus herramientas de documentos. El consumidor decide
la interfaz de producto, el almacenamiento y los servicios externos.

| Canvas | Consumidor |
| --- | --- |
| Parsers de archivos y errores de formato | Selección del archivo y permisos |
| Modelos de documentos y canales PSD sin decodificar | Decodificación de rasteres PSD y subida de assets |
| Conversión a escena e informe de pérdidas | Mostrar el informe y decidir si aceptar la importación |
| Índice serializable y búsqueda local | Base de datos, embeddings, ranking y reindexación |
| Editor, páginas, capas, marca y paneles | Rutas, autenticación, mediateca y persistencia |
| Adaptador PDF.js estructural | Versión de PDF.js, worker, fuentes y renderizador |

Los paneles `library` y `componentsPanel`, los callbacks de subida y la función
`onSceneChange` siguen siendo puntos de integración del host. No hay imports
del paquete a Studio, Next.js o servicios de Polimake.

## Reglas de código

- Solo `src/core/excal.ts` importa Excalidraw.
- Las escrituras de elementos del editor pasan por `src/core/mutate.ts`.
- `parsers`, `converters`, `indexers`, `/components` y `/fonts` no cargan UI,
  React, CSS ni Excalidraw en ejecución.
- `core` no importa `ui`.
- Los parsers no descargan imágenes enlazadas ni ejecutan macros o PostScript.
- La escena usa referencias persistentes a imágenes; los bytes se entregan
  aparte. Un asset no resuelto queda marcado como pendiente.

`__tests__/decoupling.test.ts` comprueba las fronteras en las fuentes.
`pnpm verify:build` comprueba las entradas compiladas y sus dependencias.

## Dependencias

`ag-psd` lee Photoshop. `fflate` abre el ZIP de PowerPoint y `fast-xml-parser`
interpreta su XML. No se cargan desde `/ui`. El runtime de PDF.js no se incluye:
se inyecta para que Node, navegador y Electron puedan configurarlo correctamente.
React y React DOM son peers. Excalidraw y jsPDF son dependencias del editor.

El paquete declara sus herramientas de desarrollo para poder instalarse de
forma independiente. Studio mantiene su propio lockfile y overrides; al usarlo
como submódulo dentro del workspace, esas versiones prevalecen.

## Estilos y esquinas de página

`@pm/canvas/styles.css` contiene los estilos propios. El build mantiene la
importación del CSS de Excalidraw, de modo que se utiliza la misma versión que
su JavaScript. La entrada `/ui` y la raíz conservan la directiva de cliente.

Studio aplica externamente el parche de `FRAME_STYLE.radius` de Excalidraw para
recortar las páginas con esquinas rectas. Ese parche no viaja con este paquete.
Otro consumidor debe aplicar su configuración equivalente si necesita esa
apariencia. La paleta de `src/ui/shared/theme.ts` es propia; no importa el sistema de
diseño de Studio.

## Distribución

`dist/` contiene JavaScript ESM, declaraciones, mapas y CSS y se versiona para
consumidores por submódulo. `pnpm build` regenera todas las entradas públicas.
El paquete conserva `private: true`; esta reorganización no publica un paquete,
no cambia su licencia y no despliega ninguna aplicación.
