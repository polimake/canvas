// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeSwitch } from '../src/ui/navigation/ModeSwitch';
import { DEFAULT_LABELS } from '../src/ui/shared/labels';

afterEach(cleanup);

const labels = DEFAULT_LABELS.mode;

describe('ModeSwitch', () => {
  it('con edición: los tres modos, el actual marcado', () => {
    const onChange = vi.fn();
    render(<ModeSwitch mode="edit" onChange={onChange} modes={['view', 'comment', 'edit']} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Editar' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    expect(onChange).toHaveBeenLastCalledWith('comment');
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(onChange).toHaveBeenLastCalledWith('view');
  });

  it('pulsar el modo actual no avisa', () => {
    const onChange = vi.fn();
    render(<ModeSwitch mode="view" onChange={onChange} modes={['view', 'comment', 'edit']} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('con comentarios: Ver y Comentar, sin Editar', () => {
    render(<ModeSwitch mode="comment" onChange={() => {}} modes={['comment', 'view']} labels={labels} />);
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Ver', 'Comentar']);
  });

  it('solo lectura: nada que elegir, no se pinta', () => {
    const { container } = render(<ModeSwitch mode="view" onChange={() => {}} modes={['view']} labels={labels} />);
    expect(container.firstChild).toBeNull();
  });
});
