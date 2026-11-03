import Link from 'next/link';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';
import { primaryNav } from '../components/shell/navigation';

export default function NotFound() {
  return (
    <main
      id="main"
      className="container"
      style={{ paddingBlock: 'var(--space-16)', maxWidth: '44rem' }}
    >
      <EmptyState
        title="Страница не найдена"
        description="Возможно, адрес набран с ошибкой или запись снята с публикации."
        action={<ButtonLink href="/search">Поиск по платформе</ButtonLink>}
      />
      <nav aria-label="Разделы" style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
        <Link href="/">Главная</Link>
        {primaryNav.map((s) => (
          <span key={s.href}>
            {' · '}
            <Link href={s.href}>{s.label}</Link>
          </span>
        ))}
      </nav>
    </main>
  );
}
