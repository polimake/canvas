# Documentación de `@studio/canvas2`

Esta carpeta define **qué es este paquete y qué contrato ofrece a quien lo
monta**. Es la referencia para integrarlo desde fuera del monorepo de studio
(hoy: Polimake Desktop, un cliente local).

## La regla que ordena todo lo demás

> **canvas2 define todos los componentes del editor. El consumidor decide dónde
> integrarlos.**

El paquete trae el editor entero y con buen aspecto —lienzo, páginas, capas,
marca, exportación, tipografías, componentes reutilizables— y no impone dónde
va. No sabe de rutas, ni de proyectos, ni de autenticación, ni de tu API. Lo
único que pide es que le rellenes unas pocas **ranuras** con lo que sí es tuyo:
de dónde salen tus imágenes, de dónde salen tus componentes guardados, cómo se
suben unos bytes.

Un consumidor puede montar `<Canvas2Editor>` entero y tener un editor
funcionando, o coger `LayersPanel`, `PageNavigator` y `CanvasMenu` sueltos y
componer su propio cromo. Las dos cosas están soportadas y ambas se exportan.

## Los documentos

| Fichero | Para qué |
| --- | --- |
| [COMPONENTS.md](./COMPONENTS.md) | **Qué trae el paquete.** Inventario de todo lo exportado: componentes de UI, sus props, y los módulos de lógica. Empieza aquí para saber qué hay. |
| [INTEGRATION.md](./INTEGRATION.md) | **Cómo montarlo.** Un ejemplo de integración completo y las ranuras que tiene que rellenar el host, con lo que pasa si no las rellenas. |
| [BOUNDARY.md](./BOUNDARY.md) | **Dónde está la frontera.** Qué es del paquete y qué es del host, por qué el corte está donde está, y qué reglas internas hay que respetar al tocarlo. |

Además, en la raíz del paquete y **fuera** de esta carpeta:

- `PARITY.md` — reglas estructurales del paquete y huecos conocidos (lo que
  todavía no está construido).
- `DEEP-DIVE.md` — auditoría de julio de 2026. **Instantánea caducada**, lo dice
  en su propia cabecera; comprueba contra el código antes de actuar sobre nada
  de ahí.

## Estado

**Código cerrado.** El paquete vive en su propio repositorio y studio lo consume
como submódulo de git dentro del workspace de pnpm. Que este repo esté separado
no lo hace público: mientras siga cerrado, la separación sirve para tener una
frontera limpia y poder consumirlo desde más de un producto.

Si algún día se abre, lo que hace falta está anotado en
[BOUNDARY.md](./BOUNDARY.md#si-alguna-vez-se-publica).
