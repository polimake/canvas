import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { canvasUiFonts } from '../src/vite';

describe('Canvas UI font packaging', () => {
	it('removes Assistant assets from the installed Excalidraw CSS', () => {
		const path = createRequire(import.meta.url).resolve('@excalidraw/excalidraw/index.css');
		const css = readFileSync(path, 'utf8');
		expect(css).toContain('Assistant');
		const result = canvasUiFonts().transform(css, path);
		expect(result?.code).not.toContain('Assistant');
		expect(result?.code).toContain('Funnel Sans');
	});

	it('preserves design fonts and ignores host styles', () => {
		const css = '@font-face { font-family: "Assistant"; src: url(Assistant.woff2); }\n'
			+ '@font-face { font-family: "Saved Design Font"; src: url(custom.woff2); }';
		const result = canvasUiFonts().transform(css, 'C:\\app\\node_modules\\@excalidraw\\excalidraw\\dist\\dev\\index.css?direct');
		expect(result?.code).not.toContain('Assistant.woff2');
		expect(result?.code).toContain('url(custom.woff2)');
		expect(canvasUiFonts().transform(css, '/app/styles.css')).toBeNull();
	});
});
