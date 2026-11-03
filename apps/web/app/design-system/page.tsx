import type { Metadata } from 'next';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Checkbox, Radio, Select, TextArea, TextField } from '../../components/ui/Field';
import { Alert, Badge, Card, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Breadcrumbs, Tabs } from '../../components/ui/Navigation';
import { contrastRatio } from '../../design/contrast';
import { fontSize, palette, semantic, space } from '../../design/tokens';
import styles from './ds.module.css';

export const metadata: Metadata = { title: 'Дизайн-система' };

const swatches: Array<{ name: string; value: string; on: string; note: string }> = [
  {
    name: 'Deep Forest',
    value: palette.ink,
    on: palette.paper,
    note: 'заголовки, тёмные поверхности',
  },
  { name: 'Forest', value: palette.primary, on: palette.white, note: 'основные кнопки, фокус' },
  { name: 'Leaf Green', value: palette.sage, on: palette.ink, note: 'только декор' },
  { name: 'Leaf Text', value: palette.sageText, on: palette.paper, note: 'ссылки, зелёный текст' },
  {
    name: 'Warm Gold',
    value: palette.sun,
    on: palette.ink,
    note: 'акценты, не для текста на светлом',
  },
  {
    name: 'Gold Text',
    value: palette.sunText,
    on: palette.sunSoft,
    note: 'текст на светло-золотом',
  },
  { name: 'Ivory', value: palette.paper, on: palette.textPrimary, note: 'фон страницы' },
  { name: 'White', value: palette.white, on: palette.textPrimary, note: 'карточки, поля' },
  { name: 'Primary Text', value: palette.textPrimary, on: palette.paper, note: 'основной текст' },
  {
    name: 'Secondary Text',
    value: palette.textSecondary,
    on: palette.paper,
    note: 'вторичный текст',
  },
  { name: 'Border', value: palette.border, on: palette.textPrimary, note: 'декоративные границы' },
  {
    name: 'Border Strong',
    value: palette.borderStrong,
    on: palette.white,
    note: 'границы полей (≥3:1)',
  },
  { name: 'Success', value: semantic.success, on: semantic.successSurface, note: 'успех' },
  { name: 'Warning', value: semantic.warning, on: semantic.warningSurface, note: 'предупреждение' },
  { name: 'Error', value: semantic.error, on: semantic.errorSurface, note: 'ошибка' },
  { name: 'Info', value: semantic.info, on: semantic.infoSurface, note: 'информация' },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {description && <p className={styles.muted}>{description}</p>}
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Дизайн-система' }]} />
      <div className={styles.intro}>
        <Badge tone="accent">Концепт на утверждение · PHASE 2</Badge>
        <h1>Дизайн-система SVETLY</h1>
        <p>
          Логотип, цвета, типографика и базовые компоненты платформы. Бренд — рабочий концепт: до
          коммерческого использования нужна проверка на сходство с зарегистрированными товарными
          знаками.
        </p>
      </div>

      <Section
        title="Логотип"
        description="Векторные SVG, надпись переведена в контуры (Manrope ExtraBold, SIL OFL 1.1)."
      >
        <div className={styles.logoGrid}>
          <div className={styles.logoTile}>
            <Logo height={48} />
            <span className={styles.logoCaption}>Основной — на светлом фоне</span>
          </div>
          <div className={`${styles.logoTile} ${styles.logoTileDark}`}>
            <Logo variant="on-dark" height={48} />
            <span className={styles.logoCaption}>Цветной — на тёмном фоне</span>
          </div>
          <div className={`${styles.logoTile} ${styles.logoTileIvory}`}>
            <Logo variant="mono" height={48} />
            <span className={styles.logoCaption}>Монохромный — для светлых фонов, печати</span>
          </div>
          <div className={`${styles.logoTile} ${styles.logoTileDark}`}>
            <Logo variant="inverse" height={48} />
            <span className={styles.logoCaption}>Инверсный — для тёмных фонов и фото</span>
          </div>
          <div className={styles.logoTile}>
            <div className={styles.sizes}>
              <Logo layout="mark" height={64} />
              <Logo layout="mark" height={40} />
              <Logo layout="mark" height={24} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/svetly-mark-small.svg"
                width={16}
                height={16}
                alt="Знак SVETLY 16 px"
              />
            </div>
            <span className={styles.logoCaption}>
              Знак приложения: 64 / 40 / 24 px и упрощённый 16 px (favicon)
            </span>
          </div>
        </div>
      </Section>

      <Section
        title="Цвета"
        description="Коэффициент контраста указан для пары «цвет / типичный фон или текст» по WCAG 2.2."
      >
        <div className={styles.swatches}>
          {swatches.map((s) => (
            <div key={s.name} className={styles.swatch}>
              <div className={styles.swatchColor} style={{ background: s.value }} />
              <div className={styles.swatchMeta}>
                <strong>{s.name}</strong>
                <span>{s.value}</span>
                <span>{s.note}</span>
                <span>контраст {contrastRatio(s.value, s.on).toFixed(2)}:1</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Типографика"
        description="Manrope Variable (SIL OFL 1.1), полная кириллица, шрифт поставляется вместе с приложением."
      >
        {(['4xl', '3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs'] as const).map((key) => (
          <div key={key} className={styles.typeRow}>
            <span className={styles.typeMeta}>
              {key} · {fontSize[key]}
            </span>
            <span
              style={{
                fontSize: `var(--font-size-${key})`,
                fontWeight: key.includes('xl') ? 750 : 500,
              }}
            >
              Светлый и Октябрьский — жизнь рядом с домом
            </span>
          </div>
        ))}
      </Section>

      <Section
        title="Отступы и сетка"
        description="Базовый шаг 4 px. Контейнер до 1216 px, 4 колонки на мобильных и 12 — от 768 px."
      >
        <div className="stack">
          {(['1', '2', '3', '4', '6', '8', '12', '16'] as const).map((key) => (
            <div key={key} className={styles.spaceRow}>
              <span style={{ width: '5rem' }}>space-{key}</span>
              <span className={styles.spaceBar} style={{ width: space[key] }} />
              <span className={styles.muted}>{space[key]}</span>
            </div>
          ))}
        </div>
        <div className={styles.gridDemo} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </Section>

      <Section
        title="Кнопки"
        description="Состояния: hover, focus-visible (обводка 3 px), active, disabled, loading."
      >
        <div className={styles.row}>
          <Button>Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Текстовая</Button>
          <Button variant="accent">Акцент</Button>
          <Button variant="danger">Удалить</Button>
        </div>
        <div className={styles.row}>
          <Button size="sm">Маленькая</Button>
          <Button size="lg">Большая</Button>
          <Button disabled>Недоступна</Button>
          <Button loading>Сохранение</Button>
        </div>
      </Section>

      <Section
        title="Формы"
        description="Подписи связаны с полями, подсказки и ошибки озвучиваются экранными дикторами."
      >
        <form className={styles.formGrid} noValidate>
          <TextField label="Имя" placeholder="Например, Анна" hint="Будет видно другим жителям" />
          <TextField
            label="Email"
            type="email"
            defaultValue="anna@"
            error="Введите корректный email"
            required
          />
          <TextField label="Недоступное поле" disabled defaultValue="Только чтение" />
          <Select label="Населённый пункт" defaultValue="oktyabrsky">
            <option value="oktyabrsky">пос. Октябрьский</option>
            <option value="svetly">ЖР Светлый</option>
          </Select>
          <TextArea label="Сообщение" placeholder="Опишите вопрос" />
          <div className="stack">
            <Checkbox label="Получать уведомления" defaultChecked />
            <fieldset className={styles.fieldset}>
              <legend>Как связаться</legend>
              <Radio name="contact" label="Email" defaultChecked />
              <Radio name="contact" label="Телефон" />
            </fieldset>
          </div>
        </form>
      </Section>

      <Section title="Карточки и статусы">
        <div className="grid">
          <Card interactive>
            <div className={styles.row}>
              <Badge tone="brand">Новое</Badge>
              <Badge tone="accent">Выделено</Badge>
            </div>
            <h3>Заголовок карточки</h3>
            <p className={styles.muted}>
              Короткое описание сущности. Карточки — основной блок списков платформы.
            </p>
          </Card>
          <Card>
            <div className={styles.row}>
              <Badge tone="success">Опубликовано</Badge>
              <Badge tone="warning">На модерации</Badge>
              <Badge tone="error">Отклонено</Badge>
              <Badge tone="info">Черновик</Badge>
              <Badge>Архив</Badge>
            </div>
            <p className={styles.muted}>
              Статусы будущих публикаций (модерация реализуется в следующих фазах).
            </p>
          </Card>
          <Card aria-hidden="true">
            <Skeleton width="50%" height="1.25rem" />
            <Skeleton />
            <Skeleton width="80%" />
            <p className={styles.muted}>Скелетон — состояние загрузки.</p>
          </Card>
        </div>
      </Section>

      <Section title="Сообщения и состояния">
        <div className="stack">
          <Alert tone="success" title="Изменения сохранены" />
          <Alert tone="info" title="Раздел скоро откроется">
            Мы сообщим, когда он станет доступен.
          </Alert>
          <Alert tone="warning" title="Проверьте данные">
            Некоторые поля заполнены не полностью.
          </Alert>
          <Alert tone="error" title="Не удалось сохранить">
            Повторите попытку позже.
          </Alert>
          <EmptyState
            title="Здесь пока пусто"
            description="Когда появятся материалы, они будут показаны в этом списке."
            action={<Button variant="secondary">Обновить</Button>}
          />
        </div>
      </Section>

      <Section title="Навигация и диалоги">
        <Tabs
          label="Пример вкладок"
          tabs={[
            {
              id: 'all',
              label: 'Все',
              content: (
                <p className={styles.muted}>
                  Содержимое вкладки «Все». Стрелки ← → переключают вкладки.
                </p>
              ),
            },
            {
              id: 'near',
              label: 'Рядом',
              content: <p className={styles.muted}>Содержимое вкладки «Рядом».</p>,
            },
            {
              id: 'fav',
              label: 'Избранное',
              content: <p className={styles.muted}>Содержимое вкладки «Избранное».</p>,
            },
          ]}
        />
        <div className={styles.row}>
          <ConfirmDialog
            triggerLabel="Удалить черновик"
            title="Удалить черновик?"
            description="Действие нельзя отменить. Это пример подтверждения опасного действия."
            confirmLabel="Удалить"
            danger
          />
        </div>
      </Section>
    </main>
  );
}
