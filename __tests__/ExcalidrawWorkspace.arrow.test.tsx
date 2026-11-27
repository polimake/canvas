// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WorkspaceLayout } from '../src/ui/workspaces/WorkspaceLayout';
import type { WorkspacePanel } from '../src/ui/workspaces/types';

afterEach(cleanup);

const panels: WorkspacePanel[] = [
  { id: 'design', title: 'Página', content: <p>página</p> },
  { id: 'layers', title: 'Capas', content: <p>capas</p> },
  // Del host, como Comentarios en Studio.
  { id: 'comments', title: 'Comentarios', content: <p>comentarios</p>, bleed: true },
];

function Editor({ narrow = false }: { narrow?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <WorkspaceLayout workspace="excalidraw" panels={panels} narrow={narrow} openPanel={open} onOpenPanelChange={setOpen}>
      <div />
    </WorkspaceLayout>
  );
}

describe('el inspector de la vista Excalidraw (escritorio)', () => {
  it('cerrado es UNA flecha; abre en pestañas, con las del host, y vuelve a la última', () => {
    render(<Editor />);
    // Ni rastro de la tira de iconos: solo la flecha.
    expect(screen.queryByRole('button', { name: 'Capas' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el panel' }));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Página', 'Capas', 'Comentarios']);
    expect(screen.getByText('página')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Comentarios' }));
    expect(screen.getByText('comentarios').parentElement?.hasAttribute('data-bleed')).toBe(true);
    // Abierto no hay flecha; la ✕ cierra.
    expect(screen.queryByRole('button', { name: 'Abrir el panel' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    // Reabrir vuelve a la última pestaña usada.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el panel' }));
    expect(screen.getByRole('tab', { name: 'Comentarios' }).getAttribute('aria-selected')).toBe('true');
  });

  it('en móvil sigue la tira de iconos', () => {
    render(<Editor narrow />);
    expect(screen.queryByRole('button', { name: 'Abrir el panel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Capas' })).toBeTruthy();
  });
});
