import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from './excal';
import { getSelectedVideo, setVideoPoster, type VideoMeta } from './video';
import { mergeLabels, type PartialLabels } from './labels';
import { PANEL_FONT, palette } from './theme';

/**
 * Selector del fotograma de portada de un vídeo.
 *
 * Aparece cuando seleccionas un vídeo del lienzo. Arrastras la barra, ves el
 * fotograma en vivo dentro del propio `<video>` y al confirmar ese fotograma se
 * convierte en la portada: se sube a la mediateca y sustituye a la imagen.
 *
 * Dos decisiones que explican el diseño:
 *
 * 1. El `<video>` NUNCA apunta al CDN. El CDN no manda CORS, así que dibujar
 *    ese vídeo en un lienzo lo contamina y `toBlob` muere con SecurityError. La
 *    fuente la resuelve el host (`resolveVideoSrc`), que además tiene que
 *    autenticarse — de ahí que sea asíncrona y haya un estado de carga.
 * 2. La captura y la subida las hace el HOST (`onPickFrame`). Este paquete no
 *    sabe de MediaMonster ni debe: es la misma frontera que la biblioteca y los
 *    componentes — canvas2 pone el marco, studio pone los datos.
 */

export interface VideoFramePickerProps {
  api: ExcalidrawImperativeAPI | null;
  theme?: 'light' | 'dark';
  viewMode?: boolean;
  labels?: PartialLabels;
  /**
   * Convierte la URL de la mediateca en una que el `<video>` pueda usar SIN
   * contaminar el lienzo. Es ASÍNCRONA porque el host tiene que descargarla con
   * su token: el proxy exige cabecera `Authorization` y un `<video src>` no la
   * manda, así que el camino real es fetch autenticado → blob del mismo origen.
   *
   * Sin esto no hay selector: se podría ver el vídeo pero no capturar nada.
   */
  resolveVideoSrc?: (src: string, signal: AbortSignal) => Promise<string>;
  /** Libera lo que devolviera `resolveVideoSrc` (revoca el object URL). */
  releaseVideoSrc?: (resolved: string) => void;
  /**
   * Captura el fotograma visible y devuelve la URL del póster ya subido a la
   * mediateca. Devolver `null` = no se pudo; el póster actual se queda.
   */
  onPickFrame?: (
    video: HTMLVideoElement,
    timeSec: number,
  ) => Promise<{ url: string; mimeType?: string } | null>;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoFramePicker({
  api,
  theme,
  viewMode,
  labels,
  resolveVideoSrc,
  releaseVideoSrc,
  onPickFrame,
}: VideoFramePickerProps) {
  const L = mergeLabels(labels);
  const c = palette[theme ?? 'light'];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [selected, setSelected] = useState<{ id: string; meta: VideoMeta } | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [duracion, setDuracion] = useState(0);
  const [tiempo, setTiempo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);
  /** Fuente ya resuelta por el host (un `blob:` del mismo origen). */
  const [src, setSrc] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // La selección vive en el appState de Excalidraw, que solo se lee por
  // suscripción: sin esto el panel no aparecería hasta el siguiente render del
  // editor por otro motivo.
  useEffect(() => {
    if (!api) return;
    const refresh = () => setSelected(getSelectedVideo(api));
    refresh();
    return api.onChange(refresh);
  }, [api]);

  // Cambiar de vídeo cierra el panel: dejarlo abierto mostraría la barra de uno
  // y guardaría sobre otro.
  useEffect(() => {
    setAbierto(false);
    setFallo(false);
    setTiempo(selected?.meta.posterTime ?? 0);
  }, [selected?.id]);

  // Descarga la fuente al ABRIR, no al seleccionar: el vídeo puede pesar y
  // nadie ha pedido todavía cambiar la portada. Se aborta y se libera al cerrar
  // o al cambiar de vídeo — un object URL vivo se queda en memoria hasta que se
  // recarga la pestaña.
  const videoSrcOrigen = selected?.meta.src ?? null;
  useEffect(() => {
    if (!abierto || !videoSrcOrigen || !resolveVideoSrc) return;
    const ctrl = new AbortController();
    let resuelto: string | null = null;
    let vivo = true;
    setCargando(true);
    setFallo(false);
    resolveVideoSrc(videoSrcOrigen, ctrl.signal)
      .then((url) => {
        resuelto = url;
        if (vivo) setSrc(url);
        else releaseVideoSrc?.(url);
      })
      .catch(() => {
        if (vivo) setFallo(true);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
      ctrl.abort();
      setSrc(null);
      if (resuelto) releaseVideoSrc?.(resuelto);
    };
  }, [abierto, videoSrcOrigen, resolveVideoSrc, releaseVideoSrc]);

  if (!api || viewMode || !selected) return null;

  const puedeElegir = Boolean(onPickFrame && resolveVideoSrc);

  const confirmar = async () => {
    const video = videoRef.current;
    if (!video || !onPickFrame) return;
    setGuardando(true);
    setFallo(false);
    try {
      const poster = await onPickFrame(video, video.currentTime);
      if (!poster) {
        setFallo(true);
        return;
      }
      setVideoPoster(api, selected.id, {
        url: poster.url,
        timeSec: video.currentTime,
        mimeType: poster.mimeType,
      });
      setAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      data-testid="canvas2-video-frame"
      style={{
        position: 'absolute',
        left: 12,
        bottom: 96,
        zIndex: 7,
        width: abierto ? 280 : undefined,
        padding: abierto ? 10 : '6px 10px',
        borderRadius: 10,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        fontFamily: PANEL_FONT,
        fontSize: 12,
      }}
    >
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={!puedeElegir}
          title={puedeElegir ? L.video.pickFrame : L.video.unavailable}
          style={{
            all: 'unset',
            cursor: puedeElegir ? 'pointer' : 'not-allowed',
            opacity: puedeElegir ? 1 : 0.5,
            fontWeight: 600,
          }}
        >
          {L.video.pickFrame}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cargando && <span style={{ color: c.sub }}>{L.video.loading}</span>}
          {/* Solo con la fuente ya resuelta por el host: montarlo con la URL del
              CDN contaminaría el lienzo y la captura moriría con SecurityError. */}
          {src && (
          <video
            ref={videoRef}
            src={src}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuracion(Number.isFinite(v.duration) ? v.duration : 0);
              // Arranca donde salió la portada actual, no en cero: si vuelves a
              // abrirlo es para ajustar, no para empezar de nuevo.
              const inicio = selected.meta.posterTime ?? 0;
              if (inicio > 0) v.currentTime = inicio;
            }}
            onTimeUpdate={(e) => setTiempo(e.currentTarget.currentTime)}
            onError={() => setFallo(true)}
            style={{ width: '100%', borderRadius: 6, background: '#000', display: 'block' }}
          />
          )}
          {src && (
          <>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duracion)}
            step={0.05}
            value={Math.min(tiempo, duracion || tiempo)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTiempo(v);
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: c.sub, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(tiempo)} / {formatTime(duracion)}
            </span>
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={guardando}
              style={{
                all: 'unset',
                marginLeft: 'auto',
                cursor: guardando ? 'progress' : 'pointer',
                padding: '4px 9px',
                borderRadius: 6,
                background: c.active,
                color: c.activeFg,
                fontWeight: 600,
              }}
            >
              {guardando ? L.video.saving : L.video.useFrame}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              style={{ all: 'unset', cursor: 'pointer', color: c.sub }}
            >
              {L.video.cancel}
            </button>
          </div>
          </>
          )}
          {fallo && <span style={{ color: '#e03131' }}>{L.video.failed}</span>}
        </div>
      )}
    </div>
  );
}
