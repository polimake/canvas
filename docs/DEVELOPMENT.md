# Desarrollo y extensión

## Comprobar un cambio

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm verify:build
```

En Studio: anteponer `pnpm --filter @pm/canvas` al nombre del script. Para
comprobar el host, ejecutar sus comprobaciones de tipos y el build de la web.
La distribución se versiona: incluir los cambios de `dist/` con los de fuente.

El repositorio independiente usa `pnpm@10.26.1` y su propio `pnpm-lock.yaml`.
Fuera de Studio, ejecuta `pnpm install --frozen-lockfile`. Dentro del monorepo,
Studio sigue usando su lockfile raíz. Si cambias dependencias, actualiza también
el lockfile de Canvas desde un checkout independiente.

El workflow de [distribución](DISTRIBUTION.md) recompila las fuentes antes de
empaquetar y prueba la instalación del `.tgz` fuera del workspace.

Las pruebas de importación construyen archivos binarios PSD/PSB y paquetes ZIP
OOXML pequeños, verifican errores y límites y comprueban la conversión e índices.
Las pruebas del adaptador PDF utilizan un runtime controlado: no certifican
todas las versiones de PDF.js ni la fidelidad visual de archivos Illustrator
reales. Cada host debe probar su runtime y sus archivos representativos.

## Añadir un formato

1. Definir qué se puede leer y qué fidelidad ofrece. Separar lectura, vista
   previa, búsqueda y edición; son capacidades diferentes.
2. Crear un parser en `src/parsers/` que devuelva un modelo de `src/documents/`.
   Si requiere un runtime del host, declarar un adaptador explícito.
3. Añadir un conversor puro en `src/converters/` o reutilizar `documentToScene`.
   Entregar referencias de assets y avisar de pérdidas o aproximaciones.
4. Reutilizar `indexDocument` o añadir un indexador de la estructura de origen.
5. Añadir la entrada al enrutador `parseFile` y a `IMPORT_FORMATS`, indicando
   si es nativa, parcial, por adaptador o exige conversión externa.
6. Probar un archivo válido, contenido no admitido, archivo corrupto, límites,
   orden de páginas, assets y ausencia de dependencias de interfaz.
7. Actualizar [IMPORTING.md](IMPORTING.md), exports y build si aparecen APIs nuevas.

No implementar un formato solo por su extensión: verificar la firma y la
estructura. Renombrar `.ppt` a `.pptx` o `.ai` a `.pdf` no convierte los bytes.

## Entradas y distribución

`package.json` declara las entradas públicas; `vite.config.ts` debe producirlas
y `tsconfig.build.json` sus declaraciones. Los parsers no se reexportan desde
la raíz de UI para evitar cargar lectores con el editor. Los conversores antiguos
se siguen reexportando por compatibilidad.

El adaptador central mantiene la importación de CSS de Excalidraw como externa
al build de la biblioteca. El consumidor debe importar además `styles.css`.
Las directivas de cliente se conservan en las entradas del editor; las entradas
de lectura, conversión e indexación siguen cargando en Node.

## Historial

`docs/archive/` conserva auditorías antiguas. `scripts/legacy-migrations/`
contiene scripts de una migración de Studio con rutas y supuestos históricos.
No forman parte de las APIs ni deben ejecutarse como un paso de instalación.
