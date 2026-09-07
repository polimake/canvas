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
 * Las tres entradas son las que ya existían en `exports`; se mantienen para no
 * romper a nadie: `@pm/canvas`, `/components` y `/fonts`. `components` es el
 * motor puro y lo importa también un worker, así que tiene que seguir siendo
 * una entrada de verdad y no un trozo del barrel: si se cuela por `index`, el
 * worker se traga Excalidraw entero.
 */
export default defineConfig({
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, 'src/index.ts'),
				components: resolve(__dirname, 'src/components.ts'),
				fonts: resolve(__dirname, 'src/fonts.ts'),
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
				/^@excalidraw\/excalidraw$/,
				/^@excalidraw\/excalidraw\/types/,
				'jspdf',
			],
			output: {
				// Nombre fijo para la hoja de estilos. Por defecto Rollup le
				// pone un hash, y entonces el consumidor no puede escribir el
				// import: cambiaría en cada publicación.
				assetFileNames: 'canvas2.css',
				chunkFileNames: 'chunks/[name]-[hash].js',
			},
		},
	},
});
