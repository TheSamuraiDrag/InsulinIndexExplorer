// Admin page: GitHub sign-in gate, the Photos tab (admin-photos.js) and the Data check tab.
// Data check: Supplemental Table 1 laid out like the paper's PDF, with automated checks,
// auto-flagged rows worth a look, and a review checklist (ticks + notes) saved in this browser.

import { esc, marked, footnoteMarker, FOOTNOTES, refTag, groupStyle, toast, foodPic, photoOf } from './ui.js';
import * as gh from './github.js';
import { renderPhotos, hasUnpublished, discardAll } from './admin-photos.js';

const STORE_KEY = 'ii-admin-review-v1';

// Page ranges from the PDF's "Table of Contents for Table 1".
const PDF_PAGES = {
  'Animal Protein, Poultry / Seafood / Meat Meals': '2–3',
  'Bakery Products (Non-Bread)': '4',
  'Beverages': '5–8',
  'Bread': '8–13',
  'Breakfast / Tea-Time Meals': '13–18',
  'Cereals & Cereal-Based Food': '18–22',
  'Cookies, Crackers & Biscuits': '22–26',
  'Dairy Products': '27–29',
  'Fibre & Fibre-Based Products': '29',
  'Fruit Products': '30',
  'Fruits': '30–32',
  'Infant Formulae / Food': '32–33',
  'Legumes, Pulse Products & Dishes': '34',
  'Lunch / Dinner Meals (Non-Rice)': '35–36',
  'Lunch / Dinner Meals (Rice)': '36–37',
  'Non-Rice Grains & Non-Rice Grains Products': '37–38',
  'Nutritional Support Products, Meal Replacement Food, Formulae & Bars': '38–39',
  'Pasta & Noodles': '39–40',
  'Potatoes & Potato-Based Meals': '41–42',
  'Regional / Traditional Food': '42–46',
  'Rice & Rice Products': '47–49',
  'Seed / Nut Products': '50',
  'Snack Food': '50–54',
  'Sweeteners': '54–55',
  'Vegetables & Vegetable Products': '56',
};

const TEXT_COLS = [['name', 'name'], ['portion', 'portion'], ['subjects', 'subjects'], ['comparator', 'comparator'], ['study', 'study'], ['country', 'country']];

// Patterns that often mean a copy/typing slip. Shown for review only, never "fixed".
const AUTO = {
  hyphen: { label: 'Hyphen + space', tip: 'A hyphen followed by a space, often a line break carried over from the PDF (e.g. “pan- fried”).', test: (v) => /\w- \w/.test(v) },
  brackets: { label: 'Unbalanced brackets', tip: 'The number of “(” and “)” differ.', test: (v) => (v.match(/\(/g) || []).length !== (v.match(/\)/g) || []).length },
  punct: { label: 'Ends in punctuation', tip: 'The value ends with “:”, “;” or “,”.', test: (v) => /[:;,]$/.test(v) },
  spaces: { label: 'Extra spaces', tip: 'Leading, trailing or double spaces.', test: (v) => v !== v.trim() || /\s{2,}/.test(v) },
  study: { label: 'Citation format', tip: 'The study isn’t in the usual “Author et al., Year [n]” form (missing year, missing space or extra comma).', field: 'study', test: (v) => !/, \d{4}[a-z]? \[\d+\]$/.test(v) },
  dupe: { label: 'Possible duplicate', tip: 'Another row has the same name, II, study and portion.' },
  na: { label: 'Portion NA', tip: 'Portion is “NA” (not available) in the paper. Informational.', info: true, field: 'portion', test: (v) => v === 'NA' },
};

const COL_LABEL = { name: 'name', portion: 'portion', subjects: 'subjects', comparator: 'comparator', study: 'study', country: 'country' };

function loadReview() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { checked: raw.checked || {}, notes: raw.notes || {} };
  } catch { return { checked: {}, notes: {} }; }
}
function saveReview(r) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(r)); return true; } catch { return false; }
}

