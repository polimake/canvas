# Excalidraw, desde el fuente

El lienzo no usa el `@excalidraw/excalidraw` de npm (que se quedó en la 0.18.1
de abril): usa **su rama principal con nuestros parches encima**, compilada por
nosotros y publicada como Release público de este repo. Así lo que antes se
rodeaba desde fuera se arregla en su código, y vamos siempre con lo último.

| Carpeta | Qué es | En git |
|---|---|---|
| `excalidraw/` | Su monorepo (`git subtree` de `excalidraw/excalidraw@master`) con nuestros parches | sí |
| `excalidraw-dist/` | Los paquetes compilados en local o en CI | no |
| `excalidraw/node_modules` | Sus dependencias de compilación (yarn 1) | no |

## Cómo llega a desktop y Studio

Desde que upstream separó el código en paquetes, `@excalidraw/excalidraw` pide
`@excalidraw/common`, `element`, `math` y `fractional-indexing` por fuera, y
los de npm son de otra época. `scripts/excalidraw.mjs` compila con su
`build:packages` y empaqueta los cinco con `npm pack` sobre su propio
`package.json` (sus `exports` y `files` tal cual, con la licencia MIT): solo
cambian la versión y las dependencias internas, que apuntan a la URL del mismo
Release. Versión: `<su versión>-g<commit base>.polimake.<revisión>`.

El lienzo depende solo de `@excalidraw/excalidraw` por su URL; él trae el resto:

```json
"@excalidraw/excalidraw": "https://github.com/polimake/canvas/releases/download/excalidraw-v<versión>/excalidraw-excalidraw-<versión>.tgz"
```

## Al día, solo

`.github/workflows/excalidraw-al-dia.yml` (en `main`, porque las programadas
solo corren desde la rama por defecto) cada día a las 4:17 UTC:

1. Mira si `excalidraw/excalidraw@master` tiene commits nuevos.
2. Los trae con `git subtree pull --squash`. Si chocan con un parche nuestro,
   **abre un issue** con los ficheros y se para.
3. Compila y publica el Release como prerelease.
4. Apunta el lienzo a la versión nueva y pasa typecheck, lint, pruebas, build
   (rehace `dist/`) y `verify:build`.
5. Si todo pasa, lo sube a `lienzo/unido` y marca el Release como estable. Si
   falla, **abre un issue** y no toca la rama.

Desktop y Studio fijan el lienzo por commit: lo cogen al subir su puntero.

A mano: «Run workflow» con `forzar` recompila aunque no haya commits nuevos
(sube la revisión).

## Parchear

1. Editar en `excalidraw/packages/…`. Un commit por parche, solo con ficheros
   de `vendor/excalidraw` («Excalidraw: …», con el porqué). Lo que cambia en el
   lienzo por ese parche, en otro commit («Lienzo: …»).
2. Subir `REVISION` en `scripts/excalidraw.mjs`.
3. Publicar: `git tag excalidraw-v<versión> && git push origin excalidraw-v<versión>`
   (`node scripts/excalidraw.mjs --version` dice cuál). Lo compila
   `.github/workflows/excalidraw.yml`.
4. Cambiar la URL de la dependencia, `pnpm install`, commit. El CI del lienzo
   pasa typecheck y pruebas con ella.

Lo que no sea solo nuestro se les manda también como PR al original: cuanto
menos nos separemos, menos choques al traer lo suyo.

## Parches (sobre master `82d5847e`)

| Parche | Dónde | Qué deja de hacer el lienzo |
|---|---|---|
| Marco con esquinas rectas (`FRAME_STYLE.radius` 8 → 0) y Mayúsculas+flecha a 10 px | `common/src/constants.ts` | El `pnpm patch` de Studio y la acción Mayúsculas+flecha propia. |
| `historyIgnoresSelection`: seleccionar no es un paso de deshacer; deshacer no se queda a medio paso con un texto vacío | `excalidraw/history.ts` | `core/gestures.ts` y `ui/editor/canvaGestures.tsx` (~540 líneas). |
| `ui.disabled.helpButton`, `.hints`, `.defaultSidebarTrigger`; «Generate» y Mermaid siguen a `aiEnabled`; «Marco» y «Buscar en el lienzo» en es-ES | `types.ts`, `Toolbar`, `Footer`, `LayerUI`, `MobileMenu`, `es-ES.json` | ~55 líneas de CSS con `!important` y los rótulos pintados con `::after`. |
| `renderToolbarExtra`: un hueco al final de la barra de herramientas | `Toolbar.tsx` | `ToolbarSlot.tsx` (portal con MutationObserver). |

Ya resuelto en upstream: el Ctrl+D que dejaba a la copia el índice del original
(fuera `core/duplicate.ts`), y el aviso de escena cargada (`onInitialize`).

Pendientes, para hacer con pruebas en la app:

- Arranque de páginas con `onInitialize` (upstream) en lugar del sondeo. Ojo:
  si falla, se crea una página en blanco que el autoguardado persiste.
- Modo oscuro sin invertir el diseño (hoy `sceneTheme` + ~85 líneas de CSS).
- Fuentes de marca: registro público con métricas reales.
- `pickElement` (qué coge un clic) y Escape que cancela un arrastre.

Descartados: `deleteFiles` (deshacer puede volver al id viejo y la foto
desaparecería) y lo que es producto, no limitación: páginas y orden,
conversores, `pick.ts`, el menú, el vídeo como imagen.
