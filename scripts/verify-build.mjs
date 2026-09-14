import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const [name, entry] of Object.entries(manifest.exports)) {
  for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) {
    assert.ok(fs.existsSync(path.join(root, target)), `${name} missing ${target}`);
  }
}

// Check the emitted import graph, not just the source barrels.
const seen = new Set();
function inspect(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!/^['"]use client['"]/m.test(text), `Client directive in ${file}`);
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    const spec = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
    if (spec && ts.isStringLiteral(spec)) {
      const name = spec.text;
      assert.ok(!/^(react|react-dom|@excalidraw)(\/|$)/.test(name) && !name.endsWith('.css'), `Browser dependency ${name} in ${file}`);
      if (name.startsWith('.')) inspect(path.resolve(path.dirname(file), name));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
for (const name of ['parsers', 'converters', 'indexers', 'components', 'fonts']) {
  inspect(path.join(root, `dist/${name}.js`));
  await import(`@pm/canvas/${name}`);
}
assert.equal(typeof globalThis.window, 'undefined');

const { parsePptx, parsePsd } = await import('@pm/canvas/parsers');
const { psdToScene } = await import('@pm/canvas/converters');
const { indexPsd } = await import('@pm/canvas/indexers');
assert.equal(typeof parsePptx, 'function');
const bytes = new Uint8Array(43);
bytes.set([56, 66, 80, 83]);
const view = new DataView(bytes.buffer);
view.setUint16(4, 1); view.setUint16(12, 3); view.setUint32(14, 1); view.setUint32(18, 1); view.setUint16(22, 8); view.setUint16(24, 3);
const psd = parsePsd(bytes);
assert.equal(psd.width, 1);
assert.ok(psdToScene(psd).elements.length > 0);
assert.equal(indexPsd(psd).version, 1);

for (const entry of ['index.js', 'ui.js']) assert.match(fs.readFileSync(path.join(root, 'dist', entry), 'utf8'), /^['"]use client['"]/);
const output = fs.readdirSync(path.join(root, 'dist/chunks')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(root, 'dist/chunks', f), 'utf8')).join('\n');
assert.ok(output.includes('@excalidraw/excalidraw/index.css'), 'Excalidraw CSS import must survive the library build.');
assert.ok(fs.statSync(path.join(root, 'dist/canvas2.css')).size > 0);
console.log('Build verified: exports and types exist, headless entries run in Node, editor CSS and client boundaries are retained.');
