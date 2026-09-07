import { describe, expect, it } from 'vitest';
import {
  flattenBezierPath,
  groupStyleRuns,
  listImagePlaceholders,
  postScriptStyleToCss,
  psdColorToHex,
  psdToScene,
  splitPostScriptFont,
  PSD_IMAGE_MARKER,
  type PsdDocument,
  type PsdLayer,
} from '../src/psd';
import { PAGE_GAP } from '../src/layout';

/**
 * El convertidor de PSD se testea con documentos a mano —no con ficheros— a
 * propósito: `src/psd.ts` recibe la forma ESTRUCTURAL de un PSD ya parseado, así
 * que aquí se puede escribir el caso exacto que se quiere comprobar (una capa
 * con máscara, un texto con dos estilos) sin fabricar un .psd para cada uno.
 */

type El = Record<string, unknown>;
const els = (scene: { elements: unknown[] }) => scene.elements as unknown as El[];
const byType = (scene: { elements: unknown[] }, type: string) =>
  els(scene).filter((e) => e.type === type);

function doc(children: PsdLayer[], extra: Partial<PsdDocument> = {}): PsdDocument {
  return { width: 1000, height: 800, children, ...extra };
}

const raster = (over: Partial<PsdLayer> = {}): PsdLayer => ({
  name: 'foto',
  left: 100,
  top: 50,
  right: 500,
  bottom: 350,
  imageData: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
  ...over,
});

describe('psdColorToHex', () => {
  it('lee RGB en 0..255', () => {
    expect(psdColorToHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
  });

  it('lee FRGB en 0..1 sin confundirlo con RGB', () => {
    expect(psdColorToHex({ fr: 1, fg: 0, fb: 0.5 })).toBe('#ff0080');
  });

  it('lee CMYK invertido de Photoshop', () => {
    // 0 de las cuatro tintas = blanco en la convención de Photoshop.
    expect(psdColorToHex({ c: 0, m: 0, y: 0, k: 0 })).toBe('#ffffff');
    expect(psdColorToHex({ c: 100, m: 100, y: 100, k: 100 })).toBe('#000000');
  });

  it('no confunde el k de CMYK con el de escala de grises', () => {
    expect(psdColorToHex({ k: 100 })).toBe('#ffffff');
    expect(psdColorToHex({ k: 0 })).toBe('#000000');
  });

  it('devuelve null si no reconoce el espacio', () => {
    expect(psdColorToHex(undefined)).toBeNull();
    expect(psdColorToHex({})).toBeNull();
  });
});

describe('splitPostScriptFont', () => {
  it('separa familia y estilo del nombre PostScript', () => {
    expect(splitPostScriptFont('Montserrat-BoldItalic')).toEqual({
      family: 'Montserrat',
      style: 'BoldItalic',
    });
  });

  it('desune los nombres pegados para que casen con un brand kit', () => {
    expect(splitPostScriptFont('HelveticaNeue-Bold').family).toBe('Helvetica Neue');
  });

  it('deja pasar un nombre sin estilo', () => {
    expect(splitPostScriptFont('Roboto')).toEqual({ family: 'Roboto', style: undefined });
  });
});

describe('flattenBezierPath', () => {
  it('emite un solo punto por tramo recto', () => {
    // Nudos con los controles pegados a sus anclas = polígono recto.
    const cuadrado = flattenBezierPath({
      open: false,
      knots: [
        { points: [0, 0, 0, 0, 0, 0] },
        { points: [10, 0, 10, 0, 10, 0] },
        { points: [10, 10, 10, 10, 10, 10] },
      ],
    });
    // 3 anclas + el tramo de cierre, sin muestreo intermedio.
    expect(cuadrado).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ]);
  });

  it('muestrea las curvas de verdad', () => {
    const curva = flattenBezierPath({
      open: true,
      knots: [
        { points: [0, 0, 0, 0, 5, 10] },
        { points: [15, 10, 20, 0, 20, 0] },
      ],
    });
    expect(curva.length).toBeGreaterThan(2);
    expect(curva[0]).toEqual([0, 0]);
    expect(curva[curva.length - 1]).toEqual([20, 0]);
    // La curva se sale de la recta que une los extremos.
    expect(Math.max(...curva.map((p) => p[1]))).toBeGreaterThan(0);
  });

  it('ignora un camino sin nudos utilizables', () => {
    expect(flattenBezierPath({ knots: [] })).toEqual([]);
  });
});

