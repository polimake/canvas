// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdvancedWorkspace } from '../src/ui/workspaces/advanced/AdvancedWorkspace';

afterEach(cleanup);

it('keeps layers mounted while switching resources and handles removed panels', () => {
  const panels = [
    { id: 'text', title: 'Texto', content: <input aria-label="Texto del panel" /> },
    { id: 'design', title: 'Página', content: <div>Propiedades de página</div> },
    { id: 'layers', title: 'Capas', content: <input aria-label="Nombre de capa" defaultValue="Capa 1" /> },
  ];
  const { rerender } = render(<AdvancedWorkspace panels={panels} />);
  expect(screen.getByText('Propiedades de página')).toBeTruthy();
  const layer = screen.getByRole('textbox', { name: 'Nombre de capa' });
  fireEvent.change(layer, { target: { value: 'Portada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Texto' }));
  expect(screen.getByRole('textbox', { name: 'Texto del panel' })).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Nombre de capa' })).toBe(layer);
  expect((layer as HTMLInputElement).value).toBe('Portada');
  rerender(<AdvancedWorkspace panels={panels.filter(panel => panel.id !== 'text')} />);
  expect(screen.getByText('Propiedades de página')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Nombre de capa' })).toBe(layer);
});
