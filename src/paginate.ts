import {
  convertToExcalidrawElements,
  type ExcalidrawImperativeAPI,
  type SceneElement,
} from './excal';
import { commitElements, patchElement, type CaptureMode } from './mutate';
import { buildPageBackground } from './background';
import { packPagesInArray, renumberPagesInArray, type PageSize } from './pages';
import { PAGE_GAP } from './layout';

/**
 * Convertir una escena SIN estructura de páginas en un documento paginado.
 *
 * El modelo de páginas de canvas2 son marcos de Excalidraw (ver pages.ts), pero
 * hay dos formas habituales de acabar con una escena que NO los tiene:
 *
 *  - un diseño traído de fuera (importar un .excalidraw, pegar un carrusel
 *    entero, arrastrar seis imágenes al lienzo): todo queda suelto en el plano
 *    infinito. La tira de páginas sale vacía, exportar "la página actual" no
 *    exporta nada y el guardado registra `pages: 0`.
 *  - marcos dibujados a mano con la herramienta de Excalidraw: son páginas de
 *    verdad, pero sin papel, sin numerar y sin alinear en la fila.
 *
 * La agrupación es por SOLAPE de las cajas (cierre transitivo): cada slide de
 * un carrusel cae en su propio grupo, y el título escrito encima de una imagen
 * viaja con ella porque la solapa. Los grupos de Excalidraw y los textos
 * anclados a un contenedor se unen también por su vínculo explícito, que es más
 * fiable que la geometría cuando el texto sobresale del recuadro.
 *
 * NO inventa contenido ni recorta: si un grupo es más grande que la página, se
 * reduce proporcionalmente para que quepa entero (nunca se amplía — estirar una
 * imagen por encima de su tamaño la emborrona sin ganar nada).
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxOf(el: SceneElement): Box {
  // Excalidraw normaliza los tamaños negativos al terminar de dibujar, pero un
  // elemento importado de fuera puede traerlos: sin el abs, su caja tendría
  // ancho negativo y no solaparía con nada, así que caería en un grupo suelto.
  const width = Math.abs(el.width);
  const height = Math.abs(el.height);
  return {
    x: el.width < 0 ? el.x + el.width : el.x,
    y: el.height < 0 ? el.y + el.height : el.y,
    width,
    height,
  };
}

function unionBox(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/**
 * Elementos que NO pertenecen a ninguna página: ni son marcos ni están dentro
 * de uno. Son los candidatos a agruparse en páginas nuevas.
 */
export function looseElements(elements: readonly SceneElement[]): SceneElement[] {
  return elements.filter((e) => e.type !== 'frame' && !e.frameId);
}

/**
 * Cuánto se agranda la caja de una página candidata para decidir si un satélite
 * le pertenece: un cuarto de su tamaño por cada lado.
 */
const SATELLITE_REACH = 0.25;

/**
 * Un grupo es SATÉLITE si su área no llega a esta fracción de la del grupo más
 * grande. El salto real que separa un slide de su rótulo es de dos órdenes de
 * magnitud (205.000 px² frente a 5.400), así que el umbral no está peleado con
 * ningún caso realista.
 */
const SATELLITE_MAX_AREA = 0.15;

/**
 * Los rótulos vuelven con su slide.
 *
 * El solape no basta: en un guion de carrusel el número de slide ("01 ·
 * Portada") se escribe UNA MIGA por encima del recuadro, sin llegar a tocarlo,
 * y sin esto cada rótulo se convertía en su propia página — un carrusel de 11
 * slides salía en 22 páginas, alternando slide y rótulo.
 *
 * La regla no es la distancia a secas, que dependería de lo apretada que esté
 * la rejilla: un grupo minúsculo comparado con el mayor se considera adorno y se
 * pega a la página CANDIDATA más cercana que lo tenga a tiro (su caja agrandada
 * un cuarto contiene el centro del satélite). Si ninguna lo alcanza, el satélite
 * se queda como página propia: es mejor una página de más que tragarse un
 * elemento en la equivocada.
 */
function absorbSatellites(groups: Map<number, number[]>, boxes: readonly Box[]): void {
  if (groups.size < 2) return;

  const entries = [...groups.entries()].map(([root, indices]) => ({
    root,
    indices,
    box: unionBox(indices.map((i) => boxes[i])),
  }));
  const areas = entries.map((e) => e.box.width * e.box.height);
  const maxArea = Math.max(...areas);
  if (maxArea <= 0) return;

  const anfitriones = entries.filter((_, i) => areas[i] >= maxArea * SATELLITE_MAX_AREA);
  const satelites = entries.filter((_, i) => areas[i] < maxArea * SATELLITE_MAX_AREA);
  if (anfitriones.length === 0 || satelites.length === 0) return;

  const centro = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

  for (const satelite of satelites) {
    const c = centro(satelite.box);
    let elegido: (typeof anfitriones)[number] | null = null;
    let mejor = Infinity;
    for (const anfitrion of anfitriones) {
      const { box } = anfitrion;
      const margenX = box.width * SATELLITE_REACH;
      const margenY = box.height * SATELLITE_REACH;
      const alcanza =
        c.x >= box.x - margenX &&
        c.x <= box.x + box.width + margenX &&
        c.y >= box.y - margenY &&
        c.y <= box.y + box.height + margenY;
      if (!alcanza) continue;
      const h = centro(box);
      const d = (c.x - h.x) ** 2 + (c.y - h.y) ** 2;
      if (d < mejor) {
        mejor = d;
        elegido = anfitrion;
      }
    }
    if (!elegido) continue;
    elegido.indices.push(...satelite.indices);
    groups.delete(satelite.root);
  }
}

