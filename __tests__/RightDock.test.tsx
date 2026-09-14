// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { excalMock, fakeApi, frame } from './helpers';

vi.mock('../src/core/excal', () => excalMock);

const { RightDock } = await import('../src/ui/panels/RightDock.js');

afterEach(cleanup);

const unaPagina = () => fakeApi([frame('a', 0, 0, 1080, 1350, { name: 'Portada' })]);

/** Marca del cliente, para que la pestaña Diseño tenga algo que enseñar. */
const marca = { mainColor: '#0d1b2a', secondaryColor: '#e0533d' };

describe('RightDock', () => {
  it('sin nada que enseñar no se dibuja', () => {
    const { api } = unaPagina();
    render(<RightDock api={api as never} activePageId="a" />);
    expect(screen.queryByTestId('canvas2-right-dock')).toBeNull();
  });

  it('arranca plegado: solo la fila de pestañas', () => {
    const { api } = unaPagina();
    render(<RightDock api={api as never} activePageId="a" design layers brandKit={marca} />);
    expect(screen.getByText('Diseño')).toBeTruthy();
    expect(screen.getByText('Capas')).toBeTruthy();
    // El cuerpo no está montado hasta que se pulsa una pestaña.
    expect(screen.queryByTestId('canvas2-design-panel')).toBeNull();
  });

  it('pulsar una pestaña la abre; pulsarla otra vez la cierra', () => {
    const { api } = unaPagina();
    render(<RightDock api={api as never} activePageId="a" design brandKit={marca} />);

    fireEvent.click(screen.getByText('Diseño'));
    expect(screen.getByTestId('canvas2-design-panel')).toBeTruthy();

    fireEvent.click(screen.getByText('Diseño'));
    expect(screen.queryByTestId('canvas2-design-panel')).toBeNull();
  });

  it('los componentes del proyecto son una pestaña más', () => {
    const { api } = unaPagina();
    render(
      <RightDock
        api={api as never}
        activePageId="a"
        design
        brandKit={marca}
        componentsPanel={<div>rejilla del host</div>}
      />,
    );
    // Plegado no se ve el contenido, solo el rótulo de la pestaña.
    expect(screen.queryByText('rejilla del host')).toBeNull();
    fireEvent.click(screen.getByText('Componentes'));
    expect(screen.getByText('rejilla del host')).toBeTruthy();
  });

  it('en modo lectura no hay Diseño ni Componentes: solo capas', () => {
    const { api } = unaPagina();
    render(
      <RightDock
        api={api as never}
        activePageId="a"
        viewMode
        design
        layers
        brandKit={marca}
        componentsPanel={<div>rejilla del host</div>}
      />,
    );
    expect(screen.getByText('Capas')).toBeTruthy();
    expect(screen.queryByText('Diseño')).toBeNull();
    expect(screen.queryByText('Componentes')).toBeNull();
  });

  it('acepta los rótulos del host', () => {
    const { api } = unaPagina();
    render(
      <RightDock
        api={api as never}
        activePageId="a"
        design
        brandKit={marca}
        labels={{ dock: { design: 'Design' } }}
      />,
    );
    expect(screen.getByText('Design')).toBeTruthy();
  });

  it('abre el agente del host con espacio para conversar y lo oculta en modo lectura', () => {
    const { api } = unaPagina();
    const props = { api: api as never, activePageId: 'a', design: true,
      agentPanel: <div>Conversación del host</div> };
    const { rerender } = render(<RightDock {...props} />);
    expect(screen.queryByText('Conversación del host')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agente' }));
    expect(screen.getByText('Conversación del host')).toBeTruthy();
    expect(screen.getByTestId('canvas2-right-dock').style.width).toBe('420px');
    fireEvent.click(screen.getByRole('button', { name: 'Diseño' }));
    expect(screen.queryByText('Conversación del host')).toBeNull();
    expect(screen.getByTestId('canvas2-right-dock').style.width).toBe('248px');
    rerender(<RightDock {...props} viewMode />);
    expect(screen.queryByRole('button', { name: 'Agente' })).toBeNull();
  });
});
