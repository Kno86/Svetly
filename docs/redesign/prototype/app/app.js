/* SVETLY прототип: ядро. Без сети, без API — только hash-маршрутизация и демо-данные. */
const ICONS = '../assets/icons.svg';
const ic = (n, c = 'i') => `<svg class="${c}" aria-hidden="true"><use href="${ICONS}#${n}"/></svg>`;
const ROLES = { guest: 'Гость', resident: 'Житель', business: 'Предприниматель', admin: 'Администратор' };
const S = {
  role: localStorage.getItem('sv-role') || 'guest',
  state: sessionStorage.getItem('sv-state') || 'data',
};
const R = [];
let CUR = '/';
const MODALS = {};

function route(path, o) {
  const keys = (path.match(/:(\w+)/g) || []).map((k) => k.slice(1));
  R.push({ path, keys, re: new RegExp('^' + path.replace(/:(\w+)/g, '([^/]+)') + '$'), ...o });
}
function allowed(need) {
  if (!need) return true;
  if (need.includes(S.role)) return true;
  if (need.includes('resident') && (S.role === 'business' || S.role === 'admin')) return true;
  return false;
}
const go = (h) => (location.hash = h);

/* ---------- маленькие компоненты ---------- */
const badge = (t, tone = '') => `<span class="badge ${tone}">${t}</span>`;
const concept = (t = 'Концепция') => `<span class="badge concept" title="Этой функции нет в продукте">${t}</span>`;
const conceptNote = (t) =>
  `<div class="concept-note">${ic('flag', 'i-s')}<div><b>Концепция.</b> ${t}</div></div>`;
const btn = (t, o = {}) =>
  `<${o.href ? `a href="${o.href}"` : 'button type="' + (o.type || 'button') + '"'} class="btn ${o.cls || 'btn-secondary'}" ${o.attrs || ''}>${o.icon ? ic(o.icon, 'i-s') : ''}${t}</${o.href ? 'a' : 'button'}>`;
const demo = (msg) => `data-act="toast" data-msg="${msg || 'Демо: действие не выполняется'}"`;
const tones = { sun: 'ic-sun', sky: 'ic-sky', sage: 'ic-sage', primary: 'ic-primary' };
const av = (l, tone, s = 56) =>
  `<span class="av ${tones[tone] || 'ic-primary'}" style="width:${s}px;height:${s}px;font-size:${Math.round(s / 2.6)}px">${l}</span>`;
const photo = (tone = '', cls = '') => `<div class="photo ${tone} ${cls}" aria-hidden="true"></div>`;
const crumbs = (items) =>
  `<nav class="crumbs" aria-label="Навигация">${items.map(([t, h]) => (h ? `<a href="${h}">${t}</a>` : `<span aria-current="page">${t}</span>`)).join('<span aria-hidden="true">/</span>')}</nav>`;
function pageHead(title, o = {}) {
  return `<div class="page-h">${o.crumbs ? crumbs(o.crumbs) : ''}<div class="page-h-row"><div>${o.kicker ? `<span class="kicker">${o.kicker}</span>` : ''}<h1 tabindex="-1">${title}</h1>${o.sub ? `<p class="sub">${o.sub}</p>` : ''}</div>${o.actions ? `<div class="page-h-act">${o.actions}</div>` : ''}</div></div>`;
}
function tabs(group, items, cur) {
  return `<div class="tabs" role="tablist">${items.map(([v, t]) => `<button role="tab" data-act="tab" data-group="${group}" data-val="${v}" aria-selected="${v === cur}">${t}</button>`).join('')}</div>`;
}
const panel = (group, val, html, cur) =>
  `<div data-panel-group="${group}" data-panel="${val}" ${val === cur ? '' : 'hidden'}>${html}</div>`;
