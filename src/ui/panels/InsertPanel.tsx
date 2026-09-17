import { useState } from 'react';
import { convertToExcalidrawElements, type ExcalidrawImperativeAPI } from '../../core/excal';
import { commitElements } from '../../core/mutate';
import { listPages } from '../../core/pages';
import { insertTextPreset, TEXT_PRESETS } from '../../core/text';
import { mergeLabels, type PartialLabels } from '../shared/labels';

export function InsertPanel({ api, pageId, text = false, labels, families }: {
  api: ExcalidrawImperativeAPI; pageId: string | null; text?: boolean; labels?: PartialLabels;
  families?: { heading: string | null; body: string | null };
}) {
  const [query, setQuery] = useState('');
  const L = mergeLabels(labels);
  const shapes = [
    { type: 'rectangle', label: L.workspace.rectangle },
    { type: 'ellipse', label: L.workspace.ellipse },
    { type: 'diamond', label: L.workspace.diamond },
  ] as const;
  const addShape = (type: (typeof shapes)[number]['type']) => {
    const page = listPages(api).find(p => p.id === pageId);
    const state = api.getAppState();
    const size = page ? Math.min(page.width, page.height) * 0.25 : 160;
    const x = page ? page.x + (page.width - size) / 2 : -state.scrollX + state.width / state.zoom.value / 2 - size / 2;
    const y = page ? page.y + (page.height - size) / 2 : -state.scrollY + state.height / state.zoom.value / 2 - size / 2;
    const created = convertToExcalidrawElements([{ type, x, y, width: size, height: size,
      backgroundColor: '#3a39f5', fillStyle: 'solid', strokeColor: 'transparent', roughness: 0,
      ...(page ? { frameId: page.id } : {}) }]);
    commitElements(api, [...api.getSceneElements(), ...created], 'undoable', {
      selectedElementIds: Object.fromEntries(created.map(el => [el.id, true])),
    });
    api.setActiveTool({ type: 'selection' });
  };
  if (text) return <div className="canvas2-text-presets">
    {TEXT_PRESETS.map(preset => <button key={preset.key} type="button" data-preset={preset.key}
      onClick={() => insertTextPreset(api, preset.key, { pageId: pageId ?? undefined,
        fontFamily: preset.key === 'body' ? families?.body ?? families?.heading : families?.heading ?? families?.body })}>
      {L.sizes[preset.key] ?? preset.label}
    </button>)}
  </div>;
  const visible = shapes.filter(shape => shape.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>
    <input className="canvas2-resource-search" type="search" aria-label={L.workspace.searchElements}
      placeholder={L.workspace.searchElements} value={query} onChange={event => setQuery(event.target.value)} />
    <div className="canvas2-element-grid">
      {visible.map(shape => <button key={shape.type} type="button" onClick={() => addShape(shape.type)}>
        <span className="canvas2-shape-preview" data-shape={shape.type} /><span>{shape.label}</span>
      </button>)}
    </div>
    {!visible.length && <p className="canvas2-resource-empty">{L.workspace.noResults}</p>}
    <div className="canvas2-drawing-tools">
      <button type="button" onClick={() => api.setActiveTool({ type: 'arrow' })}>{L.workspace.arrow}</button>
      <button type="button" onClick={() => api.setActiveTool({ type: 'freedraw' })}>{L.workspace.draw}</button>
    </div>
  </>;
}
