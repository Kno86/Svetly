// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from '../brand/Logo';
import { SiteHeader } from '../shell/SiteHeader';
import { Button } from './Button';
import { useAsk } from './Dialog';
import { Checkbox, TextField } from './Field';
import { Alert, EmptyState } from './Feedback';
import { Tabs } from './Navigation';

afterEach(cleanup);

describe('Button', () => {
  it('is disabled and busy while loading', () => {
    render(<Button loading>Сохранить</Button>);
    const button = screen.getByRole('button', { name: 'Сохранить' });
    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});

describe('TextField', () => {
  it('links label, hint and error for assistive tech', () => {
    const { rerender } = render(<TextField label="Email" hint="Мы не публикуем адрес" />);
    const input = screen.getByLabelText('Email');
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Мы не публикуем адрес',
    );
    rerender(<TextField label="Email" hint="Мы не публикуем адрес" error="Укажите email" />);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Укажите email');
  });

  it('renders checkbox with an accessible label', () => {
    render(<Checkbox label="Согласен" />);
    expect(screen.getByRole('checkbox', { name: 'Согласен' })).toBeTruthy();
  });
});

describe('Feedback', () => {
  it('uses role=alert only for errors', () => {
    render(
      <>
        <Alert tone="error" title="Ошибка" />
        <Alert tone="success" title="Готово" />
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Ошибка');
    expect(screen.getByRole('status').textContent).toContain('Готово');
  });

  it('renders empty state', () => {
    render(<EmptyState title="Пока пусто" description="Здесь появятся материалы" />);
    expect(screen.getByRole('heading', { name: 'Пока пусто' })).toBeTruthy();
  });
});

describe('Tabs', () => {
  it('supports arrow-key navigation', () => {
    render(
      <Tabs
        label="Пример"
        tabs={[
          { id: 'a', label: 'Первая', content: 'A' },
          { id: 'b', label: 'Вторая', content: 'B' },
        ]}
      />,
    );
    const first = screen.getByRole('tab', { name: 'Первая' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Вторая' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('B');
  });
});

describe('Logo', () => {
  it('renders an accessible vector logo for each variant', () => {
    for (const variant of ['color', 'on-dark', 'mono', 'inverse'] as const) {
      const { container, unmount } = render(<Logo variant={variant} />);
      expect(container.querySelector('svg[role="img"][aria-label="SVETLY"]')).toBeTruthy();
      expect(container.querySelector('image, text')).toBeNull();
      unmount();
    }
  });
});

describe('SiteHeader', () => {
  it('shows five sections and opens the drawer with every module', () => {
    render(<SiteHeader />);
    const nav = screen.getByRole('navigation', { name: 'Основные разделы' });
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      'Новости',
      'Объявления',
      'Услуги и бизнес',
      'Сообщество',
    ]);
    const drawer = document.getElementById('mobile-nav');
    expect(drawer?.hidden).toBe(true);
    const [toggle] = screen.getAllByRole('button', { name: /Открыть меню|Разделы/ });
    fireEvent.click(toggle!);
    expect(drawer?.hidden).toBe(false);
    expect(drawer?.getAttribute('aria-modal')).toBe('true');
    expect(
      screen.getAllByRole('link', { name: 'Потеряно и найдено' })[0]?.getAttribute('href'),
    ).toBe('/lost-found');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(drawer?.hidden).toBe(true);
  });
});

describe('useAsk', () => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };

  function Harness() {
    const [dialog, ask] = useAsk();
    const [result, setResult] = useState('none');
    return (
      <>
        <button
          onClick={() =>
            void ask({ title: 'Отклонить?', field: 'Причина' }).then((v) => setResult(String(v)))
          }
        >
          go
        </button>
        <output>{result}</output>
        {dialog}
      </>
    );
  }

  it('resolves with the trimmed reason and undefined on cancel', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('go'));
    const submit = screen.getByRole('button', { name: 'Подтвердить', hidden: true });
    expect(submit).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText(/Причина/), { target: { value: '  нет фото ' } });
    fireEvent.click(submit);
    expect(await screen.findByText('нет фото')).toBeTruthy();

    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: 'Отмена', hidden: true }));
    expect(await screen.findByText('undefined')).toBeTruthy();
  });
});
