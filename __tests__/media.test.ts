// LA REGLA: los bytes de una imagen viven en MediaMonster, nunca dentro de
// `designs.editorConfig`. Estos tests son el candado — si alguien reintroduce
// una vía que inlinea base64, aquí se cae.
//
// El coste de romperla no es "la fila engorda": una foto de 1,5 MB pasa de 2 MB
// en base64 y D1 rechaza el valor, así que el guardado falla en seco.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const {
  buildPersistableFiles,
  findInlineImageIds,
  isInlineDataUrl,
  externalizeInlineImages,
  insertImageFromUrl,
  insertImageFromBlob,
  insertImageWithPreview,
  replaceImageFromUrl,
  resolveInsertPageId,
  cascadePoints,
  imageAtScenePoint,
  dataUrlToBlob,
} = await import('../src/core/media');

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const CDN = 'https://light-media.polimake.com/media/abc.png';

const imageEl = (id: string, fileId: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'image',
  fileId,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  frameId: 'p1',
  version: 0,
  ...extra,
});

const fileEntry = (id: string, dataURL: string) => ({
  id,
  dataURL,
  mimeType: 'image/png',
});

describe('la regla: imágenes en MediaMonster, nunca base64 en el diseño', () => {
  it('no exporta ninguna vía pública para inlinear bytes', () => {
    const index = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf8');
    // `insertImageDataURL` era exactamente esa puerta. Si reaparece exportada,
    // vuelve a existir una forma soportada de meter base64 en la escena.
    expect(index).not.toMatch(/insertImageDataURL/);
  });

  it('buildPersistableFiles delata el base64 que sobreviva', () => {
    const elements = [imageEl('img1', 'f1')];
    const files = { f1: fileEntry('f1', PNG_1PX) };
    const result = buildPersistableFiles(elements as never, files);
    expect(result.inline).toEqual(['f1']);
  });

  it('buildPersistableFiles deja pasar las referencias remotas', () => {
    const elements = [imageEl('img1', 'f1')];
    const files = { f1: fileEntry('f1', CDN) };
    const result = buildPersistableFiles(elements as never, files);
    expect(result.inline).toEqual([]);
    expect(result.files.f1.dataURL).toBe(CDN);
  });

  it('buildPersistableFiles descarta ficheros huérfanos', () => {
    // Excalidraw nunca limpia su mapa: sin este filtro, borrar una foto dejaba
    // sus bytes en la fila del diseño para siempre.
    const elements = [imageEl('img1', 'f1')];
    const files = {
      f1: fileEntry('f1', CDN),
      f2: fileEntry('f2', PNG_1PX), // ya no lo usa ningún elemento
    };
    const result = buildPersistableFiles(elements as never, files);
    expect(Object.keys(result.files)).toEqual(['f1']);
    expect(result.inline).toEqual([]);
  });

  it('buildPersistableFiles ignora los elementos borrados', () => {
    const elements = [imageEl('img1', 'f1', { isDeleted: true })];
    const files = { f1: fileEntry('f1', PNG_1PX) };
    const result = buildPersistableFiles(elements as never, files);
    expect(result.files).toEqual({});
    expect(result.inline).toEqual([]);
  });

  it('isInlineDataUrl / findInlineImageIds distinguen bytes de referencia', () => {
    expect(isInlineDataUrl(PNG_1PX)).toBe(true);
    expect(isInlineDataUrl(CDN)).toBe(false);
    expect(findInlineImageIds({ a: fileEntry('a', PNG_1PX), b: fileEntry('b', CDN) })).toEqual(['a']);
  });
});

