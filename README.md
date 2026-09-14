# Polimake Canvas · `@pm/canvas`

Herramientas para **leer documentos, convertirlos, indexarlos y editarlos**.
El editor React utiliza Excalidraw; la lectura de archivos y la búsqueda funcionan
en Node o en un worker sin montar React ni cargar el motor de dibujo.

```text
Archivo → parser → documento → conversor → escena → editor
                       └────→ indexador → texto, páginas, fuentes y referencias
```

## Elegir una entrada

| Importación | Para qué sirve | Entorno |
| --- | --- | --- |
| `@pm/canvas/parsers` | Leer PSD/PSB, PPTX y AI compatible con PDF | Node / worker / navegador; AI requiere adaptador PDF |
| `@pm/canvas/converters` | Convertir PSD, legacy o el modelo de documento a escena | Sin DOM ni React en ejecución |
| `@pm/canvas/indexers` | Crear índices y buscar sin abrir el editor | Sin DOM ni React |
| `@pm/canvas/ui` | Editor, paneles y navegación | Navegador, React |
| `@pm/canvas/components` | Instanciar componentes reutilizables | Sin DOM ni React |
| `@pm/canvas/fonts` | Nombres, identificadores y metadatos de fuentes | Sin DOM ni React |
| `@pm/canvas` | API histórica completa del editor | Navegador; se conserva por compatibilidad |

No importes la raíz desde un servidor para leer un archivo: utiliza la entrada
específica. La raíz sigue cargando el editor.

## Leer e indexar un PowerPoint

```ts
import { parsePptx } from '@pm/canvas/parsers';
import { indexDocument, searchDocument } from '@pm/canvas/indexers';
import { documentToScene } from '@pm/canvas/converters';

const document = parsePptx(bytes); // Uint8Array o ArrayBuffer de un .pptx
const index = indexDocument(document);
const matches = searchDocument(index, 'campaña verano');
const scene = documentToScene(document, { idPrefix: 'presentacion-42' });
// scene.pendingAssetIds indica qué imágenes necesitan una URL persistente.
// document.assets conserva sus bytes; scene.warnings explica las aproximaciones.
```

La subida de imágenes es responsabilidad del consumidor. Tras subirlas, pasa su
mapa de URL a `documentToScene(document, { assets, idPrefix })`. Los bytes no se
incrustan en el JSON del lienzo.

## Soporte de formatos

| Formato | Soporte actual |
| --- | --- |
| `.psd`, `.psb` | Lectura binaria de estructura y canales comprimidos; conversión de capas, textos, formas y mesas de trabajo. Rasteres como referencias pendientes de decodificar/subir. |
| `.pptx` | Lectura de diapositivas en su orden, texto directo, formas básicas, imágenes y notas. Conversión editable parcial con informe. |
| `.ppt` | Requiere conversión externa a `.pptx`; no es un ZIP OOXML. |
| `.ai` compatible con PDF | Adaptador PDF: extracción de texto para búsqueda o páginas como imágenes mediante un renderizador del consumidor. |
| `.ai` antiguo/PostScript | Requiere conversión externa; no se interpreta ni ejecuta PostScript. |
| Escena Excalidraw / formato legacy | Persistencia e indexación de escenas; conversor del editor anterior. |

Importar no garantiza conservar toda la edición del programa original. Consulta
la [matriz de fidelidad y ejemplos](docs/IMPORTING.md) antes de integrar un formato.
Este paquete no añade por sí solo un botón de importación a Studio.

## Montar el editor

```tsx
import { Canvas2Editor } from '@pm/canvas/ui';
import '@pm/canvas/styles.css';

export function Editor({ scene, onSave }) {
  return <div style={{ height: 720, position: 'relative' }}>
    <Canvas2Editor initialScene={scene} onSceneChange={onSave} pages layers />
  </div>;
}
```

El componente se monta en el navegador. En Next.js, usa una frontera cliente y
`dynamic(..., { ssr: false })`; [integración completa](docs/INTEGRATION.md).
El CSS de Excalidraw se importa desde el adaptador; `styles.css` añade los estilos
propios de Canvas. Al consumir fuentes directamente, ambos se cargan desde ellas.

## Trabajar en el paquete

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm verify:build
```

Dentro de Studio, usa `pnpm --filter @pm/canvas <comando>`. La distribución vive
en `dist/`, incluye JavaScript, declaraciones y CSS, y está versionada porque
otros consumidores usan el repositorio como submódulo. Regenera `dist/` después
de cambiar fuentes o entradas públicas.

El paquete conserva `private: true`; no se publica en npm. El parche de esquinas
de Excalidraw sigue siendo una configuración del consumidor Studio, no una
característica portable del paquete. [Fronteras y dependencias](docs/BOUNDARY.md).

## Documentación

- [Arquitectura y árbol del repositorio](docs/ARCHITECTURE.md).
- [Importación, formatos y límites](docs/IMPORTING.md).
- [Indexación y búsqueda](docs/INDEXING.md).
- [Editor y contrato de integración](docs/INTEGRATION.md).
- [Referencia de componentes](docs/COMPONENTS.md).
- [Extender un formato y verificar cambios](docs/DEVELOPMENT.md).

Las auditorías históricas están en `docs/archive/`. Las migraciones específicas
de Studio están en `scripts/legacy-migrations/`; no son lectores de archivos ni
comandos generales del paquete.
