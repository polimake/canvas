'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ExcalidrawImperativeAPI } from '../../../core/excal';
import { getPageNotes, setPageNotes } from '../../../core/slideMeta';

export interface SpeakerNotesProps {
  api: ExcalidrawImperativeAPI;
  pageId: string | null;
  label: string;
  placeholder: string;
  readOnly?: boolean;
  style?: CSSProperties;
}

/**
 * La caja de notas del orador, debajo de la diapositiva.
 *
 * Se escribe en local y se guarda al salir de la caja o al cambiar de
 * diapositiva: una entrada de deshacer por edición, no una por tecla. Mientras
 * no tiene el foco sigue a la escena, para que deshacer o la llegada de otra
 * versión del diseño se vean aquí.
 */
export function SpeakerNotes({ api, pageId, label, placeholder, readOnly, style }: SpeakerNotesProps) {
  const [text, setText] = useState(() => (pageId ? getPageNotes(api, pageId) : ''));
  const focused = useRef(false);
  const dirty = useRef<{ pageId: string; text: string } | null>(null);

  const flush = () => {
    const pending = dirty.current;
    dirty.current = null;
    if (pending) setPageNotes(api, pending.pageId, pending.text);
  };

  // Cambiar de diapositiva guarda la anterior y carga la nueva.
  useEffect(() => {
    flush();
    setText(pageId ? getPageNotes(api, pageId) : '');
    // `flush` lee refs: no hace falta en las dependencias.
  }, [api, pageId]);

  // Deshacer/rehacer: con la caja sin foco, lo que diga la escena.
  useEffect(() => {
    if (!pageId) return;
    // Solo si cambia la escena: `onChange` llega con cada movimiento del puntero.
    let lastElements: unknown = api.getSceneElements();
    return api.onChange(() => {
      const elements = api.getSceneElements();
      if (focused.current || elements === lastElements) return;
      lastElements = elements;
      const live = getPageNotes(api, pageId);
      setText((current) => (current === live ? current : live));
    });
  }, [api, pageId]);

  // Al desmontar (cambiar de espacio, cerrar el editor) no se pierde lo escrito.
  useEffect(() => () => flush(), []);

  return (
    <label className="canvas2-slides-notes" style={style}>
      <span className="canvas2-slides-visually-hidden">{label}</span>
      <textarea
        value={text}
        // En lectura no se puede escribir: sin «Haz clic para añadir».
        placeholder={readOnly ? '' : placeholder}
        readOnly={readOnly || !pageId}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; flush(); }}
        onChange={(e) => {
          setText(e.target.value);
          if (pageId) dirty.current = { pageId, text: e.target.value };
        }}
        onKeyDown={(e) => {
          // Esc devuelve el teclado al lienzo, como al terminar un texto.
          if (e.key === 'Escape') (e.currentTarget as HTMLTextAreaElement).blur();
        }}
      />
    </label>
  );
}
