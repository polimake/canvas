import { describe, it, expect, vi, beforeEach } from 'vitest';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { exportScenePng } = await import('../src/core/export.js');
const exportToBlob = excalMock.exportToBlob as ReturnType<typeof vi.fn>;

beforeEach(() => {
  exportToBlob.mockReset();
  exportToBlob.mockResolvedValue(new Blob(['x'], { type: 'image/webp' }));
});

describe('exportScenePng', () => {
  it('pasa formato y calidad, y sigue siendo PNG si no se pide otra cosa', async () => {
    const { api } = fakeApi([frame('a', 0, 0, 1080, 1350)]);
    await exportScenePng(api as never, { pageId: 'a', mimeType: 'image/webp', quality: 0.85 });
    expect(exportToBlob).toHaveBeenLastCalledWith(expect.objectContaining({ mimeType: 'image/webp', quality: 0.85 }));
    await exportScenePng(api as never, { pageId: 'a' });
    const last = exportToBlob.mock.lastCall?.[0];
    expect(last.mimeType).toBe('image/png');
    expect('quality' in last).toBe(false);
  });

  it('exporta la instantánea que se le da, no lo que el editor tenga después', async () => {
    const snapshot = [frame('a', 0, 0, 1080, 1350)];
    // El editor ya se cerró: su escena está vacía.
    const { api } = fakeApi([]);
    await exportScenePng(api as never, { pageId: 'a', elements: snapshot as never });
    const call = exportToBlob.mock.lastCall?.[0];
    expect(call.elements).toBe(snapshot);
    expect(call.exportingFrame.id).toBe('a');
  });

  it('una página que no está falla en vez de exportar la escena entera', async () => {
    const { api } = fakeApi([]);
    await expect(exportScenePng(api as never, { pageId: 'gone' })).rejects.toThrow(/gone/);
    expect(exportToBlob).not.toHaveBeenCalled();
  });
});
