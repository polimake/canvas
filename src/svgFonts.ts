/**
 * Tipografías propias en el export a SVG.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 *
 * Excalidraw no tiene vía pública para registrar una fuente. Su mecanismo real
 * es `Fonts.register`, pero es `private static` y la clase no se exporta del
 * paquete (el índice solo publica `FONT_FAMILY`), así que la única forma de
 * llamarlo sería parchear el bundle minificado en varios sitios.
 *
 * En pantalla y en PNG eso no hace falta: `getFontString()` escribe el NOMBRE de
 * la familia en el contexto del canvas, así que declarar un `@font-face` con ese
 * mismo nombre basta para que el navegador resuelva a nuestro fichero (ver
 * `fontOverrides` en Canvas2Editor).
 *
 * Pero el SVG lo genera Excalidraw embebiendo las fuentes REGISTRADAS, no las
 * sustituidas: un SVG abierto en otro equipo salía con la tipografía de serie.
 * Como el exportador nos devuelve el `<svg>` ya construido, la solución
 * desacoplada es añadir NOSOTROS las declaraciones al final de su hoja de
 * estilos — la última regla con la misma especificidad gana — sin tocar la
 * dependencia y sin depender de una API privada.
 *
 * Con `fetcher`, el fichero se incrusta como data URI y el SVG queda
 * autocontenido: se abre en cualquier equipo sin red y sin acceso al CDN.
 */

export interface SvgFontFace {
  /** Familia tal y como aparece en el SVG (la familia secuestrada). */
  family: string;
  /** URL del fichero (woff2/ttf/otf) o data URI ya resuelto. */
  src: string;
  weight?: string;
  style?: string;
}

/** `format()` correcto según la extensión: sin él algunos visores descartan la fuente. */
function formatHint(src: string): string | null {
  const limpio = src.split('?')[0].toLowerCase();
  if (limpio.endsWith('.woff2')) return 'woff2';
  if (limpio.endsWith('.woff')) return 'woff';
  if (limpio.endsWith('.otf')) return 'opentype';
  if (limpio.endsWith('.ttf')) return 'truetype';
  // Un data URI trae el tipo dentro; dejar `format()` fuera es mejor que mentir.
  return null;
}

/**
 * PURA: construye el CSS de las `@font-face`. Separada de la manipulación del
 * DOM para poder probarla en node, donde no hay `SVGSVGElement`.
 */
export function buildFontFaceCss(faces: readonly SvgFontFace[]): string {
  return faces
    .filter((f) => f.family && f.src)
    .map((f) => {
      const hint = formatHint(f.src);
      const src = hint ? `url("${f.src}") format("${hint}")` : `url("${f.src}")`;
      return (
        `@font-face{font-family:"${f.family}";src:${src};` +
        `font-weight:${f.weight ?? 'normal'};font-style:${f.style ?? 'normal'};}`
      );
    })
    .join('\n');
}

/** Convierte bytes a data URI. Chunked: un spread de 3 MB revienta la pila. */
async function blobToDataUrl(blob: Blob, mime: string): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binario += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binario)}`;
}

function mimeFor(src: string): string {
  switch (formatHint(src)) {
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'opentype':
      return 'font/otf';
    case 'truetype':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Resuelve las fuentes a data URI descargándolas. Una que falle se deja con su
 * URL original: el SVG seguirá viéndose bien donde haya red, que es mejor que
 * abortar el export entero por una tipografía.
 */
export async function inlineFontFaces(
  faces: readonly SvgFontFace[],
  fetcher: (url: string) => Promise<Blob>,
): Promise<{ faces: SvgFontFace[]; failed: string[] }> {
  const failed: string[] = [];
  const resueltas = await Promise.all(
    faces.map(async (f) => {
      if (f.src.startsWith('data:')) return f;
      try {
        return { ...f, src: await blobToDataUrl(await fetcher(f.src), mimeFor(f.src)) };
      } catch {
        failed.push(f.family);
        return f;
      }
    }),
  );
  return { faces: resueltas, failed };
}

/**
 * Añade las declaraciones al `<svg>` ya generado.
 *
 * Van en un `<style>` PROPIO al final de `<defs>`, no dentro del que escribe
 * Excalidraw: así se distinguen de las suyas y una futura versión que cambie su
 * hoja no se lleva las nuestras por delante.
 */
export function appendFontFacesToSvg(svg: SVGSVGElement, css: string): SVGSVGElement {
  if (!css.trim()) return svg;
  const doc = svg.ownerDocument;
  const NS = 'http://www.w3.org/2000/svg';
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = doc.createElementNS(NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  const style = doc.createElementNS(NS, 'style');
  style.setAttribute('data-canvas2-fonts', '');
  style.textContent = css;
  defs.appendChild(style);
  return svg;
}
