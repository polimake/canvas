// Guard: `src/excal.ts` is the ONLY module allowed to touch @excalidraw/*.
// If this fails, someone bypassed the adapter — route the import through
// excal.ts instead, so Excalidraw upgrades stay a one-file change.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('Excalidraw decoupling', () => {
  it('only src/excal.ts imports from @excalidraw/*', () => {
    const offenders: string[] = [];
    for (const file of fs.readdirSync(SRC)) {
      if (!/\.(ts|tsx)$/.test(file) || file === 'excal.ts') continue;
      const content = fs.readFileSync(path.join(SRC, file), 'utf8');
      if (/from\s+['"]@excalidraw\//.test(content) || /import\s+['"]@excalidraw\//.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every module that needs Excalidraw goes through ./excal.js', () => {
    // Sanity: the adapter itself does import the real package.
    const adapter = fs.readFileSync(path.join(SRC, 'excal.ts'), 'utf8');
    expect(adapter).toMatch(/@excalidraw\/excalidraw/);
  });

  it('element writes go through mutate.ts (no `as SceneElements` casts elsewhere)', () => {
    // A raw cast almost always means a spread-patch bypassed patchElement —
    // which skips the version bump and makes the change invisible to undo.
    const offenders: string[] = [];
    for (const file of fs.readdirSync(SRC)) {
      if (!/\.(ts|tsx)$/.test(file) || file === 'mutate.ts') continue;
      const content = fs.readFileSync(path.join(SRC, file), 'utf8');
      if (content.includes('as SceneElements')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('scene mutations never call updateScene directly outside mutate.ts (appState-only excepted)', () => {
    // `updateScene({ elements: ... })` outside the funnel bypasses capture-mode
    // discipline. Appstate-only updates (selection) are allowed.
    const offenders: string[] = [];
    for (const file of fs.readdirSync(SRC)) {
      if (!/\.(ts|tsx)$/.test(file) || file === 'mutate.ts') continue;
      const content = fs.readFileSync(path.join(SRC, file), 'utf8');
      const calls = content.match(/updateScene\(\{[\s\S]*?\}\)/g) ?? [];
      for (const call of calls) {
        if (/\belements\s*:/.test(call)) offenders.push(`${file}: ${call.slice(0, 60)}…`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
