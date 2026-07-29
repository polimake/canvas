import { defineConfig } from 'vitest/config';

/**
 * El entorno por defecto es `node` a propósito: casi todos los tests son de
 * módulos puros (conversión legacy, páginas, marca, fuentes del SVG) y montar un
 * DOM para todos los haría lentos sin ganar nada.
 *
 * Los que necesitan DOM lo piden por fichero con el pragma
 * `// @vitest-environment jsdom`, así el coste lo paga solo quien lo usa.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // `.tsx` además de `.ts`: los tests de hooks y componentes son JSX.
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
  },
});
