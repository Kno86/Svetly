import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';

export default function NotFound() {
  return (
    <main
      id="main"
      className="container"
      style={{ paddingBlock: 'var(--space-16)', maxWidth: '44rem' }}
    >
      <EmptyState
        title="Страница не найдена"
        description="Возможно, адрес набран с ошибкой или раздел ещё не открыт."
        action={<ButtonLink href="/">На главную</ButtonLink>}
      />
    </main>
  );
}
