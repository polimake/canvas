#!/usr/bin/env node
/**
 * Compila Excalidraw desde su fuente (`vendor/excalidraw`: su rama principal +
 * nuestros parches) y empaqueta sus paquetes para publicarlos como Release.
 *
 *   node scripts/excalidraw.mjs             compila y empaqueta
 *   node scripts/excalidraw.mjs --instalar  instala antes sus dependencias (yarn 1)
 *   node scripts/excalidraw.mjs --version   solo imprime la versión y la etiqueta
 *
 * Desde que separaron el código en paquetes, `@excalidraw/excalidraw` deja fuera
 * de su bundle a `@excalidraw/common`, `element`, `math` y `fractional-indexing`
 * y los pide como dependencias. Las de npm son de otra época, así que se
 * publican los cinco con nuestra versión y se apuntan entre sí por la URL del
 * mismo Release. Del resto (laser-pointer, mermaid…) vale npm.
 *
 * Salida en `vendor/excalidraw-dist/` (no va en git): un `.tgz` por paquete,
 * hecho con `npm pack` sobre su propio `package.json` (sus `exports` y `files`
 * tal cual, con la licencia MIT del original); solo cambian la versión y las
 * dependencias internas. Lo publica `.github/workflows/excalidraw.yml`.
 * Ver vendor/EXCALIDRAW.md.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fuente = join(raiz, 'vendor', 'excalidraw');
const salida = join(raiz, 'vendor', 'excalidraw-dist');
const enWindows = process.platform === 'win32';

/** Commit del original que hay en vendor/excalidraw (lo sube quien lo actualiza). */
export const BASE = '82d5847e';
/** Nuestra revisión sobre esa base. Se sube a mano al cambiar un parche. */
export const REVISION = 3;
/** Donde se publican los Releases. */
const REPO = process.env.GITHUB_REPOSITORY || 'polimake/canvas';

/** Lo que se publica, en orden de dependencias. */
const PUBLICAR = ['common', 'fractional-indexing', 'math', 'element', 'excalidraw'];

const leer = (p) => JSON.parse(readFileSync(p, 'utf8'));
const versionDe = (dir) => `${leer(join(fuente, 'packages', dir, 'package.json')).version}-g${BASE}.polimake.${REVISION}`;

export const version = versionDe('excalidraw');
export const etiqueta = `excalidraw-v${version}`;

if (process.argv.includes('--version')) {
  console.log(`${version} ${etiqueta}`);
  process.exit(0);
}

function correr(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(' ')}  (${cwd.slice(raiz.length + 1) || '.'})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: enWindows });
}

const yarn = (args) => correr('npx', ['--yes', 'yarn@1.22.22', ...args], fuente);

if (process.argv.includes('--instalar') || !existsSync(join(fuente, 'node_modules'))) {
  // La caché de yarn va junto al fuente y se borra al acabar: por defecto vive
  // en C:\…\AppData y son ~3 GB (el 13/11 llenó el disco C: entero).
  const cache = join(raiz, 'vendor', '.yarn-cache');
  process.env.YARN_CACHE_FOLDER = cache;
  try {
    // `--ignore-scripts`: su `prepare` instala husky, que no queremos.
    yarn(['install', '--frozen-lockfile', '--ignore-scripts', '--network-timeout', '600000']);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
}

// Sus paquetes en orden, con su propio guion (common → … → excalidraw).
yarn(['build:packages']);

rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

const ficheroDe = (nombre, ver) => `${nombre.replace(/^@/, '').replace('/', '-')}-${ver}.tgz`;
const nuestros = new Map(
  PUBLICAR.map((dir) => {
    const { name } = leer(join(fuente, 'packages', dir, 'package.json'));
    const ver = versionDe(dir);
    return [name, { dir, ver, url: `https://github.com/${REPO}/releases/download/${etiqueta}/${ficheroDe(name, ver)}` }];
  }),
);

const apuntar = (deps) =>
  deps && Object.fromEntries(Object.entries(deps).map(([k, v]) => [k, nuestros.get(k)?.url ?? v]));

for (const [name, { dir, ver }] of nuestros) {
  const origen = join(fuente, 'packages', dir);
  const destino = join(salida, dir);
  mkdirSync(destino, { recursive: true });
  cpSync(join(origen, 'dist'), join(destino, 'dist'), { recursive: true });
  for (const f of ['README.md', 'CHANGELOG.md']) {
    if (existsSync(join(origen, f))) cpSync(join(origen, f), join(destino, f));
  }
  cpSync(join(fuente, 'LICENSE'), join(destino, 'LICENSE'));
  const pkg = leer(join(origen, 'package.json'));
  delete pkg.devDependencies;
  delete pkg.scripts;
  pkg.version = ver;
  pkg.dependencies = apuntar(pkg.dependencies);
  pkg.peerDependencies = apuntar(pkg.peerDependencies);
  pkg.description = `${pkg.description ?? name} — compilado por Polimake desde excalidraw/excalidraw@${BASE} con sus parches`;
  pkg.repository = `https://github.com/${REPO}`;
  writeFileSync(join(destino, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  correr('npm', ['pack', destino, '--pack-destination', salida], raiz);
}

writeFileSync(
  join(salida, 'paquetes.json'),
  JSON.stringify({ version, etiqueta, base: BASE, paquetes: Object.fromEntries([...nuestros].map(([k, v]) => [k, v.url])) }, null, 2) + '\n',
);
console.log(`\nListo: ${etiqueta}`);
for (const [name, { url }] of nuestros) console.log(`  ${name}: ${url}`);