describe('groupStyleRuns', () => {
  it('funde tramos con el mismo estilo en uno solo', () => {
    const grupos = groupStyleRuns('HolaMundo', {
      style: { fontSize: 20 },
      styleRuns: [
        { length: 4, style: { fontSize: 20 } },
        { length: 5, style: { fontSize: 20 } },
      ],
    });
    expect(grupos).toHaveLength(1);
    expect(grupos[0].text).toBe('HolaMundo');
  });

  it('separa cuando el estilo cambia de verdad', () => {
    const grupos = groupStyleRuns('HolaMundo', {
      style: { fontSize: 20 },
      styleRuns: [
        { length: 4, style: { fontSize: 20 } },
        { length: 5, style: { fontSize: 48 } },
      ],
    });
    expect(grupos.map((g) => g.text)).toEqual(['Hola', 'Mundo']);
    expect(grupos[1].style.fontSize).toBe(48);
  });

  it('no pierde la cola cuando los tramos no suman el texto entero', () => {
    const grupos = groupStyleRuns('HolaMundo', {
      style: { fontSize: 20 },
      styleRuns: [{ length: 4, style: { fontSize: 48 } }],
    });
    expect(grupos.map((g) => g.text).join('')).toBe('HolaMundo');
  });
});

describe('psdToScene — páginas', () => {
  it('sin mesas de trabajo, el documento es una sola página', () => {
    const scene = psdToScene(doc([raster()]), { documentName: 'cartel' });
    const frames = byType(scene, 'frame');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ x: 0, y: 0, width: 1000, height: 800, name: 'cartel' });
    expect(scene.report.pages).toBe(1);
  });

  it('pone un papel bloqueado con el marcador que espera background.ts', () => {
    const scene = psdToScene(doc([]));
    const papel = els(scene).find(
      (e) => (e.customData as { c2?: string } | undefined)?.c2 === 'pageBackground',
    );
    expect(papel).toMatchObject({ type: 'rectangle', locked: true, backgroundColor: '#ffffff' });
  });

  it('convierte cada mesa de trabajo en una página, en fila y con PAGE_GAP', () => {
    const mesa = (name: string, left: number, right: number): PsdLayer => ({
      name,
      artboard: { rect: { left, top: 0, right, bottom: 600 } },
      children: [],
    });
    const scene = psdToScene(doc([mesa('A', 0, 400), mesa('B', 500, 900)]));
    const frames = byType(scene, 'frame');
    expect(frames.map((f) => f.name)).toEqual(['A', 'B']);
    expect(frames[0]).toMatchObject({ x: 0, width: 400 });
    // La segunda mesa arranca donde acaba la primera + la separación del editor,
    // NO en su coordenada original del documento.
    expect(frames[1]).toMatchObject({ x: 400 + PAGE_GAP, width: 400 });
    expect(scene.report.pages).toBe(2);
  });

  it('traslada las capas de una mesa al origen de su página', () => {
    const scene = psdToScene(
      doc([
        {
          name: 'Mesa 2',
          artboard: { rect: { left: 500, top: 100, right: 900, bottom: 700 } },
          children: [raster({ left: 550, top: 150, right: 650, bottom: 250 })],
        },
      ]),
    );
    const hueco = els(scene).find(
      (e) => (e.customData as { c2?: string } | undefined)?.c2 === PSD_IMAGE_MARKER,
    );
    // 550-500 = 50 dentro de la mesa; la mesa está en x=0 porque es la primera.
    expect(hueco).toMatchObject({ x: 50, y: 50, width: 100, height: 100 });
  });

  it('manda a una página aparte las capas que no están en ninguna mesa', () => {
    const scene = psdToScene(
      doc([
        { name: 'suelta', ...raster() },
        { name: 'Mesa', artboard: { rect: { left: 0, top: 0, right: 400, bottom: 400 } }, children: [] },
      ]),
    );
    expect(byType(scene, 'frame').map((f) => f.name)).toEqual(['Mesa', 'Fuera de mesa']);
  });
});

