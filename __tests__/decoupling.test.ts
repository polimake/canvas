import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
}
const files = walk(SRC);
const relative = (file: string) => path.relative(SRC, file).replaceAll('\\', '/');

describe('package boundaries', () => {
  it('only core/excal.ts imports Excalidraw', () => {
    expect(files.filter(file => relative(file) !== 'core/excal.ts' &&
      /(?:from\s+|import\s+)['"]@excalidraw\//.test(fs.readFileSync(file, 'utf8'))).map(relative)).toEqual([]);
    expect(fs.readFileSync(path.join(SRC, 'core/excal.ts'), 'utf8')).toContain('@excalidraw/excalidraw');
  });

  it('scene element writes go through core/mutate.ts', () => {
    const offenders: string[] = [];
    for (const file of files.filter(f => relative(f) !== 'core/mutate.ts')) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes('as SceneElements')) offenders.push(relative(file));
      for (const call of text.match(/updateScene\(\{[\s\S]*?\}\)/g) ?? []) {
        if (/\belements\s*:/.test(call)) offenders.push(relative(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('headless entries cannot reach UI, CSS, React or Excalidraw at runtime', () => {
    const seen = new Set<string>(), offenders: string[] = [];
    function inspect(file: string) {
      if (seen.has(file)) return;
      seen.add(file);
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      source.forEachChild(node => {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return;
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;
        if (ts.isImportDeclaration(node)) {
          if (node.importClause?.isTypeOnly) return;
          const bindings = node.importClause?.namedBindings;
          if (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length && bindings.elements.every(e => e.isTypeOnly)) return;
        } else if (node.isTypeOnly) return;
        const spec = node.moduleSpecifier.text;
        if (/^(react|react-dom|@excalidraw)(\/|$)/.test(spec) || /\.css$/.test(spec)) offenders.push(`${relative(file)} -> ${spec}`);
        if (spec.startsWith('.')) {
          const base = path.resolve(path.dirname(file), spec.replace(/\.js$/, ''));
          const target = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(f => fs.existsSync(f));
          if (!target) { offenders.push(`Unresolved ${relative(file)} -> ${spec}`); return; }
          if (relative(target).startsWith('ui/') || relative(target) === 'core/excal.ts') offenders.push(`${relative(file)} -> ${relative(target)}`);
          inspect(target);
        }
      });
    }
    for (const entry of ['parsers/index.ts', 'converters/index.ts', 'indexers/index.ts', 'components.ts', 'fonts.ts']) inspect(path.join(SRC, entry));
    expect(offenders).toEqual([]);
  });

  it('core never imports UI, including types', () => {
    expect(files.filter(f => relative(f).startsWith('core/') && /from\s+['"][^'"]*\/ui\//.test(fs.readFileSync(f, 'utf8'))).map(relative)).toEqual([]);
  });
});
