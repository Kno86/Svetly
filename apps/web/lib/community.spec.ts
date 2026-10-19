import { describe, expect, it } from 'vitest';
import { ISSUE_STATUS, initialValues, percent, tel, toPayload, type FieldSpec } from './community';

const fields: FieldSpec[] = [
  { name: 'title', label: 'Заголовок', kind: 'text', required: true },
  { name: 'area', label: 'Район', kind: 'text' },
  { name: 'description', label: 'Описание', kind: 'textarea' },
  {
    name: 'kind',
    label: 'Тип',
    kind: 'select',
    options: [
      ['lost', 'Потеряно'],
      ['found', 'Найдено'],
    ],
  },
  { name: 'isPublic', label: 'Публично', kind: 'checkbox' },
  { name: 'imageIds', label: 'Фото', kind: 'images' },
  { name: 'happenedOn', label: 'Дата', kind: 'date' },
];

describe('community form helpers', () => {
  it('builds defaults without inventing values', () => {
    expect(initialValues(fields)).toEqual({
      title: '',
      area: '',
      description: '',
      kind: 'lost',
      isPublic: false,
      imageIds: [],
      happenedOn: '',
    });
  });

  it('prefills from an API record and trims dates', () => {
    const v = initialValues(fields, {
      title: 'Кот',
      kind: 'found',
      isPublic: true,
      imageIds: ['a'],
      happenedOn: '2026-10-01T00:00:00.000Z',
    });
    expect(v).toMatchObject({
      title: 'Кот',
      kind: 'found',
      isPublic: true,
      imageIds: ['a'],
      happenedOn: '2026-10-01',
    });
  });

  it('turns empty optional fields into null and keeps privacy opt-in false by default', () => {
    const payload = toPayload(fields, {
      ...initialValues(fields),
      title: '  Пропал кот ',
      area: '   ',
    });
    expect(payload).toEqual({
      title: 'Пропал кот',
      area: null,
      description: '',
      kind: 'lost',
      isPublic: false,
      imageIds: [],
      happenedOn: null,
    });
  });

  it('labels every issue status from the spec', () => {
    expect(Object.keys(ISSUE_STATUS)).toEqual([
      'received',
      'reviewing',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'rejected',
    ]);
  });

  it('computes poll percentages safely', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
  });

  it('normalises phone links', () => {
    expect(tel('+7 (900) 000-00-00')).toBe('tel:+79000000000');
  });
});
