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

vi.mock('../src/excal', () => excalMock);

const {
  buildPersistableFiles,
  findInlineImageIds,
  isInlineDataUrl,
  externalizeInlineImages,
  insertImageFromUrl,
  insertImageFromBlob,
  dataUrlToBlob,
} = await import('../src/media');

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
