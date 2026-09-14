import { describe, it, expect } from 'vitest';
import { legacyToScene, parseLegacyText } from '../src/converters/legacy';
import { customFontFamilyId } from '../src/core/fonts';
import { PAGE_GAP } from '../src/core/layout';

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
  it('extrae texto, tamaño, color, alineación y tipografía', () => {
    const [p] = parseLegacyText(T2_TEXTO[0].c.ca_txt.g.v);
    expect(p).toEqual({
      text: 'Hola mundo',
      fontSize: 45,
      color: 'rgb(0, 0, 0)',
      align: 'center',
      // El editor legacy la escribe entrecomillada con `&quot;`: si no se
      // decodifica antes de leer el estilo, el `;` de la entidad parte el valor.
      fontFamily: 'Canva Sans Regular',
    });
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
    // Esta capa nombra la fuente pero no guarda su fichero, así que se cae al
    // respaldo y se dice. La familia 2 es "Helvetica" de Excalidraw.
    expect(txt.fontFamily).toBe(2);
    expect(report.notes.some((n) => n.detail.includes('Canva Sans'))).toBe(true);
    expect(legacyToScene(T2_TEXTO).fonts).toEqual([]);
  });

  it('conserva la tipografía cuando la capa SÍ trae el fichero', () => {
    const conFichero = JSON.parse(JSON.stringify(T2_TEXTO));
    conFichero[0].c.ca_txt.g.w = [
      { a: 'Canva Sans Regular', x: 'Canva Sans', y: 'https://fonts.example/canva-sans.ttf' },
    ];
    const out = legacyToScene(conFichero);
    const txt = out.elements.find((e: any) => e.type === 'text') as any;

    expect(txt.fontFamily).toBe(customFontFamilyId('Canva Sans Regular'));
    expect(out.fonts).toEqual([
      {
        family: 'Canva Sans Regular',
        src: 'https://fonts.example/canva-sans.ttf',
        style: undefined,
      },
    ]);
    // Ya no hay pérdida tipográfica que anotar.
    expect(out.report.notes.some((n) => n.detail.includes('Canva Sans'))).toBe(false);
  });

  it('el resolvedor externo rescata una fuente sin fichero en la capa', () => {
    // Es el caso mayoritario en los diseños reales: el editor legacy solo
    // escribía `url` cuando la fuente salía de su lista curada.
    const out = legacyToScene(T2_TEXTO, {
      resolveFontUrl: (nombre) =>
        nombre === 'Canva Sans Regular'
          ? { url: 'https://fonts.gstatic.com/canva.ttf', style: 'italic' }
          : null,
    });
    const txt = out.elements.find((e: any) => e.type === 'text') as any;

    expect(txt.fontFamily).toBe(customFontFamilyId('Canva Sans Regular'));
    expect(out.fonts[0].src).toBe('https://fonts.gstatic.com/canva.ttf');
    expect(out.fonts[0].style).toBe('italic');
  });

  it('el fichero de la capa gana al del resolvedor', () => {
    const conFichero = JSON.parse(JSON.stringify(T2_TEXTO));
    conFichero[0].c.ca_txt.g.w = [
      { a: 'Canva Sans Regular', y: 'https://propia/la-del-diseno.woff2' },
    ];
    const out = legacyToScene(conFichero, {
      resolveFontUrl: () => ({ url: 'https://ajena/otra.woff2' }),
    });
    expect(out.fonts[0].src).toBe('https://propia/la-del-diseno.woff2');
  });

  it('la misma fuente en varias páginas se declara una sola vez', () => {
    const dos = JSON.parse(JSON.stringify(T2_TEXTO));
    dos[0].c.ca_txt.g.w = [{ a: 'Canva Sans Regular', y: 'https://x/f.woff2' }];
    dos.push(JSON.parse(JSON.stringify(dos[0])));
    const out = legacyToScene(dos);
    expect(out.report.pages).toBe(2);
    expect(out.fonts).toHaveLength(1);
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

describe('legacyToScene() — imagen de fondo del RootLayer', () => {
  // En polimake-canvas la foto a sangre NO es una capa: vive en `root.g.p`. En
  // Paella Power son 59 de 64 páginas. Ignorarlo dejaba la página en blanco.
  const CON_FONDO = [
    {
      a: '',
      c: {
        d: {
          e: { f: 'RootLayer' },
          g: {
            h: { i: 1080, j: 1920 },
            k: { x: 0, y: 0 },
            n: 0,
            o: '#fff',
            p: { y: IMG_URL, h: { i: 1080.87, j: 1920 }, k: { l: -0.44, m: 0 }, n: 0 },
          },
          r: false,
          s: [],
          t: null,
        },
      },
    },
  ];

  it('convierte el fondo del root en un elemento imagen', () => {
    const { elements, files } = legacyToScene(CON_FONDO);
    expect(elements.map((e: any) => e.type)).toEqual(['frame', 'rectangle', 'image']);
    const img = elements[2] as any;
    expect(files[img.fileId].dataURL).toBe(IMG_URL);
  });

  it('respeta el desplazamiento del recorte y el tamaño escalado', () => {
    const img = legacyToScene(CON_FONDO).elements[2] as any;
    expect(img.x).toBeCloseTo(-0.44);
    expect(img.width).toBeCloseTo(1080.87);
  });

  it('el fondo va bloqueado y por debajo de las capas', () => {
    const conCapa = JSON.parse(JSON.stringify(CON_FONDO));
    conCapa[0].c.ca_txt = {
      e: { f: 'TextLayer' },
      g: { h: { i: 100, j: 40 }, k: { l: 0, m: 0 }, u: 1, v: '<p style="font-size:20px">x</p>' },
      s: [],
      t: 'ROOT',
    };
    conCapa[0].c.d.s = ['ca_txt'];
    const { elements } = legacyToScene(conCapa);
    // El fondo se pinta ANTES que el texto: si no, taparía la capa.
    expect(elements.map((e: any) => e.type)).toEqual(['frame', 'rectangle', 'image', 'text']);
    expect((elements[2] as any).locked).toBe(true);
  });

  it('descarta un fondo blob: y lo reporta en vez de dejar la página muda', () => {
    const roto = JSON.parse(JSON.stringify(CON_FONDO));
    roto[0].c.d.g.p.y = 'blob:http://localhost/x';
    const { elements, report } = legacyToScene(roto);
    expect(elements.map((e: any) => e.type)).toEqual(['frame', 'rectangle']);
    expect(report.notes.some((n) => n.detail.includes('fondo de página'))).toBe(true);
  });

  it('una página sin fondo ni capas sigue produciendo solo frame + papel', () => {
    const vacia = JSON.parse(JSON.stringify(CON_FONDO));
    vacia[0].c.d.g.p = null;
    expect(legacyToScene(vacia).elements.map((e: any) => e.type)).toEqual(['frame', 'rectangle']);
  });
});

describe('legacyToScene() — multipágina', () => {
  it('coloca las páginas de izquierda a derecha con el mismo carril que el editor', () => {
    const dos = [T1_UNA_PAGINA[0], JSON.parse(JSON.stringify(T1_UNA_PAGINA[0]))];
    const frames = legacyToScene(dos).elements.filter((e: any) => e.type === 'frame') as any[];
    expect(frames).toHaveLength(2);
    expect(frames[0].x).toBe(0);
    expect(frames[1].x).toBe(1080 + PAGE_GAP);
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

  it('una VideoLayer sin póster recuperable se descarta y marca T3', () => {
    const conVideo = JSON.parse(JSON.stringify(T1_UNA_PAGINA));
    conVideo[0].c.ca_video = { e: { f: 'VideoLayer' }, g: {}, s: [], t: 'ROOT' };
    conVideo[0].c.d.s.push('ca_video');
    const { report } = legacyToScene(conVideo);
    expect(report.tier).toBe('T3');
    expect(report.notes.some((n) => n.detail.includes('sin póster'))).toBe(true);
  });

  it('una VideoLayer CON póster se convierte a imagen, no se tira', () => {
    // Fixture COPIADA de un diseño real de Aldea Los Odres, no inventada: el
    // póster de un vídeo vive en `g.ar.as`, NO en `g.p` como el de una imagen.
    // La primera versión de este test usaba una forma inventada con `g.p.aj`,
    // pasaba en verde, y las cuatro páginas de vídeo de producción seguían
    // saliendo en blanco.
    const conVideo = JSON.parse(JSON.stringify(T1_UNA_PAGINA));
    conVideo[0].c.ca_video = {
      e: { f: 'VideoLayer' },
      g: {
        h: { i: 1086, j: 1931 },
        k: { l: -5, m: -12 },
        n: 0,
        ar: {
          y: 'https://light-media.polimake.com/p/videos/v1/preview.mp4',
          as: 'https://light-media.polimake.com/p/videos/v1/thumbnail.webp',
          at: 'https://light-media.polimake.com/p/videos/v1/thumbnail.webp',
          h: { i: 1086, j: 1931 },
          k: { l: 0, m: 0 },
          n: 0,
        },
      },
      r: false,
      s: [],
      t: 'ROOT',
    };
    conVideo[0].c.d.s.push('ca_video');
    const { elements, files, report } = legacyToScene(conVideo);

    const img = elements.filter((e) => e.type === 'image');
    expect(img).toHaveLength(2); // la del diseño + el póster del vídeo
    const video = img[img.length - 1];
    expect(video).toMatchObject({ width: 1086, height: 1931 });
    expect(
      Object.values(files).some((f) => String(f.dataURL).endsWith('thumbnail.webp')),
    ).toBe(true);

    // Sigue siendo una pérdida: la pieza está, la reproducción no.
    expect(report.notes.some((n) => n.kind === 'lossy' && n.detail.includes('póster'))).toBe(true);
    expect(report.clean).toBe(false);
  });

  it('es determinista: dos conversiones de la misma entrada son idénticas', () => {
    expect(JSON.stringify(legacyToScene(T1_UNA_PAGINA).elements)).toBe(
      JSON.stringify(legacyToScene(T1_UNA_PAGINA).elements),
    );
  });
});