function field(label, o = {}) {
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  const ctl =
    o.type === 'textarea'
      ? `<textarea id="${id}" rows="${o.rows || 5}" ${o.req ? 'required' : ''} placeholder="${o.ph || ''}">${o.val || ''}</textarea>`
      : o.type === 'select'
        ? `<select id="${id}" ${o.req ? 'required' : ''}>${(o.opts || []).map((x) => `<option>${x}</option>`).join('')}</select>`
        : `<input id="${id}" type="${o.type || 'text'}" value="${o.val || ''}" placeholder="${o.ph || ''}" ${o.req ? 'required' : ''} ${o.attrs || ''}>`;
  return `<div class="fld"><label for="${id}">${label}${o.req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${ctl}${o.help ? `<small class="help">${o.help}</small>` : ''}</div>`;
}

/* ---------- состояния данных ---------- */
function skeleton(n = 4) {
  return `<div class="skel-list" aria-busy="true" aria-label="Загрузка">${Array.from({ length: n }, () => '<div class="skel"><i></i><div><b></b><b></b></div></div>').join('')}</div>`;
}
function emptyBox(t = 'Пока пусто', d = '', a = '') {
  return `<div class="empty">${ic('sun')}<h2>${t}</h2>${d ? `<p>${d}</p>` : ''}${a}</div>`;
}
function errorBox() {
  return `<div class="alert err" role="alert">${ic('alert')}<div><b>Не удалось загрузить данные.</b><p>Проверьте соединение и попробуйте ещё раз. Если ошибка повторяется — напишите в поддержку.</p><button class="btn btn-secondary" data-act="toast" data-msg="Демо: повторный запрос">Повторить</button></div></div>`;
}
function st(fn, empty = []) {
  if (S.state === 'loading') return skeleton();
  if (S.state === 'error') return errorBox();
  if (S.state === 'empty') return emptyBox(...empty);
  return fn();
}

