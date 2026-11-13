# Excalidraw, desde el fuente

El lienzo no usa el `@excalidraw/excalidraw` de npm: lo compila desde aquí.
Así podemos parchearlo y traer sus cambios cuando queramos, sin esperar a que
publiquen (npm se quedó en la 0.18.1 de abril; su rama principal va cientos de
commits por delante).

| Carpeta | Qué es | En git |
|---|---|---|
| `excalidraw/` | Su monorepo entero, como `git subtree` del fork | sí |
| `excalidraw-dist/` | El paquete compilado que consumen desktop y Studio | sí, como nuestro `dist/` |
| `excalidraw/node_modules` | Sus dependencias de compilación (yarn 1) | no |

## El fork

`github.com/polimake/excalidraw`, público, MIT como el original.

- `master` sigue al original tal cual. No se toca.
- `polimake` es la que usamos: el original más nuestros parches, **un commit
  por parche**, con su porqué en el mensaje.

## Compilar

```sh
node scripts/excalidraw.mjs        # compila y deja excalidraw-dist/
pnpm install                        # el lienzo coge la copia nueva
```

La primera vez instala sus dependencias con yarn 1 (tarda: trae también las de
su app web). Después, `pnpm build` del lienzo como siempre, y en desktop o
Studio su install para que se enteren.

Solo va la build de producción y los tipos. La condición `development` apunta
también a producción: la de desarrollo eran 28 MB más, y para depurar está el
fuente.

## Parchear

1. Editar en `excalidraw/packages/…`.
2. Subir `SUFIJO` en `scripts/excalidraw.mjs` (`polimake.0` → `polimake.1`).
3. `node scripts/excalidraw.mjs`, probar, commit en el lienzo.
4. Llevarlo al fork:
   `git subtree push --prefix=vendor/excalidraw https://github.com/polimake/excalidraw.git polimake`

Lo que no sea solo nuestro se les manda también como PR al original: cuanto
menos nos separemos, menos cuesta ponerse al día.

## Traer lo suyo

1. En el fork, `master` al día con el original y mezclado en `polimake`.
   Antes, leer sus commits nuevos y quedarse con lo que interesa.
2. `git subtree pull --prefix=vendor/excalidraw https://github.com/polimake/excalidraw.git polimake --squash`
3. Compilar, `pnpm typecheck` y pruebas. Lo que rompa su API se arregla en
   `src/core/excal.ts`, que sigue siendo el único fichero que lo importa.

## Parches

Ninguno todavía: la primera versión es la 0.18.1 tal cual, para comprobar que
compilarla nosotros no cambia nada.

Candidatos, de más a menos código que nos ahorran:

- Sacar su historial por la API (hoy `src/core/gestures.ts` sustituye deshacer y rehacer).
- Poder borrar entradas del mapa de ficheros (`src/core/media.ts`).
- Medidas reales de nuestras fuentes y nuestras familias en su selector (`src/core/fonts.ts`).
- Radio 0 en el marco: Studio ya lo parchea sobre el dist de npm.
- Vídeo como elemento propio (`src/core/video.ts`).
