// Food Explorer: instant search, filter chips, sort, live count, URL state,
// progressive card rendering and the detail sheet.

import { card, esc, openDetail, closeSheet, groupStyle } from './ui.js';

const BATCH = 48;

const FACETS = [
  { key: 'group', label: 'Food group' },
  { key: 'meal', label: 'Single or mixed' },
  { key: 'ref', label: 'Reference food' },
  { key: 'country', label: 'Country' },
];

const MEAL_VALUES = { single: 'SINGLE', mixed: 'MIXED MEAL' };
const SORTS = { asc: 'II low → high', desc: 'II high → low', az: 'A–Z' };

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function renderExplorer(app, data, params, options = {}) {
  const groups = data.groups;
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const countries = [...new Set(data.foods.map((f) => f.country))].sort((a, b) => a.localeCompare(b));

  const options_ = {
    group: groups.map((g) => ({ v: g.id, label: g.label, emoji: g.emoji, style: groupStyle(g) })),
    meal: [{ v: 'single', label: 'Single food' }, { v: 'mixed', label: 'Mixed meal' }],
    ref: [{ v: 'glucose', label: 'vs glucose' }, { v: 'bread', label: 'vs bread' }],
    country: countries.map((c) => ({ v: c, label: c })),
  };

  // ----- state from URL -----
  const listParam = (k) => new Set((params.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean)
    .filter((v) => options_[k].some((o) => o.v === v)));
  const state = {
    q: params.get('q') || '',
    sort: SORTS[params.get('sort')] ? params.get('sort') : 'asc',
    ...Object.fromEntries(FACETS.map((f) => [f.key, listParam(f.key)])),
  };

  const title = options.title || 'Find a food’s insulin index';
  app.innerHTML = `
  <section class="explorer">
    <div class="wrap page-head">
      <p class="eyebrow">Food Explorer</p>
      <h1>${esc(title)}</h1>
      <p class="lede">Search all 629 foods. Tap any card for its portion, volunteers, study and footnotes.</p>
    </div>

    <div class="toolbar-wrap">
      <div class="wrap toolbar">
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <label for="q" class="sr-only">Search foods by name</label>
          <input id="q" type="search" placeholder="Search foods, e.g. brown rice" autocomplete="off" enterkeyhint="search" value="${esc(state.q)}">
          <button type="button" class="search-clear" aria-label="Clear search" ${state.q ? '' : 'hidden'}>✕</button>
        </div>
        <button type="button" class="filter-btn" aria-controls="filters" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
          <span>Filters</span><span class="filter-count" hidden></span>
        </button>
        <label class="sort">
          <span class="sr-only">Sort by</span>
          <select id="sort">${Object.entries(SORTS).map(([v, l]) => `<option value="${v}"${v === state.sort ? ' selected' : ''}>${l}</option>`).join('')}</select>
        </label>
      </div>
    </div>

    <div class="wrap explorer-layout">
      <div class="filters-backdrop" hidden></div>
      <aside id="filters" class="filters" aria-label="Filters">
        <div class="filters-head">
          <h2>Filters</h2>
          <button type="button" class="btn btn-ghost btn-sm" data-clear-filters>Clear all</button>
        </div>
        <div class="filters-body">
          ${FACETS.map((f) => `<fieldset class="facet facet-${f.key}">
            <legend>${f.label}</legend>
            <div class="chips" data-facet="${f.key}"></div>
          </fieldset>`).join('')}
        </div>
        <div class="filters-foot">
          <button type="button" class="btn btn-primary btn-block" data-close-filters>Show results</button>
        </div>
      </aside>

      <div class="results">
        <div class="results-bar">
          <p class="count" id="count" aria-live="polite" aria-atomic="true"></p>
          <div class="active-chips" id="active"></div>
        </div>
        <ul class="cards" id="cards"></ul>
        <div class="sentinel" id="sentinel" aria-hidden="true"></div>
        <div class="empty" id="empty" hidden>
          <span aria-hidden="true">🥄</span>
          <h2>No foods match</h2>
          <p>Try a shorter search or remove a filter.</p>
          <button type="button" class="btn btn-primary" data-clear-filters>Clear search and filters</button>
        </div>
      </div>
    </div>
  </section>`;

  const $ = (s) => app.querySelector(s);
  // Listen on this page's own root: #app outlives each page, so listeners there would pile up.
  const root = app.querySelector('.explorer');
  const input = $('#q');
  const clearBtn = $('.search-clear');
  const cardsEl = $('#cards');
  const countEl = $('#count');
  const sentinel = $('#sentinel');
  const filtersEl = $('#filters');
  const backdrop = $('.filters-backdrop');
  const filterBtn = $('.filter-btn');

  // ----- filtering -----
  const matchers = {
    group: (f, s) => s.has(f.group),
    meal: (f, s) => [...s].some((v) => MEAL_VALUES[v] === f.meal),
    ref: (f, s) => s.has(f.ref),
    country: (f, s) => s.has(f.country),
  };
  const valueOf = {
    group: (f) => f.group, ref: (f) => f.ref, country: (f) => f.country,
    meal: (f) => (f.meal === 'SINGLE' ? 'single' : 'mixed'),
  };

  function passes(f, except) {
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    if (terms.length && !terms.every((t) => f.searchKey.includes(t))) return false;
    return FACETS.every(({ key }) => key === except || !state[key].size || matchers[key](f, state[key]));
  }

  function sorted(list) {
    const out = [...list];
    if (state.sort === 'az') out.sort((a, b) => a.searchKey.localeCompare(b.searchKey));
    else if (state.sort === 'desc') out.sort((a, b) => b.iiValue - a.iiValue || a.searchKey.localeCompare(b.searchKey));
    else out.sort((a, b) => a.iiValue - b.iiValue || a.searchKey.localeCompare(b.searchKey));
    return out;
  }

  // ----- URL -----
  function writeURL() {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    FACETS.forEach(({ key }) => { if (state[key].size) p.set(key, [...state[key]].join(',')); });
    if (state.sort !== 'asc') p.set('sort', state.sort);
    const food = new URLSearchParams(location.hash.split('?')[1] || '').get('food');
    if (food) p.set('food', food);
    const qs = p.toString();
    history.replaceState(null, '', `#/explorer${qs ? `?${qs}` : ''}`);
  }

  // ----- render -----
  let results = [];
  let shown = 0;

  function renderChips() {
    FACETS.forEach(({ key }) => {
      const counts = {};
      data.foods.forEach((f) => { if (passes(f, key)) { const v = valueOf[key](f); counts[v] = (counts[v] || 0) + 1; } });
      app.querySelector(`[data-facet="${key}"]`).innerHTML = options_[key].map((o) => {
        const on = state[key].has(o.v);
        const n = counts[o.v] || 0;
        return `<button type="button" class="chip chip-${key}${n ? '' : ' is-empty'}"
          data-key="${key}" data-v="${esc(o.v)}" aria-pressed="${on}"${o.style ? ` style="${o.style}"` : ''}>
          ${o.emoji ? `<span aria-hidden="true">${o.emoji}</span>` : ''}
          <span class="chip-label">${esc(o.label)}</span>
          <span class="chip-n">${n}</span></button>`;
      }).join('');
    });
  }

  function renderActive() {
    const active = [];
    if (state.q.trim()) active.push({ key: 'q', v: state.q, label: `“${state.q.trim()}”` });
    FACETS.forEach(({ key }) => state[key].forEach((v) => {
      const o = options_[key].find((x) => x.v === v);
      active.push({ key, v, label: `${o.emoji ? `${o.emoji} ` : ''}${o.label}` });
    }));
    $('#active').innerHTML = active.map((a) => `<button type="button" class="active-chip" data-remove="${a.key}" data-v="${esc(a.v)}"
      aria-label="Remove filter ${esc(a.label)}">${esc(a.label)} <span aria-hidden="true">✕</span></button>`).join('')
      + (active.length > 1 ? '<button type="button" class="link-btn" data-clear-filters>Clear all</button>' : '');
    const nFilters = FACETS.reduce((s, { key }) => s + state[key].size, 0);
    const fc = $('.filter-count');
    fc.hidden = !nFilters;
    fc.textContent = nFilters;
  }

  function renderMore() {
    const next = results.slice(shown, shown + BATCH);
    cardsEl.insertAdjacentHTML('beforeend', next.map((f, i) => card(f, i)).join(''));
    shown += next.length;
    sentinel.hidden = shown >= results.length;
  }

  function update({ keepScroll = true } = {}) {
    results = sorted(data.foods.filter((f) => passes(f)));
    shown = 0;
    cardsEl.innerHTML = '';
    renderMore();
    const total = data.foods.length;
    countEl.innerHTML = results.length === total
      ? `Showing all <strong>${total}</strong> foods`
      : `<strong>${results.length}</strong> of ${total} foods`;
    $('#empty').hidden = results.length > 0;
    $('[data-close-filters]').textContent = `Show ${results.length} food${results.length === 1 ? '' : 's'}`;
    clearBtn.hidden = !state.q;
    renderChips();
    renderActive();
    writeURL();
    if (!keepScroll) {
      const top = $('.toolbar-wrap').getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  // ----- events -----
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = input.value; update(); }, 90);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); } });
  clearBtn.addEventListener('click', () => { input.value = ''; state.q = ''; update(); input.focus(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; update({ keepScroll: false }); });

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-key]');
    if (chip) {
      const set = state[chip.dataset.key];
      if (set.has(chip.dataset.v)) set.delete(chip.dataset.v); else set.add(chip.dataset.v);
      update();
      app.querySelector(`.chip[data-key="${chip.dataset.key}"][data-v="${CSS.escape(chip.dataset.v)}"]`)?.focus();
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      if (rm.dataset.remove === 'q') { state.q = ''; input.value = ''; } else state[rm.dataset.remove].delete(rm.dataset.v);
      update();
      return;
    }
    if (e.target.closest('[data-clear-filters]')) {
      state.q = ''; input.value = '';
      FACETS.forEach(({ key }) => state[key].clear());
      update();
      return;
    }
    if (e.target.closest('[data-close-filters]')) { setFilters(false); }
  });

  // Filters: sidebar on desktop, bottom sheet on phones.
  function setFilters(open) {
    filtersEl.classList.toggle('open', open);
    backdrop.hidden = !open;
    filterBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('lock', open);
    if (open) filtersEl.querySelector('button.chip')?.focus();
    else filterBtn.focus({ preventScroll: true });
  }
  filterBtn.addEventListener('click', () => setFilters(!filtersEl.classList.contains('open')));
  backdrop.addEventListener('click', () => setFilters(false));
  const onKey = (e) => { if (e.key === 'Escape' && filtersEl.classList.contains('open')) setFilters(false); };
  document.addEventListener('keydown', onKey);

  // Progressive rendering keeps scrolling smooth.
  const io = new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting) && shown < results.length) renderMore();
  }, { rootMargin: '900px 0px' });
  io.observe(sentinel);

  update();

  const food = params.get('food');
  if (food) requestAnimationFrame(() => openDetail(food));

  return () => {
    io.disconnect();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('lock');
    const detail = document.getElementById('detail');
    if (detail.open) closeSheet(detail);
  };
}