describe('psdToScene — capas de píxeles', () => {
  it('deja un hueco con la geometría exacta y su proporción anotada', () => {
    const scene = psdToScene(doc([raster()]));
    const [slot] = scene.assets;
    expect(slot).toMatchObject({ name: 'foto', naturalWidth: 400, naturalHeight: 300 });
    const hueco = els(scene).find((e) => e.id === slot.id)!;
    expect(hueco).toMatchObject({ x: 100, y: 50, width: 400, height: 300 });
    expect(hueco.customData).toMatchObject({
      c2: PSD_IMAGE_MARKER,
      psd: { layer: 'foto', naturalWidth: 400, naturalHeight: 300 },
    });
  });

  it('NUNCA mete bytes de imagen en la escena', () => {
    const scene = psdToScene(doc([raster()]));
    expect(scene.files).toEqual({});
    expect(JSON.stringify(scene.elements)).not.toContain('data:');
    expect(byType(scene, 'image')).toHaveLength(0);
  });

  it('agrupa el hueco con su etiqueta para que se muevan juntos', () => {
    const scene = psdToScene(doc([raster()]));
    const hueco = els(scene).find((e) => e.id === scene.assets[0].id)!;
    const etiqueta = els(scene).find(
      (e) => e.type === 'text' && String(e.text).startsWith('foto'),
    )!;
    expect((hueco.groupIds as string[])[0]).toBe((etiqueta.groupIds as string[])[0]);
    expect(etiqueta.text).toBe('foto\n400×300');
  });

  it('recorta el hueco a la máscara de capa y lo anota', () => {
    const scene = psdToScene(
      doc([raster({ mask: { left: 200, top: 100, right: 400, bottom: 200 } })]),
    );
    const hueco = els(scene).find((e) => e.id === scene.assets[0].id)!;
    expect(hueco).toMatchObject({ x: 200, y: 100, width: 200, height: 100 });
    expect(scene.report.notes.some((n) => n.detail.includes('máscara de capa'))).toBe(true);
  });

  it('escala geometría y proporción de forma coherente', () => {
    const scene = psdToScene(doc([raster()]), { scale: 0.5 });
    const hueco = els(scene).find((e) => e.id === scene.assets[0].id)!;
    expect(hueco).toMatchObject({ x: 50, y: 25, width: 200, height: 150 });
    // El tamaño NATURAL no se escala: es el del PNG que hay que subir.
    expect(scene.assets[0]).toMatchObject({ naturalWidth: 400, naturalHeight: 300 });
    expect((hueco.width as number) / (hueco.height as number)).toBeCloseTo(400 / 300, 6);
  });

  it('da un nombre de fichero único a dos capas que se llaman igual', () => {
    const scene = psdToScene(doc([raster(), raster()]), { documentName: 'cartel' });
    const nombres = scene.assets.map((a) => a.filename);
    expect(new Set(nombres).size).toBe(2);
    expect(nombres[0]).toMatch(/^cartel-p1-foto\.png$/);
  });

  it('la dirección del asset resuelve desde psd.children, también con mesas', () => {
    const d = doc([
      { name: 'suelta', ...raster() },
      {
        name: 'Mesa',
        artboard: { rect: { left: 0, top: 0, right: 400, bottom: 400 } },
        children: [{ name: 'grupo', children: [raster({ name: 'dentro' })] }],
      },
    ]);
    const scene = psdToScene(d);
    const resolver = (address: number[]): PsdLayer | null => {
      let lista: PsdLayer[] | undefined = d.children;
      let layer: PsdLayer | null = null;
      for (const i of address) {
        if (!lista?.[i]) return null;
        layer = lista[i];
        lista = layer.children;
      }
      return layer;
    };
    for (const slot of scene.assets) {
      expect(resolver(slot.address)?.name).toBe(slot.name);
    }
  });
});

