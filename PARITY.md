# @studio/canvas2 — reglas del paquete y huecos conocidos

Este fichero era el mapa de paridad contra el editor DOM anterior mientras los
dos convivían. Ese editor se retiró el 2026-08-06 (ver
[docs/retirada-polimake-canvas.md](../../docs/retirada-polimake-canvas.md)), así
que la comparación ya no aplica: aquí quedan la regla estructural del paquete y
la lista de lo que sigue sin construirse.

## Regla base: desacoplado de Excalidraw (con test que lo obliga)

Todo lo de este paquete es una **capa sobre `@excalidraw/excalidraw` de serie**,
y la frontera es estructural, no una convención:

- **`src/excal.ts` es el ÚNICO módulo que importa `@excalidraw/*`.** Reexporta el
  componente, los ayudantes (`exportToBlob/Canvas/Svg`,
  `convertToExcalidrawElements`, `serializeAsJSON`, `CaptureUpdateAction`), los
  tipos públicos y los alias derivados canónicos (`SceneElement`,
  `SceneElements`, `FrameElement`). Todo lo demás importa de `./excal`.
- **La regla la vigila un test**: `__tests__/decoupling.test.ts` recorre `src/` y
  falla si cualquier otro fichero menciona `@excalidraw/`. No hay forma de
  colarse.
- Solo se usa la superficie pública: props del componente, la API imperativa
  (`getSceneElements` / `updateScene` / `onChange` / `scrollToContent` /
  `addFiles`), los ayudantes públicos y la entrada de tipos pública. Sin
  internals bifurcados, sin parches, sin meter mano en el DOM de Excalidraw.
- Las páginas son **marcos** nativos y nuestros metadatos viajan en el campo
  público `customData` (por ejemplo la marca del fondo de página).
- El adaptador es también lo que hace testeable el paquete en node (el Excalidraw
  real toca `window` al importarse): los tests simulan `./excal` y ejercitan la
  lógica de la capa contra una API imperativa falsa.
- **Procedimiento de actualización**: subir la dependencia → arreglar
  `src/excal.ts` hasta que `pnpm --filter @studio/canvas2 typecheck` esté en
  verde → `pnpm --filter @studio/canvas2 test` → repetir el recorrido de humo con
  Playwright. La deriva de comportamiento de la API pública aflora en el
  adaptador o en los tests, no repartida por el paquete.

## Huecos: lo que todavía no existe

| Hueco | Nota |
| --- | --- |
| Gradientes (fondo de página / formas) | Excalidraw no los tiene; prioridad baja |
| Efectos de texto (sombra, neón, contorno…) | No son nativos; serían filtros SVG — aplazado |
| Capas de vídeo de verdad | Excalidraw no tiene elemento de vídeo. Hoy un vídeo entra como su PÓSTER, marcado con el vídeo del que salió para poder reelegir el fotograma (`video.ts`) |
| Biblioteca de formas recortadas y marcos | Cabría como **librería** de Excalidraw (`.excalidrawlib`): cero código, datos puros |
| Selector de tipografía en el panel | Las familias propias se registran bien (`src/fonts.ts`) y el diseño guarda las suyas en `editorConfig.fonts`, pero la tipografía llega del brand kit o del propio diseño: no se elige a mano |

## Decisiones visuales que conviene no deshacer sin querer

- Las páginas van **pegadas** entre sí (`PAGE_GAP = 0`).
- Las páginas son **de esquina viva**: Excalidraw dibuja el contorno de los
  marcos redondeado y no expone radio, así que el contorno nativo está apagado
  (`frameRendering.outline: false`) y cada página lleva un rectángulo "papel"
  blanco, bloqueado y de esquina recta (rugosidad 0, borde de un pelo) como
  visual. El papel se crea solo en cada página nueva, se estira exacto al
  redimensionar, se oculta de la lista de capas, y `ensurePagePapers` lo añade a
  las escenas que vienen sin él.
- Los glifos del cromo son un juego de iconos SVG en línea (`icons.tsx`), sin
  dependencia de ninguna librería de iconos.
