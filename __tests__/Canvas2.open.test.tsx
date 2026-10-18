// @vitest-environment jsdom
import { Component, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { excalMock, fakeApi, frame, member } from './helpers';

let engine = fakeApi([]);
/** Cada salto de vista que recibe el editor falso (el id del destino), en orden. */
let saltos: string[] = [];
/** Hace que el editor falso «hidrate»: su primer `onChange`, desde dentro. */
let hidratar: () => void = () => {};

vi.mock('../src/core/excal', () => ({
  ...excalMock,
  /**
   * Un editor de CLASE, como el de Excalidraw, porque el aviso que se vigila
   * aquí es el de las clases: «Cannot update during an existing state
   * transition». Imita las dos cosas del de verdad que hacen falta para verlo:
   *
   *  - `onChange` se emite desde su `componentDidUpdate`, así que la
   *    inicialización de páginas corre DENTRO del ciclo del editor;
   *  - un salto animado deja una animación en curso, y el SIGUIENTE salto la
   *    cancela con un `setState` del propio editor (`cancelInProgressAnimation`
   *    → `onCancel`). Ese `setState` es el que React no admite a mitad de un
   *    render.
   */
  Excalidraw: class Engine extends Component<{ excalidrawAPI: (api: unknown) => void }> {
    state = { hidratado: false, canceladas: 0 };
    cancelar: (() => void) | null = null;
    api = {
      ...engine.api,
      scrollToContent: (destino: { id: string }) => {
        this.cancelar?.();
        saltos.push(destino.id);
        this.cancelar = () => {
          this.cancelar = null;
          this.setState({ canceladas: this.state.canceladas + 1 });
        };
      },
    };
    componentDidMount() {
      hidratar = () => this.setState({ hidratado: true });
      this.props.excalidrawAPI(this.api);
    }
    componentDidUpdate(_: unknown, antes: { hidratado: boolean }) {
      if (this.state.hidratado && !antes.hidratado) engine.notify();
    }
    render() {
      return <div data-testid="engine" data-canceladas={this.state.canceladas} />;
    }
  },
}));
const { Canvas2Editor } = await import('../src/ui/editor/Canvas2');

const papel = (id: string, frameId: string, x: number, y: number, width: number, height: number) => ({
  ...member(id, frameId, x, y, width, height),
  locked: true,
  customData: { c2: 'pageBackground' },
});

/** Un marco ya marcado con su posición de documento: abrirlo no lo reescribe. */
const pagina = (id: string, index: number, x: number) =>
  frame(id, x, 0, 1080, 1080, { name: `Página ${index + 1}`, customData: { c2page: { index } } });

/** Dos páginas en su sitio, cada una con su papel y una capa encima. */
const dosPaginas = () => [
  // Forma canónica de una página (ver `pageElementsInOrder`): los miembros
  // primero y el marco al final, o `ensurePagePapers` migraría el orden.
  papel('papel-a', 'a', 0, 0, 1080, 1080),
  member('capa-a', 'a', 40, 40, 200, 200),
  pagina('a', 0, 0),
  papel('papel-b', 'b', 1128, 0, 1080, 1080),
  member('capa-b', 'b', 1168, 40, 200, 200),
  pagina('b', 1, 1128),
];

/** Lo que React ha dicho por consola, en una línea por aviso. */
const avisos = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((args: unknown[]) => args.map(String).join(' '));

const AVISO = 'Cannot update during an existing state transition';

let errores: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  saltos = [];
  // jsdom no implementa ninguna de las dos.
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  errores = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/**
 * Monta el editor como lo monta la app —en `StrictMode`, que en desarrollo
 * repite cada actualizador de estado— y deja pasar el primer `onChange`, que es
 * el que dispara la inicialización de páginas.
 */
function abrir(escena: any[]) {
  engine = fakeApi(escena);
  const montado = render(
    <StrictMode>
      <Canvas2Editor pages initialScene={{ elements: escena } as never} />
    </StrictMode>,
  );
  act(() => hidratar());
  return montado;
}

describe('abrir un diseño', () => {
  it('lleva la vista a la primera página, UNA vez y fuera del render', () => {
    abrir(dosPaginas());
    // Dentro de un actualizador de estado el salto se repetía, y la repetición
    // cancelaba la animación del primero con un `setState` a mitad del render.
    expect(avisos(errores).filter((linea: string) => linea.includes(AVISO))).toEqual([]);
    expect(saltos).toEqual(['a']);
  });

  it('no pierde el salto cuando la página se crea en ese mismo arranque', () => {
    // Una escena con contenido pero sin ninguna página: la inicialización crea
    // la primera, y el salto —que ya no es inmediato— tiene que encontrarla.
    abrir([member('suelto', '', 20, 20, 100, 100)]);
    const creada = engine.get().find((e) => e.type === 'frame');
    expect(creada).toBeTruthy();
    expect(saltos).toEqual([creada.id]);
    expect(avisos(errores).filter((linea: string) => linea.includes(AVISO))).toEqual([]);
  });

  it('si ya se eligió otra página antes de terminar de abrir, la vista se queda en ella', () => {
    const escena = dosPaginas();
    engine = fakeApi(escena);
    render(
      <StrictMode>
        <Canvas2Editor pages initialScene={{ elements: escena } as never} />
      </StrictMode>,
    );
    // La tira de páginas ya está en pantalla antes del primer `onChange`.
    fireEvent.click(screen.getByTitle('Página 2'));
    expect(saltos).toEqual(['b']);
    act(() => hidratar());
    // La inicialización respeta la elegida: ni la cambia ni se lleva la vista.
    expect(saltos).toEqual(['b']);
    expect(avisos(errores).filter((linea: string) => linea.includes(AVISO))).toEqual([]);
  });

  it('el papel guardado fuera de su marco vuelve a él, sin entrada de deshacer', () => {
    // La segunda página se añadió antes del 11/10: marco en (1128, 0), papel en
    // (1128, 10).
    const escena = dosPaginas().map((e) => (e.id === 'papel-b' ? { ...e, y: 10 } : e));
    abrir(escena);
    const por = (id: string) => engine.get().find((e) => e.id === id);
    expect([por('papel-b').x, por('papel-b').y, por('papel-b').width, por('papel-b').height])
      .toEqual([por('b').x, por('b').y, por('b').width, por('b').height]);
    // Es la forma canónica de la escena, no una edición: un solo commit y fuera
    // del historial.
    expect(engine.commits.map((c) => c.captureUpdate)).toEqual(['NEVER']);
    // Nada más se ha movido: el resto son los mismos objetos de antes.
    engine.get().forEach((e, i) => {
      if (e.id !== 'papel-b') expect(e).toBe(escena[i]);
    });
  });

  it('con cada papel en su marco, abrir no escribe nada en la escena', () => {
    const escena = dosPaginas();
    abrir(escena);
    expect(engine.commits).toEqual([]);
    expect(engine.get()).toBe(escena);
  });

  it('desmontar entre la inicialización y el salto lo cancela', () => {
    engine = fakeApi(dosPaginas());
    const { unmount } = render(
      <StrictMode>
        <Canvas2Editor pages initialScene={{ elements: engine.get() } as never} />
      </StrictMode>,
    );
    act(() => {
      engine.notify();
      unmount();
    });
    expect(saltos).toEqual([]);
  });

  it('desmontado, ni el reintento ni un cambio tardío mueven la vista', () => {
    vi.useFakeTimers();
    engine = fakeApi(dosPaginas());
    const { unmount } = render(
      <StrictMode>
        <Canvas2Editor pages initialScene={{ elements: engine.get() } as never} />
      </StrictMode>,
    );
    unmount();
    act(() => {
      engine.notify();
      vi.advanceTimersByTime(6000);
    });
    expect(saltos).toEqual([]);
    expect(engine.commits).toEqual([]);
  });
});

describe('RePág y AvPág', () => {
  const pulsar = (key: 'PageDown' | 'PageUp') =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });

  it('pasan de página una vez por pulsación, sin el aviso de React', () => {
    abrir(dosPaginas());
    expect(saltos).toEqual(['a']);
    // El salto iba dentro del actualizador de la página activa: en desarrollo
    // se repetía, y el segundo cancelaba la animación del primero a mitad del
    // render.
    pulsar('PageDown');
    expect(saltos).toEqual(['a', 'b']);
    pulsar('PageDown');
    expect(saltos).toEqual(['a', 'b', 'a']);
    pulsar('PageUp');
    expect(saltos).toEqual(['a', 'b', 'a', 'b']);
    expect(avisos(errores).filter((linea: string) => linea.includes(AVISO))).toEqual([]);
  });

  it('dos pulsaciones seguidas, antes de que React repinte, avanzan dos páginas', () => {
    abrir([
      ...dosPaginas(),
      pagina('c', 2, 2256),
      papel('papel-c', 'c', 2256, 0, 1080, 1080),
    ]);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    });
    expect(saltos).toEqual(['a', 'b', 'c']);
  });
});
