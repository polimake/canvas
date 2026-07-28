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
});