describe('psdToScene — texto', () => {
  const texto = (over: Partial<PsdLayer> = {}): PsdLayer => ({
    name: 'titular',
    left: 0,
    top: 0,
    right: 300,
    bottom: 60,
    text: {
      text: 'Hola',
      transform: [1, 0, 0, 1, 40, 20],
      boxBounds: [0, 0, 300, 60],
      style: { fontSize: 48, fillColor: { r: 255, g: 0, b: 0 } },
      paragraphStyle: { justification: 'center' },
    },
    ...over,
  });

  it('coloca el texto por su caja de motor, no por el bbox rasterizado', () => {
    const scene = psdToScene(doc([texto()]));
    const t = byType(scene, 'text')[0];
    expect(t).toMatchObject({
      x: 40,
      y: 20,
      width: 300,
      text: 'Hola',
      fontSize: 48,
      textAlign: 'center',
      strokeColor: '#ff0000',
      autoResize: false,
    });
  });

  it('multiplica el tamaño por la escala de la matriz de transformación', () => {
    const l = texto();
    l.text!.transform = [2, 0, 0, 2, 0, 0];
    const t = byType(psdToScene(doc([l])), 'text')[0];
    expect(t.fontSize).toBe(96);
  });

  it('normaliza los saltos de línea de Photoshop', () => {
    const l = texto();
    l.text!.text = 'uno\rdos';
    const t = byType(psdToScene(doc([l])), 'text')[0];
    expect(t.text).toBe('uno\ndos');
  });

  it('parte una capa de estilos mixtos y lo anota', () => {
    const l = texto();
    l.text!.text = 'HolaMundo';
    l.text!.styleRuns = [
      { length: 4, style: { fontSize: 48 } },
      { length: 5, style: { fontSize: 20 } },
    ];
    const scene = psdToScene(doc([l]));
    const ts = byType(scene, 'text');
    expect(ts.map((t) => t.text)).toEqual(['Hola', 'Mundo']);
    // El segundo bloque arranca justo debajo del primero.
    expect(ts[1].y as number).toBeGreaterThan(ts[0].y as number);
    expect(scene.report.notes.some((n) => n.detail.includes('estilos mixtos'))).toBe(true);
  });

  it('registra la tipografía cuando se le da el fichero', () => {
    const l = texto();
    l.text!.style!.font = { name: 'Montserrat-Bold' };
    const scene = psdToScene(doc([l]), {
      resolveFontUrl: (name) =>
        name === 'Montserrat' ? { url: 'https://x/mont.woff2' } : null,
    });
    // El peso va en `weight`, NO en `style`: `buildFontFaceCss` vuelca `style`
    // en `font-style`, donde "Bold" no es un valor válido de CSS.
    expect(scene.fonts).toEqual([
      { family: 'Montserrat', src: 'https://x/mont.woff2', weight: '700', style: undefined },
    ]);
    expect(byType(scene, 'text')[0].fontFamily).not.toBe(2);
    expect(scene.report.fonts).toEqual([{ name: 'Montserrat', resolved: true }]);
  });

  it('traduce el sufijo PostScript a peso e inclinación de CSS', () => {
    expect(postScriptStyleToCss('BoldItalic')).toEqual({ weight: '700', style: 'italic' });
    expect(postScriptStyleToCss('SemiBold')).toEqual({ weight: '600', style: undefined });
    expect(postScriptStyleToCss('Black')).toEqual({ weight: '900', style: undefined });
    expect(postScriptStyleToCss('Italic')).toEqual({ weight: undefined, style: 'italic' });
    expect(postScriptStyleToCss('Regular')).toEqual({ weight: undefined, style: undefined });
    expect(postScriptStyleToCss(undefined)).toEqual({});
  });

  it('cae a la familia de respaldo y lo DICE cuando no hay fichero', () => {
    const l = texto();
    l.text!.style!.font = { name: 'Montserrat-Bold' };
    const scene = psdToScene(doc([l]));
    expect(byType(scene, 'text')[0].fontFamily).toBe(2);
    expect(scene.report.fonts).toEqual([{ name: 'Montserrat', resolved: false }]);
    expect(scene.report.notes.some((n) => n.detail.includes('sin fichero para la fuente'))).toBe(
      true,
    );
  });

  it('descarta una capa de texto vacía sin romper la conversión', () => {
    const l = texto();
    l.text!.text = '   ';
    const scene = psdToScene(doc([l]));
    expect(byType(scene, 'text')).toHaveLength(0);
    expect(scene.report.layers.dropped).toBe(1);
  });
});

