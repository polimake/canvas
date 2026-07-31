'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { MainMenu, type ExcalidrawImperativeAPI } from './excal';
import {
  PAGE_SIZE_PRESETS,
  listPages,
  resizePage,
  goToPage,
  type PageInfo,
  type PageSize,
} from './pages';
import { getPageBackground, setPageBackgroundColor } from './background';
import { convertToPages, looseElements } from './paginate';
import { TEXT_PRESETS, insertTextPreset } from './text';
import { exportScenePng, exportSceneSvg, exportScenePdf, downloadBlob } from './export';
import type { FilesMap } from './pageThumbnails';
import type { SvgFontFace } from './svgFonts';
import { palette } from './theme';
import { mergeLabels, type PartialLabels } from './labels';

/**
 * Menú principal del editor: fondo de página, tamaño y exportación.
 *
 * Estos tres vivían como botones en la tira de páginas, donde competían por
 * espacio con las miniaturas y no eran acciones de "navegar entre páginas" sino
 * de documento. Aquí caben sin apretar y la tira se queda con lo suyo.
 *
 * Ojo al montarlo: pasar un <MainMenu> como hijo de <Excalidraw> SUSTITUYE el
 * menú de fábrica entero, no le añade cosas. Por eso abajo se reponen a mano los
 * items de serie que merece la pena conservar.
 */

/** Ancho de página admitido, en píxeles. Mismo rango que usaba la tira. */
const SIZE_MIN = 100;
const SIZE_MAX = 8000;

/** Colores de fondo a un clic; el selector cubre el resto. */
const BG_SWATCHES = ['#ffffff', '#f8f9fa', '#fff9db', '#ffe3e3', '#d3f9d8', '#d0ebff', '#1e1e1e'];

export interface CanvasMenuProps {
  /** Puede llegar null en el primer render: ver el comentario del montaje en Canvas2. */
  api: ExcalidrawImperativeAPI | null;
  /** Página activa, gobernada por Canvas2Editor. */
  activePageId?: string | null;
  theme?: 'light' | 'dark';
  /** En modo lectura solo queda exportar: nada que mute el documento. */
  viewMode?: boolean;
  /**
   * Trae el mapa de ficheros hidratado justo antes de exportar.
   *
   * Con imágenes remotas el canvas queda contaminado y `toBlob` muere con
   * SecurityError. Antes eso se resolvía ESCONDIENDO el grupo Exportar y
   * dejando el botón bueno en una barra aparte del host — o sea que exportar
   * estaba en el menú salvo justo cuando hacía falta.
   *
   * Se pide en el momento, y no se recibe un mapa ya hecho, porque uno
   * publicado hace diez segundos no incluiría una imagen añadida después: el
   * export saldría incompleto sin avisar.
   */
  hydrateFiles?: () => Promise<FilesMap>;
  /**
   * Tipografías de la marca, para embeberlas en el SVG. Excalidraw mete las que
   * tiene REGISTRADAS, no las que sustituimos por `@font-face`, así que sin esto
   * un SVG abierto en otro equipo sale con la fuente de serie (ver svgFonts.ts).
   */
  fontFaces?: readonly SvgFontFace[];
  /**
   * Familias de marca por rol, para que "Insertar texto" nazca ya en la
   * tipografía del cliente. Las resuelve `Canvas2Editor` desde el brand kit.
   */
  brandFamilies?: { heading: string | null; body: string | null };
  /** "Guardar página como componente" — la subida la hace el host. */
  onSaveComponent?: () => void;
  /** Textos, inyectados por el host (ver labels.ts). */
  labels?: PartialLabels;
}

function safeFilename(name: string): string {
  return (name || 'diseño').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'diseño';
}

