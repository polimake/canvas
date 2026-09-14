import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * La build de librería: lo que se publica cuando canvas2 deja de ser un paquete
 * del monorepo y pasa a importarse desde fuera.
 *
 * Dentro del workspace el consumidor compilaba nuestro `src/` a pelo (el
 * `main` apuntaba a `src/index.ts`). Eso solo funciona cuando el paquete vive
 * en el mismo árbol que quien lo usa: desde `node_modules`, un bundler no
 * transforma TSX ajeno por defecto. Así que se publica compilado.
 *
 * Se mantienen la raíz, /components y /fonts, y se añaden entradas separadas
 * de UI, parsers, conversores e indexadores. Las entradas sin interfaz tienen
 * que seguir siendo independientes: un worker no debe cargar Excalidraw.
 */
export default defineConfig({
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, 'src/index.ts'),
				components: resolve(__dirname, 'src/components.ts'),
				fonts: resolve(__dirname, 'src/fonts.ts'),
				ui: resolve(__dirname, 'src/ui/index.ts'),
				parsers: resolve(__dirname, 'src/parsers/index.ts'),
				converters: resolve(__dirname, 'src/converters/index.ts'),
				indexers: resolve(__dirname, 'src/indexers/index.ts'),
			},
			formats: ['es'],
		},
		// Sin minificar a propósito: esto lo vuelve a procesar el bundler del
		// consumidor, que ya minifica. Minificar dos veces solo sirve para que
		// un fallo en producción salga con nombres de una letra.
		minify: false,
		sourcemap: true,
		rollupOptions: {
			/**
			 * Lo que NO viaja dentro.
			 *
			 * React y Excalidraw son `peerDependencies`: si viajaran, en la
			 * página habría dos copias y los hooks reventarían («Invalid hook
			 * call») o el editor perdería su contexto. `jspdf` se queda fuera
			 * porque ya se carga bajo demanda desde `export.ts` y meterlo aquí
			 * lo devolvería al arranque.
			 *
			 * La hoja de estilos de Excalidraw va con ellos, y esto no es
			 * un detalle: empaquetarla aquí dentro significaría publicar 145 KB
			 * de CSS de un tercero que se queda congelado en la versión con la
			 * que se compiló, mientras el JS que lo acompaña lo pone el
			 * consumidor. Dejándola fuera, el `import` sobrevive en el JS
			 * publicado y lo resuelve el bundler de quien nos usa, contra la
			 * misma copia de Excalidraw que ya tiene.
			 *
			 * Ojo con quitarla de aquí: si se deja que Vite la resuelva, la
			 * hoja NO acaba en `dist/canvas2.css` ni en el JS. Desaparece, sin
			 * warning, y el lienzo sale sin estilos. Se vio.
			 */
			external: [
				'react',
				'react-dom',
				'react/jsx-runtime',
				'react-dom/client',
				/^@excalidraw\/excalidraw(?:\/.*)?$/,
				'jspdf',
				'ag-psd',
				'fflate',
				'fast-xml-parser',
			],
			output: {
				banner: (chunk) => /src\/(?:index|ui\/index)\.ts$/.test(chunk.facadeModuleId?.replace(/\\/g, '/') ?? '') ? "'use client';" : '',
				// Nombre fijo para la hoja de estilos. Por defecto Rollup le
				// pone un hash, y entonces el consumidor no puede escribir el
				// import: cambiaría en cada publicación.
				assetFileNames: 'canvas2.css',
				chunkFileNames: 'chunks/[name]-[hash].js',
			},
		},
	},
});
