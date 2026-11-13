# Excalidraw, desde el fuente

El lienzo no usa el `@excalidraw/excalidraw` de npm: lo compilamos desde aquí,
con nuestros parches. Así arreglamos en su código lo que antes se rodeaba desde
fuera, y traemos sus cambios cuando queramos sin esperar a que publiquen (npm
se quedó en la 0.18.1 de abril; su rama principal va cientos de commits por
delante).

| Carpeta | Qué es | En git |
|---|---|---|
| `excalidraw/` | Su monorepo, como `git subtree` de la etiqueta base, con nuestros parches | sí |
| `excalidraw-dist/` | El paquete compilado en local, para probar | no |
| `excalidraw/node_modules` | Sus dependencias de compilación (yarn 1) | no |

## Cómo llega a desktop y Studio

Cada versión se publica como **Release público** de este repo, con el `.tgz`
descargable, y el lienzo depende de esa descarga:

```json
"@excalidraw/excalidraw": "https://github.com/polimake/canvas/releases/download/excalidraw-v0.18.1-polimake.2/excalidraw-excalidraw-0.18.1-polimake.2.tgz"
```

bun y pnpm lo instalan sin token y apuntan su hash en el lockfile. Lo publica
`.github/workflows/excalidraw.yml` al subir la etiqueta `excalidraw-v<versión>`:
compila en GitHub, empaqueta con `npm pack` (lleva la licencia MIT del
original) y crea el Release con el `.tgz` y su `SHA256SUMS`.

## Parchear

1. Editar en `excalidraw/packages/…`. Un commit por parche, solo con ficheros
   de `vendor/excalidraw`, y con el porqué en el mensaje («Excalidraw: …»). Lo
   que cambia en el lienzo por ese parche, en un commit aparte («Lienzo: …»).
2. Subir `SUFIJO` en `scripts/excalidraw.mjs` (`polimake.2` → `polimake.3`).
3. `node scripts/excalidraw.mjs` (la primera vez con `--instalar`), y para
   probarlo en el lienzo sin publicar, apuntar la dependencia a
   `file:./vendor/excalidraw-dist` y `pnpm install`. Pruebas y typecheck.
4. Publicar: `git tag excalidraw-v0.18.1-polimake.3 && git push origin excalidraw-v0.18.1-polimake.3`.
5. Cambiar la URL de la dependencia a la del Release nuevo, install, commit.

Lo que no sea solo nuestro se les manda también como PR al original: cuanto
menos nos separemos, menos cuesta ponerse al día.

## Traer lo suyo

1. Leer sus commits nuevos desde la etiqueta base y quedarse con lo que interesa.
2. `git subtree pull --prefix=vendor/excalidraw https://github.com/excalidraw/excalidraw.git <etiqueta o commit> --squash`
   y resolver contra nuestros parches (los de upstream que ya traigamos como
   backport desaparecen).
3. Subir `BASE` en `scripts/excalidraw.mjs`, compilar, typecheck y pruebas. Lo
   que rompa su API se arregla en `src/core/excal.ts`, que sigue siendo el único
   fichero que lo importa.

## Parches

La base es la 0.18.1 tal cual (`polimake.0`), que sale idéntica byte a byte a
la de npm.

| Versión | Parche | Qué deja de hacer el lienzo |
|---|---|---|
| `polimake.1` | Marco con esquinas rectas (`FRAME_STYLE.radius` 8 → 0): un marco es una página. | El `pnpm patch` de Studio sobre el dist. |
| `polimake.2` | Ctrl+D da índice propio a las copias (backport de upstream, `syncMovedIndices`). | `core/duplicate.ts` y `onDuplicate`. |
| `polimake.2` | `UIOptions.helpButton`, `.hints`, `.defaultSidebarTrigger`; «Generate» y Mermaid siguen a `aiEnabled`; «Marco» y «Buscar en el lienzo» en es-ES. | ~55 líneas de CSS con `!important` y los rótulos pintados con `::after`. |
| `polimake.2` | `historyIgnoresSelection`: seleccionar no es un paso de deshacer, y deshacer no se queda a medio paso con un texto vacío. Mayúsculas+flecha mueve 10 px. | `core/gestures.ts` y `ui/editor/canvaGestures.tsx` (~540 líneas). |
| `polimake.2` | `renderToolbarExtra`: un hueco al final de la barra de herramientas. | `ToolbarSlot.tsx` (portal con MutationObserver). |

Pendientes, para hacer con pruebas en la app (tocan cosas delicadas):

- Modo oscuro sin invertir el diseño (hoy `sceneTheme` + ~85 líneas de CSS que
  copian sus variables).
- Aviso de escena cargada (`onInitialize`) en lugar del sondeo del arranque de
  páginas. Ojo: si falla, se crea una página en blanco que el autoguardado
  persiste.
- Fuentes de marca: `registerCustomFont` público, con métricas reales
  (`svgFonts.ts`, el silenciador de `export.ts`, los casts de `FONT_FAMILY`).
- `pickElement` para elegir qué coge un clic (`canvaPick.ts`).
- Escape cancela un arrastre o un escalado (`canvaDrag.ts`).

Descartados:

- `deleteFiles` en el API: el elemento se repunta al id nuevo sin pasar por la
  historia, así que deshacer puede volver al id viejo; si su entrada se borra,
  la foto desaparece.
- Lo que es producto y no limitación: páginas y orden (`pages.ts`,
  `paginate.ts`, `zorder.ts`), conversores, `pick.ts`, el menú (`CanvasMenu`
  usa la API pública), el vídeo como imagen.
