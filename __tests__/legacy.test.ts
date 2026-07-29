import { describe, it, expect } from 'vitest';
import { legacyToScene, parseLegacyText } from '../src/legacy';

/**
 * Fixtures recortadas de filas reales de `designs` en producción (Paella Power),
 * con las claves minificadas tal cual las escribe polimake-canvas.
 */
const IMG_URL =
  'https://light-media.polimake.com/projects/1b3f4604-66cb-4454-a7d5-38f2a076fcf4/images/5bc2386e-77d8-420d-98ed-82a065c91c6f/preview.webp';

const T1_UNA_PAGINA = [
  {
    a: '',
    c: {
      d: {
        e: { f: 'RootLayer' },
        g: { h: { i: 1080, j: 1920 }, k: { x: 0, y: 0 }, n: 0, o: '#fff', p: null },
        r: false,
        s: ['ca_pureOYe'],
        t: null,
      },
      ca_pureOYe: {
        e: { f: 'ImageLayer' },
        g: {
          p: { y: IMG_URL, aj: IMG_URL, h: { i: 1080.32, j: 1920 }, k: { l: -0.16, m: 0 }, n: 0 },
          k: { l: 0, m: 0 },
          h: { i: 1080, j: 1920 },
          n: 0,
        },
        r: false,
        s: [],
        t: 'ROOT',
      },
    },
  },
];

const T2_TEXTO = [
  {
    a: '',
    c: {
      d: {
        e: { f: 'RootLayer' },
        g: { h: { i: 1080, j: 1080 }, k: { l: 0, m: 0 }, n: 0, o: '#ffffff', p: null },
        r: false,
        s: ['ca_txt'],
        t: null,
      },
      ca_txt: {
        e: { f: 'TextLayer' },
        g: {
          h: { i: 400, j: 252 },
          k: { l: 334, m: 552 },
          n: 0,
          u: 1,
          v: '<p style="text-align: center; font-family: &quot;Canva Sans Regular&quot;; font-size: 45px; color: rgb(0, 0, 0); line-height: 1.4;"><strong><span style="color: rgb(0, 0, 0);">Hola mundo</span></strong></p>',
          w: [{ a: 'Canva Sans Regular', x: 'Canva Sans' }],
          ab: ['rgb(0, 0, 0)'],
          ac: [45],
        },
        r: false,
        s: [],
        t: 'ROOT',
      },
    },
  },
];

describe('parseLegacyText()', () => {
  it('extrae texto, tamaño, color y alineación', () => {
    const [p] = parseLegacyText(T2_TEXTO[0].c.ca_txt.g.v);
    expect(p).toEqual({ text: 'Hola mundo', fontSize: 45, color: 'rgb(0, 0, 0)', align: 'center' });
  });

  it('el color del span gana al del párrafo', () => {
    const [p] = parseLegacyText(
      '<p style="color: rgb(1,1,1); font-size: 20px;"><span style="color: rgb(9,9,9);">x</span></p>',
    );
    expect(p.color).toBe('rgb(9,9,9)');
  });

  it('decodifica entidades y descarta párrafos vacíos', () => {
    const out = parseLegacyText('<p style="font-size:10px">a &amp; b</p><p style="font-size:10px"></p>');
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('a & b');
  });

  it('no revienta con HTML fuera del molde esperado', () => {
    expect(parseLegacyText('texto suelto sin etiquetas')[0].text).toBe('texto suelto sin etiquetas');
    expect(parseLegacyText('')).toEqual([]);
  });
});

describe('legacyToScene() — T1 imagen', () => {
  const { elements, files, report } = legacyToScene(T1_UNA_PAGINA);

  it('produce frame + paper + imagen', () => {
    expect(elements.map((e: any) => e.type)).toEqual(['frame', 'rectangle', 'image']);
    expect(report.tier).toBe('T1');
    expect(report.clean).toBe(true);
  });

  it('el frame conserva el tamaño de página del RootLayer', () => {
    const frame = elements[0] as any;
    expect([frame.width, frame.height]).toEqual([1080, 1920]);
  });

  it('el paper va bloqueado y marcado para background.ts', () => {
    const paper = elements[1] as any;
    expect(paper.locked).toBe(true);
    expect(paper.customData).toEqual({ c2: 'pageBackground' });
    expect(paper.frameId).toBe((elements[0] as any).id);
  });

  it('la imagen va por URL remota, sin dataURL', () => {
    const img = elements[2] as any;
    const file = files[img.fileId] as any;
    expect(file.dataURL).toBe(IMG_URL);
    expect(file.dataURL.startsWith('data:')).toBe(false);
  });

  it('traslada el desplazamiento interno del recorte legacy', () => {
    const img = elements[2] as any;
    // g.p.k = {l:-0.16, m:0} sobre una capa en 0,0
    expect(img.x).toBeCloseTo(-0.16);
    expect(img.width).toBeCloseTo(1080.32);
  });

  it('descarta imágenes con URL blob: en vez de escribir basura', () => {
    const roto = JSON.parse(JSON.stringify(T1_UNA_PAGINA));
    roto[0].c.ca_pureOYe.g.p.y = 'blob:http://localhost/abc';
    roto[0].c.ca_pureOYe.g.p.aj = 'blob:http://localhost/abc';
    const out = legacyToScene(roto);
    expect(out.elements.map((e: any) => e.type)).toEqual(['frame', 'rectangle']);
    expect(out.report.notes[0].kind).toBe('dropped');
  });
});