// A short fingerprint of the published values, so a tick is dropped if the row later changes.
function fingerprint(f) {
  const s = [f.name, f.category, f.subcategory, f.portion, f.meal, f.ii, f.iiNote, f.subjects, f.comparator, f.study, f.country].join('␟');
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function scaled(ii) { // exact decimal sum without float drift
  const [w, d = ''] = ii.split('.');
  return Number(w) * 1000 + Number((d + '000').slice(0, 3));
}

function runChecks(data) {
  const F = data.foods;
  const count = (fn) => F.filter(fn).length;
  const studies = new Set(F.map((f) => (f.study.match(/\[(\d+)\]/) || [])[1]).filter(Boolean));
  const nums = F.map((f) => Number(f.n));
  const seen = new Set();
  const contiguous = F.every((f, i) => {
    if (i && F[i - 1].category === f.category) return true;
    if (seen.has(f.category)) return false;
    seen.add(f.category);
    return true;
  });
  const sum = F.reduce((s, f) => s + scaled(f.ii), 0);
  const row = (label, actual, expected, note = '') => ({ label, actual: String(actual), expected: String(expected), ok: String(actual) === String(expected), note });
  return [
    row('Foods (rows)', F.length, 629, 'Paper: 629 foods'),
    row('Single foods', count((f) => f.meal === 'SINGLE'), 469, 'Paper: 469'),
    row('Mixed meals', count((f) => f.meal === 'MIXED MEAL'), 160, 'Paper: 160'),
    row('Studies (unique reference numbers)', studies.size, 80, 'Paper: 80 articles'),
    row('Countries', new Set(F.map((f) => f.country)).size, 32, 'Paper: 32'),
    row('Paper categories', new Set(F.map((f) => f.category)).size, 25, 'Paper: 25'),
    row('Sum of all II values', (sum / 1000).toFixed(2), '42429.12'),
    row('Lowest II', Math.min(...F.map((f) => f.iiValue)), 1),
    row('Highest II', Math.max(...F.map((f) => f.iiValue)), 209),
    row('vs bread / vs glucose', `${count((f) => f.ref === 'bread')} / ${count((f) => f.ref === 'glucose')}`, '227 / 402'),
    row('Numbered 1 to N with no gaps', nums.every((n, i) => n === i + 1) ? 'yes' : 'no', 'yes'),
    row('Each category is one block (as in the PDF)', contiguous ? 'yes' : 'no', 'yes'),
    row('Every II is a number', F.every((f) => /^\d+(\.\d+)?$/.test(f.ii)) ? 'yes' : 'no', 'yes'),
    row('Only known footnote symbols in the II column', F.every((f) => !f.iiNote || FOOTNOTES[f.iiNote]) ? 'yes' : 'no', 'yes'),
    row('Every comparator names glucose, dextrose or bread', F.every((f) => /glucose|dextrose|bread|glucodin|diasol/i.test(f.comparator)) ? 'yes' : 'no', 'yes'),
  ];
}

function autoFlags(data) {
  const out = {};
  const add = (n, type, field) => { (out[n] ||= []).push({ type, field }); };
  data.foods.forEach((f) => {
    Object.entries(AUTO).forEach(([type, a]) => {
      if (!a.test) return;
      if (a.field) { if (a.test(f[a.field])) add(f.n, type, a.field); return; }
      TEXT_COLS.forEach(([key]) => { if (a.test(f[key])) add(f.n, type, key); });
    });
  });
  const byKey = {};
  data.foods.forEach((f) => { (byKey[[f.name, f.ii, f.study, f.portion].join('|')] ||= []).push(f.n); });
  Object.values(byKey).filter((ns) => ns.length > 1).forEach((ns) => ns.forEach((n) => add(n, 'dupe', 'name')));
  return out;
}

/* ---------- Sign-in and tabs ---------- */

// Admin login for the testing phase. This is a light lock: a site with no server can't keep a
// password truly secret, so it only guards the admin screens. Changing the live site also
// needs a one-time GitHub connection when someone presses Publish (admin-photos.js), and
// GitHub checks that itself. Change the login with: python3 scripts/set_admin_login.py
const LOGIN_HASH = '629e4e9d4e3dfb9e0fadaea740f96f266bf3ae7258c7a341b931fd651014a870';
const LOGIN_KEY = 'ii-admin-login';
const USER_KEY = 'ii-admin-user';

let memoryLogin = null; // used when browser storage is blocked
let active = () => {}; // clean-up for whatever the admin page last drew

async function hashLogin(user, pass) {
  const bytes = new TextEncoder().encode(`insulin-index-admin|${user.trim().toLowerCase()}|${pass}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readLogin() {
  try { return { hash: sessionStorage.getItem(LOGIN_KEY) || localStorage.getItem(LOGIN_KEY), user: sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY) }; } catch { return memoryLogin || {}; }
}
function saveLogin(user, remember) {
  memoryLogin = { hash: LOGIN_HASH, user };
  try {
    const keep = remember ? localStorage : sessionStorage;
    const drop = remember ? sessionStorage : localStorage;
    keep.setItem(LOGIN_KEY, LOGIN_HASH); keep.setItem(USER_KEY, user);
    drop.removeItem(LOGIN_KEY); drop.removeItem(USER_KEY);
  } catch { /* stay signed in for this page only */ }
}
function clearLogin() {
  memoryLogin = null;
  try { [sessionStorage, localStorage].forEach((st) => { st.removeItem(LOGIN_KEY); st.removeItem(USER_KEY); }); } catch { /* ignore */ }
}
const loggedIn = () => readLogin().hash === LOGIN_HASH;

export function renderAdmin(app, data, params) {
  active();
  active = draw(app, data, params) || (() => {});
  return () => { active(); active = () => {}; };
}

function draw(app, data, params) {
  if (!loggedIn()) return renderSignIn(app, data, params);
  const tab = params.get('tab') === 'photos' ? 'photos' : 'data';
  const bar = `<div class="wrap-wide admin-nav">
      <div class="seg" role="tablist" aria-label="Admin sections">
        <a role="tab" href="#/admin" aria-selected="${tab === 'data'}" ${tab === 'data' ? 'aria-current="page"' : ''}>Data check</a>
        <a role="tab" href="#/admin?tab=photos" aria-selected="${tab === 'photos'}" ${tab === 'photos' ? 'aria-current="page"' : ''}>Photos</a>
      </div>
      <p class="admin-who">Signed in as <strong>${esc(readLogin().user || 'admin')}</strong>
        <span data-gh-status>${gh.statusHtml()}</span>
        · <button type="button" class="link-btn" data-signout>Sign out</button></p>
    </div>`;
  let cleanup = () => {};
  if (tab === 'photos') {
    app.innerHTML = `<section class="admin">${bar}<div class="wrap-wide page-head">
        <p class="eyebrow">Admin · Photos</p><h1>Food photos</h1>
        <p class="lede">Add, replace or remove photos and choose which foods use them. Changes are previewed here first; <strong>Publish</strong> saves them to the live site, which updates about a minute later.</p>
      </div><div class="wrap-wide" id="ph-root"></div></section>`;
    let inner = () => {};
    renderPhotos(app.querySelector('#ph-root'), data, params).then((c) => { inner = c; });
    cleanup = () => inner();
  } else {
    cleanup = renderDataCheck(app, data, params);
    app.querySelector('.admin').insertAdjacentHTML('afterbegin', bar);
  }
  const onClick = (e) => {
    if (e.target.closest('[data-gh-disconnect]')) {
      gh.signOut();
      app.querySelectorAll('[data-gh-status]').forEach((el) => { el.innerHTML = gh.statusHtml(); });
      toast('GitHub disconnected on this device');
      return;
    }
    if (!e.target.closest('[data-signout]')) return;
    if (hasUnpublished() && !confirm('You have unpublished photo changes. Sign out and lose them?')) return;
    discardAll();
    clearLogin();
    history.replaceState(null, '', '#/admin');
    renderAdmin(app, data, new URLSearchParams());
  };
  app.addEventListener('click', onClick);
  return () => { app.removeEventListener('click', onClick); cleanup(); };
}

function renderSignIn(app, data, params) {
  app.innerHTML = `<section class="wrap admin-signin">
    <div class="signin-card">
      <p class="eyebrow">Admin</p>
      <h1>Sign in</h1>
      <p class="lede">For the research team: check the data against the paper and manage food photos.</p>
      <form class="signin-form" novalidate>
        <label for="si-user">Username</label>
        <input id="si-user" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>
        <label for="si-pass">Password</label>
        <input id="si-pass" type="password" autocomplete="current-password" required>
        <label class="signin-remember"><input type="checkbox" id="si-remember"> Keep me signed in on this device <span class="hint">(not on shared computers)</span></label>
        <p class="signin-error" role="alert"></p>
        <button type="submit" class="btn btn-primary">Sign in</button>
      </form>
    </div>
  </section>`;
  const form = app.querySelector('.signin-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = app.querySelector('#si-user').value;
    const pass = app.querySelector('#si-pass').value;
    const errEl = app.querySelector('.signin-error');
    const btn = form.querySelector('button');
    btn.disabled = true; errEl.textContent = '';
    const ok = (await hashLogin(user, pass)) === LOGIN_HASH;
    await new Promise((r) => setTimeout(r, ok ? 0 : 700)); // slow down guessing
    btn.disabled = false;
    if (!ok) { errEl.textContent = 'Wrong username or password.'; app.querySelector('#si-pass').select(); return; }
    saveLogin(user.trim().toLowerCase(), app.querySelector('#si-remember').checked);
    if (/^#\/admin(\?|$)/.test(location.hash)) renderAdmin(app, data, params);
  });
  app.querySelector('#si-user').focus();
  return () => {};
}

/* ---------- Data check ---------- */

function renderDataCheck(app, data, params) {
  const F = data.foods;
  const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));
  const review = loadReview();
  const prints = Object.fromEntries(F.map((f) => [f.n, fingerprint(f)]));
  // Drop ticks whose row has changed since it was checked.
  const changed = new Set(Object.keys(review.checked).filter((n) => prints[n] && review.checked[n] !== prints[n]));
  const flags = autoFlags(data);
  const checks = runChecks(data);
  const categories = [...new Set(F.map((f) => f.category))];

  const state = {
    q: params.get('q') || '',
    cat: categories.includes(params.get('cat')) ? params.get('cat') : '',
    show: params.get('show') || 'all',
    auto: params.get('auto') || '',
    site: params.get('site') === '1',
    active: null,
  };

  const autoCounts = {};
  Object.values(flags).forEach((list) => [...new Set(list.map((x) => x.type))].forEach((t) => { autoCounts[t] = (autoCounts[t] || 0) + 1; }));

  app.innerHTML = `
  <section class="admin">
    <div class="wrap-wide page-head">
      <p class="eyebrow">Admin · Data check</p>
      <h1>Supplemental Table 1, row by row</h1>
      <p class="lede">Laid out like the paper’s PDF so you can check it side by side, one PDF page at a time.
        Ticks and notes are saved <strong>in this browser only</strong>; export them to keep a copy. Nothing here changes the data.</p>
    </div>

    <div class="wrap-wide admin-top">
      <section class="admin-card" aria-labelledby="checks-title">
        <div class="admin-card-head">
          <h2 id="checks-title">Automated checks</h2>
          <span class="pill ${checks.every((c) => c.ok) ? 'pill-ok' : 'pill-bad'}">${checks.filter((c) => c.ok).length}/${checks.length} pass</span>
        </div>
        <div class="x-scroll"><table class="checks">
          <thead><tr><th scope="col">Check</th><th scope="col">Data</th><th scope="col">Expected</th><th scope="col"><span class="sr-only">Result</span></th></tr></thead>
          <tbody>${checks.map((c) => `<tr class="${c.ok ? '' : 'is-fail'}"><th scope="row">${esc(c.label)}${c.note ? `<span class="hint">${esc(c.note)}</span>` : ''}</th>
            <td>${esc(c.actual)}</td><td>${esc(c.expected)}</td>
            <td><span class="result ${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓ Pass' : '✕ Check'}</span></td></tr>`).join('')}</tbody>
        </table></div>
      </section>

      <div class="admin-side">
        <section class="admin-card" aria-labelledby="progress-title">
          <div class="admin-card-head"><h2 id="progress-title">Review progress</h2></div>
          <div class="progress-num"><strong id="p-done">0</strong> of ${F.length} rows checked</div>
          <div class="progress" aria-hidden="true"><span id="p-bar"></span></div>
          <p class="progress-sub"><span id="p-flagged">0</span> flagged with a note${changed.size ? ` · <strong>${changed.size}</strong> changed since checked` : ''}</p>
          <div class="admin-actions">
            <button type="button" class="btn btn-primary btn-sm" data-export>Export review (CSV)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-backup>Backup (JSON)</button>
            <label class="btn btn-ghost btn-sm file-btn">Restore<input type="file" accept="application/json" data-restore hidden></label>
            <button type="button" class="btn btn-ghost btn-sm" data-print>Print</button>
          </div>
          <p class="kbd-hint"><kbd>J</kbd>/<kbd>K</kbd> next/previous row · <kbd>X</kbd> tick · <kbd>F</kbd> flag · <kbd>/</kbd> search</p>
        </section>

        <section class="admin-card" aria-labelledby="auto-title">
          <div class="admin-card-head"><h2 id="auto-title">Worth a look</h2></div>
          <p class="admin-sub">Spotted automatically. Shown exactly as published; check each against the PDF.</p>
          <div class="auto-list">
            ${Object.entries(AUTO).map(([type, a]) => `<button type="button" class="auto-chip${a.info ? ' is-info' : ''}" data-auto="${type}"
              aria-pressed="${state.auto === type}" title="${esc(a.tip)}">${esc(a.label)} <span>${autoCounts[type] || 0}</span></button>`).join('')}
          </div>
        </section>
      </div>
    </div>

    <div class="wrap-wide">
      <details class="admin-card toc" open>
        <summary><h2>Table of contents</h2><span class="hint">Category order, numbers and PDF pages, with how many rows you’ve checked</span></summary>
        <div class="x-scroll"><table class="toc-table">
          <thead><tr><th scope="col">Category (as in the paper)</th><th scope="col">Nos.</th><th scope="col">Rows</th><th scope="col">PDF pages</th><th scope="col">Site group</th><th scope="col">Checked</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${categories.map((c) => {
            const rows = F.filter((f) => f.category === c);
            const g = groupById[rows[0].group];
            return `<tr data-cat-row="${esc(c)}">
              <th scope="row"><button type="button" class="link-btn toc-go" data-go="${esc(c)}">${esc(c)}</button></th>
              <td>${rows[0].n}–${rows[rows.length - 1].n}</td><td>${rows.length}</td><td>${PDF_PAGES[c] || '—'}</td>
              <td><span class="mini-group" style="${groupStyle(g)}">${esc(g.label)}</span></td>
              <td><span class="toc-prog" data-prog="${esc(c)}"></span></td>
              <td><button type="button" class="btn btn-ghost btn-xs" data-tick-cat="${esc(c)}">Tick all</button></td></tr>`;
          }).join('')}</tbody>
        </table></div>
      </details>
    </div>

    <div class="admin-toolbar">
      <div class="wrap-wide admin-toolbar-inner">
        <div class="search search-sm">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <label for="aq" class="sr-only">Search any column</label>
          <input id="aq" type="search" placeholder="Search any column, or a number like 342" value="${esc(state.q)}" autocomplete="off">
        </div>
        <label class="sel"><span class="sr-only">Category</span>
          <select id="acat"><option value="">All 25 categories</option>${categories.map((c) => `<option value="${esc(c)}"${c === state.cat ? ' selected' : ''}>${esc(c)} (p. ${PDF_PAGES[c] || '—'})</option>`).join('')}</select>
        </label>
        <div class="seg" role="group" aria-label="Show rows">
          ${[['all', 'All'], ['unchecked', 'Unchecked'], ['checked', 'Checked'], ['flagged', 'Flagged'], ['auto', 'Worth a look'], ['footnote', 'Footnotes']].map(([v, l]) =>
            `<button type="button" data-show="${v}" aria-pressed="${state.show === v}">${l}</button>`).join('')}
        </div>
        <label class="switch"><input type="checkbox" id="asite" ${state.site ? 'checked' : ''}><span>Site columns</span></label>
        <span class="admin-count" id="acount" aria-live="polite"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-tick-visible>Tick visible</button>
      </div>
    </div>

    <div class="wrap-wide">
      <div class="pdf-scroll">
        <table class="pdf-table${state.site ? ' show-site' : ''}" id="ptable">
          <thead><tr>
            <th scope="col" class="c-check"><span class="sr-only">Checked</span>✓</th>
            <th scope="col" class="c-num">Number</th>
            <th scope="col" class="c-name">Food / Beverage Name</th>
            <th scope="col">Total Weight (g) / Portion</th>
            <th scope="col">Single / Mixed Meal</th>
            <th scope="col" class="c-ii">II</th>
            <th scope="col">Subject Details (No. of Subjects)</th>
            <th scope="col">Comparator</th>
            <th scope="col">Author / Year / Reference</th>
            <th scope="col">Country</th>
            <th scope="col" class="c-site">Site: group · reference · photo</th>
            <th scope="col" class="c-notes">Review notes</th>
          </tr></thead>
          <tbody id="pbody"></tbody>
        </table>
      </div>
      <div class="pdf-foot">
        <section><h3>Abbreviations for Supplemental Table 1</h3>
          <dl class="abbr"><dt>avCHO</dt><dd>available carbohydrates</dd><dt>BMI</dt><dd>Body Mass Index</dd><dt>II</dt><dd>Insulinaemic Index</dd><dt>mL</dt><dd>millilitres</dd><dt>NA</dt><dd>not available</dd></dl></section>
        <section><h3>Footnotes for Supplemental Table 1</h3>
          <ul class="fn-legend">${Object.entries(FOOTNOTES).map(([s, t]) => `<li><span class="fn-sym">${esc(s)}</span> ${esc(t)}</li>`).join('')}</ul></section>
        <p class="hint">Source of truth: <code>data/mmc1_insulinaemic_index.csv</code>. The PDF prints a few trailing semicolons in the Comparator column (e.g. “25g glucose;”) that the CSV leaves out.</p>
      </div>
    </div>
  </section>`;

  const $ = (s) => app.querySelector(s);
  // Listen on this page's own root: #app outlives each page, so listeners there would pile up.
  const root = app.querySelector('.admin');
  const body = $('#pbody');

  const isChecked = (n) => review.checked[n] === prints[n];
  const hasFootnote = (f) => f.iiNote || /‡|¶|†|\|\|/.test(f.name + f.subjects);

  function cell(f, key) {
    const v = f[key];
    const hit = (flags[f.n] || []).filter((x) => x.field === key && !AUTO[x.type].info);
    const html = key === 'name' || key === 'subjects' ? marked(v) : esc(v);
    return hit.length
      ? `<td class="c-${key} has-auto" title="${esc(hit.map((x) => AUTO[x.type].label).join(', '))}">${html}</td>`
      : `<td class="c-${key}">${html}</td>`;
  }

  function notesCell(f) {
    const auto = [...new Set((flags[f.n] || []).map((x) => x.type))];
    const note = review.notes[f.n];
    return `<td class="c-notes">
      ${auto.map((t) => `<span class="auto-tag${AUTO[t].info ? ' is-info' : ''}" title="${esc(AUTO[t].tip)}">${esc(AUTO[t].label)}${t !== 'dupe' && t !== 'na' ? ` · ${esc(COL_LABEL[(flags[f.n].find((x) => x.type === t) || {}).field] || '')}` : ''}</span>`).join('')}
      ${changed.has(f.n) ? '<span class="auto-tag is-warn">Changed since checked</span>' : ''}
      ${note !== undefined ? `<span class="user-note"><span aria-hidden="true">⚑</span> ${esc(note || 'Flagged')}</span>` : ''}
      <button type="button" class="note-btn" data-note="${f.n}" aria-label="${note !== undefined ? 'Edit or remove flag' : 'Flag'} for entry ${f.n}">${note !== undefined ? 'Edit' : '⚑ Flag'}</button>
    </td>`;
  }

  function rowHTML(f) {
    const g = groupById[f.group];
    const ok = isChecked(f.n);
    return `<tr id="r-${f.n}" data-n="${f.n}" class="prow${ok ? ' is-checked' : ''}${review.notes[f.n] !== undefined ? ' is-flagged' : ''}">
      <td class="c-check"><input type="checkbox" data-check="${f.n}" ${ok ? 'checked' : ''} aria-label="Entry ${f.n} checked"></td>
      <td class="c-num">${esc(f.n)}.</td>
      ${cell(f, 'name')}${cell(f, 'portion')}
      <td class="c-meal">${esc(f.meal)}</td>
      <td class="c-ii">${esc(f.ii)}${f.iiNote ? footnoteMarker(f.iiNote) : ''}</td>
      ${cell(f, 'subjects')}${cell(f, 'comparator')}${cell(f, 'study')}${cell(f, 'country')}
      <td class="c-site"><span class="mini-group" style="${groupStyle(g)}">${esc(g.label)}</span> ${refTag(f.ref)}
        <span class="admin-photo">${foodPic(f, 'admin-pic')}<span>${photoOf(f) ? esc(photoOf(f).label) : 'No photo'}
          <a href="#/admin?tab=photos&view=foods&q=${esc(f.n)}">Change</a></span></span></td>
      ${notesCell(f)}
    </tr>`;
  }

  function visible(f) {
    if (state.cat && f.category !== state.cat) return false;
    const q = state.q.trim().toLowerCase();
    if (q) {
      if (/^\d+$/.test(q)) { if (f.n !== q) return false; }
      else if (![f.name, f.portion, f.meal, f.ii, f.subjects, f.comparator, f.study, f.country, f.category, f.subcategory].join(' ').toLowerCase().includes(q)) return false;
    }
    if (state.auto && !(flags[f.n] || []).some((x) => x.type === state.auto)) return false;
    switch (state.show) {
      case 'unchecked': return !isChecked(f.n);
      case 'checked': return isChecked(f.n);
      case 'flagged': return review.notes[f.n] !== undefined;
      case 'auto': return (flags[f.n] || []).some((x) => !AUTO[x.type].info);
      case 'footnote': return hasFootnote(f);
      default: return true;
    }
  }

  let shownRows = [];
  function render() {
    shownRows = F.filter(visible);
    let html = '';
    let lastCat = null;
    let lastSub = null;
    shownRows.forEach((f) => {
      if (f.category !== lastCat) {
        html += `<tr class="cat-row" id="cat-${categories.indexOf(f.category)}"><th colspan="12" scope="colgroup">${esc(f.category)}
          <span class="cat-meta">PDF p. ${PDF_PAGES[f.category] || '—'}</span></th></tr>`;
        lastCat = f.category; lastSub = null;
      }
      if (f.subcategory && f.subcategory !== lastSub) {
        html += `<tr class="sub-row"><th colspan="12" scope="colgroup">${esc(f.subcategory)}</th></tr>`;
        lastSub = f.subcategory;
      }
      html += rowHTML(f);
    });
    body.innerHTML = html || '<tr><td colspan="12" class="admin-empty">No rows match. Try another filter.</td></tr>';
    $('#acount').textContent = `${shownRows.length} row${shownRows.length === 1 ? '' : 's'}`;
    if (state.active && !shownRows.some((f) => f.n === state.active)) state.active = null;
    markActive(false);
    updateProgress();
    writeURL();
  }

  function updateProgress() {
    const done = F.filter((f) => isChecked(f.n)).length;
    $('#p-done').textContent = done;
    $('#p-bar').style.width = `${(done / F.length) * 100}%`;
    $('#p-flagged').textContent = Object.keys(review.notes).length;
    categories.forEach((c) => {
      const rows = F.filter((f) => f.category === c);
      const d = rows.filter((f) => isChecked(f.n)).length;
      const el = app.querySelector(`[data-prog="${CSS.escape(c)}"]`);
      el.innerHTML = `<span class="toc-bar"><span style="width:${(d / rows.length) * 100}%"></span></span> ${d}/${rows.length}${d === rows.length ? ' ✓' : ''}`;
    });
  }

  function persist() {
    if (!saveReview(review)) toast('Couldn’t save in this browser. Use Backup (JSON) to keep your progress.');
  }

  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat) p.set('cat', state.cat);
    if (state.show !== 'all') p.set('show', state.show);
    if (state.auto) p.set('auto', state.auto);
    if (state.site) p.set('site', '1');
    const qs = p.toString();
    history.replaceState(null, '', `#/admin${qs ? `?${qs}` : ''}`);
  }

  function setChecked(n, on) {
    if (on) review.checked[n] = prints[n]; else delete review.checked[n];
    changed.delete(n);
    const tr = body.querySelector(`#r-${CSS.escape(n)}`);
    if (tr) {
      tr.classList.toggle('is-checked', on);
      tr.querySelector('[data-check]').checked = on;
      tr.querySelector('.c-notes').outerHTML = notesCell(F.find((f) => f.n === n));
    }
  }

  function editNote(n) {
    const tr = body.querySelector(`#r-${CSS.escape(n)}`);
    const td = tr.querySelector('.c-notes');
    const current = review.notes[n] || '';
    td.innerHTML = `<form class="note-form">
      <label class="sr-only" for="note-${n}">Note for entry ${n}</label>
      <input id="note-${n}" type="text" value="${esc(current)}" placeholder="What looks wrong? (optional)">
      <div class="note-actions"><button type="submit" class="btn btn-primary btn-xs">Save flag</button>
      ${review.notes[n] !== undefined ? '<button type="button" class="btn btn-ghost btn-xs" data-unflag>Remove flag</button>' : ''}
      <button type="button" class="btn btn-ghost btn-xs" data-cancel>Cancel</button></div></form>`;
    const input = td.querySelector('input');
    input.focus();
    const finish = () => {
      tr.classList.toggle('is-flagged', review.notes[n] !== undefined);
      td.outerHTML = notesCell(F.find((f) => f.n === n));
      updateProgress();
    };
    td.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); review.notes[n] = input.value.trim(); persist(); finish(); });
    td.querySelector('[data-cancel]').addEventListener('click', finish);
    td.querySelector('[data-unflag]')?.addEventListener('click', () => { delete review.notes[n]; persist(); finish(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(); } });
  }

  function markActive(scroll = true) {
    body.querySelectorAll('.prow.is-active').forEach((r) => r.classList.remove('is-active'));
    if (!state.active) return;
    const tr = body.querySelector(`#r-${CSS.escape(state.active)}`);
    if (!tr) return;
    tr.classList.add('is-active');
    if (scroll) tr.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function move(step) {
    if (!shownRows.length) return;
    const i = shownRows.findIndex((f) => f.n === state.active);
    const next = i === -1 ? (step > 0 ? 0 : shownRows.length - 1) : Math.min(shownRows.length - 1, Math.max(0, i + step));
    state.active = shownRows[next].n;
    markActive();
  }

  // ----- events -----
  let t;
  $('#aq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; render(); }, 120); });
  $('#acat').addEventListener('change', (e) => { state.cat = e.target.value; render(); });
  $('#asite').addEventListener('change', (e) => { state.site = e.target.checked; $('#ptable').classList.toggle('show-site', state.site); writeURL(); });

  root.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-check]');
    if (cb) { setChecked(cb.dataset.check, cb.checked); persist(); updateProgress(); state.active = cb.dataset.check; markActive(false); }
    const file = e.target.closest('[data-restore]');
    if (file && file.files[0]) {
      file.files[0].text().then((txt) => {
        const r = JSON.parse(txt);
        if (!r || typeof r.checked !== 'object' || typeof r.notes !== 'object') throw new Error('bad file');
        review.checked = r.checked; review.notes = r.notes;
        changed.clear();
        Object.keys(review.checked).forEach((n) => { if (prints[n] && review.checked[n] !== prints[n]) changed.add(n); });
        persist(); render(); toast('Review restored');
      }).catch(() => toast('That file isn’t a review backup'));
      file.value = '';
    }
  });

  root.addEventListener('click', (e) => {
    const show = e.target.closest('[data-show]');
    if (show) {
      state.show = show.dataset.show;
      app.querySelectorAll('[data-show]').forEach((b) => b.setAttribute('aria-pressed', String(b === show)));
      render(); return;
    }
    const auto = e.target.closest('[data-auto]');
    if (auto) {
      state.auto = state.auto === auto.dataset.auto ? '' : auto.dataset.auto;
      app.querySelectorAll('[data-auto]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.auto === state.auto)));
      render();
      $('.admin-toolbar').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) {
      if (state.cat && state.cat !== go.dataset.go) { state.cat = ''; $('#acat').value = ''; }
      render();
      app.querySelector(`#cat-${categories.indexOf(go.dataset.go)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const tickCat = e.target.closest('[data-tick-cat]');
    if (tickCat) {
      const rows = F.filter((f) => f.category === tickCat.dataset.tickCat);
      const allOn = rows.every((f) => isChecked(f.n));
      rows.forEach((f) => setChecked(f.n, !allOn));
      persist(); updateProgress();
      toast(`${allOn ? 'Unticked' : 'Ticked'} ${rows.length} rows in ${tickCat.dataset.tickCat}`);
      return;
    }
    if (e.target.closest('[data-tick-visible]')) {
      if (!shownRows.length) return;
      if (!confirm(`Tick all ${shownRows.length} visible rows as checked?`)) return;
      shownRows.forEach((f) => setChecked(f.n, true));
      persist(); updateProgress(); toast(`Ticked ${shownRows.length} rows`);
      return;
    }
    const note = e.target.closest('[data-note]');
    if (note) { state.active = note.dataset.note; markActive(false); editNote(note.dataset.note); return; }
    const tr = e.target.closest('.prow');
    if (tr && !e.target.closest('input, button, a, form')) { state.active = tr.dataset.n; markActive(false); }

    if (e.target.closest('[data-export]')) exportCSV();
    if (e.target.closest('[data-backup]')) download('insulin-index-review.json', JSON.stringify(review, null, 2), 'application/json');
    if (e.target.closest('[data-print]')) window.print();
  });

  const onKey = (e) => {
    if (e.target.closest('input:not([type="checkbox"]), textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k === 'j') { e.preventDefault(); move(1); }
    else if (k === 'k') { e.preventDefault(); move(-1); }
    else if (k === 'x' && state.active) { e.preventDefault(); setChecked(state.active, !isChecked(state.active)); persist(); updateProgress(); markActive(false); }
    else if (k === 'f' && state.active) { e.preventDefault(); editNote(state.active); }
    else if (k === '/') { e.preventDefault(); $('#aq').focus(); }
  };
  document.addEventListener('keydown', onKey);

  function exportCSV() {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Number', 'Food / Beverage Name', 'Category', 'II', 'Author / Year / Reference', 'Checked', 'Flagged', 'Note', 'Worth a look'].map(q).join(',')];
    F.forEach((f) => {
      const auto = [...new Set((flags[f.n] || []).map((x) => `${AUTO[x.type].label} (${x.field})`))].join('; ');
      lines.push([f.n, f.name, f.category, f.ii, f.study, isChecked(f.n) ? 'yes' : 'no', review.notes[f.n] !== undefined ? 'yes' : 'no', review.notes[f.n] || '', auto].map(q).join(','));
    });
    download('insulin-index-review.csv', `﻿${lines.join('\r\n')}`, 'text/csv');
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  render();
  if (changed.size) toast(`${changed.size} row${changed.size === 1 ? ' has' : 's have'} changed since you checked ${changed.size === 1 ? 'it' : 'them'}`);

  return () => document.removeEventListener('keydown', onKey);
}
