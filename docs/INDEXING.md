# Indexación y búsqueda

Un índice es una descripción serializable del contenido. No contiene imágenes,
miniaturas ni credenciales; tampoco crea embeddings ni una base de datos.

```ts
import { indexDocument, indexPsd, indexScene, searchDocument } from '@pm/canvas/indexers';

const deckIndex = indexDocument(parsedPptx);
const photoshopIndex = indexPsd(parsedPsd);
const canvasIndex = indexScene(savedScene);
const pages = searchDocument(deckIndex, 'campaña otoño');
```

## Contrato `DocumentIndex`

| Campo | Contenido |
| --- | --- |
| `version` | Versión del esquema, actualmente `1` |
| `pages` | ID, nombre, texto y número de elementos de cada página |
| `text` | Texto conjunto, con los nombres de página |
| `fonts` | Familias únicas; en una escena pueden ser IDs numéricos serializados |
| `assetIds` | Referencias únicas, nunca los bytes |
| `tokens` | Palabras normalizadas, sin distinción de mayúsculas o tildes |

`indexDocument` incluye notas de PowerPoint y texto extraído de PDF. Si una
página se representa como imagen, su texto original sigue disponible para
búsqueda mediante `extractedText`. En PPTX, también conserva el texto de objetos
que no pudieron colocarse por depender de geometría heredada del patrón.

`indexPsd` recorre capas y mesas de trabajo; omite los subárboles ocultos salvo
que se pase `{ includeHidden: true }`. Los IDs de assets son direcciones de
capas (por ejemplo, `0.2`), compatibles con la idea de `address` del conversor.
No decodifica canales raster.

`indexScene` ignora elementos borrados. El texto fuera de un marco válido se
agrupa en `__unframed__`, para no desaparecer del buscador. Sus contadores son
de elementos presentes, incluidos los rectángulos de fondo de página.

`searchDocument` busca por páginas: todos los términos deben aparecer en el
nombre o texto. Ignora tildes y mayúsculas, devuelve las páginas en orden y no
asigna puntuaciones de relevancia. Es una búsqueda local sencilla, no búsqueda
semántica. Una consulta vacía devuelve una lista vacía.

El consumidor debe persistir el índice con el identificador y versión de su
documento, regenerarlo cuando cambie el contenido y aplicar los permisos de
lectura antes de ofrecer resultados.
