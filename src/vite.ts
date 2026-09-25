/** Keep Excalidraw's UI on the host's Funnel Sans without bundling Assistant. */
export function canvasUiFonts() {
	return {
		name: 'canvas-ui-fonts',
		enforce: 'pre' as const,
		transform(code: string, id: string) {
			const path = id.replace(/\\/g, '/').split('?')[0];
			if (!path?.includes('/@excalidraw/excalidraw/') || !path.endsWith('.css')) {
				return null;
			}
			const css = code.replace(/@font-face\s*\{[^}]*\}/gi, (face) =>
				/font-family\s*:\s*["']?Assistant["']?\s*[;}]/i.test(face) ? '' : face,
			);
			return { code: css.replace(/\bAssistant\b/g, 'Funnel Sans'), map: null };
		},
	};
}