export function CanvasMenu({
  api,
  activePageId,
  theme = 'light',
  viewMode = false,
  hydrateFiles,
  fontFaces,
  brandFamilies,
  onSaveComponent,
  labels: labelsProp,
}: CanvasMenuProps) {
  const L = mergeLabels(labelsProp);
  const c = palette[theme];
  const [pages, setPages] = useState<PageInfo[]>(() => (api ? listPages(api) : []));
  const [loose, setLoose] = useState(0);
  const [scaleContent, setScaleContent] = useState(true);
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  // El menú se abre y se cierra, pero mientras está abierto la escena puede
  // cambiar (deshacer, otra pestaña). Suscribirse es más barato que recalcular
  // la lista en cada render del editor.
  useEffect(() => {
    if (!api) return;
    const refresh = () => {
      setPages(listPages(api));
      setLoose(looseElements(api.getSceneElements()).length);
    };
    refresh();
    return api.onChange(refresh);
  }, [api]);

  // Los campos de tamaño arrancan con las medidas de la página activa, para que
  // ajustar 20px no obligue a teclear las dos cifras.
  useEffect(() => {
    if (!activePage) return;
    setCustomW(String(activePage.width));
    setCustomH(String(activePage.height));
  }, [activePage?.id, activePage?.width, activePage?.height]);

  const applyResize = (size: PageSize) => {
    if (!api || !activePageId) return;
    resizePage(api, activePageId, size, { scaleContent });
    goToPage(api, activePageId);
  };

  const customSize = (() => {
    const w = Number.parseInt(customW, 10);
    const h = Number.parseInt(customH, 10);
    const ok =
      Number.isInteger(w) && Number.isInteger(h) &&
      w >= SIZE_MIN && w <= SIZE_MAX && h >= SIZE_MIN && h <= SIZE_MAX;
    return ok ? { width: w, height: h } : null;
  })();

  const runExport = async (kind: 'png' | 'png-all' | 'svg' | 'pdf') => {
    if (!api || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const base = safeFilename(activePage?.name ?? 'diseño');
      // Los bytes de las imágenes remotas, traídos por el host. Sin esto el
      // canvas está contaminado y cualquier rasterizado muere.
      const files = hydrateFiles ? await hydrateFiles() : undefined;
      if (kind === 'png') {
        downloadBlob(
          await exportScenePng(api, { pageId: activePageId ?? undefined, files }),
          `${base}.png`,
        );
      } else if (kind === 'png-all') {
        for (const page of pages) {
          downloadBlob(
            await exportScenePng(api, { pageId: page.id, files }),
            `${safeFilename(page.name)}.png`,
          );
        }
      } else if (kind === 'svg') {
        const svg = await exportSceneSvg(api, {
          pageId: activePageId ?? undefined,
          files,
          fontFaces,
          // Google sirve las fuentes con CORS abierto, así que un `fetch` normal
          // basta: no hace falta el proxy del worker (que además solo permite
          // los hosts de media). Si falla, la fuente se queda por URL y el SVG
          // se sigue viendo bien donde haya red.
          fontFetcher: (url) => fetch(url).then((r) => r.blob()),
        });
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
        downloadBlob(blob, `${base}.svg`);
      } else {
        downloadBlob(await exportScenePdf(api, { files }), `${safeFilename(pages[0]?.name ?? 'diseño')}.pdf`);
      }
    } catch (err) {
      console.error('[canvas2] export failed', err);
      setExportError(true);
      setTimeout(() => setExportError(false), 4000);
    } finally {
      setExporting(false);
    }
  };

  const inputStyle: CSSProperties = {
    width: 64,
    padding: '4px 6px',
    borderRadius: 6,
    border: `1px solid ${c.border}`,
    background: 'transparent',
    color: c.fg,
    fontSize: 12,
  };

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
  };

  // Antes de que llegue la API imperativa no hay escena que gobernar, pero el
  // menú TIENE que renderizarse igual: si no hay hijo, Excalidraw dibuja su
  // propio menú de respaldo y luego aparecen los dos. Va después de todos los
  // hooks, así que no altera su orden.
  if (!api) {
    return (
      <MainMenu>
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.ToggleTheme />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    );
  }

  return (
    <MainMenu>
      {!viewMode && (
        <MainMenu.Group title={L.menu.background}>
          {/* ItemCustom y no Item: los Item se cierran al pulsarlos, y aquí
              dentro hay un selector de color con el que hay que poder trastear. */}
          <MainMenu.ItemCustom>
            <div style={{ ...rowStyle, flexWrap: 'wrap' }}>
              {BG_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`Fondo ${color}`}
                  onClick={() => activePageId && setPageBackgroundColor(api, activePageId, color)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: color,
                    border: `1px solid ${c.border}`,
                  }}
                />
              ))}
            </div>
          </MainMenu.ItemCustom>
          <MainMenu.ItemCustom>
            <label style={{ ...rowStyle, fontSize: 12, color: c.fg, cursor: 'pointer', width: '100%' }}>
              {L.menu.backgroundOther}
              <input
                type="color"
                value={(activePageId && getPageBackground(api, activePageId)) || '#ffffff'}
                onChange={(e) => {
                  // Vista previa mientras se arrastra el selector; se pliega en
                  // el commit final deshacible (capture 'transient').
                  if (activePageId) {
                    setPageBackgroundColor(api, activePageId, e.target.value, { capture: 'transient' });
                  }
                }}
                onBlur={(e) => activePageId && setPageBackgroundColor(api, activePageId, e.target.value)}
                style={{
                  marginLeft: 'auto',
                  width: 28,
                  height: 22,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              />
            </label>
          </MainMenu.ItemCustom>
          <MainMenu.Item
            onSelect={() => activePageId && setPageBackgroundColor(api, activePageId, null)}
          >
            Quitar fondo
          </MainMenu.Item>
        </MainMenu.Group>
      )}

      {!viewMode && (
        <MainMenu.Group title={L.menu.size}>
          {PAGE_SIZE_PRESETS.map((preset) => (
            <MainMenu.Item
              key={preset.key}
              selected={activePage?.width === preset.width && activePage?.height === preset.height}
              shortcut={`${preset.width}×${preset.height}`}
              onSelect={() => applyResize(preset)}
            >
              {L.sizes[preset.key] ?? preset.label}
            </MainMenu.Item>
          ))}
          <MainMenu.ItemCustom>
            <div style={rowStyle}>
              <input
                value={customW}
                onChange={(e) => setCustomW(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && customSize && applyResize(customSize)}
                inputMode="numeric"
                aria-label={L.menu.width}
                placeholder={L.menu.width}
                style={inputStyle}
              />
              <span style={{ color: c.sub, fontSize: 12 }}>×</span>
              <input
                value={customH}
                onChange={(e) => setCustomH(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && customSize && applyResize(customSize)}
                inputMode="numeric"
                aria-label={L.menu.height}
                placeholder={L.menu.height}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => customSize && applyResize(customSize)}
                disabled={!customSize}
                style={{
                  all: 'unset',
                  cursor: customSize ? 'pointer' : 'default',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: customSize ? c.activeFg : c.sub,
                  background: customSize ? c.active : 'transparent',
                  border: `1px solid ${c.border}`,
                  opacity: customSize ? 1 : 0.6,
                }}
              >
                {L.menu.apply}
              </button>
            </div>
          </MainMenu.ItemCustom>
          <MainMenu.ItemCustom>
            <label style={{ ...rowStyle, fontSize: 12, color: c.sub, cursor: 'pointer', width: '100%' }}>
              <input
                type="checkbox"
                checked={scaleContent}
                onChange={(e) => setScaleContent(e.target.checked)}
              />
              {L.menu.scaleContent}
            </label>
          </MainMenu.ItemCustom>
          <MainMenu.ItemCustom>
            <span style={{ padding: '0 8px', fontSize: 11, color: c.sub }}>
              {SIZE_MIN}–{SIZE_MAX}px
            </span>
          </MainMenu.ItemCustom>
        </MainMenu.Group>
      )}

      {/* Paginar lo que está suelto en el plano infinito. Solo aparece cuando
          hay algo que paginar: en un documento ya paginado sería una entrada
          permanente que no hace nada, y que por estar ahí invita a pulsarla.
          Tras convertir, `loose` baja a 0 y la entrada desaparece sola — ése es
          el acuse de recibo, junto a las páginas que aparecen en la tira. */}
      {!viewMode && loose > 0 && (
        <MainMenu.Item
          shortcut={L.menu.toPagesHint(loose)}
          onSelect={() => {
            const { created, total } = convertToPages(api, {
              // Hereda el tamaño de la página activa cuando el documento ya
              // tiene alguna; si no, lo decide el grupo más grande.
              pageSize: activePage
                ? { width: activePage.width, height: activePage.height }
                : undefined,
            });
            // Salta a la primera página creada: si no, la conversión ocurre
            // fuera de la pantalla y parece que no ha pasado nada.
            const first = listPages(api)[total - created];
            if (first) goToPage(api, first.id);
          }}
        >
          {L.menu.toPages}
        </MainMenu.Item>
      )}

      {!viewMode && (
        <MainMenu.Group title={L.menu.insertText}>
          {TEXT_PRESETS.map((preset) => (
            <MainMenu.Item
              key={preset.key}
              shortcut={`${preset.fontSize}px`}
              textStyle={{
                fontSize: preset.key === 'heading' ? 15 : preset.key === 'subheading' ? 13 : 12,
                fontWeight: preset.key === 'body' ? 400 : 700,
              }}
              onSelect={() =>
                insertTextPreset(api, preset.key, {
                  pageId: activePageId ?? undefined,
                  // El cuerpo usa la tipografía de texto; título y subtítulo, la
                  // de titulares — con respaldo cruzado si la marca solo trae una.
                  fontFamily:
                    preset.key === 'body'
                      ? brandFamilies?.body ?? brandFamilies?.heading
                      : brandFamilies?.heading ?? brandFamilies?.body,
                })
              }
            >
              {L.sizes[preset.key] ?? preset.label}
            </MainMenu.Item>
          ))}
        </MainMenu.Group>
      )}

      {/* La página activa pasa a la biblioteca de componentes del proyecto.
          Solo si el host lo cablea: sin API donde guardar, sin entrada. */}
      {!viewMode && onSaveComponent && (
        <MainMenu.Item onSelect={onSaveComponent}>{L.components.save}</MainMenu.Item>
      )}

      <MainMenu.Group
        title={exporting ? L.menu.exporting : exportError ? L.menu.exportFailed : L.menu.export}
      >
        <MainMenu.Item onSelect={() => void runExport('png')}>{L.menu.exportPngPage}</MainMenu.Item>
        <MainMenu.Item onSelect={() => void runExport('png-all')}>{L.menu.exportPngAll}</MainMenu.Item>
        <MainMenu.Item onSelect={() => void runExport('svg')}>{L.menu.exportSvg}</MainMenu.Item>
        <MainMenu.Item onSelect={() => void runExport('pdf')}>{L.menu.exportPdf}</MainMenu.Item>
      </MainMenu.Group>

      {/* Items de fábrica que se reponen: sustituir el menú los tira todos.
          Quedan fuera a propósito `LoadScene`, `SaveToActiveFile` y `ClearCanvas`
          (abren o borran documentos ajenos al contenido que se está editando) y
          `SaveAsImage`, que es el diálogo nativo que revienta con imágenes
          remotas — su sitio lo ocupa el grupo Exportar de arriba. */}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.ToggleTheme />
      <MainMenu.DefaultItems.Help />
    </MainMenu>
  );
}