describe('externalizeInlineImages', () => {
  it('sube el base64 a MM y repunta el elemento a un id NUEVO', async () => {
    // El id tiene que cambiar: `addFiles` ignora los ids existentes, así que
    // reutilizarlo sería un no-op silencioso y la escena seguiría en base64.
    const scene = fakeApi([frame('p1', 0, 0, 100, 100), imageEl('img1', 'f1')], {
      f1: fileEntry('f1', PNG_1PX),
    });
    const uploader = vi.fn().mockResolvedValue(CDN);

    const result = await externalizeInlineImages(scene.api, uploader);

    expect(result).toEqual({ externalized: 1, failed: [] });
    expect(uploader).toHaveBeenCalledTimes(1);

    const img = scene.get().find((e: any) => e.id === 'img1');
    expect(img.fileId).not.toBe('f1');
    expect(scene.api.getFiles()[img.fileId].dataURL).toBe(CDN);

    // Y lo que se guardaría ya no lleva bytes.
    const persistable = buildPersistableFiles(scene.get() as never, scene.api.getFiles());
    expect(persistable.inline).toEqual([]);
  });

  it('no entra en el historial (un Ctrl+Z no puede devolver el base64)', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100), imageEl('img1', 'f1')], {
      f1: fileEntry('f1', PNG_1PX),
    });
    await externalizeInlineImages(scene.api, vi.fn().mockResolvedValue(CDN));
    expect(scene.commits.at(-1)?.captureUpdate).toBe('NEVER');
  });

  it('reporta los fallos en vez de dejar pasar los bytes', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100), imageEl('img1', 'f1')], {
      f1: fileEntry('f1', PNG_1PX),
    });
    const result = await externalizeInlineImages(
      scene.api,
      vi.fn().mockRejectedValue(new Error('MM caído')),
    );
    expect(result.failed).toEqual(['f1']);
    // El host aborta el guardado con esto; la escena sigue intacta.
    const persistable = buildPersistableFiles(scene.get() as never, scene.api.getFiles());
    expect(persistable.inline).toEqual(['f1']);
  });

  it('rechaza un uploader que devuelva un data: URL', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100), imageEl('img1', 'f1')], {
      f1: fileEntry('f1', PNG_1PX),
    });
    const result = await externalizeInlineImages(
      scene.api,
      vi.fn().mockResolvedValue(PNG_1PX),
    );
    expect(result.failed).toEqual(['f1']);
  });

  it('no hace nada cuando ya está todo por referencia', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100), imageEl('img1', 'f1')], {
      f1: fileEntry('f1', CDN),
    });
    const uploader = vi.fn();
    expect(await externalizeInlineImages(scene.api, uploader)).toEqual({
      externalized: 0,
      failed: [],
    });
    expect(uploader).not.toHaveBeenCalled();
    expect(scene.commits).toHaveLength(0);
  });
});

/**
 * Colocación: dónde acaba la imagen y a qué página dice pertenecer.
 *
 * Las dos cosas TIENEN que coincidir. Excalidraw recorta cada elemento contra su
 * marco, así que unas coordenadas de la página 3 con el `frameId` de la página 1
 * no dan una imagen mal puesta: dan una imagen que no se ve, sin error y sin
 * hueco. Es el modo de fallo que hacía parecer que soltar no hacía nada.
 */
