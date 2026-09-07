# La frontera: qué es del paquete y qué es del host

## La regla

**canvas2 define todos los componentes del editor. El consumidor decide dónde
integrarlos.**

El paquete trae el editor entero y presentable. No sabe de rutas, proyectos,
autenticación, ni de ninguna API. Todo lo que necesita del exterior entra por
**props**, nunca por import.

## Qué es del paquete

Todo el cromo del editor, y funciona sin que el host aporte nada:

- El **dock derecho** entero (`RightDock`) con sus pestañas Diseño / Capas /
  Componentes, incluida la lógica de cuáles se muestran y el responsive.
- **Capas** (`LayersPanel`), completo y autónomo: solo necesita la escena, que ya
  está en memoria.
- **Diseño** (`DesignPanel` + `BrandGallery`): marca, tamaño y fondo de página.
- La **tira de páginas** (`PageNavigator`), el **menú** (`CanvasMenu`), las
  **acciones de página**, el **selector de fotograma de vídeo**.
- El **motor de componentes** (`components.ts`), puro.
- Páginas, mutación, serialización, exportación, tipografías, tema.

## Qué es del host

Solo lo que depende de un backend concreto. Son ranuras declaradas como
`ReactNode` o como callbacks:

| Ranura | Por qué es del host |
| --- | --- |
| `library` | La mediateca depende de proyectos, carpetas y autenticación. |
| `componentsPanel` | La rejilla consulta la biblioteca del proyecto en tu API. |
| `onFilesDrop` / `onMediaDrop` | Subir bytes es cosa tuya; canvas2 solo dice dónde cayó. |
| `onSaveComponent` | La subida y la miniatura son tuyas. |
| `resolveVideoSrc` / `onPickVideoFrame` | Proxy autenticado y subida del póster. |
| `hydrateFiles` | Traer bytes remotos exige saber de tu CDN y tus credenciales. |
| `labels` | El paquete no impone idioma ni librería de i18n. |
| Persistencia | `onSceneChange` da la instantánea; guardarla es del host. |

## Por qué el corte está ahí

El criterio es uno solo: **si necesita saber de un backend, no entra**.

De ahí salen tres consecuencias que conviene no deshacer:

1. **Ni un import hacia fuera.** El paquete no importa `@studio/*`, ni
   `@polimake/*`, ni `next/*`. Ni URLs, ni `process.env`. Es lo que le permite
   moverse a otro producto sin tocar nada.

2. **Sin Tailwind y sin `@polimake/ui`.** Todo el cromo se estila con estilos
   inline desde `theme.ts`, que espeja **a mano** los tokens de marca. El
   consumidor obtiene un editor presentable sin instalar el sistema de diseño
   entero. El precio: el acento es una copia, no una importación, y se
   desincroniza en silencio si cambian los tokens.

3. **Dos subpaths puros.** `/components` y `/fonts` no tocan `window` ni importan
   Excalidraw, así que valen en Node. Por eso el MCP worker y el servidor pueden
   instanciar componentes y calcular ids de fuente sin cargar el editor.

## Reglas internas (con test que las obliga)

`__tests__/decoupling.test.ts` falla si alguna se rompe. No son convenciones:

1. **`src/excal.ts` es el ÚNICO módulo que importa `@excalidraw/*`.** Así, subir
   de versión Excalidraw es un cambio de un fichero.
2. **Toda escritura de elementos pasa por `mutate.ts`.** `patchElement` sube el
   `versionNonce`; sin eso, el cambio es invisible para deshacer. Un cast a
   `SceneElements` fuera de ahí casi siempre significa que alguien se saltó el
   embudo.
3. **Nada llama a `updateScene({ elements })` fuera de `mutate.ts`.** Salta la
   disciplina de modo de captura. Los updates de solo `appState` (selección) sí
   valen.

## Dependencia externa con truco: el parche de Excalidraw

`FRAME_STYLE.radius` se cambia de `8` a `0` mediante un parche de pnpm
(`patchedDependencies`). Los marcos son nuestras páginas, y su contenido se
recorta con ese radio: sin el parche, **todo lo que hay dentro de la página** sale
con las esquinas redondeadas, incluida la foto a sangre. No hay API pública para
esto (`frameRendering` no expone el radio) y apagar el recorte no vale, porque
los fondos a sangre se derramarían sobre el hueco entre páginas.

⚠️ **Hoy el parche vive en el `package.json` raíz de studio, fuera de este
paquete.** Un consumidor que instale canvas2 por su cuenta **no lo hereda**, y le
saldrán las esquinas redondeadas sin ningún aviso: no es un fallo ruidoso, es que
se ve mal.

Mientras el consumo sea por submódulo dentro del workspace de studio, el parche
se aplica y no hay problema. En el momento en que alguien lo instale desde un
registro, hay que resolverlo — ver abajo.

## Si alguna vez se publica

Hoy esto es **código cerrado**: repositorio propio, consumido por studio como
submódulo de git dentro del workspace de pnpm. Que esté separado no lo hace
público; la separación sirve para tener una frontera limpia y poder consumirlo
desde más de un producto.

Si se decide publicarlo, esto es lo que falta. No hace falta ahora:

1. **Portar el parche de Excalidraw.** Es el bloqueante real. La vía limpia es
   mutar `FRAME_STYLE.radius` en tiempo de ejecución desde `excal.ts`, si el
   objeto resulta alcanzable; si no, publicar el parche dentro del paquete y
   documentarlo. Lo definitivo sería que Excalidraw expusiera el radio.

2. **Un build de verdad.** Hoy `main` apunta a `./src/index.ts` y no hay `dist`:
   studio lo consume como fuente TypeScript. Un consumidor externo necesita JS
   compilado y `.d.ts`, con los tres subpaths y el CSS en `exports`, y
   conservando `sideEffects`.

3. **CI que ejercite el `dist`.** Es el hueco que abre consumir por submódulo:
   studio usa las fuentes y un consumidor externo usaría el compilado. Todo lo
   que solo se rompe al compilar —un tipo que no se exporta, un `exports` mal
   puesto, el CSS que no viaja— pasaría en verde aquí y llegaría roto allí. El
   CI tiene que compilar y montar el editor **desde `dist`**, más `publint` y
   `arethetypesworking`.

4. **Nombre y licencia.** `@studio/canvas2` no sirve fuera: el scope es interno y
   el `2` es un resto de la migración desde el editor anterior. Y hoy no hay
   fichero de licencia. Excalidraw es MIT.
