'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CaptureUpdateAction, type ExcalidrawImperativeAPI, type SceneElement } from '../core/excal';
import { commitElements, patchElement } from '../core/mutate';
import { insertImageFromUrl } from '../core/media';
import { PANEL_FONT, palette } from './theme';
import { resolveBrandKit, type BrandKitInput } from '../core/brand';
import { mergeLabels, type PartialLabels } from './labels';

/**
 * Galería de marca: colores y logos del cliente, a un clic, abajo a la derecha
 * del lienzo.
 *
 * Vive aquí y no en el panel de propiedades de Excalidraw por dos motivos. Uno
 * técnico: el selector de color no es sustituible desde props (`UIOptions` solo
 * expone `canvasActions` y `tools`) y ese subárbol lo gobierna React de la
 * dependencia, que borraría lo que le inyectáramos en el siguiente render. Y
 * uno de fondo: el panel de propiedades solo existe con algo seleccionado,
 * mientras que insertar un logo CREA un elemento — no es una propiedad de nada.
 *
 * Reparto de responsabilidades del color: el trazo va a textos y líneas, el
 * relleno a figuras cerradas. Es una regla por TIPO de elemento y no un
 * modificador de teclado porque tiene que poder explicarse en una frase.
 */

/** Figuras cerradas: aquí el color de marca se entiende como relleno. */
const RELLENABLES = new Set(['rectangle', 'ellipse', 'diamond']);

export interface BrandGalleryProps {
  api: ExcalidrawImperativeAPI | null;
  /** `projects.brandKit` crudo; se traduce aquí (ver la prop homónima de Canvas2Editor). */
  brandKit?: BrandKitInput | null;
  theme?: 'light' | 'dark';
  /** Página activa: los logos se insertan dentro de ella. */
  activePageId?: string | null;
  /** En modo lectura la galería no se muestra: todo lo que hace es mutar. */
  viewMode?: boolean;
  /** Dentro de una pestaña del dock: sin flotar, sin marco ni cabecera propia. */
  embedded?: boolean;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

export function BrandGallery({
  api,
  brandKit,
  theme = 'light',
  activePageId,
  viewMode,
  embedded = false,
  labels: labelsProp,
}: BrandGalleryProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const brand = useMemo(() => resolveBrandKit(brandKit), [brandKit]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(true);

  // Saber si hay selección decide entre "pinta lo seleccionado" y "deja esto
  // como color por defecto", y hay que reflejarlo en el texto de ayuda.
  useEffect(() => {
    if (!api) return;
    return api.onChange(() => {
      const state = api.getAppState();
      const ids = Object.keys(state.selectedElementIds ?? {}).filter(
        (id) => state.selectedElementIds[id],
      );
      setSeleccion((prev) =>
        prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids,
      );
    });
  }, [api]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 1800);
    return () => clearTimeout(t);
  }, [aviso]);

  const aplicarColor = useCallback(
    (color: string) => {
      if (!api) return;
      const ids = new Set(seleccion);
      if (!ids.size) {
        // Sin selección, el clic define el color de lo siguiente que se dibuje.
        // Se tocan los dos porque el usuario no sabe (ni debe saber) si lo
        // próximo será un texto o un rectángulo.
        api.updateScene({
          appState: { currentItemStrokeColor: color, currentItemBackgroundColor: color },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
        setAviso(L.brand.defaultColor);
        return;
      }
      const elements = api.getSceneElements();
      const siguiente = elements.map((el: SceneElement) =>
        ids.has(el.id)
          ? patchElement(
              el,
              (RELLENABLES.has(el.type)
                ? { backgroundColor: color }
                : { strokeColor: color }) as Partial<SceneElement>,
            )
          : el,
      );
      commitElements(api, siguiente, 'undoable');
      setAviso(L.brand.applied(ids.size));
    },
    [api, seleccion],
  );

  const insertarLogo = useCallback(
    async (url: string) => {
      if (!api) return;
      try {
        // Reutiliza el insertador de media: la imagen entra por REFERENCIA
        // remota, nunca como base64, que es la regla de todo el paquete.
        await insertImageFromUrl(api, url, { pageId: activePageId ?? undefined });
        setAviso(L.brand.logoInserted);
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'no se pudo insertar');
      }
    },
    [api, activePageId],
  );

  const logos = [
    { url: brand.logos.small, label: L.brand.logo },
    { url: brand.logos.black, label: L.brand.black },
    { url: brand.logos.white, label: L.brand.white },
  ].filter((l): l is { url: string; label: string } => Boolean(l.url));

  // Sin colores ni logos no hay galería: un panel vacío solo ocupa lienzo.
  if (viewMode || !api || (!brand.palette.length && !logos.length)) return null;

  return (
    <div
      data-testid="canvas2-brand-gallery"
      style={{
        // Empotrada en el dock no flota ni trae marco: eso lo pone el dock.
        ...(embedded
          ? { position: 'relative', width: '100%', overflowY: 'auto' }
          : {
              position: 'absolute' as const,
              right: 12,
              bottom: 16,
              zIndex: 95,
              width: abierta ? 168 : 'auto',
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            }),
        padding: 6,
        background: embedded ? 'transparent' : c.bg,
        color: c.fg,
        font: `12px ${PANEL_FONT}`,
      }}
    >
      {!embedded && (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          title={abierta ? L.dock.collapse : L.brand.title}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: '2px 4px',
            color: c.sub,
            fontWeight: 600,
          }}
        >
          {L.brand.title}
          {/* El aviso vive en la cabecera para que siga visible con la galería
              contraída: si no, la confirmación se perdería justo al plegarla. */}
          <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.9 }}>
            {aviso ?? (abierta ? '▾' : '▸')}
          </span>
        </button>
      )}
      {embedded && aviso && (
        <div style={{ padding: '2px 4px', color: c.sub }}>{aviso}</div>
      )}

      {(embedded || abierta) && (
        <>
          {brand.palette.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 4px 2px' }}>
              {brand.palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => aplicarColor(color)}
                  title={
                    seleccion.length ? L.brand.applyToSelection(color) : `${color} · ${L.brand.defaultColor}`
                  }
                  aria-label={color}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: color,
                    border: `1px solid ${c.border}`,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}

          {logos.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                padding: '4px 4px 2px',
              }}
            >
              {logos.map((logo) => (
                <button
                  key={logo.url}
                  type="button"
                  onClick={() => void insertarLogo(logo.url)}
                  title={L.brand.insertLogo(logo.label)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    padding: 3,
                    borderRadius: 6,
                    border: `1px solid ${c.border}`,
                  }}
                >
                  <span
                    style={{
                      width: '100%',
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      // Tablero de ajedrez: sin él un logo blanco sobre panel
                      // blanco parece un hueco vacío.
                      backgroundImage:
                        'linear-gradient(45deg,rgba(128,128,128,.25) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.25) 75%),linear-gradient(45deg,rgba(128,128,128,.25) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.25) 75%)',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px',
                      borderRadius: 4,
                    }}
                  >
                    <img
                      src={logo.url}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      // Un logo roto no debe dejar el icono de imagen rota.
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 10, color: c.sub }}>{logo.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
