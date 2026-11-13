#!/usr/bin/env node
/**
 * Compila Excalidraw desde su fuente (`vendor/excalidraw`) y deja el paquete
 * listo para consumir en `vendor/excalidraw-dist`.
 *
 *   node scripts/excalidraw.mjs            compila y empaqueta
 *   node scripts/excalidraw.mjs --instalar instala antes sus dependencias (yarn 1)
 *
 * `vendor/excalidraw` es un `git subtree` de github.com/polimake/excalidraw
 * (rama `polimake`): el fuente se edita ahí mismo y los parches viajan al fork
 * con `git subtree push`. Ver vendor/EXCALIDRAW.md.
 *
 * `vendor/excalidraw-dist` va en git, por lo mismo que nuestro `dist/`: quien
 * coge el lienzo como submódulo (desktop, Studio) lo usa, no lo compila.
 * Solo lleva la build de producción y los tipos: la de desarrollo pesaba 28 MB
 * más y el fuente ya está aquí para depurar. Por eso la condición
 * `development` de sus `exports` apunta también a `dist/prod`.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fuente = join(raiz, 'vendor', 'excalidraw');
const paquete = join(fuente, 'packages', 'excalidraw');
const salida = join(raiz, 'vendor', 'excalidraw-dist');
const enWindows = process.platform === 'win32';

/** Sufijo de versión: 0.18.1 → 0.18.1-polimake.N. Se sube a mano al cambiar el fuente. */
const SUFIJO = 'polimake.0';

function correr(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(' ')}  (${cwd.slice(raiz.length + 1) || '.'})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: enWindows });
}

if (process.argv.includes('--instalar') || !existsSync(join(fuente, 'node_modules'))) {
  // Su monorepo es yarn 1. `--ignore-engines`: pide node ≤22 y aquí hay 24;
  // `--ignore-scripts`: su `prepare` instala husky, que no queremos.
  // La caché de yarn va junto al fuente y se borra al acabar: por defecto
  // vive en C:\…\AppData y son ~3 GB (el 13/11 llenó el disco C: entero).
  const cache = join(raiz, 'vendor', '.yarn-cache');
  process.env.YARN_CACHE_FOLDER = cache;
  try {
    correr('npx', ['--yes', 'yarn@1.22.22', 'install', '--frozen-lockfile',
      '--ignore-scripts', '--ignore-engines', '--network-timeout', '600000'], fuente);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
}

// Lo mismo que su `build:esm`, sin `rm -rf` (no existe en Windows).
rmSync(join(paquete, 'dist'), { recursive: true, force: true });
correr('node', ['../../scripts/buildPackage.js'], paquete);
// `--newLine lf`: en Windows tsc escribe CRLF y los tipos dejarían de ser
// idénticos a los de npm (con LF, lo son byte a byte).
correr('node', [join(fuente, 'node_modules', 'typescript', 'bin', 'tsc'), '--newLine', 'lf'], paquete);

const original = JSON.parse(readFileSync(join(paquete, 'package.json'), 'utf8'));
const revision = execFileSync('git', ['log', '-1', '--format=%H', '--', 'vendor/excalidraw'], { cwd: raiz })
  .toString().trim();

rmSync(salida, { recursive: true, force: true });
mkdirSync(join(salida, 'dist'), { recursive: true });
cpSync(join(paquete, 'dist', 'prod'), join(salida, 'dist', 'prod'), { recursive: true });
cpSync(join(paquete, 'dist', 'types'), join(salida, 'dist', 'types'), { recursive: true });
cpSync(join(fuente, 'LICENSE'), join(salida, 'LICENSE'));

const pkg = {
  name: original.name,
  version: `${original.version}-${SUFIJO}`,
  description: `${original.description} — compilado por Polimake desde vendor/excalidraw`,
  license: original.license,
  repository: 'https://github.com/polimake/excalidraw',
  type: original.type,
  types: original.types,
  main: original.main,
  module: original.module,
  exports: {
    './*': { types: './dist/types/excalidraw/*.d.ts' },
    './index.css': {
      development: './dist/prod/index.css',
      production: './dist/prod/index.css',
      default: './dist/prod/index.css',
    },
    '.': {
      types: './dist/types/excalidraw/index.d.ts',
      development: './dist/prod/index.js',
      production: './dist/prod/index.js',
      default: './dist/prod/index.js',
    },
  },
  dependencies: original.dependencies,
  peerDependencies: original.peerDependencies,
};
writeFileSync(join(salida, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
writeFileSync(join(salida, 'ORIGEN.json'), JSON.stringify({
  fuente: 'vendor/excalidraw',
  fork: 'https://github.com/polimake/excalidraw',
  upstream: 'https://github.com/excalidraw/excalidraw',
  version: pkg.version,
  commitDelLienzo: revision,
}, null, 2) + '\n');

console.log(`\nListo: vendor/excalidraw-dist (${pkg.version}).`);
console.log('Después: `pnpm install` aquí, y en desktop/Studio su install, para que cojan la copia nueva.');