describe('psdToScene — formas', () => {
  const forma = (keyOriginType: number, over: Partial<PsdLayer> = {}): PsdLayer => ({
    name: 'caja',
    left: 10,
    top: 20,
    right: 110,
    bottom: 70,
    vectorFill: { type: 'color', color: { r: 0, g: 128, b: 255 } },
    vectorOrigination: {
      keyDescriptorList: [
        {
          keyOriginType,
          keyOriginShapeBoundingBox: {
            left: { units: 'Pixels', value: 10 },
            top: { units: 'Pixels', value: 20 },
            right: { units: 'Pixels', value: 110 },
            bottom: { units: 'Pixels', value: 70 },
          },
        },
      ],
    },
    ...over,
  });

  it('rectángulo con su color y sin borde inventado', () => {
    const r = byType(psdToScene(doc([forma(1)])), 'rectangle').find((e) => e.width === 100)!;
    expect(r).toMatchObject({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      backgroundColor: '#0080ff',
      strokeColor: 'transparent',
      roundness: null,
    });
  });

  it('elipse cuando el descriptor lo dice', () => {
    expect(byType(psdToScene(doc([forma(4)])), 'ellipse')).toHaveLength(1);
  });

  it('rectángulo redondeado conserva el radio', () => {
    const l = forma(2);
    l.vectorOrigination!.keyDescriptorList![0].keyOriginRRectRadii = {
      topLeft: { units: 'Pixels', value: 12 },
      topRight: { units: 'Pixels', value: 12 },
      bottomLeft: { units: 'Pixels', value: 12 },
      bottomRight: { units: 'Pixels', value: 12 },
    };
    const r = byType(psdToScene(doc([l])), 'rectangle').find((e) => e.width === 100)!;
    expect(r.roundness).toEqual({ type: 2, value: 12 });
  });

  it('aplana un camino libre a una línea CERRADA para que se rellene', () => {
    const l: PsdLayer = {
      name: 'logo',
      left: 0,
      top: 0,
      right: 20,
      bottom: 20,
      vectorFill: { type: 'color', color: { r: 0, g: 0, b: 0 } },
      vectorMask: {
        paths: [
          {
            open: false,
            knots: [
              { points: [0, 0, 0, 0, 0, 0] },
              { points: [20, 0, 20, 0, 20, 0] },
              { points: [20, 20, 20, 20, 20, 20] },
            ],
          },
        ],
      },
    };
    const linea = byType(psdToScene(doc([l])), 'line')[0];
    const pts = linea.points as Array<[number, number]>;
    expect(pts[0]).toEqual(pts[pts.length - 1]);
    expect(linea.backgroundColor).toBe('#000000');
  });

  it('NO avisa de efectos que Photoshop guardó apagados', () => {
    // Photoshop escribe los ocho efectos en cuanto se abre el diálogo de estilo.
    // Contarlos por su mera presencia llenaba de avisos falsos capas que no
    // tienen ningún efecto, y eso tapa los avisos que sí importan.
    const l = forma(1, {
      effects: {
        dropShadow: [{ enabled: false, present: false }],
        innerShadow: [{ enabled: true, present: false }],
        bevel: { enabled: false, present: true },
        satin: { present: false },
      },
    });
    const scene = psdToScene(doc([l]));
    expect(scene.report.notes.filter((n) => n.detail.includes('efectos'))).toEqual([]);
  });

  it('sí avisa del efecto que está puesto de verdad', () => {
    const l = forma(1, { effects: { dropShadow: [{ enabled: true, present: true }] } });
    const scene = psdToScene(doc([l]));
    expect(scene.report.notes.some((n) => n.detail.includes('sombra paralela'))).toBe(true);
  });

  it('la superposición de color apagada no pisa el relleno vectorial', () => {
    const l = forma(1, {
      effects: { solidFill: [{ enabled: false, present: false, color: { r: 255, g: 0, b: 0 } }] },
    });
    const r = byType(psdToScene(doc([l])), 'rectangle').find((e) => e.width === 100)!;
    expect(r.backgroundColor).toBe('#0080ff');
  });

  it('una capa con demasiados subcaminos se trata como imagen', () => {
    // Una textura de pincel real trae ~900 subcaminos y, vectorizada, produce
    // megabytes de polilíneas que el editor no puede mover. Como Photoshop
    // guarda además su versión rasterizada, se representa como imagen.
    const camino = {
      open: false,
      knots: [
        { points: [0, 0, 0, 0, 0, 0] },
        { points: [5, 0, 5, 0, 5, 0] },
        { points: [5, 5, 5, 5, 5, 5] },
      ],
    };
    const l: PsdLayer = {
      name: 'pincel',
      left: 0,
      top: 0,
      right: 100,
      bottom: 40,
      vectorFill: { type: 'color', color: { r: 0, g: 0, b: 0 } },
      vectorMask: { paths: Array.from({ length: 200 }, () => camino) },
      imageData: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
    };
    const scene = psdToScene(doc([l]), { maxSubpaths: 64 });
    expect(byType(scene, 'line')).toHaveLength(0);
    expect(scene.assets.map((a) => a.name)).toEqual(['pincel']);
    expect(scene.report.notes.some((n) => n.detail.includes('200 subcaminos'))).toBe(true);
  });

  it('respeta el tope y vectoriza lo que cabe por debajo', () => {
    const camino = {
      open: false,
      knots: [
        { points: [0, 0, 0, 0, 0, 0] },
        { points: [5, 0, 5, 0, 5, 0] },
        { points: [5, 5, 5, 5, 5, 5] },
      ],
    };
    const l: PsdLayer = {
      name: 'logo',
      left: 0,
      top: 0,
      right: 100,
      bottom: 40,
      vectorFill: { type: 'color', color: { r: 0, g: 0, b: 0 } },
      vectorMask: { paths: [camino, camino, camino] },
      imageData: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
    };
    const scene = psdToScene(doc([l]), { maxSubpaths: 64 });
    expect(byType(scene, 'line')).toHaveLength(3);
    expect(scene.assets).toEqual([]);
  });

  it('sin píxeles rasterizados NO se rinde: sigue vectorizando', () => {
    // El respaldo solo existe porque Photoshop guarda la capa ya pintada. Sin
    // píxeles, convertirla en un hueco gris borraría el dibujo.
    const camino = {
      open: false,
      knots: [
        { points: [0, 0, 0, 0, 0, 0] },
        { points: [5, 0, 5, 0, 5, 0] },
        { points: [5, 5, 5, 5, 5, 5] },
      ],
    };
    const l: PsdLayer = {
      name: 'sin-pixeles',
      left: 0,
      top: 0,
      right: 100,
      bottom: 40,
      vectorFill: { type: 'color', color: { r: 0, g: 0, b: 0 } },
      vectorMask: { paths: Array.from({ length: 200 }, () => camino) },
    };
    const scene = psdToScene(doc([l]), { maxSubpaths: 64 });
    expect(byType(scene, 'line')).toHaveLength(200);
    expect(scene.assets).toEqual([]);
  });

  it('un degradado se aproxima a su primera parada y se anota', () => {
    const l = forma(1, {
      vectorFill: {
        type: 'gradient',
        gradient: { colorStops: [{ color: { r: 255, g: 0, b: 0 } }, { color: { r: 0, g: 0, b: 255 } }] },
      },
    });
    const scene = psdToScene(doc([l]));
    const r = byType(scene, 'rectangle').find((e) => e.width === 100)!;
    expect(r.backgroundColor).toBe('#ff0000');
    expect(scene.report.notes.some((n) => n.detail.includes('relleno no plano'))).toBe(true);
  });
});

