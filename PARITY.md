# Capacidades pendientes del editor

La paridad con el editor anterior dejó de ser el criterio al retirarse aquel
motor. Este archivo conserva los huecos de la interfaz; para importar documentos,
consulta [IMPORTING.md](docs/IMPORTING.md).

| Capacidad | Estado |
| --- | --- |
| Gradientes de página y formas | No son nativos en el motor actual. |
| Efectos de texto: sombra, neón y contorno | No implementados. |
| Capas de vídeo con reproducción en el lienzo | Se conserva el póster y la referencia al vídeo. |
| Catálogo adicional de formas y marcos | Puede añadirse como biblioteca Excalidraw. |
| Selector manual de familia tipográfica | La fuente llega del brand kit o del diseño. |

Las páginas permanecen pegadas (PAGE_GAP = 0) y usan un rectángulo de papel como
fondo. El parche externo de recorte a esquina recta se explica en
[BOUNDARY.md](docs/BOUNDARY.md). Las reglas de dependencia y mutación viven en
[ARCHITECTURE.md](docs/ARCHITECTURE.md) y sus pruebas; no se duplican aquí.
