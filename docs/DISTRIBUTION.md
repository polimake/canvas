# Distribuir Canvas a varios consumidores

El repositorio publica un paquete instalable en GitHub Releases. Mantiene el
nombre `@pm/canvas`, todas sus entradas y sus peer dependencies. No necesita
credenciales de npm ni que los consumidores compilen Canvas.

## Workflow

`.github/workflows/distribute.yml` se ejecuta en:

| Evento | Resultado |
| --- | --- |
| Push a `main` | Build, validación y prerelease con un `.tgz` versionado |
| Push de tag `vMAJOR.MINOR.PATCH` | Release estable; exige que el tag coincida con `package.json` |
| Pull request | Validación y artifact descargable, sin publicar release |
| Ejecución manual | Validación; publica prerelease si se ejecuta desde `main` |

Los pasos de validación instalan con lockfile congelado, comprueban tipos y
lint, ejecutan tests, compilan y verifican `dist/`. Después instalan el tarball
en proyectos temporales independientes con React 18 y 19. Allí comprueban las
entradas públicas, cargan las APIs sin interfaz en Node y compilan una entrada
de navegador con el editor y su CSS.

La publicación usa únicamente el `GITHUB_TOKEN` del job de release con
`contents: write`. El job de compilación y las PR tienen solo lectura.
Las acciones están fijadas a commits. No hay que añadir secretos externos.

## Versiones y contenido

Los pushes generan `0.0.0-build.NUMERO.INTENTO` (con la versión base actual),
con tag `build-NUMERO-INTENTO-SHA`. Cada ejecución produce su propia URL.
Una release estable usa exactamente la versión del tag. El workflow no reemplaza
assets ni fuerza tags existentes; repetir una publicación estable ya existente
falla. Para cambiar una estable, publica otra versión.

Cada release adjunta:

- `pm-canvas-VERSION.tgz`: JavaScript, tipos, CSS, fuentes para depuración y documentación.
- `SHA256SUMS`: checksum SHA-256 del tarball.
- `release.json`: versión, commit original, URL y checksum.

El manifest del tarball omite scripts, dependencias de desarrollo y ajustes de
pnpm. El paquete se instala ya compilado. `private: true` evita publicarlo por
accidente a npm; permite instalar el tarball. Se mantiene `dist/` en Git para
los consumidores que todavía usan el submódulo, pero CI siempre lo regenera.

## Instalar en los tres consumidores

Abre [Releases](https://github.com/polimake/canvas/releases), elige una versión
y copia su comando de instalación. Usa **la misma URL** en los tres proyectos:

```sh
pnpm add "https://github.com/polimake/canvas/releases/download/TAG/pm-canvas-VERSION.tgz"
# Alternativa:
npm install "https://github.com/polimake/canvas/releases/download/TAG/pm-canvas-VERSION.tgz"
```

Sustituye `TAG` y `VERSION` por los valores de la release. Guarda tanto
`package.json` como el lockfile de cada consumidor. Evita URLs `latest`: cada
aplicación debe poder reproducir y revertir exactamente la versión instalada.
El repositorio es público, así que descargar estos assets no requiere token.

Si el consumidor tiene un submódulo/workspace llamado `@pm/canvas`, deja de
incluir ese paquete local en su workspace o ajusta la resolución antes de
cambiar a la URL. Comprueba el lockfile: debe resolver el `.tgz`, no `link:` ni
`workspace:`. Cambiar el mecanismo de instalación de cada aplicación es una
migración separada; este workflow no modifica automáticamente los consumidores.

El host aporta React y React DOM (18 o 19). Para el editor:

```tsx
import { Canvas2Editor } from '@pm/canvas/ui';
import '@pm/canvas/styles.css';
```

En servidores usa `/parsers`, `/converters` o `/indexers`. La raíz y `/ui`
cargan el motor del navegador. El parche visual de Excalidraw de Studio no se
incluye automáticamente en dependencias externas; consulta [fronteras](BOUNDARY.md).

## Comprobar una distribución local

Desde un checkout independiente:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm verify:build
pnpm release:package
pnpm verify:package
```

Los resultados quedan en `artifacts/` (ignorado por Git). Los scripts no cambian
la versión del manifest fuente. La prueba de instalación usa directorios
temporales fuera del workspace y los elimina al terminar.

El empaquetado usa [pnpm pack](https://pnpm.io/cli/pack). npm admite instalar
[tarballs por URL](https://docs.npmjs.com/cli/commands/npm-install/).
