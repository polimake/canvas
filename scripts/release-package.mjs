import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sha = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.match(sha, /^[a-f0-9]{40}$/);
const repo = process.env.GITHUB_REPOSITORY || 'polimake/canvas';
assert.match(repo, /^[\w.-]+\/[\w.-]+$/);
const ref = process.env.GITHUB_REF || '';
const stable = /^refs\/tags\/v(\d+\.\d+\.\d+)$/.exec(ref);
if (ref.startsWith('refs/tags/')) assert.ok(stable, 'Release tags must use vMAJOR.MINOR.PATCH');
if (stable) assert.equal(stable[1], manifest.version, 'Tag must match package.json version');
const run = process.env.GITHUB_RUN_NUMBER || String(Date.now());
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
assert.match(run, /^\d+$/);
assert.match(attempt, /^\d+$/);
const version = stable ? stable[1] : `${manifest.version.split('-')[0]}-build.${run}.${attempt}`;
const tag = stable ? `v${version}` : `build-${run}-${attempt}-${sha.slice(0, 12)}`;
const file = `pm-canvas-${version}.tgz`;
const out = path.join(root, 'artifacts');
fs.mkdirSync(out, { recursive: true });
assert.ok(!fs.existsSync(path.join(out, file)), `Refusing to overwrite ${file}`);

// Stage a consumer package. No lifecycle scripts or build dependencies are installed.
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-package-'));
try {
  const { scripts: _scripts, devDependencies: _dev, pnpm: _pnpm, packageManager: _pm, ...consumer } = manifest;
  void _scripts; void _dev; void _pnpm; void _pm;
  fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify({ ...consumer, version, gitHead: sha }, null, 2) + '\n');
  for (const entry of manifest.files) fs.cpSync(path.join(root, entry), path.join(staging, entry), { recursive: true });
  assert.ok(process.env.npm_execpath, 'Run through pnpm release:package');
  execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--pack-destination', out], { cwd: staging, stdio: 'inherit' });
} finally {
  // Only the fresh temporary directory created above is removed.
  fs.rmSync(staging, { recursive: true, force: true });
}

const digest = createHash('sha256').update(fs.readFileSync(path.join(out, file))).digest('hex');
const url = `https://github.com/${repo}/releases/download/${tag}/${file}`;
fs.writeFileSync(path.join(out, 'SHA256SUMS'), `${digest}  ${file}\n`);
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({ name: manifest.name, version, tag, commit: sha, file, sha256: digest, url }, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'release.md'), `Paquete **${manifest.name}@${version}**, compilado desde \`${sha}\`.

Incluye JavaScript, declaraciones TypeScript, CSS, fuentes y documentación. No requiere compilar Canvas en los consumidores.

Instalar la misma URL en los tres consumidores y guardar sus lockfiles:

\`\`\`sh
pnpm add "${url}"
# También: npm install "${url}"
\`\`\`

React y React DOM son peer dependencies del consumidor (18 o 19).
El editor importa \`@pm/canvas/ui\` y \`@pm/canvas/styles.css\`.
Los procesos sin interfaz usan \`@pm/canvas/parsers\`, \`/converters\` o \`/indexers\`.

SHA-256: \`${digest}\`. Los cambios visuales del parche de Excalidraw de Studio siguen siendo responsabilidad del consumidor.
`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\nversion=${version}\nfile=${file}\nstable=${Boolean(stable)}\n`);
console.log(`Package ready: ${path.join(out, file)}`);
