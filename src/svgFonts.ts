/**
 * Tipografías propias en el export a SVG.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 *
 * En pantalla y en PNG basta con registrar la familia y declarar su
 * `@font-face`: el canvas resuelve el nombre contra las fuentes del documento
 * (ver `fonts.ts` para el mecanismo completo).
 *
 * Pero el SVG lo genera Excalidraw embebiendo únicamente las fuentes que tiene
 * REGISTRADAS en su `Fonts.registered` — un mapa privado al que no se puede
 * añadir desde fuera. Para una familia nuestra emite el `font-family` correcto
 * en el `<text>` pero ninguna `@font-face`, así que el SVG abierto en otro
 * equipo salía con la tipografía de respaldo.
 *
 * Como el exportador nos devuelve el `<svg>` ya construido, la solución
 * desacoplada es añadir NOSOTROS las declaraciones al final de su hoja de
 * estilos — la última regla con la misma especificidad gana — sin tocar la
 * dependencia y sin depender de una API privada.
 *
 * Con `fetcher`, el fichero se incrusta como data URI y el SVG queda
 * autocontenido: se abre en cualquier equipo sin red y sin acceso al CDN.
 */
import { buildFontFaceCss, fontFormatHint, type CustomFontFace } from './fonts';

/** Misma forma que una tipografía propia: el SVG declara exactamente lo mismo
 *  que la pantalla, y así no pueden divergir. */
export type SvgFontFace = CustomFontFace;

export { buildFontFaceCss };

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
  switch (fontFormatHint(src)) {
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
