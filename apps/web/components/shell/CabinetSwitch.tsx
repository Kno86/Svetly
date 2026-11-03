import Link from 'next/link';
import { styles } from '../content/Blocks';

/** «Житель / Бизнес»: both cabinets are open to every resident, the API decides what each shows. */
export function CabinetSwitch({ current }: { current: 'resident' | 'business' }) {
  return (
    <nav aria-label="Выбор кабинета" className={styles.switch}>
      <Link href="/account" aria-current={current === 'resident' ? 'page' : undefined}>
        Житель
      </Link>
      <Link href="/business" aria-current={current === 'business' ? 'page' : undefined}>
        Бизнес
      </Link>
    </nav>
  );
}