describe('colocación', () => {
  // `insertImageFromUrl` mide con `new Image()`, que no existe en node.
  const withFakeImage = async (fn: () => Promise<void>) => {
    const original = (globalThis as { Image?: unknown }).Image;
    (globalThis as { Image?: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 200;
      naturalHeight = 100;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      await fn();
    } finally {
      (globalThis as { Image?: unknown }).Image = original;
    }
  };

  const twoPages = () => fakeApi([frame('p1', 0, 0, 400, 400), frame('p2', 600, 0, 400, 400)]);
  const inserted = (scene: ReturnType<typeof fakeApi>) =>
    scene.get().find((e: any) => e.type === 'image');

  it('devuelve el id del ELEMENTO, no el del fichero', async () => {
    // Devolver el `fileId` compilaba igual (los dos son `string`) y dejaba mudas
    // a `insertVideo` y a `setAsBackground`, que buscan un elemento por ese id.
    await withFakeImage(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      const id = await insertImageFromUrl(scene.api, CDN);
      const img = inserted(scene);
      expect(id).toBe(img.id);
      expect(id).not.toBe(img.fileId);
    });
  });

  it('la página la manda el punto de suelte, no la activa', async () => {
    await withFakeImage(async () => {
      const scene = twoPages();
      // Mirando la página 1, se suelta sobre la 2.
      await insertImageFromUrl(scene.api, CDN, { pageId: 'p1', at: { x: 800, y: 200 } });
      expect(inserted(scene).frameId).toBe('p2');
    });
  });

  it('soltar fuera de toda página deja la imagen DENTRO de la de respaldo', async () => {
    await withFakeImage(async () => {
      const scene = twoPages();
      // El gris entre las dos páginas.
      await insertImageFromUrl(scene.api, CDN, { pageId: 'p1', at: { x: 500, y: 200 } });
      const img = inserted(scene);
      expect(img.frameId).toBe('p1');
      expect(img.x).toBeGreaterThanOrEqual(0);
      expect(img.x + img.width).toBeLessThanOrEqual(400);
    });
  });

  it('soltar pegado al borde no deja media imagen recortada', async () => {
    await withFakeImage(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      await insertImageFromUrl(scene.api, CDN, { at: { x: 5, y: 395 } });
      const img = inserted(scene);
      expect(img.x).toBeGreaterThanOrEqual(0);
      expect(img.y).toBeGreaterThanOrEqual(0);
      expect(img.x + img.width).toBeLessThanOrEqual(400);
      expect(img.y + img.height).toBeLessThanOrEqual(400);
    });
  });

  it('deja seleccionado lo que acaba de insertar', async () => {
    await withFakeImage(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      const id = await insertImageFromUrl(scene.api, CDN);
      expect(scene.api.getAppState().selectedElementIds).toEqual({ [id]: true });
    });
  });

  it('una imagen sin dimensiones utilizables no entra en la escena', async () => {
    // Un `load` de 0×0 (SVG sin tamaño intrínseco, respuesta vacía) daba un
    // elemento invisible e inagarrable con el ratón.
    const original = (globalThis as { Image?: unknown }).Image;
    (globalThis as { Image?: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      await expect(insertImageFromUrl(scene.api, CDN)).rejects.toThrow(/dimensiones/);
      expect(scene.commits).toHaveLength(0);
    } finally {
      (globalThis as { Image?: unknown }).Image = original;
    }
  });
});

describe('soltar varios de una vez', () => {
  const page = () => fakeApi([frame('p1', 0, 0, 400, 400)]);

  it('escalona los puntos en vez de apilarlos', () => {
    const scene = page();
    const puntos = cascadePoints(scene.api, { x: 100, y: 100 }, 3);
    expect(puntos).toHaveLength(3);
    // Cada uno separado del anterior: encimados serían una inserción que
    // PARECE fallida — la de arriba tapa al resto.
    expect(puntos[1].x).not.toBe(puntos[0].x);
    expect(puntos[2].y).not.toBe(puntos[1].y);
  });

  it('escalona hacia dentro cuando sueltas en la esquina lejana', () => {
    // Escalonando siempre hacia abajo-derecha, soltar ahí empujaba todas las
    // copias contra el borde y el recorte a la página las reapilaba.
    const scene = page();
    const puntos = cascadePoints(scene.api, { x: 380, y: 380 }, 3);
    expect(puntos[2].x).toBeLessThan(puntos[0].x);
    expect(puntos[2].y).toBeLessThan(puntos[0].y);
  });

  it('un solo archivo cae exactamente donde lo sueltas', () => {
    const scene = page();
    expect(cascadePoints(scene.api, { x: 100, y: 100 }, 1)).toEqual([{ x: 100, y: 100 }]);
  });

  it('resolveInsertPageId usa la MISMA regla que la inserción', () => {
    const scene = fakeApi([frame('p1', 0, 0, 400, 400), frame('p2', 600, 0, 400, 400)]);
    // El host lo consulta para rebotar un lote entero sobre página bloqueada;
    // si discrepara de la inserción real, avisaría de una y escribiría en otra.
    expect(resolveInsertPageId(scene.api, { at: { x: 800, y: 100 }, pageId: 'p1' })).toBe('p2');
    expect(resolveInsertPageId(scene.api, { pageId: 'p2' })).toBe('p2');
    expect(resolveInsertPageId(scene.api)).toBe('p1');
  });
});

