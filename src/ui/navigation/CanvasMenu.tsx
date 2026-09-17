'use client';

import { useEffect, useState } from 'react';
import { MainMenu, type ExcalidrawImperativeAPI } from '../../core/excal';
import { listPages, goToPage, type PageInfo } from '../../core/pages';
import { convertToPages, looseElements } from '../../core/paginate';
import { TEXT_PRESETS, insertTextPreset } from '../../core/text';
import { exportScenePng, exportSceneSvg, exportScenePdf, downloadBlob } from '../../core/export';
import type { FilesMap } from '../hooks/pageThumbnails';
import type { SvgFontFace } from '../../core/svgFonts';
import { mergeLabels, type PartialLabels } from '../shared/labels';
import type { CanvasWorkspace } from '../workspaces/types';

/**
 * Menú principal del editor: acciones de DOCUMENTO —convertir en páginas,
 * insertar texto, guardar como componente y exportar.
 *
 * Fondo y tamaño de la página estuvieron aquí y se han ido a la pestaña Diseño
 * del dock: son ajustes de UNA página y se buscan mirándola, no dentro de un
 * icono sin rótulo en la esquina opuesta.
 *
 * Ojo al montarlo: pasar un <MainMenu> como hijo de <Excalidraw> SUSTITUYE el
 * menú de fábrica entero, no le añade cosas. Por eso abajo se reponen a mano los
 * items de serie que merece la pena conservar.
 */

export interface CanvasMenuProps {
  /** Use the page actions, or retain the standard scene menu for a free canvas. */
  pages?: boolean;
  workspace?: CanvasWorkspace;
  onWorkspaceChange?: (workspace: CanvasWorkspace) => void;
  /** Puede llegar null en el primer render: ver el comentario del montaje en Canvas2. */
  api: ExcalidrawImperativeAPI | null;
  /** Página activa, gobernada por Canvas2Editor. */
  activePageId?: string | null;
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
  hydrateFiles?: (opts?: { output?: 'blob' | 'dataurl' }) => Promise<FilesMap>;
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
  pages: pageMode = true,
  workspace = 'excalidraw',
  onWorkspaceChange,
  api,
  activePageId,
  viewMode = false,
  hydrateFiles,
  fontFaces,
  brandFamilies,
  onSaveComponent,
  labels: labelsProp,
}: CanvasMenuProps) {
  const L = mergeLabels(labelsProp);
  const workspaceItems = !viewMode && onWorkspaceChange ? (
    <MainMenu.Group title={L.workspace.label}>
      {(['excalidraw', 'design', 'advanced'] as const).map((value) => (
        <MainMenu.Item key={value} role="menuitemradio" aria-checked={workspace === value}
          selected={workspace === value} onSelect={() => onWorkspaceChange(value)}>
          {L.workspace[value]}
        </MainMenu.Item>
      ))}
    </MainMenu.Group>
  ) : null;
  const [pages, setPages] = useState<PageInfo[]>(() => (api ? listPages(api) : []));
  const [loose, setLoose] = useState(0);
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

  const runExport = async (kind: 'png' | 'png-all' | 'svg' | 'pdf') => {
    if (!api || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const base = safeFilename(activePage?.name ?? 'diseño');
      // Los bytes de las imágenes remotas, traídos por el host. Sin esto el
      // canvas está contaminado y cualquier rasterizado muere.
      // El SVG necesita los bytes en base64: van DENTRO del fichero, y un
      // `blob:` moriría con la pestaña. El resto rasteriza en un canvas, donde
      // un `blob:` vale igual y sale mucho más barato.
      const files = hydrateFiles
        ? await hydrateFiles(kind === 'svg' ? { output: 'dataurl' } : undefined)
        : undefined;
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

  // Antes de que llegue la API imperativa no hay escena que gobernar, pero el
  // menú TIENE que renderizarse igual: si no hay hijo, Excalidraw dibuja su
  // propio menú de respaldo y luego aparecen los dos. Va después de todos los
  // hooks, así que no altera su orden.
  if (!api || !pageMode) {
    return (
      <MainMenu>
        {workspaceItems}
        {!pageMode && <>
          {!viewMode && <MainMenu.DefaultItems.LoadScene />}
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          {!viewMode && <MainMenu.DefaultItems.ClearCanvas />}
          <MainMenu.Separator />
        </>}
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.ToggleTheme />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    );
  }

  return (
    <MainMenu>
      {workspaceItems}
      {/* Fondo y tamaño de la página VIVÍAN aquí. Se han mudado a la pestaña
          Diseño del dock (ver DesignPanel): son ajustes de la página que estás
          mirando, y detrás de un icono sin rótulo no los encontraba nadie. */}

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
              // Con un tamaño heredado la intención es llenar ESE lienzo, así
              // que el contenido se escala en los dos sentidos. Un guion de
              // carrusel dibujado en miniatura sale a tamaño real, no como
              // sellos centrados en una página gigante.
              scaleUp: Boolean(activePage),
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