describe('psdToScene — grupos, visibilidad e informe', () => {
  it('un grupo de Photoshop es un grupo de Excalidraw', () => {
    const scene = psdToScene(
      doc([{ name: 'g', children: [raster({ name: 'a' }), raster({ name: 'b' })] }]),
    );
    const huecos = els(scene).filter(
      (e) => (e.customData as { c2?: string } | undefined)?.c2 === PSD_IMAGE_MARKER,
    );
    // Cada hueco lleva su propio grupo (con la etiqueta) y, detrás, el del PSD.
    const delPsd = huecos.map((h) => (h.groupIds as string[])[1]);
    expect(delPsd[0]).toBe(delPsd[1]);
    expect(delPsd[0]).toBeTruthy();
  });

  it('omite las capas ocultas por defecto pero las cuenta', () => {
    const scene = psdToScene(doc([raster({ hidden: true }), raster({ name: 'visible' })]));
    expect(scene.assets.map((a) => a.name)).toEqual(['visible']);
    expect(scene.report.layers.hidden).toBe(1);
  });

  it('las incluye con includeHidden', () => {
    const scene = psdToScene(doc([raster({ hidden: true })]), { includeHidden: true });
    expect(scene.assets).toHaveLength(1);
  });

  it('traduce la opacidad de 0..1 a 0..100', () => {
    const scene = psdToScene(doc([raster({ opacity: 0.5 })]));
    const hueco = els(scene).find((e) => e.id === scene.assets[0].id)!;
    expect(hueco.opacity).toBe(50);
  });

  it('baja la opacidad del grupo a sus hijos, acumulándola', () => {
    const scene = psdToScene(
      doc([
        {
          name: 'externo',
          opacity: 0.5,
          children: [
            { name: 'interno', opacity: 0.5, children: [raster({ opacity: 0.5 })] },
          ],
        },
      ]),
    );
    const hueco = els(scene).find((e) => e.id === scene.assets[0].id)!;
    expect(hueco.opacity).toBe(13); // 0.5 · 0.5 · 0.5 = 12,5 %
    expect(scene.report.notes.filter((n) => n.detail.includes('opacidad de grupo'))).toHaveLength(2);
  });

  it('anota el modo de fusión que no se puede reproducir', () => {
    const scene = psdToScene(doc([raster({ blendMode: 'multiply' })]));
    expect(scene.report.notes.some((n) => n.detail.includes('multiply'))).toBe(true);
  });

  it('marca T3 y descarta una capa de ajuste, sin silenciarla', () => {
    const scene = psdToScene(doc([{ name: 'curvas', adjustment: { type: 'curves' } }]));
    expect(scene.report.tier).toBe('T3');
    expect(scene.report.notes[0]).toMatchObject({ kind: 'dropped', layer: 'curvas' });
  });

  it('T2 cuando hay texto y nada se perdió por el camino', () => {
    const scene = psdToScene(
      doc([
        {
          name: 't',
          left: 0,
          top: 0,
          right: 10,
          bottom: 10,
          text: { text: 'x', transform: [1, 0, 0, 1, 0, 0], boxBounds: [0, 0, 10, 10], style: {} },
        },
      ]),
    );
    expect(scene.report.tier).toBe('T2');
    expect(scene.report.clean).toBe(true);
  });

  it('cuadra el recuento de capas: nada desaparece sin contarse', () => {
    const scene = psdToScene(
      doc([
        raster(),
        raster({ hidden: true }),
        { name: 'vacía' },
        { name: 'g', children: [raster({ name: 'c' })] },
      ]),
    );
    const { total, converted, hidden, dropped } = scene.report.layers;
    expect(total).toBe(5); // 4 de primer nivel + 1 dentro del grupo
    expect(hidden).toBe(1);
    expect(dropped).toBe(1); // la vacía
    // El grupo cuenta como convertido porque su hijo produjo algo.
    expect(converted).toBe(3);
    expect(converted + hidden + dropped).toBe(total);
  });

  it('cuenta CAPAS, no elementos: una capa que da varios sigue siendo una', () => {
    const l: PsdLayer = {
      name: 'multi',
      left: 0,
      top: 0,
      right: 10,
      bottom: 10,
      text: {
        text: 'HolaMundo',
        transform: [1, 0, 0, 1, 0, 0],
        boxBounds: [0, 0, 10, 10],
        style: { fontSize: 20 },
        styleRuns: [
          { length: 4, style: { fontSize: 20 } },
          { length: 5, style: { fontSize: 48 } },
        ],
      },
    };
    const scene = psdToScene(doc([l]));
    expect(byType(scene, 'text')).toHaveLength(2);
    expect(scene.report.layers.converted).toBe(1);
    // Solo el contenido: el marco y el papel de la página no cuentan.
    expect(scene.report.elements).toBe(2);
  });

  it('es determinista: dos conversiones de la misma entrada son idénticas', () => {
    const d = doc([raster(), { name: 'g', children: [raster({ name: 'x' })] }]);
    expect(JSON.stringify(psdToScene(d))).toBe(JSON.stringify(psdToScene(d)));
  });

  it('dos documentos distintos NO comparten ni un id', () => {
    // Sin esto, el marco de todos los diseños de un pack salía con el mismo id
    // y juntar dos páginas en una escena rompía `frameId` y `groupIds`.
    const d = doc([raster(), { name: 'g', children: [raster({ name: 'x' })] }]);
    const a = psdToScene(d, { documentName: 'cartel-a' });
    const b = psdToScene(d, { documentName: 'cartel-b' });
    const idsA = new Set(a.elements.map((e) => (e as unknown as { id: string }).id));
    const compartidos = b.elements.filter((e) =>
      idsA.has((e as unknown as { id: string }).id),
    );
    expect(compartidos).toEqual([]);
    // Y sigue siendo reproducible con el MISMO nombre.
    expect(JSON.stringify(psdToScene(d, { documentName: 'cartel-a' }))).toBe(JSON.stringify(a));
  });
});

describe('listImagePlaceholders', () => {
  it('encuentra los huecos con la geometría lista para el intercambio', () => {
    const scene = psdToScene(doc([raster()]), { scale: 0.5 });
    const huecos = listImagePlaceholders(scene.elements);
    expect(huecos).toHaveLength(1);
    expect(huecos[0]).toMatchObject({
      layer: 'foto',
      x: 50,
      y: 25,
      width: 200,
      height: 150,
      naturalWidth: 400,
      naturalHeight: 300,
    });
    expect(huecos[0].asset).toBe(scene.assets[0].filename);
  });

  it('ignora todo lo que no sea un hueco', () => {
    const scene = psdToScene(doc([]));
    expect(listImagePlaceholders(scene.elements)).toEqual([]);
  });
});