describe('sustituir la imagen de debajo (Mayúsculas + soltar)', () => {
  const withFakeImage = async (w: number, h: number, fn: () => Promise<void>) => {
    const original = (globalThis as { Image?: unknown }).Image;
    (globalThis as { Image?: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = w;
      naturalHeight = h;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      await fn();
    } finally {
      (globalThis as { Image?: unknown }).Image = original;
    }
  };

  it('encuentra la imagen de ENCIMA cuando hay dos superpuestas', () => {
    // La escena va de atrás hacia delante: la que el usuario ve bajo el puntero
    // es la última que lo contiene, no la primera.
    const scene = fakeApi([
      frame('p1', 0, 0, 400, 400),
      imageEl('abajo', 'f1', { x: 0, y: 0, width: 200, height: 200 }),
      imageEl('arriba', 'f2', { x: 50, y: 50, width: 200, height: 200 }),
    ]);
    expect(imageAtScenePoint(scene.api, { x: 100, y: 100 })?.id).toBe('arriba');
    expect(imageAtScenePoint(scene.api, { x: 10, y: 10 })?.id).toBe('abajo');
    expect(imageAtScenePoint(scene.api, { x: 380, y: 380 })).toBeNull();
  });

  it('conserva el hueco y no deforma la imagen nueva', async () => {
    // Un hueco cuadrado con una foto apaisada dentro: estirarla hasta llenarlo
    // la deformaría, y Excalidraw no sabe recortar.
    await withFakeImage(400, 100, async () => {
      const scene = fakeApi([
        frame('p1', 0, 0, 400, 400),
        imageEl('hueco', 'f1', { x: 100, y: 100, width: 200, height: 200 }),
      ]);
      expect(await replaceImageFromUrl(scene.api, 'hueco', CDN)).toBe(true);

      const el = scene.get().find((e: any) => e.id === 'hueco');
      expect(el.fileId).not.toBe('f1');
      expect(scene.api.getFiles()[el.fileId].dataURL).toBe(CDN);
      // Misma proporción que el archivo nuevo (4:1), dentro del hueco viejo…
      expect(el.width / el.height).toBeCloseTo(4, 5);
      expect(el.width).toBeLessThanOrEqual(200);
      // …y con el mismo centro.
      expect(el.x + el.width / 2).toBeCloseTo(200, 5);
      expect(el.y + el.height / 2).toBeCloseTo(200, 5);
    });
  });

  it('no toca nada si ese id no es una imagen', async () => {
    await withFakeImage(200, 100, async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      expect(await replaceImageFromUrl(scene.api, 'p1', CDN)).toBe(false);
      expect(scene.commits).toHaveLength(0);
    });
  });

  it('sigue sin admitir bytes: un data: URL se rechaza', async () => {
    const scene = fakeApi([
      frame('p1', 0, 0, 400, 400),
      imageEl('hueco', 'f1', { x: 0, y: 0, width: 100, height: 100 }),
    ]);
    await expect(replaceImageFromUrl(scene.api, 'hueco', PNG_1PX)).rejects.toThrow(/data:/);
  });
});

/**
 * Soltar del escritorio: pinta YA con los bytes locales y cambia a MediaMonster
 * al terminar la subida.
 *
 * Es la única parte del paquete que llega a poner un base64 en la escena, así
 * que es la que más de cerca hay que vigilar: al acabar la función, salga bien o
 * salga mal, no puede quedar ni un byte dentro.
 */