describe('legacyToScene() — T2 texto', () => {
  const { elements, report } = legacyToScene(T2_TEXTO);

  it('convierte la capa de texto y marca la pérdida de fuente', () => {
    const txt = elements.find((e: any) => e.type === 'text') as any;
    expect(txt.text).toBe('Hola mundo');
    expect(txt.fontSize).toBe(45);
    expect(txt.strokeColor).toBe('rgb(0, 0, 0)');
    expect(txt.textAlign).toBe('center');
    expect(report.tier).toBe('T2');
    expect(report.notes.some((n) => n.detail.includes('Canva Sans'))).toBe(true);
  });

  it('parte estilos mixtos en varios elementos y lo reporta', () => {
    const mixto = JSON.parse(JSON.stringify(T2_TEXTO));
    mixto[0].c.ca_txt.g.v =
      '<p style="font-size: 60px; color: rgb(1,1,1);">Titular</p>' +
      '<p style="font-size: 20px; color: rgb(2,2,2);">Bajada</p>';
    const out = legacyToScene(mixto);
    const textos = out.elements.filter((e: any) => e.type === 'text');
    expect(textos).toHaveLength(2);
    expect(out.report.notes.some((n) => n.kind === 'lossy' && n.detail.includes('2 elementos'))).toBe(true);
  });

  it('aplica la escala de la capa al tamaño de fuente', () => {
    const escalado = JSON.parse(JSON.stringify(T2_TEXTO));
    escalado[0].c.ca_txt.g.u = 2;
    const txt = legacyToScene(escalado).elements.find((e: any) => e.type === 'text') as any;
    expect(txt.fontSize).toBe(90);
  });
});

describe('legacyToScene() — multipágina', () => {
  it('coloca las páginas pegadas de izquierda a derecha', () => {
    const dos = [T1_UNA_PAGINA[0], JSON.parse(JSON.stringify(T1_UNA_PAGINA[0]))];
    const frames = legacyToScene(dos).elements.filter((e: any) => e.type === 'frame') as any[];
    expect(frames).toHaveLength(2);
    expect(frames[0].x).toBe(0);
    expect(frames[1].x).toBe(1080);
  });

  it('cada elemento pertenece a su propia página', () => {
    const dos = [T1_UNA_PAGINA[0], JSON.parse(JSON.stringify(T1_UNA_PAGINA[0]))];
    const { elements } = legacyToScene(dos);
    const frames = elements.filter((e: any) => e.type === 'frame') as any[];
    const huerfanos = elements.filter(
      (e: any) => e.type !== 'frame' && !frames.some((f) => f.id === e.frameId),
    );
    expect(huerfanos).toEqual([]);
  });
});

describe('legacyToScene() — robustez', () => {
  it('acepta el editorConfig como string', () => {
    expect(legacyToScene(JSON.stringify(T1_UNA_PAGINA)).report.pages).toBe(1);
  });

  it('devuelve escena vacía con entrada inservible', () => {
    expect(legacyToScene(null).elements).toEqual([]);
    expect(legacyToScene(undefined).report.pages).toBe(0);
  });

  it('marca T3 y reporta las capas que no sabe convertir', () => {
    const conVideo = JSON.parse(JSON.stringify(T1_UNA_PAGINA));
    conVideo[0].c.ca_video = { e: { f: 'VideoLayer' }, g: {}, s: [], t: 'ROOT' };
    conVideo[0].c.d.s.push('ca_video');
    const { report } = legacyToScene(conVideo);
    expect(report.tier).toBe('T3');
    expect(report.notes.some((n) => n.detail.includes('VideoLayer'))).toBe(true);
  });

  it('es determinista: dos conversiones de la misma entrada son idénticas', () => {
    expect(JSON.stringify(legacyToScene(T1_UNA_PAGINA).elements)).toBe(
      JSON.stringify(legacyToScene(T1_UNA_PAGINA).elements),
    );
  });
});