/**
 * PURA: reparte los elementos sueltos en grupos —un grupo, una página futura—
 * y los devuelve en orden de lectura (por filas, y dentro de cada fila de
 * izquierda a derecha).
 *
 * Se exporta para poder testear la agrupación sin montar el editor: es la única
 * parte con criterio discutible de toda la conversión.
 */
export function clusterLooseElements(loose: readonly SceneElement[]): SceneElement[][] {
  if (loose.length === 0) return [];

  const parent = loose.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    // Compresión de caminos: sin ella, una tira larga de elementos encadenados
    // degrada a O(n) por consulta.
    let cur = i;
    while (parent[cur] !== root) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const indexById = new Map(loose.map((e, i) => [e.id, i]));

  // 1. Vínculos EXPLÍCITOS. Van primero porque no dependen de la geometría: un
  //    texto anclado que sobresale de su recuadro, o un grupo de Excalidraw con
  //    dos piezas separadas, se partirían si solo mirásemos el solape.
  const byGroup = new Map<string, number[]>();
  loose.forEach((el, i) => {
    const container = (el as { containerId?: string | null }).containerId;
    if (container) {
      const j = indexById.get(container);
      if (j !== undefined) union(i, j);
    }
    for (const gid of (el as { groupIds?: readonly string[] }).groupIds ?? []) {
      const bucket = byGroup.get(gid);
      if (bucket) bucket.push(i);
      else byGroup.set(gid, [i]);
    }
  });
  for (const bucket of byGroup.values()) {
    for (let k = 1; k < bucket.length; k += 1) union(bucket[0], bucket[k]);
  }

  // 2. Solape geométrico, por pares. Cuadrático, pero sobre los elementos
  //    SUELTOS de un diseño: son decenas, no millones, y se ejecuta una vez por
  //    conversión (no en cada render).
  const boxes = loose.map(boxOf);
  for (let i = 0; i < loose.length; i += 1) {
    for (let j = i + 1; j < loose.length; j += 1) {
      if (find(i) !== find(j) && overlaps(boxes[i], boxes[j])) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  loose.forEach((_, i) => {
    const root = find(i);
    const bucket = groups.get(root);
    if (bucket) bucket.push(i);
    else groups.set(root, [i]);
  });

  absorbSatellites(groups, boxes);

  // Orden de lectura: se abren filas por solape VERTICAL. Un carrusel en línea
  // da una sola fila (izquierda → derecha, que es el orden de los slides); una
  // rejilla da tantas filas como tenga, cada una ordenada por x. Ordenar solo
  // por x mezclaría las filas de una rejilla; solo por y, los slides de una
  // fila quedarían en el orden accidental de sus coordenadas.
  const clusters = [...groups.values()].map((indices) => ({
    elements: indices.map((i) => loose[i]),
    box: unionBox(indices.map((i) => boxes[i])),
  }));
  clusters.sort((a, b) => a.box.y - b.box.y);

  const rows: { bottom: number; items: typeof clusters }[] = [];
  for (const cluster of clusters) {
    const row = rows[rows.length - 1];
    if (row && cluster.box.y < row.bottom) {
      row.items.push(cluster);
      row.bottom = Math.max(row.bottom, cluster.box.y + cluster.box.height);
    } else {
      rows.push({ bottom: cluster.box.y + cluster.box.height, items: [cluster] });
    }
  }

  return rows.flatMap((row) =>
    row.items.sort((a, b) => a.box.x - b.box.x).map((c) => c.elements),
  );
}

export interface PaginateOptions {
  /**
   * Tamaño de las páginas nuevas. Sin él se usa el del grupo más grande, que
   * para un carrusel de slides iguales es exactamente el del slide — así la
   * conversión no reencuadra nada cuando no hace falta.
   */
  pageSize?: PageSize;
  /**
   * Permitir AMPLIAR un grupo más pequeño que la página, además de reducir el
   * que no cabe.
   *
   * Por defecto no: cuando el tamaño se deduce del propio contenido, ampliar
   * solo emborronaría las imágenes sin ganar nada. Cuando el tamaño lo IMPONE
   * quien llama —el menú, que hereda el de la página activa— la intención es
   * llenar ese lienzo, y es justo lo que hace `resizePage` al cambiar el tamaño
   * de una página con "Escalar el contenido" marcado. Mismo gesto, misma
   * respuesta.
   */
  scaleUp?: boolean;
  /** Color del papel de las páginas nuevas. */
  paperColor?: string;
}

const PAPER_COLOR = '#ffffff';

export interface PaginateResult {
  elements: readonly SceneElement[];
  /** Páginas creadas a partir de elementos sueltos. */
  created: number;
  /** Total de páginas del documento después de convertir. */
  total: number;
}

/**
 * PURA: devuelve la escena ya paginada, empaquetada y renumerada. No toca el
 * editor — quien la aplica es {@link convertToPages}, en UN solo commit.
 */
export function paginateSceneInArray(
  elements: readonly SceneElement[],
  opts: PaginateOptions = {},
): PaginateResult {
  const existingFrames = elements
    .filter((e) => e.type === 'frame')
    .slice()
    .sort((a, b) => a.x - b.x);
  const loose = looseElements(elements);
  const clusters = clusterLooseElements(loose);

  if (clusters.length === 0) {
    // Sin nada suelto no hay páginas que crear, pero sí que ordenar: es el caso
    // de los marcos dibujados a mano, que existen desalineados y sin numerar.
    const order = existingFrames.map((f) => f.id);
    let next = packPagesInArray(elements, order);
    next = renumberPagesInArray(next, order);
    return { elements: next, created: 0, total: existingFrames.length };
  }

  const boxes = clusters.map((c) => unionBox(c.map(boxOf)));
  const pageSize: PageSize = opts.pageSize ?? {
    width: Math.round(Math.max(...boxes.map((b) => b.width))),
    height: Math.round(Math.max(...boxes.map((b) => b.height))),
  };

  // Las páginas nuevas arrancan a la derecha de las que ya hubiera; el
  // empaquetado final las alinea de todas formas, pero partir de una posición
  // coherente evita que el commit las haga aparecer encima de las existentes.
  const y = existingFrames[0]?.y ?? 0;
  let cursor = existingFrames.length
    ? Math.max(...existingFrames.map((f) => f.x + f.width)) + PAGE_GAP
    : 0;

  const looseIds = new Set(loose.map((e) => e.id));
  const out: SceneElement[] = elements.filter((e) => !looseIds.has(e.id));
  const newFrameIds: string[] = [];

  clusters.forEach((cluster, index) => {
    const box = boxes[index];
    const x = cursor;
    cursor += pageSize.width + PAGE_GAP;

    const skeleton = [
      {
        type: 'frame',
        name: `Página ${existingFrames.length + index + 1}`,
        x,
        y,
        width: pageSize.width,
        height: pageSize.height,
        children: [],
      },
    ] as Parameters<typeof convertToExcalidrawElements>[0];
    const [frame] = convertToExcalidrawElements(skeleton, {
      regenerateIds: true,
    }) as unknown as SceneElement[];
    newFrameIds.push(frame.id);

    // Uniforme en los dos ejes: escalar por separado deformaría las imágenes.
    const encaje = Math.min(pageSize.width / box.width, pageSize.height / box.height);
    const k = opts.scaleUp ? encaje : Math.min(1, encaje);
    // Centrado en la página, conservando la disposición relativa del grupo.
    const offsetX = x + (pageSize.width - box.width * k) / 2;
    const offsetY = y + (pageSize.height - box.height * k) / 2;

    const members = cluster.map((el) => {
      const elBox = boxOf(el);
      const updates: Record<string, unknown> = {
        frameId: frame.id,
        x: offsetX + (elBox.x - box.x) * k,
        y: offsetY + (elBox.y - box.y) * k,
      };
      if (k !== 1) {
        updates.width = Math.max(1, elBox.width * k);
        updates.height = Math.max(1, elBox.height * k);
        const fontSize = (el as { fontSize?: number }).fontSize;
        if (el.type === 'text' && typeof fontSize === 'number') {
          // El cuerpo de letra acompaña a la caja: sin esto, un slide ampliado
          // sale con el texto del tamaño original nadando en la página.
          updates.fontSize = Math.max(4, fontSize * k);
        }
      }
      return patchElement(el, updates as Partial<SceneElement>);
    });

    // El papel va DELANTE de los miembros en el array: más tarde en el array es
    // más arriba en la pila, así que ponerlo después lo dibujaría tapando el
    // contenido de la página (ver zorder.ts).
    out.push(
      frame,
      ...buildPageBackground(frame.id, { x, y, ...pageSize }, opts.paperColor ?? PAPER_COLOR),
      ...members,
    );
  });

  const order = [...existingFrames.map((f) => f.id), ...newFrameIds];
  let next: readonly SceneElement[] = packPagesInArray(out, order);
  next = renumberPagesInArray(next, order);

  return { elements: next, created: clusters.length, total: order.length };
}

/**
 * Aplica la paginación al editor en UN solo commit (una entrada de deshacer),
 * como el resto de operaciones compuestas del paquete.
 */
export function convertToPages(
  api: ExcalidrawImperativeAPI,
  opts: PaginateOptions & { capture?: CaptureMode } = {},
): { created: number; total: number } {
  const elements = api.getSceneElements();
  const result = paginateSceneInArray(elements, opts);
  if (result.elements !== elements) {
    commitElements(api, result.elements, opts.capture ?? 'undoable');
  }
  return { created: result.created, total: result.total };
}
