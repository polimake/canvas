# canvas2

Editor de diseño multipágina sobre [Excalidraw](https://github.com/excalidraw/excalidraw).

Trae el editor entero —lienzo, páginas de tamaño fijo, capas, identidad de
marca, tipografías propias, exportación (PNG/SVG/PDF) y componentes
reutilizables— y **no impone dónde va**. No sabe de rutas, proyectos,
autenticación ni de ninguna API: lo que necesita del exterior entra por props.

> **canvas2 define todos los componentes. El consumidor decide dónde integrarlos.**

## Documentación

Empieza por **[docs/](./docs/)**:

- [docs/COMPONENTS.md](./docs/COMPONENTS.md) — qué trae el paquete: todo lo
  exportado, con sus props.
- [docs/INTEGRATION.md](./docs/INTEGRATION.md) — cómo montarlo, con un ejemplo
  completo y las ranuras que rellena el host.
- [docs/BOUNDARY.md](./docs/BOUNDARY.md) — dónde cae la frontera entre paquete y
  host, y las reglas internas que hay que respetar al tocarlo.

En la raíz, `PARITY.md` recoge las reglas estructurales y los huecos conocidos.
`DEEP-DIVE.md` es una auditoría de julio de 2026: **instantánea caducada**, lo
avisa en su cabecera.

## Estado

**Código cerrado.** Se consume como submódulo de git dentro del workspace de
pnpm de studio. No está publicado en ningún registro y todavía **no tiene build**:
hoy se consume como fuente TypeScript, y `main` apunta a `src/index.ts`.

Lo que faltaría para publicarlo está anotado en
[docs/BOUNDARY.md](./docs/BOUNDARY.md#si-alguna-vez-se-publica). Hay un
bloqueante real: el parche de `FRAME_STYLE.radius` vive en el `package.json`
raíz de studio y **no viaja con el paquete**.