/* ---------- каркасы ---------- */
const NAV = [
  ['/', 'Главная', 'home'], ['/news', 'Новости', 'news'], ['/ads', 'Объявления', 'ads'],
  ['/catalog', 'Услуги и бизнес', 'catalog'], ['/community', 'Сообщество', 'community'],
];
const MORE = [
  ['/events', 'События'], ['/directory', 'Справочник'], ['/catalog?tab=places', 'Места'], ['/issues', 'Обращения жителей'],
  ['/community?tab=polls', 'Опросы'], ['/ads?tab=jobs', 'Вакансии'], ['/ads?tab=lost', 'Потеряно и найдено'], ['/search', 'Поиск'],
];
function logo() {
  return `<a class="logo" href="#/" aria-label="SVETLY — на главную"><svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#B4441E"/><path d="M14 36a18 18 0 0 1 36 0z" fill="#F2B441"/><rect x="10" y="40" width="44" height="4" rx="2" fill="#FAF6EF"/><rect x="18" y="48" width="28" height="4" rx="2" fill="#FAF6EF" opacity=".8"/><rect x="26" y="56" width="12" height="3" rx="1.5" fill="#FAF6EF" opacity=".6"/></svg><span><span class="logo-word">SVETLY</span><span class="logo-sub">Октябрьский · Светлый</span></span></a>`;
}
function ribbon() {
  const o = (obj, cur) => Object.entries(obj).map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('');
  return `<div class="proto-bar"><span class="pb-t">Прототип · данные вымышлены · действия не выполняются</span>
  <label>Роль <select data-ctl="role">${o(ROLES, S.role)}</select></label>
  <label>Данные <select data-ctl="state">${o({ data: 'Есть', empty: 'Пусто', loading: 'Загрузка', error: 'Ошибка' }, S.state)}</select></label>
  <a href="#/screens">Карта экранов</a></div>`;
}
function header(r) {
  const cur = r.section || '';
  const guest = S.role === 'guest';
  const acts = guest
    ? `<a class="btn btn-primary hide-m" href="#/submit">${ic('plus', 'i-s')}Разместить</a><a class="btn btn-secondary hide-m" href="#/login">Войти</a>`
    : `<a class="icon-btn hide-m" href="#/me/messages" aria-label="Сообщения, 2 непрочитанных">${ic('chat')}<i class="cnt">2</i></a>
       <a class="icon-btn hide-m" href="#/me/notifications" aria-label="Уведомления, 2 новых">${ic('bell')}<i class="cnt">2</i></a>
       <a class="btn btn-primary hide-m" href="#/submit">${ic('plus', 'i-s')}Разместить</a>
       ${S.role === 'admin' ? `<a class="icon-btn hide-t" href="#/admin" aria-label="Админ-платформа" title="Админ-платформа">${ic('shield')}</a>` : ''}
       <a class="me-btn hide-m" href="${S.role === 'business' ? '#/biz' : '#/me'}" aria-label="Кабинет">${av(S.role === 'business' ? 'И' : S.role === 'admin' ? 'А' : 'Ж', 'sky', 40)}</a>`;
  return `<header class="hdr"><div class="container hdr-in">${logo()}
  <nav class="nav" aria-label="Основные разделы">${NAV.map(([h, t, s]) => `<a href="#${h}" ${s === cur ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
  <div class="hdr-act"><a class="icon-btn hide-t" href="#/search" aria-label="Поиск">${ic('search')}</a>${acts}
  <button class="icon-btn only-t" data-act="menu" aria-label="Открыть меню" aria-expanded="false">${ic('menu')}</button></div></div></header>`;
}
function footer() {
  return `<footer class="ftr"><div class="container ftr-g"><div><span class="logo-word" style="color:var(--ink)">SVETLY</span><p>Цифровая платформа жителей посёлка Октябрьский и жилого района Светлый, Мошковский район.</p></div>
  <div><h4>Разделы</h4><a href="#/news">Новости</a><a href="#/ads">Объявления</a><a href="#/catalog">Услуги и бизнес</a><a href="#/community">Сообщество</a></div>
  <div><h4>Жителям</h4><a href="#/submit">Разместить</a><a href="#/issues">Обращения</a><a href="#/directory">Справочник</a><a href="#/events">События</a></div>
  <div><h4>Платформа</h4><a href="#/screens">Карта экранов</a><a href="#/404">Правила (нет страницы)</a><a href="#/error">Пример ошибки</a></div></div></footer>`;
}
function tabbar(r) {
  const a = r.area === 'me' || r.area === 'biz' ? 'me' : r.section === 'home' ? 'home' : '';
  return `<nav class="tabbar" aria-label="Нижнее меню">
  <a href="#/" ${a === 'home' ? 'aria-current="page"' : ''}>${ic('home')}Главная</a>
  <button data-act="menu">${ic('grid')}Разделы</button>
  <a class="fab" href="#/submit">${ic('plus')}Разместить</a>
  <a href="#/me/messages">${ic('chat')}Сообщения</a>
  <a href="${S.role === 'guest' ? '#/login' : S.role === 'business' ? '#/biz' : '#/me'}" ${a === 'me' ? 'aria-current="page"' : ''}>${ic('user')}${S.role === 'guest' ? 'Войти' : 'Кабинет'}</a></nav>`;
}
function publicLayout(r, body) {
  return `${header(r)}<main id="main" tabindex="-1" class="${r.wide ? '' : 'container'} page">${body}</main>${footer()}${tabbar(r)}`;
}
const ME_NAV = [
  ['/me', 'Обзор', 'home'], ['/me/pubs', 'Мои публикации', 'tag'], ['/me/issues', 'Обращения', 'alert'], ['/me/favorites', 'Избранное', 'heart'],
  ['/me/messages', 'Сообщения', 'chat'], ['/me/groups', 'Группы', 'people'], ['/me/notifications', 'Уведомления', 'bell'],
  ['/me/reco', 'Рекомендации', 'star'], ['/me/profile', 'Профиль и безопасность', 'settings'],
];
const BIZ_NAV = [
  ['/biz', 'Обзор', 'home'], ['/biz/profile', 'Профиль организации', 'briefcase'], ['/biz/services', 'Услуги и предложения', 'tool'],
  ['/biz/posts', 'Публикации', 'news'], ['/biz/inquiries', 'Заявки жителей', 'chat'], ['/biz/stats', 'Статистика', 'chart'], ['/biz/settings', 'Настройки и проверка', 'settings'],
];
function cabLayout(r, body) {
  const nav = r.area === 'biz' ? BIZ_NAV : ME_NAV;
  const path = r.navKey || CUR;
  const sw = S.role === 'business'
    ? `<div class="sw" role="group" aria-label="Кабинет"><a href="#/me" ${r.area === 'me' ? 'aria-current="page"' : ''}>Житель</a><a href="#/biz" ${r.area === 'biz' ? 'aria-current="page"' : ''}>Бизнес</a></div>` : '';
  return `${header(r)}<div class="container cab"><aside class="cab-nav" aria-label="${r.area === 'biz' ? 'Кабинет бизнеса' : 'Личный кабинет'}">
  <div class="cab-who">${av(r.area === 'biz' ? 'М' : 'Ж', r.area === 'biz' ? 'sun' : 'sky', 44)}<div><b>${r.area === 'biz' ? 'Мастер на час (пример)' : 'Житель (пример)'}</b><span>${r.area === 'biz' ? 'кабинет бизнеса' : 'личный кабинет'}</span></div></div>
  ${sw}<nav>${nav.map(([h, t, i]) => `<a href="#${h}" ${h === path ? 'aria-current="page"' : ''}>${ic(i, 'i-s')}<span>${t}</span></a>`).join('')}</nav>
  <button class="cab-out" data-act="logout">${ic('logout', 'i-s')}Выйти</button></aside>
  <main id="main" tabindex="-1" class="cab-main">${body}</main></div>${tabbar(r)}`;
}
const ADM_NAV = [
  ['', [['/admin', 'Обзор', 'home']]],
  ['Модерация', [['/admin/queue', 'Очередь', 'check'], ['/admin/complaints', 'Жалобы', 'flag']]],
  ['Контент', [['/admin/content/news', 'Новости', 'news'], ['/admin/content/events', 'События', 'calendar'], ['/admin/content/orgs', 'Организации и услуги', 'briefcase'], ['/admin/content/directory', 'Справочник', 'phone'], ['/admin/categories', 'Категории', 'list']]],
  ['Сообщество', [['/admin/issues', 'Обращения', 'alert'], ['/admin/polls', 'Опросы', 'poll'], ['/admin/groups', 'Группы и лента', 'people']]],
  ['Бизнес', [['/admin/business', 'Заявки бизнеса', 'briefcase']]],
  ['Люди', [['/admin/users', 'Пользователи и роли', 'user']]],
  ['Система', [['/admin/analytics', 'Аналитика', 'chart'], ['/admin/audit', 'Журнал аудита', 'eye'], ['/admin/settings', 'Настройки и функции', 'settings']]],
];
function adminLayout(r, body) {
  const path = r.navKey || CUR;
  return `<div class="adm"><header class="adm-top"><button class="icon-btn only-t" data-act="admnav" aria-label="Меню админки">${ic('menu')}</button>
  <a class="adm-logo" href="#/admin"><svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#B4441E"/><path d="M14 36a18 18 0 0 1 36 0z" fill="#F2B441"/><rect x="10" y="40" width="44" height="4" rx="2" fill="#FAF6EF"/><rect x="18" y="48" width="28" height="4" rx="2" fill="#FAF6EF" opacity=".8"/></svg><span>SVETLY <em>админ-платформа</em></span></a>
  <label class="adm-search hide-m"><span class="sr">Поиск по админке</span>${ic('search', 'i-s')}<input placeholder="Найти пользователя, запись, № обращения"></label>
  <a class="btn btn-ghost hide-m" href="#/">${ic('external', 'i-s')}На сайт</a>${av('А', 'sky', 36)}</header>
  <div class="adm-body"><aside class="adm-nav" aria-label="Разделы админки">${ADM_NAV.map(([g, items]) => `${g ? `<h3>${g}</h3>` : ''}${items.map(([h, t, i]) => `<a href="#${h}" ${h === path ? 'aria-current="page"' : ''}>${ic(i, 'i-s')}${t}</a>`).join('')}`).join('')}
  <p class="adm-role">Вы: Администратор (пример). Пункты зависят от роли; права проверяет сервер.</p></aside>
  <main id="main" tabindex="-1" class="adm-main">${body}</main></div></div>`;
}
function needLogin(r) {
  return `<div class="gate">${ic('user')}<h1 tabindex="-1">Войдите, чтобы продолжить</h1><p>Раздел «${r.title}» доступен после входа. После входа вы вернётесь на эту страницу.</p>
  <div class="row-btns">${btn('Войти', { href: '#/login?next=' + encodeURIComponent(location.hash.slice(1)), cls: 'btn-primary' })}${btn('Зарегистрироваться', { href: '#/register' })}</div></div>`;
}
function forbidden(r) {
  const why = r.area === 'biz' ? 'Кабинет бизнеса открывается владельцу карточки организации. Подайте заявку на размещение — после проверки кабинет появится.' : r.area === 'admin' ? 'Админ-платформа доступна сотрудникам с ролью. Роли назначает администратор.' : 'У вашей роли нет доступа к этому разделу.';
  return `<div class="gate">${ic('shield')}<h1 tabindex="-1">Нет доступа</h1><p>${why}</p><p class="muted">В прототипе роль переключается в верхней панели.</p>
  <div class="row-btns">${r.area === 'biz' ? btn('Подать заявку', { href: '#/submit/org', cls: 'btn-primary' }) : ''}${btn('На главную', { href: '#/' })}</div></div>`;
}

/* ---------- рендер ---------- */
function render() {
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  CUR = path;
  const q = new URLSearchParams(qs || '');
  let m = null;
  let r = R.find((x) => (m = path.match(x.re)));
  if (!r) { r = R.find((x) => x.path === '/404'); m = [path]; }
  const p = { q };
  r.keys.forEach((k, i) => (p[k] = decodeURIComponent(m[i + 1])));
  let html;
  if (!allowed(r.need)) html = publicLayout({ ...r, section: '' }, S.role === 'guest' ? needLogin(r) : forbidden(r));
  else {
    const body = r.render(p);
    html = r.area === 'admin' ? adminLayout(r, body) : r.area === 'me' || r.area === 'biz' ? cabLayout(r, body) : r.bare ? `<main id="main" tabindex="-1" class="bare">${body}</main>` : publicLayout(r, body);
  }
  document.getElementById('app').innerHTML = ribbon() + html;
  document.title = r.title + ' · SVETLY прототип';
  closeLayer();
  window.scrollTo(0, 0);
  if (r.after) r.after(p);
}

/* ---------- слой: модальные окна, меню, тосты ---------- */
let lastFocus = null;
function openLayer(html, cls = 'dlg') {
  lastFocus = document.activeElement;
  const L = document.getElementById('layer');
  L.innerHTML = `<div class="ov" data-act="close-ov"><div class="${cls}" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
  const d = L.querySelector('[role=dialog]');
  (d.querySelector('input,textarea,select,button:not([data-act=close])') || d).focus();
}
function closeLayer() {
  const L = document.getElementById('layer');
  if (L && L.innerHTML) { L.innerHTML = ''; lastFocus && lastFocus.focus && lastFocus.focus(); }
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function menuDrawer() {
  return `<div class="dr-h">${logo()}<button class="icon-btn" data-act="close" aria-label="Закрыть меню">${ic('close')}</button></div>
  <a class="btn btn-primary" href="#/submit" style="width:100%">${ic('plus', 'i-s')}Разместить</a>
  <nav class="dr-nav" aria-label="Разделы">${NAV.map(([h, t, s]) => `<a href="#${h}">${ic(s === 'home' ? 'home' : s === 'news' ? 'news' : s === 'ads' ? 'tag' : s === 'catalog' ? 'briefcase' : 'people', 'i-s')}${t}</a>`).join('')}</nav>
  <h3 class="dr-g">Ещё</h3><nav class="dr-nav dr-more">${MORE.map(([h, t]) => `<a href="#${h}">${t}</a>`).join('')}</nav>
  ${S.role === 'guest' ? btn('Войти', { href: '#/login', cls: 'btn-secondary' }) : `<nav class="dr-nav"><a href="#/me">${ic('user', 'i-s')}Кабинет</a>${S.role === 'business' ? `<a href="#/biz">${ic('briefcase', 'i-s')}Кабинет бизнеса</a>` : ''}${S.role === 'admin' ? `<a href="#/admin">${ic('shield', 'i-s')}Админка</a>` : ''}</nav>`}`;
}
function admDrawer() {
  return `<div class="dr-h"><b>Админ-платформа</b><button class="icon-btn" data-act="close" aria-label="Закрыть">${ic('close')}</button></div>${document.querySelector('.adm-nav')?.innerHTML || ''}`;
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (e.target.closest('a[href^="#"]') && document.getElementById('layer').innerHTML && !a) closeLayer();
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'close-ov') { if (e.target === a) closeLayer(); return; }
  e.preventDefault();
  if (act === 'toast') toast(a.dataset.msg);
  else if (act === 'close') closeLayer();
  else if (act === 'menu') openLayer(menuDrawer(), 'drawer');
  else if (act === 'admnav') openLayer(admDrawer(), 'drawer');
  else if (act === 'modal') openLayer(MODALS[a.dataset.id](a.dataset), a.dataset.sheet ? 'dlg sheet' : 'dlg');
  else if (act === 'go') { closeLayer(); go(a.dataset.to); if (a.dataset.msg) setTimeout(() => toast(a.dataset.msg), 50); }
  else if (act === 'login-as') { setRole(a.dataset.role); toast('Демо-вход: ' + ROLES[a.dataset.role]); go(a.dataset.next || (a.dataset.role === 'business' ? '/biz' : a.dataset.role === 'admin' ? '/admin' : '/me')); }
  else if (act === 'logout') { setRole('guest'); toast('Вы вышли (демо)'); go('/'); }
  else if (act === 'tab') {
    const g = a.dataset.group;
    document.querySelectorAll(`[data-act=tab][data-group="${g}"]`).forEach((b) => b.setAttribute('aria-selected', b === a));
    document.querySelectorAll(`[data-panel-group="${g}"]`).forEach((p) => (p.hidden = p.dataset.panel !== a.dataset.val));
  } else if (act === 'toggle') {
    const on = a.getAttribute('aria-pressed') !== 'true';
    a.setAttribute('aria-pressed', on);
    if (a.dataset.on) a.lastChild.textContent = on ? a.dataset.on : a.dataset.off;
    toast(on ? (a.dataset.msgOn || 'Демо: включено') : (a.dataset.msgOff || 'Демо: выключено'));
  }
});
document.addEventListener('change', (e) => {
  const c = e.target.dataset.ctl;
  if (c === 'role') { setRole(e.target.value); render(); }
  if (c === 'state') { S.state = e.target.value; sessionStorage.setItem('sv-state', S.state); render(); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  f.querySelectorAll('.fld').forEach((x) => { x.classList.remove('err'); x.querySelector('.emsg')?.remove(); });
  const bad = [...f.querySelectorAll('[required]')].filter((x) => !x.value.trim() || (x.type === 'email' && !/^\S+@\S+\.\S+$/.test(x.value)) || (x.minLength > 0 && x.value.length < x.minLength));
  bad.forEach((x) => {
    const fld = x.closest('.fld'); fld.classList.add('err'); x.setAttribute('aria-invalid', 'true');
    fld.insertAdjacentHTML('beforeend', `<small class="emsg">${!x.value.trim() ? 'Заполните поле' : x.type === 'email' ? 'Проверьте формат email' : 'Минимум ' + x.minLength + ' символов'}</small>`);
  });
  if (bad.length) { bad[0].focus(); toast('Проверьте выделенные поля'); return; }
  if (f.dataset.role) setRole(f.dataset.role);
  closeLayer();
  if (f.dataset.next) go(f.dataset.next);
  if (f.dataset.ok) setTimeout(() => toast(f.dataset.ok), 50);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLayer(); });
function setRole(r) { S.role = r; localStorage.setItem('sv-role', r); }
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

/* общие модальные окна */
MODALS.reject = (d) => `<h2>Отклонить: ${d.title || 'запись'}</h2><form data-form data-ok="Демо: отклонено, автор получит уведомление с причиной">
${field('Причина (её увидит автор)', { type: 'select', opts: ['Нет цены или описания', 'Запрещённый товар или услуга', 'Повтор объявления', 'Оскорбления', 'Другое'] })}
${field('Комментарий', { type: 'textarea', rows: 3, req: true, ph: 'Что исправить, чтобы публикация прошла проверку' })}
<div class="row-btns end">${btn('Отмена', { attrs: 'data-act="close"' })}${btn('Отклонить', { type: 'submit', cls: 'btn-danger' })}</div></form>`;
MODALS.danger = (d) => `<h2>${d.title || 'Подтвердите действие'}</h2><div class="alert err">${ic('alert')}<div>${d.text || 'Действие необратимо.'}</div></div>
<form data-form data-ok="${d.ok || 'Демо: выполнено'}">${field('Чтобы подтвердить, введите «' + (d.word || 'ПОДТВЕРЖДАЮ') + '»', { req: true, attrs: `pattern="${d.word || 'ПОДТВЕРЖДАЮ'}"` })}
<div class="row-btns end">${btn('Отмена', { attrs: 'data-act="close"' })}${btn(d.btn || 'Подтвердить', { type: 'submit', cls: 'btn-danger' })}</div></form>`;
MODALS.report = () => `<h2>Пожаловаться</h2><form data-form data-ok="Демо: жалоба отправлена модераторам">${field('Причина', { type: 'select', opts: ['Мошенничество', 'Спам', 'Оскорбления', 'Запрещённое содержание', 'Другое'] })}${field('Подробности', { type: 'textarea', rows: 3 })}<p class="muted">Модератор увидит только эту публикацию.</p><div class="row-btns end">${btn('Отмена', { attrs: 'data-act="close"' })}${btn('Отправить', { type: 'submit', cls: 'btn-primary' })}</div></form>`;
MODALS.filters = () => `<h2>Фильтры</h2>${filtersBody()}<div class="row-btns end">${btn('Сбросить', { attrs: demo('Демо: фильтры сброшены') })}${btn('Показать', { cls: 'btn-primary', attrs: 'data-act="close"' })}</div>`;
function filtersBody() {
  return `<div class="filters-b">${field('Категория', { type: 'select', opts: ['Все категории', ...DATA.cats] })}${field('Цена до, ₽', { type: 'number', ph: 'Любая' })}
  <fieldset class="chk"><legend>Тип</legend><label><input type="checkbox" checked> Продам</label><label><input type="checkbox" checked> Отдам даром</label><label><input type="checkbox"> Только с фото</label></fieldset></div>`;
}
