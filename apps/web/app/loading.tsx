import { Skeleton } from '../components/ui/Feedback';

export default function Loading() {
  return (
    <main
      id="main"
      className="container"
      aria-busy="true"
      style={{ paddingBlock: 'var(--space-16)' }}
    >
      <p className="visually-hidden" role="status">
        Загрузка…
      </p>
      <div className="stack">
        <Skeleton width="40%" height="2.5rem" />
        <Skeleton width="70%" />
        <Skeleton width="60%" />
        <div className="grid" style={{ marginTop: 'var(--space-8)' }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height="10rem" />
          ))}
        </div>
      </div>
    </main>
  );
}
