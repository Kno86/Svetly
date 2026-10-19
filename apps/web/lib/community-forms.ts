import type { FieldSpec } from './community';
import { ISSUE_CATEGORIES } from './community';

export const JOB_FIELDS: FieldSpec[] = [
  { name: 'title', label: 'Должность', kind: 'text', required: true, minLength: 3, maxLength: 120 },
  {
    name: 'employer',
    label: 'Работодатель',
    kind: 'text',
    required: true,
    minLength: 2,
    maxLength: 120,
  },
  {
    name: 'description',
    label: 'Описание работы',
    kind: 'textarea',
    required: true,
    minLength: 10,
    maxLength: 5000,
  },
  { name: 'conditions', label: 'Условия', kind: 'textarea', maxLength: 3000, rows: 3 },
  { name: 'requirements', label: 'Требования', kind: 'textarea', maxLength: 3000, rows: 3 },
  {
    name: 'salary',
    label: 'Оплата',
    hint: 'Например, «от 40 000 ₽» или «по договорённости»',
    kind: 'text',
    maxLength: 120,
  },
  { name: 'schedule', label: 'График', kind: 'text', maxLength: 120 },
  { name: 'area', label: 'Где работать', kind: 'text', maxLength: 120 },
  {
    name: 'contactPhone',
    label: 'Телефон',
    hint: 'Виден только на странице вакансии',
    kind: 'tel',
  },
  {
    name: 'contactNote',
    label: 'Как откликнуться',
    hint: 'Например, «звонить с 9 до 18»',
    kind: 'text',
    maxLength: 300,
  },
];

export const LOST_FOUND_FIELDS: FieldSpec[] = [
  {
    name: 'kind',
    label: 'Что случилось',
    kind: 'select',
    required: true,
    options: [
      ['lost', 'Я потерял'],
      ['found', 'Я нашёл'],
    ],
  },
  {
    name: 'subject',
    label: 'Раздел',
    kind: 'select',
    required: true,
    options: [
      ['item', 'Вещь'],
      ['animal', 'Животное'],
    ],
  },
  { name: 'title', label: 'Коротко', kind: 'text', required: true, minLength: 3, maxLength: 120 },
  {
    name: 'description',
    label: 'Описание',
    hint: 'Не указывайте номера документов и карт: их владелец назовёт сам.',
    kind: 'textarea',
    required: true,
    minLength: 10,
    maxLength: 3000,
  },
  {
    name: 'area',
    label: 'Приблизительное место',
    hint: 'Улица или ориентир, без точного адреса дома',
    kind: 'text',
    maxLength: 120,
  },
  { name: 'happenedOn', label: 'Дата', kind: 'date' },
  { name: 'imageIds', label: 'Фото', kind: 'images', max: 6 },
  {
    name: 'contactPhone',
    label: 'Телефон',
    hint: 'Виден только на странице объявления',
    kind: 'tel',
  },
];

export const ISSUE_FIELDS: FieldSpec[] = [
  {
    name: 'category',
    label: 'Категория',
    kind: 'select',
    required: true,
    options: Object.entries(ISSUE_CATEGORIES),
  },
  {
    name: 'title',
    label: 'Суть проблемы',
    kind: 'text',
    required: true,
    minLength: 5,
    maxLength: 120,
  },
  {
    name: 'description',
    label: 'Подробности',
    kind: 'textarea',
    required: true,
    minLength: 10,
    maxLength: 5000,
  },
  {
    name: 'address',
    label: 'Место',
    hint: 'Улица или ориентир, если это важно',
    kind: 'text',
    maxLength: 200,
  },
  { name: 'imageIds', label: 'Фото', kind: 'images', max: 6 },
  {
    name: 'contact',
    label: 'Как с вами связаться (необязательно)',
    hint: 'Видят только сотрудники платформы',
    kind: 'text',
    maxLength: 200,
  },
  {
    name: 'isPublic',
    label: 'Показывать обращение и его статус всем жителям',
    hint: 'Без вашего имени и контактов. Если не отмечено, обращение видите только вы и сотрудники.',
    kind: 'checkbox',
  },
];

export const BUSINESS_FIELDS: FieldSpec[] = [
  {
    name: 'kind',
    label: 'Тип карточки',
    kind: 'select',
    required: true,
    options: [
      ['organization', 'Организация'],
      ['service', 'Услуга частного мастера'],
    ],
  },
  { name: 'name', label: 'Название', kind: 'text', required: true, minLength: 2, maxLength: 120 },
  {
    name: 'description',
    label: 'Описание',
    kind: 'textarea',
    required: true,
    minLength: 20,
    maxLength: 5000,
  },
  {
    name: 'services',
    label: 'Услуги, товары и цены',
    hint: 'Каждую позицию с новой строки',
    kind: 'textarea',
    maxLength: 3000,
    rows: 4,
  },
  { name: 'phone', label: 'Телефон', kind: 'tel' },
  { name: 'website', label: 'Сайт', hint: 'Адрес, начинающийся с https://', kind: 'url' },
  { name: 'address', label: 'Адрес', kind: 'text', maxLength: 200 },
  { name: 'serviceArea', label: 'География обслуживания', kind: 'text', maxLength: 200 },
  { name: 'hours', label: 'График работы', kind: 'text', maxLength: 300 },
];
