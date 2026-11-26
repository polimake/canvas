'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import { exportSceneSvg } from '../../../core/export';
import { getPageNotes, getPageTransition } from '../../../core/slideMeta';
import type { DeckSlide } from './useDeck';
import type { Canvas2Labels } from '../../shared/labels';
import { SlidesIcon } from './icons';

export interface PresentModeProps {
  api: ExcalidrawImperativeAPI;
  slides: DeckSlide[];
  /** Por dónde empieza (la activa, o la primera con «desde el principio»). */
  startId: string | null;
  labels: Canvas2Labels;
  /** Al salir, la diapositiva en la que se estaba: el editor vuelve a ella. */
  onExit: (lastId: string | null) => void;
  /** Abrir directamente con la vista del orador. */
  presenter?: boolean;
}

/** Tras cuánto sin mover el ratón se esconden los controles. */
const IDLE_MS = 2500;

/**
 * Presentar a pantalla completa, como en Slides.
 *
 * Cada diapositiva se pinta con `exportSceneSvg` y el SVG va INLINE (no como
 * `<img>`): así usa las fuentes de la marca que la página ya tiene cargadas y
 * las imágenes por su URL, sin hidratarlas. Se pintan bajo demanda (la actual
 * y la siguiente) y se guardan para no repetir. Las que se saltan no salen.
 */
