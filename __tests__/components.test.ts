import { describe, expect, it, vi } from 'vitest';
import { excalMock, fakeApi, frame, member } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const {
  appendComponentToEditorConfig,
  cloneSceneElements,
  deriveComponentMeta,
  extractComponentFragment,
  fitImageInBox,
  instantiateComponent,
  listSlots,
  measureWrappedText,
} = await import('../src/core/components.js');
const { insertComponentIntoScene, extractPageForComponent } = await import('../src/core/insertComponent.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** editorConfig de un componente: una página con titular-slot, foto y papel. */
function componentConfig() {
  return {
    elements: [
      frame('pg1', 0, 0, 1080, 1350, { name: 'Story CTA' }),
      member('paper', 'pg1', 0, 0, 1080, 1350, { customData: { c2: 'pageBackground' } }),
      member('tit', 'pg1', 84, 900, 912, 100, {
        type: 'text',
        text: 'Titular de ejemplo',
        originalText: 'Titular de ejemplo',
        fontSize: 64,
        lineHeight: 1.2,
        customData: { c2: 'slot', name: 'titular', maxChars: 60 },
      }),
      member('img', 'pg1', 0, 0, 1080, 800, { type: 'image', fileId: 'file-a' }),
    ],
    files: {
      'file-a': { id: 'file-a', dataURL: 'https://cdn.example/a.webp', mimeType: 'image/webp' },
      'file-huerfano': { id: 'file-huerfano', dataURL: 'https://cdn.example/x.webp', mimeType: 'image/webp' },
    },
    fonts: [{ family: 'Recoleta (marca)', src: 'https://cdn.example/recoleta.woff2' }],
    appState: { viewBackgroundColor: '#ffffff' },
  };
}

// ─── cloneSceneElements ──────────────────────────────────────────────────────

describe('cloneSceneElements', () => {
  it('acuña ids nuevos y remapea las referencias internas', () => {
    const group = [
      frame('f1', 0, 0, 100, 100),
      member('a', 'f1', 10, 10, 20, 20, { boundElements: [{ id: 'b', type: 'arrow' }], groupIds: ['g1'] }),
      member('b', 'f1', 40, 40, 20, 20, { containerId: 'a', groupIds: ['g1'] }),
    ] as any[];

    const { clones, idMap } = cloneSceneElements(group, { dx: 500 });

    expect(clones).toHaveLength(3);
    for (const original of group) {
      expect(idMap.get(original.id)).not.toBe(original.id);
    }
    const [f, a, b] = clones as any[];
    expect(f.x).toBe(500);
    expect(a.frameId).toBe(f.id);
    expect(b.containerId).toBe(a.id);
    expect(a.boundElements[0].id).toBe(b.id);
    // Los groupIds también se reacuñan, pero conservando la agrupación.
    expect(a.groupIds[0]).toBe(b.groupIds[0]);
    expect(a.groupIds[0]).not.toBe('g1');
    // Identidad fresca para el store: sin index heredado, versión subida.
    expect('index' in f).toBe(false);
    expect(a.version).toBe(1);
  });

  it('remapea fileId solo cuando se pide (instanciación)', () => {
    const group = [member('img', null as any, 0, 0, 10, 10, { type: 'image', fileId: 'file-a' })] as any[];

    const sinMapa = cloneSceneElements(group);
    expect((sinMapa.clones[0] as any).fileId).toBe('file-a');

    const fileIdMap = new Map<string, string>();
    const conMapa = cloneSceneElements(group, { fileIdMap });
    expect((conMapa.clones[0] as any).fileId).toBe(fileIdMap.get('file-a'));
    expect(fileIdMap.get('file-a')).not.toBe('file-a');
  });
});

// ─── Medición y encaje ───────────────────────────────────────────────────────

describe('measureWrappedText / fitImageInBox', () => {
  it('parte el texto por ancho medio de glifo y devuelve la altura', () => {
    const wrapped = measureWrappedText('una frase con varias palabras que no cabe en una línea', {
      width: 400,
      fontSize: 40,
      lineHeight: 1.2,
    });
    expect(wrapped.lines.length).toBeGreaterThan(1);
    expect(wrapped.height).toBe(wrapped.lines.length * 40 * 1.2);
    // Nada se pierde al envolver.
    expect(wrapped.text.replace(/\n/g, ' ')).toContain('varias palabras');
  });

  it('contiene la imagen entera, centrada — nunca recorta ni deforma', () => {
    // Panorámica 2:1 en caja cuadrada: ancho manda, sobra alto.
    const wide = fitImageInBox(2, { x: 0, y: 0, width: 100, height: 100 });
    expect(wide).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    // Vertical 1:2 en la misma caja: alto manda, sobra ancho.
    const tall = fitImageInBox(0.5, { x: 0, y: 0, width: 100, height: 100 });
    expect(tall).toEqual({ x: 25, y: 0, width: 50, height: 100 });
    // Ratio inválido no revienta: cae al 1.5 por defecto.
    const bad = fitImageInBox(NaN, { x: 0, y: 0, width: 150, height: 150 });
    expect(bad.width).toBe(150);
  });
});

// ─── Slots ───────────────────────────────────────────────────────────────────

describe('listSlots', () => {
  it('detecta customData, azúcar {{…}} y la imagen implícita', () => {
    const elements = [
      member('t1', 'f', 0, 0, 10, 10, { type: 'text', text: 'fijo', customData: { c2: 'slot', name: 'titular', maxChars: 60 } }),
      member('t2', 'f', 0, 0, 10, 10, { type: 'text', text: '{{cta}}' }),
      member('i1', 'f', 0, 0, 100, 100, { type: 'image', fileId: 'a' }),
      member('i2', 'f', 0, 0, 500, 500, { type: 'image', fileId: 'b' }),
    ] as any[];

    const slots = listSlots(elements);
    expect(slots).toEqual([
      { name: 'titular', type: 'text', elementId: 't1', maxChars: 60 },
      { name: 'cta', type: 'text', elementId: 't2', implicit: true },
      // La imagen MÁS GRANDE es el slot implícito 'foto'.
      { name: 'foto', type: 'image', elementId: 'i2', implicit: true },
    ]);
  });

  it('un slot de imagen declarado desactiva la imagen implícita', () => {
    const elements = [
      member('i1', 'f', 0, 0, 100, 100, { type: 'image', customData: { c2: 'slot', name: 'logo' } }),
      member('i2', 'f', 0, 0, 900, 900, { type: 'image' }),
    ] as any[];
    const slots = listSlots(elements);
    expect(slots).toEqual([{ name: 'logo', type: 'image', elementId: 'i1' }]);
  });

  it('el papel de página (otro customData.c2) no es un slot', () => {
    const elements = [member('p', 'f', 0, 0, 10, 10, { customData: { c2: 'pageBackground' } })] as any[];
    expect(listSlots(elements)).toEqual([]);
  });
});

describe('deriveComponentMeta', () => {
  it('inventaría los slots verificables de la escena', () => {
    const cfg = componentConfig();
    const meta = deriveComponentMeta(cfg.elements as any[], { description: 'Story con CTA', tags: ['story'] });
    expect(meta).toEqual({
      description: 'Story con CTA',
      tags: ['story'],
      slots: {
        titular: { type: 'text', maxChars: 60 },
        foto: { type: 'image' },
      },
    });
  });
});

// ─── Extracción ──────────────────────────────────────────────────────────────

describe('extractComponentFragment', () => {
  it('extrae marco, miembros, solo los ficheros referenciados y las fuentes', () => {
    const fragment = extractComponentFragment(componentConfig());
    expect(fragment).not.toBeNull();
    expect(fragment!.frame.id).toBe('pg1');
    expect(fragment!.members.map((m: any) => m.id)).toEqual(['paper', 'tit', 'img']);
    // El fichero huérfano NO viaja con el fragmento.
    expect(Object.keys(fragment!.files)).toEqual(['file-a']);
    expect(fragment!.fonts).toHaveLength(1);
    expect(fragment!.pageSize).toEqual({ width: 1080, height: 1350 });
  });

  it('rechaza configs legacy (array) y sin marcos', () => {
    expect(extractComponentFragment([{ a: 'legacy' }])).toBeNull();
    expect(extractComponentFragment({ elements: [member('x', null as any, 0, 0, 5, 5)] })).toBeNull();
    expect(extractComponentFragment(null)).toBeNull();
  });
});

// ─── Instanciación ───────────────────────────────────────────────────────────

describe('instantiateComponent', () => {
  it('clona con ficheros reacuñados y rellena slots de texto e imagen', () => {
    const fragment = extractComponentFragment(componentConfig())!;
    const instance = instantiateComponent(fragment, {
      dx: 2000,
      slots: {
        titular: 'Nuevo titular de la pieza',
        foto: { url: 'https://cdn.example/nueva.jpg', w: 1000, h: 2000 },
      },
    });

    expect(instance.elements).toHaveLength(4);
    expect(instance.unknownSlots).toEqual([]);

    const text = instance.elements.find((e: any) => e.type === 'text') as any;
    expect(text.originalText).toBe('Nuevo titular de la pieza');
    expect(text.autoResize).toBe(false);
    expect(text.id).not.toBe('tit');

    const image = instance.elements.find((e: any) => e.type === 'image') as any;
    // El slot de foto acuña un fichero NUEVO apuntando a la URL dada…
    expect(instance.files[image.fileId]).toMatchObject({
      dataURL: 'https://cdn.example/nueva.jpg',
      mimeType: 'image/jpeg',
    });
    // …y con medidas reales (1:2) la imagen se CONTIENE en su caja 1080x800.
    expect(image.height).toBe(800);
    expect(image.width).toBe(400);
    // La caja original arranca en x=0 y el marco se movió 2000.
    expect(image.x).toBe(2000 + (1080 - 400) / 2);
  });

  it('reporta los slots desconocidos en vez de inventarlos', () => {
    const fragment = extractComponentFragment(componentConfig())!;
    const instance = instantiateComponent(fragment, { slots: { inexistente: 'x' } });
    expect(instance.unknownSlots).toEqual(['inexistente']);
  });

  it('sin slots, la instancia es una copia fiel con identidad fresca', () => {
    const fragment = extractComponentFragment(componentConfig())!;
    const instance = instantiateComponent(fragment);
    const text = instance.elements.find((e: any) => e.type === 'text') as any;
    expect(text.text).toBe('Titular de ejemplo');
    // El fileId del clon existe en los ficheros de la instancia, no en los viejos.
    const image = instance.elements.find((e: any) => e.type === 'image') as any;
    expect(image.fileId).not.toBe('file-a');
    expect(instance.files[image.fileId].dataURL).toBe('https://cdn.example/a.webp');
  });
});

// ─── Composición server-side ─────────────────────────────────────────────────

describe('appendComponentToEditorConfig', () => {
  it('añade la página tras la última, fusiona ficheros y deduplica fuentes', () => {
    const target = {
      elements: [frame('dest1', 0, 0, 1080, 1350, { name: 'Página 1' })],
      files: { existente: { id: 'existente', dataURL: 'https://cdn.example/e.webp', mimeType: 'image/webp' } },
      fonts: [{ family: 'Recoleta (marca)', src: 'https://cdn.example/recoleta.woff2' }],
      appState: { viewBackgroundColor: '#fafafa' },
    };
    const fragment = extractComponentFragment(componentConfig())!;

    const result = appendComponentToEditorConfig(target, fragment, { slots: { titular: 'Hola' } })!;

    expect(result.pages).toBe(2);
    const framesOut = (result.editorConfig.elements as any[]).filter((e) => e.type === 'frame');
    expect(framesOut).toHaveLength(2);
    // Colocada tras la última página con el PAGE_GAP de siempre (48).
    expect(framesOut[1].x).toBe(0 + 1080 + 48);
    expect(framesOut[1].id).toBe(result.pageId);
    // Ficheros fusionados sin pisar los existentes.
    expect(Object.keys(result.editorConfig.files)).toContain('existente');
    expect(Object.keys(result.editorConfig.files).length).toBe(2);
    // La fuente repetida NO se duplica.
    expect(result.editorConfig.fonts).toHaveLength(1);
    // El appState del destino sobrevive.
    expect((result.editorConfig as any).appState.viewBackgroundColor).toBe('#fafafa');
  });

  it('rechaza un destino legacy (array) — el endpoint lo convierte en 400', () => {
    const fragment = extractComponentFragment(componentConfig())!;
    expect(appendComponentToEditorConfig([{ a: 1 }], fragment)).toBeNull();
  });
});

// ─── Integración con la escena viva (navegador) ──────────────────────────────

describe('insertComponentIntoScene', () => {
  it('un solo commit, ficheros por addFiles y navegación a la página nueva', () => {
    const { api, commits, get } = fakeApi(
      [frame('p1', 0, 0, 1080, 1350, { name: 'Página 1' })],
      {},
    );
    const fragment = extractComponentFragment(componentConfig())!;

    const result = insertComponentIntoScene(api, fragment, { slots: { titular: 'Insertado' } });

    // Un único updateScene con elementos (regla de una entrada de deshacer)…
    const withElements = commits.filter((c) => c.elements);
    expect(withElements).toHaveLength(1);
    // …más el scroll de goToPage (que no toca elementos).
    expect(get()).toHaveLength(5);
    const newFrame = get().find((e: any) => e.id === result.pageId) as any;
    expect(newFrame.type).toBe('frame');
    // Empaquetada tras la página 1 con el gap estándar.
    expect(newFrame.x).toBe(1080 + 48);
    // Los ficheros de la instancia entraron en el store de Excalidraw.
    const image = get().find((e: any) => e.type === 'image') as any;
    expect(api.getFiles()[image.fileId]).toBeTruthy();
    // Las fuentes del componente se devuelven para que el host las persista.
    expect(result.fonts).toHaveLength(1);
  });
});

describe('extractPageForComponent', () => {
  it('extrae la página con la forma de editorConfig que guarda useCanvas2Save', () => {
    const { api } = fakeApi(
      [
        frame('p1', 0, 0, 1080, 1350),
        member('m1', 'p1', 0, 0, 100, 100, { type: 'image', fileId: 'f-remoto' }),
        frame('p2', 2000, 0, 1080, 1350),
        member('otro', 'p2', 2000, 0, 50, 50),
      ],
      { 'f-remoto': { id: 'f-remoto', dataURL: 'https://cdn.example/r.webp', mimeType: 'image/webp' } },
    );

    const out = extractPageForComponent(api, 'p1', { fonts: [{ family: 'X', src: 'https://x/f.woff2' }] })!;

    // Solo la página pedida, no la vecina.
    expect(out.editorConfig.elements.map((e: any) => e.id)).toEqual(['p1', 'm1']);
    expect(Object.keys(out.editorConfig.files)).toEqual(['f-remoto']);
    expect(out.editorConfig.fonts).toHaveLength(1);
    expect(out.inline).toEqual([]);
    expect(extractPageForComponent(api, 'no-existe')).toBeNull();
  });
});
