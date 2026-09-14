# Importación de documentos

La API separa **leer**, **indexar** y **convertir**. Leer un archivo no modifica
ningún diseño. Convertirlo genera una escena nueva y un informe que el consumidor
debe revisar antes de guardarla o enseñarla como resultado final.

## Elegir el parser

```ts
import { parseFile } from '@pm/canvas/parsers';
import { psdToScene, documentToScene } from '@pm/canvas/converters';
import { indexPsd, indexDocument } from '@pm/canvas/indexers';

const parsed = await parseFile(bytes, { fileName: 'campaña.pptx' });
if (parsed.format === 'psd' || parsed.format === 'psb') {
  const index = indexPsd(parsed.document);
  const scene = psdToScene(parsed.document);
  // scene.assets contiene las capas raster pendientes; scene.report, las pérdidas.
} else {
  const index = indexDocument(parsed.document);
  const scene = documentToScene(parsed.document, { idPrefix: 'campaña' });
  // Subir parsed.document.assets y volver a convertir con el mapa de URL.
}
```

También se pueden invocar directamente `parsePsd`, `parsePptx` y
`parseIllustrator`. `IMPORT_FORMATS` describe las extensiones y capacidades para
que el host construya su selector de archivos con información real.

## Photoshop: `.psd` y `.psb`

`parsePsd` utiliza `ag-psd` con `useRawData: true`. Conserva la estructura y los
canales de imagen comprimidos sin inicializar un canvas. El tipo de archivo se
verifica con la firma `8BPS` y su versión. El modelo de datos vive en
`src/documents/psd.ts`; no depende del editor.

```ts
import { parsePsd } from '@pm/canvas/parsers';
import { psdToScene } from '@pm/canvas/converters';

const psd = parsePsd(bytes);
const scene = psdToScene(psd, {
  documentName: 'Portada',
  resolveFontUrl: name => fontFiles[name] ?? null,
});
```

El conversor conserva mesas de trabajo, posiciones, grupos, texto y formas
compatibles. Las curvas se aproximan a polilíneas. Mezclas, máscaras, ajustes,
efectos y geometría compleja pueden perder fidelidad y aparecen en
`scene.report.notes`. `scene.report.clean` y `tier` describen el resultado.

Las capas raster producen huecos marcados y entradas en `scene.assets`.
Cada entrada conserva `address`, el camino de índices a la capa original:

```ts
for (const slot of scene.assets) {
  let children = psd.children ?? [];
  let layer;
  for (const i of slot.address) {
    layer = children[i];
    children = layer?.children ?? [];
  }
  // layer.rawData conserva los canales comprimidos.
  // El host configura su decodificador, produce PNG/JPEG y lo sube.
}
```

