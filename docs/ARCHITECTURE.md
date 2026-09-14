# Arquitectura

La separación sigue las responsabilidades. Un parser entiende un formato de
archivo; un conversor entiende cómo representarlo en el lienzo; un indexador
extrae información para buscar; la UI permite editar.

```text
src/
├── documents/     Modelos de datos compartidos, límites y errores
├── parsers/       Bytes → estructura de documento
│   ├── psd.ts     PSD/PSB con ag-psd, sin canvas y con canales sin decodificar
│   ├── pptx.ts    ZIP, relaciones OOXML, diapositivas, objetos y notas
│   ├── xml.ts     Utilidades XML internas
│   ├── illustrator.ts  Selección de la representación PDF de AI
│   └── pdfjs.ts   Adaptador de extracción; runtime y renderizador inyectados
├── converters/    Estructura → escena + assets pendientes + informe
│   ├── psd.ts     Photoshop → elementos del lienzo
│   ├── legacy.ts  Modelo del editor anterior → elementos del lienzo
│   └── document.ts  Modelo común PPTX/PDF/AI → elementos del lienzo
├── indexers/      Documento, PSD o escena → índice serializable y búsqueda
├── core/          Operaciones sobre escenas, fuentes, exportación y motor
│   ├── excal.ts   Único adaptador que importa Excalidraw
│   ├── mutate.ts  Escrituras al editor y disciplina de deshacer
│   └── scene.ts   Tipos compartidos del editor
├── ui/            Componentes React, hooks, etiquetas, tema y CSS
├── components.ts  Entrada pública estable del motor de componentes
├── fonts.ts       Entrada pública estable de fuentes
└── index.ts       Entrada histórica del editor
```

## Dependencias permitidas

`parsers` usa `documents` y bibliotecas de lectura. `indexers` usa los modelos,
sin necesitar el parser, el archivo original ni un conversor. `converters`
produce objetos planos; puede usar utilidades puras de `core` y tipos de escena,
pero no invoca el motor. `ui` se apoya en `core`.

`core` **no significa que todos sus módulos sean puros**: `pages`, `mutate`,
`export` y otros necesitan el motor en el navegador. `fonts`, `components`,
`layout` y `brand` sí son utilidades de datos. No se ofrece una entrada pública
genérica de `core` para evitar mezclar estos dos usos.

`core` no depende de componentes de UI, ni siquiera para declarar `Canvas2Scene`.
El test de fronteras recorre subdirectorios y sigue las importaciones de las
entradas sin interfaz. La verificación de distribución vuelve a comprobar el
grafo de JavaScript generado y carga esas entradas en Node sin `window`.

## Del archivo a la edición

1. El host obtiene los bytes y decide límites, permisos y dónde ejecutar la lectura.
2. El parser lee la estructura. Las imágenes quedan separadas de la escena.
3. El indexador puede producir un índice sin hacer ninguna conversión visual.
4. El host decodifica o convierte los assets que lo necesiten y los sube.
5. El conversor recibe las URL y produce una escena más un informe de pérdidas.
6. El host muestra el informe y monta el editor con esa escena.

Las funciones de lectura y conversión no guardan diseños, no suben archivos y
no llaman a Studio. Las URL, credenciales, persistencia, colas y búsqueda en
base de datos pertenecen al consumidor.

## Compatibilidad

Se mantienen los nombres `Canvas2`, `Canvas2Editor` y las entradas raíz,
`/components` y `/fonts`. Los importadores nuevos deben usar `/parsers`,
`/converters` e `/indexers`; el código del editor puede usar `/ui`.

Los caminos internos anteriores (`src/psd.ts`, `src/Canvas2.tsx`, etc.) se han
movido. No son la API pública. Si un consumidor compilaba desde fuentes, debe
apuntar a una entrada estable y no a un módulo interno.
