import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/release.json'), 'utf8'));
const tarball = path.join(root, 'artifacts', artifact.file);
assert.equal(createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'), artifact.sha256);
assert.ok(process.env.npm_execpath, 'Run through pnpm verify:package');

// Outside any workspace: catches missing files/dependencies hidden by Studio hoisting.
for (const react of ['18', '19']) {
  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), `canvas-react-${react}-`));
  try {
    fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    execFileSync(process.execPath, [process.env.npm_execpath, 'add', '--ignore-workspace', '--ignore-scripts',
      tarball, `react@${react}`, `react-dom@${react}`], { cwd: consumer, stdio: 'inherit' });
    const installed = path.join(consumer, 'node_modules/@pm/canvas');
    const pkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    assert.equal(pkg.version, artifact.version);
    assert.equal(pkg.scripts, undefined);
    assert.equal(pkg.devDependencies, undefined);
    for (const entry of Object.values(pkg.exports)) {
      for (const file of typeof entry === 'string' ? [entry] : Object.values(entry)) {
        assert.ok(fs.existsSync(path.join(installed, file)), `Missing packaged export: ${file}`);
      }
    }
    const smoke = path.join(consumer, 'headless.mjs');
    fs.writeFileSync(smoke, `import assert from 'node:assert/strict';
      import { parsePsd, parsePptx } from '@pm/canvas/parsers';
      import { documentToScene } from '@pm/canvas/converters';
      import { indexDocument } from '@pm/canvas/indexers';
      import * as fonts from '@pm/canvas/fonts';
      import * as components from '@pm/canvas/components';
      assert.equal(typeof window, 'undefined');
      for (const fn of [parsePsd, parsePptx, documentToScene, indexDocument]) assert.equal(typeof fn, 'function');
      assert.ok(Object.keys(fonts).length && Object.keys(components).length);
    `);
    execFileSync(process.execPath, [smoke], { cwd: consumer, stdio: 'inherit' });
    fs.writeFileSync(path.join(consumer, 'index.js'), `export { Canvas2Editor } from '@pm/canvas/ui';
      import '@pm/canvas/styles.css';`);
    await build({ root: consumer, configFile: false, logLevel: 'error',
      build: { minify: false, lib: { entry: path.join(consumer, 'index.js'), formats: ['es'], fileName: 'consumer' } } });
    assert.ok(fs.readdirSync(path.join(consumer, 'dist')).some(file => file.endsWith('.css')));
    console.log(`Installed package verified: React ${react}, public exports, headless imports and browser bundle.`);
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
}