export function PresentMode({ api, slides, startId, labels, onExit, presenter: presenterAtStart }: PresentModeProps) {
  const L = labels.slides;
  const shown = useMemo(() => slides.filter((s) => !s.skipped), [slides]);
  // Desde la pedida; si se salta, desde la siguiente que no (como Slides).
  const [index, setIndex] = useState(() => {
    const from = Math.max(0, slides.findIndex((s) => s.id === startId));
    const next = slides.slice(from).find((s) => !s.skipped) ?? null;
    const at = next ? shown.indexOf(next) : -1;
    return at >= 0 ? at : 0;
  });
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [idle, setIdle] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [presenterWin, setPresenterWin] = useState<Window | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Si ya se llegó a estar a pantalla completa: dejarla entonces es salir. */
  const wasFull = useRef(false);
  const current = shown[index] ?? null;
  const nextSlide = shown[index + 1] ?? null;
  const total = shown.length;

  // SVG de una diapositiva, una sola vez: lo pedido (en curso o hecho) no se
  // vuelve a pedir aunque llegue otro SVG entre medias.
  const requested = useRef(new Set<string>());
  const render = useCallback(async (id: string) => {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    try {
      const svg = await exportSceneSvg(api, { pageId: id });
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const markup = new XMLSerializer().serializeToString(svg);
      setSvgs((m) => (m[id] ? m : { ...m, [id]: markup }));
    } catch (err) {
      requested.current.delete(id);
      console.error('[canvas2] presentar: no se pudo pintar la diapositiva', err);
    }
  }, [api]);

  useEffect(() => {
    if (current) void render(current.id);
    if (nextSlide) void render(nextSlide.id);
  }, [current?.id, nextSlide?.id, render]);

  // Si la presentación cambia mientras se presenta (deshacer, otra persona), el
  // índice vuelve a una diapositiva que existe o a la pantalla del final
  // (`index === total`).
  useEffect(() => {
    if (index > total) setIndex(total);
  }, [total, index]);

  // Solo se guardan la anterior, la de ahora y la siguiente: cada SVG puede
  // llevar las letras dentro, y una presentación larga se comía la memoria.
  const prevId = shown[index - 1]?.id;
  useEffect(() => {
    const keep = new Set([prevId, current?.id, nextSlide?.id].filter((id): id is string => Boolean(id)));
    for (const id of [...requested.current]) if (!keep.has(id)) requested.current.delete(id);
    setSvgs((m) => {
      const ids = Object.keys(m);
      if (ids.every((id) => keep.has(id))) return m;
      return Object.fromEntries(ids.filter((id) => keep.has(id)).map((id) => [id, m[id]!]));
    });
  }, [prevId, current?.id, nextSlide?.id]);

  // La ventana del orador por referencia: el desmontaje la cierra aunque se
  // salga por otro camino que «Salir» (cambiar de espacio, cerrar el editor).
  const presenterRef = useRef<Window | null>(null);
  presenterRef.current = presenterWin;
  const exited = useRef(false);
  const exit = useCallback(() => {
    // Salir quita la pantalla completa, y eso vuelve a avisar: una sola vez.
    if (exited.current) return;
    exited.current = true;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    presenterRef.current?.close();
    onExit(current?.id ?? null);
    // El teclado vuelve a donde estaba antes de presentar (el botón, el lienzo).
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }, [onExit, current?.id]);
  const exitRef = useRef(exit);
  exitRef.current = exit;

  const go = useCallback((step: number) => {
    setIndex((i) => Math.min(total, Math.max(0, i + step)));
  }, [total]);

  const opener = useRef<HTMLElement | null>(typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);

  // Pantalla completa al entrar; salir de ella (Esc del navegador) es salir.
  // Con la vista del orador, su ventana se abre ANTES: pedir pantalla completa
  // gasta el gesto del usuario y el navegador bloquearía la ventana después.
  useEffect(() => {
    if (presenterAtStart) openPresenter();
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => { /* sin permiso: se presenta en la ventana */ });
    el?.focus();
    const onChange = () => {
      if (!document.fullscreenElement && wasFull.current) exitRef.current();
      wasFull.current = Boolean(document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Teclado de presentar: el de Slides, también desde la ventana del orador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      // Mientras se presenta, NINGUNA tecla llega al editor: el reenvío del
      // lienzo (keyRouting.ts) le pasaría Supr o una letra a la selección.
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Intro o espacio sobre un botón de la barra (Salir, Notas…) es pulsarlo.
      const target = e.target as HTMLElement | null;
      if ((k === 'Enter' || k === ' ') && target?.closest('.canvas2-slides-present-bar, button[data-presenter]')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) go(1);
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) go(-1);
      else if (k === 'Home') setIndex(0);
      else if (k === 'End') setIndex(Math.max(0, total - 1));
      else if (k === 'Escape') exit();
      else if (k === 's' || k === 'S') setShowNotes((v) => !v);
      else return;
      // Sin esto, Intro o espacio sobre un botón con foco lo pulsarían además.
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    presenterWin?.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      presenterWin?.removeEventListener('keydown', onKey, true);
    };
  }, [go, exit, total, presenterWin]);

  // Controles que se esconden si no se mueve el ratón.
  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  };
  useEffect(() => {
    wake();
    return () => clearTimeout(idleTimer.current);
  }, []);

  const openPresenter = () => {
    if (presenterWin && !presenterWin.closed) {
      presenterWin.focus();
      return;
    }
    const win = window.open('', 'canvas2-presenter', 'width=1100,height=720');
    if (!win) {
      setBlocked(true);
      return;
    }
    win.document.title = L.presenterView;
    win.document.body.style.margin = '0';
    // Las hojas de estilo de la página (con los @font-face de la marca): sin
    // ellas, las diapositivas de la vista del orador salían con otra letra.
    for (const sheet of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      win.document.head.appendChild(sheet.cloneNode(true));
    }
    win.addEventListener('beforeunload', () => setPresenterWin(null));
    setPresenterWin(win);
  };
  useEffect(() => () => presenterRef.current?.close(), []);

  const transition = current ? getPageTransition(api, current.id) : 'none';
  const notes = current ? getPageNotes(api, current.id) : '';
  const finished = index >= total;

  // En <body>: por encima de todo el editor (también de la interfaz de
  // Excalidraw) aunque el navegador no conceda la pantalla completa.
  return createPortal(
    <div ref={rootRef} className="canvas2-slides-present" tabIndex={-1} role="dialog" aria-modal="true"
      aria-label={L.presenting} data-idle={idle ? '' : undefined} onPointerMove={wake}>
      {finished ? (
        <button type="button" className="canvas2-slides-present-end" onClick={exit}>{L.presenterEnd}</button>
      ) : (
        <button type="button" className="canvas2-slides-present-stage" aria-label={L.next} onClick={() => go(1)}>
          {current && svgs[current.id] ? (
            <span key={current.id} className="canvas2-slides-present-slide" data-transition={transition}
              // El SVG lo genera el propio exportador a partir de la escena.
              dangerouslySetInnerHTML={{ __html: svgs[current.id] }} />
          ) : null}
        </button>
      )}

      <span className="canvas2-slides-present-hint" aria-hidden="true">{L.escToExit}</span>

      {showNotes && !finished && (
        <div className="canvas2-slides-present-notes">
          <span>{L.notes} · {L.slideN(index + 1)}</span>
          <p>{notes}</p>
        </div>
      )}

      {blocked && <p className="canvas2-slides-present-blocked" role="alert">{L.presenterBlocked}</p>}

      <div className="canvas2-slides-present-bar" role="toolbar" aria-label={L.presenting}>
        <button type="button" aria-label={L.previous} title={L.previous} onClick={() => go(-1)} disabled={index === 0}>
          <SlidesIcon.chevronLeft />
        </button>
        <span className="canvas2-slides-present-count">{L.counter(Math.min(index + 1, total), total)}</span>
        <button type="button" aria-label={L.next} title={L.next} onClick={() => go(1)} disabled={finished}>
          <SlidesIcon.chevronRight />
        </button>
        <span className="canvas2-slides-present-sep" aria-hidden="true" />
        <button type="button" aria-pressed={showNotes} onClick={() => setShowNotes((v) => !v)}>
          <SlidesIcon.notes /><span>{L.notes}</span>
        </button>
        <button type="button" aria-pressed={Boolean(presenterWin)} onClick={openPresenter}>
          <SlidesIcon.presenter /><span>{L.presenterView}</span>
        </button>
        <span className="canvas2-slides-present-sep" aria-hidden="true" />
        <button type="button" onClick={exit}>
          <SlidesIcon.close /><span>{L.exit}</span>
        </button>
      </div>

      {presenterWin && createPortal(
        <PresenterView labels={labels} index={index} total={total} startedAt={startedAt}
          currentSvg={current ? svgs[current.id] : undefined}
          nextSvg={nextSlide ? svgs[nextSlide.id] : undefined}
          notes={notes} onPrev={() => go(-1)} onNext={() => go(1)} />,
        presenterWin.document.body,
      )}
    </div>,
    document.body,
  );
}