describe('soltar del escritorio (pintar ya, subir después)', () => {
  const PNG_BLOB = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

  const withEnv = async (fn: () => Promise<void>) => {
    const oldImage = (globalThis as { Image?: unknown }).Image;
    const oldReader = (globalThis as { FileReader?: unknown }).FileReader;
    (globalThis as { Image?: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 200;
      naturalHeight = 100;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    (globalThis as { FileReader?: unknown }).FileReader = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      readAsDataURL(_b: Blob) {
        this.result = PNG_1PX;
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      await fn();
    } finally {
      (globalThis as { Image?: unknown }).Image = oldImage;
      (globalThis as { FileReader?: unknown }).FileReader = oldReader;
    }
  };

  it('la imagen está en la escena ANTES de que la subida termine', async () => {
    await withEnv(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      let resolver: (url: string) => void = () => {};
      const uploader = vi.fn(() => new Promise<string>((r) => (resolver = r)));

      const pendiente = insertImageWithPreview(scene.api, PNG_BLOB(), uploader);
      // Los tics justos para leer el blob y medirlo (dos `setTimeout` en los
      // dobles), y ni uno más: la subida sigue colgada a propósito.
      for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));

      const img = scene.get().find((e: any) => e.type === 'image');
      expect(img).toBeTruthy();
      // Y de momento pinta con los bytes locales: eso es lo que la hace instantánea.
      expect(scene.api.getFiles()[img.fileId].dataURL).toBe(PNG_1PX);

      resolver(CDN);
      await pendiente;
    });
  });

  it('al terminar apunta a MediaMonster y NO queda base64 que guardar', async () => {
    await withEnv(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      const id = await insertImageWithPreview(
        scene.api,
        PNG_BLOB(),
        vi.fn().mockResolvedValue(CDN),
        { filename: 'foto.png' },
      );

      const img = scene.get().find((e: any) => e.id === id);
      expect(scene.api.getFiles()[img.fileId].dataURL).toBe(CDN);
      // EL filtro de salida es el juez: lo que se guardaría no lleva bytes.
      const persistable = buildPersistableFiles(scene.get() as never, scene.api.getFiles());
      expect(persistable.inline).toEqual([]);
    });
  });

  it('el cambio de fichero NO entra en el historial', async () => {
    // Un Ctrl+Z que devolviera el elemento al base64 recién sustituido sería
    // exactamente lo que la regla prohíbe.
    await withEnv(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      await insertImageWithPreview(scene.api, PNG_BLOB(), vi.fn().mockResolvedValue(CDN));
      expect(scene.commits.at(-1)?.captureUpdate).toBe('NEVER');
    });
  });

  it('si la subida falla, el elemento se RETIRA (no se queda en base64)', async () => {
    // Quedarse sería bloquear el guardado del diseño entero, no solo el de esta
    // foto: el filtro de salida es fail-closed.
    await withEnv(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      await expect(
        insertImageWithPreview(scene.api, PNG_BLOB(), vi.fn().mockRejectedValue(new Error('MM caído'))),
      ).rejects.toThrow(/MM caído/);

      expect(scene.get().some((e: any) => e.type === 'image')).toBe(false);
      const persistable = buildPersistableFiles(scene.get() as never, scene.api.getFiles());
      expect(persistable.inline).toEqual([]);
    });
  });

  it('un uploader que devuelva data: se trata como fallo', async () => {
    await withEnv(async () => {
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      await expect(
        insertImageWithPreview(scene.api, PNG_BLOB(), vi.fn().mockResolvedValue(PNG_1PX)),
      ).rejects.toThrow(/data:/);
      expect(scene.get().some((e: any) => e.type === 'image')).toBe(false);
    });
  });

  it('sigue exigiendo un uploader: no hay puerta sin MediaMonster', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
    await expect(
      insertImageWithPreview(scene.api, PNG_BLOB(), undefined as never),
    ).rejects.toThrow(/MediaUploader/);
  });
});

describe('inserción', () => {
  it('insertImageFromUrl rechaza un data: URL', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100)]);
    await expect(insertImageFromUrl(scene.api, PNG_1PX)).rejects.toThrow(/data:/);
  });

  it('insertImageFromBlob exige un uploader', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100)]);
    await expect(
      insertImageFromBlob(scene.api, new Blob(['x']), undefined as never),
    ).rejects.toThrow(/MediaUploader/);
  });

  it('insertImageFromBlob sube los bytes antes de tocar la escena', async () => {
    const scene = fakeApi([frame('p1', 0, 0, 100, 100)]);
    const uploader = vi.fn().mockResolvedValue(CDN);
    // `insertImageFromUrl` mide la imagen con `new Image()`, que no existe en
    // node: se corta ahí a propósito — lo que se comprueba es que la subida
    // ocurrió ANTES, que es donde vive la regla.
    await insertImageFromBlob(scene.api, new Blob(['x']), uploader).catch(() => {});
    expect(uploader).toHaveBeenCalledTimes(1);
  });

  it('dataUrlToBlob decodifica base64 para poder subirlo', () => {
    const blob = dataUrlToBlob(PNG_1PX);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });
});
