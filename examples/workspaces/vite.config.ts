import { defineConfig } from 'vite';
import { canvasUiFonts } from '../../src/vite';

export default defineConfig({ plugins: [canvasUiFonts()] });
