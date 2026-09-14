import { describe, it, expect, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { isVideoElement, getVideoMeta, getSelectedVideo, setVideoPoster, insertVideo, VIDEO_MARKER } =
  await import('../src/core/video.js');

/**
 * Un vídeo en el lienzo es su PÓSTER (una imagen) que además recuerda de qué
 * vídeo salió. Excalidraw no tiene elemento de vídeo y el paquete no se forkea;
 * el vínculo va en `customData`, que Excalidraw serializa y devuelve intacto.
 */
const meta = (extra: Record<string, unknown> = {}) => ({
  c2: VIDEO_MARKER,
  src: 'https://cdn/video.mp4',
  mediaFileId: 'mf1',
  posterTime: 3.5,
  ...extra,
});

const videoEl = (id: string, extra: Record<string, unknown> = {}) =>
  member(id, 'p1', 0, 0, 100, 100, { type: 'image', fileId: 'f_viejo', customData: meta(), ...extra });

describe('isVideoElement', () => {
  it('reconoce el póster marcado', () => {
    expect(isVideoElement(videoEl('v1') as never)).toBe(true);
  });

  it('una imagen normal no es un vídeo', () => {
    expect(isVideoElement(member('i1', 'p1', 0, 0, 10, 10, { type: 'image' }) as never)).toBe(false);
  });

  it('un customData ajeno no cuela', () => {
    // La marca `c2` es lo que distingue esto de cualquier otro uso del campo:
    // el fondo de página también vive en `customData`.
    const falso = member('x', 'p1', 0, 0, 10, 10, {
      type: 'image',
      customData: { c2: 'pageBackground' },
    });
    expect(isVideoElement(falso as never)).toBe(false);
  });

  it('sin `src` no vale: sin vídeo al que volver no hay nada que elegir', () => {
    const sinSrc = member('x', 'p1', 0, 0, 10, 10, {
      type: 'image',
      customData: { c2: VIDEO_MARKER, src: '' },
    });
    expect(isVideoElement(sinSrc as never)).toBe(false);
  });
});

describe('getSelectedVideo', () => {
  it('devuelve el vídeo cuando hay exactamente uno seleccionado', () => {
    const { api, setSelected } = fakeApi([frame('p1', 0, 0, 200, 200), videoEl('v1')]);
    setSelected(['v1']);
    expect(getSelectedVideo(api)?.id).toBe('v1');
  });

  it('con selección múltiple devuelve null', () => {
    // Aplicar la portada al primero de una selección múltiple es la clase de
    // atajo que acaba cambiando el vídeo equivocado.
    const { api, setSelected } = fakeApi([frame('p1', 0, 0, 200, 200), videoEl('v1'), videoEl('v2')]);
    setSelected(['v1', 'v2']);
    expect(getSelectedVideo(api)).toBeNull();
  });

  it('con una imagen normal seleccionada devuelve null', () => {
    const { api, setSelected } = fakeApi([
      frame('p1', 0, 0, 200, 200),
      member('i1', 'p1', 0, 0, 10, 10, { type: 'image' }),
    ]);
    setSelected(['i1']);
    expect(getSelectedVideo(api)).toBeNull();
  });
});

describe('setVideoPoster', () => {
  it('cambia el fichero y guarda el instante, sin mover ni redimensionar', () => {
    // Es un cambio de portada, no una inserción: recolocar tiraría la maqueta.
    const { api, get } = fakeApi([
      frame('p1', 0, 0, 200, 200),
      videoEl('v1', { x: 30, y: 40, width: 120, height: 80 }),
    ]);

    expect(setVideoPoster(api, 'v1', { url: 'https://cdn/nuevo.webp', timeSec: 7.25 })).toBe(true);

    const el = get().find((e) => e.id === 'v1');
    expect(el.fileId).not.toBe('f_viejo');
    expect(el.customData.posterTime).toBe(7.25);
    // El vínculo con el vídeo sobrevive: si no, la siguiente vez no habría de
    // dónde sacar otro fotograma.
    expect(el.customData.src).toBe('https://cdn/video.mp4');
    expect(el.customData.mediaFileId).toBe('mf1');
    expect([el.x, el.y, el.width, el.height]).toEqual([30, 40, 120, 80]);
  });

  it('registra el póster con un id NUEVO', () => {
    // `addFiles` de Excalidraw hace `continue` con todo id que ya exista, así
    // que reutilizarlo dejaría la portada vieja en pantalla.
    const { api } = fakeApi([frame('p1', 0, 0, 200, 200), videoEl('v1')]);
    setVideoPoster(api, 'v1', { url: 'https://cdn/nuevo.webp', timeSec: 1 });
    const ids = Object.keys(api.getFiles());
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe('f_viejo');
  });

  it('commitea una sola vez', () => {
    const { api, commits } = fakeApi([frame('p1', 0, 0, 200, 200), videoEl('v1')]);
    setVideoPoster(api, 'v1', { url: 'https://cdn/nuevo.webp', timeSec: 1 });
    expect(commits).toHaveLength(1);
  });

  it('sobre algo que no es un vídeo devuelve false y no toca nada', () => {
    const { api, commits } = fakeApi([
      frame('p1', 0, 0, 200, 200),
      member('i1', 'p1', 0, 0, 10, 10, { type: 'image' }),
    ]);
    expect(setVideoPoster(api, 'i1', { url: 'https://cdn/x.webp', timeSec: 1 })).toBe(false);
    expect(commits).toHaveLength(0);
  });
});

describe('getVideoMeta', () => {
  it('devuelve los datos por id', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 200, 200), videoEl('v1')]);
    expect(getVideoMeta(api, 'v1')?.src).toBe('https://cdn/video.mp4');
  });

  it('null si el elemento no existe', () => {
    const { api } = fakeApi([frame('p1', 0, 0, 200, 200)]);
    expect(getVideoMeta(api, 'nope')).toBeNull();
  });
});

describe('insertVideo', () => {
  it('deja el póster MARCADO como vídeo', async () => {
    // El fallo que cubre: `insertImageFromUrl` devolvía el id del FICHERO y aquí
    // se buscaba un ELEMENTO con ese id. No casaba nunca, así que la marca no se
    // escribía — y sin marca no hay selector de fotograma ni vínculo con el mp4:
    // un vídeo insertado quedaba como una foto suelta, en silencio.
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
      const scene = fakeApi([frame('p1', 0, 0, 400, 400)]);
      const id = await insertVideo(scene.api, 'https://cdn/poster.png', 'https://cdn/video.mp4', {
        mediaFileId: 'mf9',
        name: 'clip',
      });
      const meta = getVideoMeta(scene.api, id);
      expect(meta?.src).toBe('https://cdn/video.mp4');
      expect(meta?.mediaFileId).toBe('mf9');
    } finally {
      (globalThis as { Image?: unknown }).Image = original;
    }
  });
});
