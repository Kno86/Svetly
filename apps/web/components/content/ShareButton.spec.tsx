// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareButton } from './ShareButton';

describe('ShareButton', () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'share');
  });

  it('opens the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<ShareButton title="Новость" />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ title: 'Новость', url: window.location.href }),
    );
  });

  it('falls back to copying the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareButton title="Новость" />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Ссылка скопирована'));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('copies the link when native sharing fails', async () => {
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      configurable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareButton title="Новость" />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Ссылка скопирована'));
  });

  it('shows the link when the clipboard is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareButton title="Новость" />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(window.location.href),
    );
  });
});