/**
 * La vista del orador, en su propia ventana. Es un portal del MISMO árbol de
 * React: comparte el estado de la presentación sin mensajes entre ventanas. Va
 * con estilos en línea porque la hoja del editor no existe en esa ventana.
 */
function PresenterView({ labels, index, total, startedAt, currentSvg, nextSvg, notes, onPrev, onNext }: {
  labels: Canvas2Labels; index: number; total: number; startedAt: number;
  currentSvg?: string; nextSvg?: string; notes: string; onPrev: () => void; onNext: () => void;
}) {
  const L = labels.slides;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.floor((now - startedAt) / 1000);
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const ink = '#f7f4ed';
  const box: CSSProperties = { background: '#000', borderRadius: 3, overflow: 'hidden', aspectRatio: '16 / 9' };
  const btn: CSSProperties = {
    height: 36, padding: '0 14px', border: 0, borderRadius: 8, background: '#3a3833', color: ink,
    font: '500 14px system-ui, sans-serif', cursor: 'pointer',
  };
  return (
    <div style={{ boxSizing: 'border-box', minHeight: '100vh', padding: 24, background: '#1c1b19', color: ink,
      font: '400 14px system-ui, sans-serif', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={box} dangerouslySetInnerHTML={currentSvg ? { __html: currentSvg } : undefined} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" data-presenter="" style={btn} onClick={onPrev}>{L.previous}</button>
          <span style={{ minWidth: 64, textAlign: 'center' }}>{L.counter(Math.min(index + 1, total), total)}</span>
          <button type="button" data-presenter="" style={btn} onClick={onNext}>{L.next}</button>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{L.presenterTimer} {clock}</span>
        </div>
        <div style={{ flex: 1, background: '#28261f', borderRadius: 12, padding: '16px 20px', whiteSpace: 'pre-wrap',
          fontSize: 18, lineHeight: 1.5, overflow: 'auto' }}>
          <div style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a39e96', marginBottom: 8 }}>{L.notes}</div>
          {notes}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: '#a39e96' }}>{L.presenterNext}</span>
        {nextSvg ? <div style={box} dangerouslySetInnerHTML={{ __html: nextSvg }} />
          : <div style={{ ...box, display: 'grid', placeItems: 'center', color: '#a39e96' }}>{L.presenterEnd}</div>}
      </div>
    </div>
  );
}