`listImagePlaceholders(scene.elements)` localiza los huecos del conversor.
No hay un exportador automático de rasteres PSD en esta API. Las miniaturas y
los bytes de archivos enlazados de objetos inteligentes se omiten en la lectura.
No se promete reproducción exacta de un PSD ni reconstrucción de objetos
inteligentes. El lector base documenta sus opciones en
[ag-psd](https://github.com/Agamnentzar/ag-psd#options).

## PowerPoint: `.pptx`

El parser abre el ZIP y sigue las relaciones de la presentación; el orden se
obtiene de `sldIdLst`, no de los nombres `slide1.xml`, `slide2.xml`, etc.
Las coordenadas se convierten de EMU a píxeles CSS a 96 ppp.

| Contenido | Resultado |
| --- | --- |
| Diapositivas y tamaño | Conservados en orden |
| Textos con geometría directa | Editables; se aproximan estilos y métricas |
| Texto de placeholders sin geometría | Indexado; no se coloca sin resolver el layout |
| Rectángulos y elipses | Formas editables; colores directos y trazo básico |
| Otras geometrías | Rectángulo aproximado con aviso |
| Grupos trasladados/escalados | Coordenadas de hijos transformadas |
| Rotación/reflejo de grupos | No conservados, con aviso |
| Imágenes embebidas | Bytes separados y referencia por `assetId` |
| Imágenes externas | No se descargan; aviso |
| Notas | Texto indexable; puede incluir placeholders de notas |
| Patrones, layouts y temas | No se resuelven; aviso por diapositiva |
| Tablas, gráficos, SmartArt, conectores y media | No convertidos; aviso |
| Animaciones/transiciones | No importadas |

Un `.ppt` binario debe convertirse externamente a `.pptx`. El parser no inicia
PowerPoint, LibreOffice ni servicios externos. La estructura OOXML está descrita
por [Microsoft](https://learn.microsoft.com/es-es/office/open-xml/presentation/structure-of-a-presentationml-document).

### Imágenes y escena

```ts
const document = parsePptx(bytes);
const uploaded = {};
for (const asset of document.assets) {
  // upload es una función del host y devuelve una URL persistente.
  uploaded[asset.id] = {
    url: await upload(asset.bytes, asset.mimeType),
    mimeType: asset.mimeType,
  };
}
const scene = documentToScene(document, {
  idPrefix: 'deck-42',
  assets: uploaded,
  fonts: projectFonts,
});
```

`documentToScene` produce páginas/marcos, fondos y elementos. Una imagen sin URL
HTTP(S) se representa con un hueco `customData.c2 = 'importAsset'` y su ID se
añade a `pendingAssetIds`. Los data URI no se aceptan como URL persistente.
Los formatos de imagen que el navegador no entienda necesitan conversión en
el host antes de subirlos. Los SVG embebidos también requieren el tratamiento
que el host aplique a cualquier SVG externo antes de mostrarlos.

Las familias sin fichero proporcionado usan la fuente de respaldo y generan
un aviso. Usa un `idPrefix` diferente si vas a combinar varias importaciones
en la misma escena. El valor por defecto es `import`.

## Illustrator: `.ai`

Los AI guardados con **Create PDF Compatible File** contienen una representación
PDF que otras herramientas pueden leer. Eso no conserva toda la edición propia
de Illustrator; [Adobe describe esta diferencia](https://www.adobe.com/creativecloud/file-types/image/vector/ai-file.html).

```ts
import { parseIllustrator, createPdfJsAdapter } from '@pm/canvas/parsers';
import * as pdfjs from 'pdfjs-dist'; // dependencia del host

// Configurar workerSrc/workerPort según el bundler y el entorno del host.
const document = await parseIllustrator(bytes, {
  pdf: createPdfJsAdapter(pdfjs),
});
```

Por defecto, el adaptador extrae texto y cajas aproximadas: sirve para indexar
y producir una escena de texto, **no para reproducir el arte completo**. Emite
`text-only` e `illustrator-pdf` para dejar explícita esa limitación.

Para preservar el aspecto de la página, el host puede proporcionar
`createPdfJsAdapter(pdfjs, { renderPage })`. La función recibe la página real de
PDF.js y su número y devuelve `{ bytes, mimeType: 'image/png' | 'image/jpeg' }`.
En ese modo cada página es una imagen y el texto queda en `extractedText` para
buscar, sin duplicarlo visualmente. El informe incluye `flattened-page`.
La configuración y renderización de PDF.js se describen en sus
[ejemplos oficiales](https://mozilla.github.io/pdf.js/getting_started/).

El host configura las fuentes, worker y superficie de renderizado apropiadas
para navegador, Node o Electron. El adaptador libera cada página y destruye la
tarea al terminar, también si falla. Un AI sin cabecera PDF devuelve
`unsupported-format`: re-guardar con compatibilidad PDF o convertir externamente
a PDF/SVG. No se interpreta PostScript ni se reconstruyen capas nativas de AI.

## Límites y errores

| Opción | Por defecto | Aplicación |
| --- | --- | --- |
| `maxFileBytes` | 64 MiB | Todos los lectores |
| `maxExpandedBytes` | 128 MiB | Expansión ZIP; presupuesto de decodificación de ag-psd |
| `maxEntries` | 4096 | Entradas ZIP de PPTX |
| `maxPages` | 500 | PPTX y adaptador PDF.js |

Los errores de `DocumentImportError` tienen códigos estables: `invalid-file`,
`unsupported-format`, `limit-exceeded` y `adapter-required`. Los fallos del runtime
PDF o del renderizador se propagan; el host puede envolverlos para su UI.

Estos límites no son un aislamiento de procesos ni un timeout. Para archivos
grandes, ejecutar los parsers síncronos en un worker o proceso con presupuesto
de memoria y tiempo. El host debe limitar también la resolución y memoria del
renderizador PDF y el decodificador de rasteres.

El lector XML rechaza DTD y declaraciones de entidades. Las relaciones de PPTX
no pueden escapar del paquete y los enlaces externos no provocan peticiones.
Ninguna importación de esta API ejecuta macros, guarda datos o sube archivos.
