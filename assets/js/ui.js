import { SITE } from './config.js';

// Shared rendering helpers: escaping, footnote markers, tags, cards,
// the food detail sheet, the compare tray and the compare sheet.

export const FOOTNOTES = {
  '*': 'II derived from the article’s supplementary file',
  '§': 'Mean II shown; the study also reported a median',
  '†': 'No BMI given, but standard protocol stated',
  '‡': 'Study 2 of a two-study article',
  '||': 'Discrepancy between 9 and 10 subjects in the original article',
  '¶': 'New rice variants without abbreviations',
};

export const PHOTO = (id, w = 1600) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const METER_MAX = 210;
const MAX_COMPARE = 3;

let DATA = null;
let GROUPS = {};
let FOODS = {};
let PHOTOS = {};

export function setData(data) {
  DATA = data;
  PHOTOS = {};
  GROUPS = Object.fromEntries(data.groups.map((g) => [g.id, g]));
  FOODS = Object.fromEntries(data.foods.map((f) => [f.n, f]));
}
export const getGroup = (id) => GROUPS[id];

// Attach photos (data/photos.json: { types, map }) to the foods. The Admin page calls this
// again with unpublished edits, using previewSrc/previewThumb object URLs for new images.
export function applyPhotos(photos) {
  PHOTOS = {};
  Object.entries((photos && photos.types) || {}).forEach(([id, t]) => {
    const v = t.v ? `?v=${encodeURIComponent(t.v)}` : '';
    PHOTOS[id] = {
      label: t.label,
      credit: t.credit || {},
      src: t.previewSrc || `assets/img/foods/${id}.jpg${v}`,
      thumb: t.previewThumb || `assets/img/foods/thumb/${id}.jpg${v}`,
    };
  });
  DATA.photos = PHOTOS;
  const map = (photos && photos.map) || {};
  DATA.foods.forEach((f) => { f.photo = PHOTOS[map[f.n]] ? map[f.n] : null; });
}
export const getFood = (n) => FOODS[n];

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const groupStyle = (g) => `--g-bg:${g.bg};--g-ink:${g.ink}`;

// Plain text with footnote symbols removed, for labels and search.
export const plain = (text) => text.replace(/‡|¶|†|\|\|/g, '').replace(/\s+/g, ' ').trim();

// Render text exactly as published, turning footnote symbols into markers.
// interactive = focusable markers with a tooltip (not allowed inside buttons).
export function marked(text, interactive = false) {
  return String(text).split(/(‡|¶|†|\|\|)/).map((part) => {
    if (!FOOTNOTES[part]) return esc(part);
    return footnoteMarker(part, interactive);
  }).join('');
}

export function footnoteMarker(sym, interactive = false) {
  const tip = FOOTNOTES[sym];
  if (!tip) return '';
  if (!interactive) return `<sup class="fn-mark" title="${esc(tip)}">${esc(sym)}</sup>`;
  return `<button type="button" class="fn" data-tip="${esc(tip)}" aria-label="Footnote ${esc(sym)}: ${esc(tip)}">${esc(sym)}</button>`;
}

/* ---------- Photos and icons ---------- */

// Small line icons (no emoji): they look the same on every device.
export const ICONS = {
  meal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><path d="M3 4v5a2 2 0 0 0 2 2v9M5 4v5M21 4c-1.7 0-2.5 2-2.5 5s1 3 2.5 3v8"/></svg>',
  plate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17v.5"/></svg>',
};
export const icon = (name, cls = '') => `<span class="icon ${cls}">${ICONS[name]}</span>`;

export const photoType = (id) => (id ? PHOTOS[id] : null);
export const photoOf = (f) => photoType(f && f.photo);

// A food's photo (the type of food, not the exact product tested), or a neutral
// plate outline when there is no faithful photo. Decorative: the name is always beside it.
export function foodPic(f, cls = '') {
  const p = photoOf(f);
  if (!p) return `<span class="food-pic no-pic ${cls}" aria-hidden="true">${ICONS[f.meal === 'SINGLE' ? 'plate' : 'meal']}</span>`;
  return `<span class="food-pic ${cls}"><img src="${p.thumb}" alt="" loading="lazy" decoding="async" width="200" height="200"></span>`;
}

export function typePic(id, cls = '', full = false) {
  const p = photoType(id);
  if (!p) return `<span class="food-pic no-pic ${cls}" aria-hidden="true">${ICONS.plate}</span>`;
  return `<span class="food-pic ${cls}"><img src="${full ? p.src : p.thumb}" alt="" loading="lazy" decoding="async"></span>`;
}

export const photoCredit = (p) => {
  const c = p.credit;
  const who = c.author ? (c.authorUrl ? `<a href="${esc(c.authorUrl)}" rel="noopener">${esc(c.author)}</a>` : esc(c.author)) : '';
  const lic = c.licenceUrl ? `<a href="${esc(c.licenceUrl)}" rel="noopener license">${esc(c.licence)}</a>` : esc(c.licence);
  const via = c.source ? `<a href="${esc(c.source)}" rel="noopener">${esc(c.via || 'source')}</a>` : '';
  return `Photo${who ? ` by ${who}` : ''}${via ? ` via ${via}` : ''}, ${lic}.`;
};

export const refTag = (ref) =>
  `<span class="tag tag-ref tag-${ref}">Comparator: ${ref}</span>`;

export const mealTag = (meal) =>
  `<span class="tag tag-meal">${meal === 'SINGLE' ? 'Single food' : 'Mixed meal'}</span>`;

// Neutral position on a 0–210 scale (the published II values run from 1 to 209).
// No bands, colours or reference marks: the paper gives no cut-offs.
export function meter(value, big = false) {
  const pct = Math.min(100, (value / METER_MAX) * 100).toFixed(1);
  return `<span class="meter${big ? ' meter-big' : ''}" aria-hidden="true" style="--p:${pct}%">
    <span class="meter-fill"></span><span class="meter-dot"></span></span>`;
}

// rank > 0 shows the card's position in a ranking (Lowest-II picks).
export function card(f, index = 0, rank = 0) {
  const g = GROUPS[f.group];
  const on = compareIds.includes(f.n);
  return `<li class="card" style="${groupStyle(g)};--i:${index % 12}">
    <button type="button" class="card-open" data-open="${f.n}">
      ${foodPic(f, 'card-pic')}
      <span class="card-head">
        <span class="card-group">${esc(g.label)}</span>
        ${rank ? `<span class="card-rank"><span class="sr-only">Rank </span>#${rank}</span>` : ''}
      </span>
      <span class="card-name">${marked(f.name)}</span>
      <span class="card-score">
        <span class="ii"><span class="ii-num">${esc(f.ii)}</span>${f.iiNote ? footnoteMarker(f.iiNote) : ''}<span class="ii-unit">II</span></span>
      </span>
      ${meter(f.iiValue)}
    </button>
    <div class="card-foot" data-open="${f.n}">
    <span class="tags">${refTag(f.ref)}${mealTag(f.meal)}</span>
    <button type="button" class="cmp-btn" data-cmp="${f.n}" aria-pressed="${on}"
      aria-label="${on ? 'Remove from' : 'Add to'} compare: ${esc(plain(f.name))}">
      <span aria-hidden="true">${on ? '✓' : '+'}</span> ${on ? 'Comparing' : 'Compare'}</button>
    </div>
  </li>`;
}

/* ---------- Toast ---------- */

let toastTimer;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Dialog helpers (animated open/close, drag-to-close) ---------- */

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function openSheet(dialog) {
  if (!dialog.open) dialog.showModal();
  dialog.classList.remove('closing');
  dialog.querySelector('.sheet-inner').scrollTop = 0;
}

export function closeSheet(dialog) {
  if (!dialog.open || dialog.classList.contains('closing')) return;
  if (reduceMotion()) { dialog.close(); return; }
  dialog.classList.add('closing');
  const done = () => { dialog.classList.remove('closing'); dialog.close(); };
  dialog.addEventListener('animationend', done, { once: true });
  setTimeout(() => dialog.open && done(), 400);
}

function wireSheet(dialog) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeSheet(dialog);
    if (e.target.closest('[data-close]')) closeSheet(dialog);
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(dialog); });

  // Drag the handle down to dismiss (phones).
  let startY = null;
  const inner = dialog.querySelector('.sheet-inner');
  dialog.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sheet-handle')) return;
    startY = e.clientY;
    inner.style.transition = 'none';
    e.target.setPointerCapture?.(e.pointerId);
  });
  dialog.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    const dy = Math.max(0, e.clientY - startY);
    inner.style.transform = `translateY(${dy}px)`;
  });
  const end = (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    inner.style.transition = '';
    inner.style.transform = '';
    if (dy > 110) closeSheet(dialog);
  };
  dialog.addEventListener('pointerup', end);
  dialog.addEventListener('pointercancel', end);
}

/* ---------- Food detail ---------- */

let onDetailChange = () => {};
export function setDetailListener(fn) { onDetailChange = fn; }

export function openDetail(n) {
  const f = FOODS[n];
  if (!f) return;
  const g = GROUPS[f.group];
  const dialog = document.getElementById('detail');
  const body = document.getElementById('detail-body');
  const on = compareIds.includes(f.n);
  const studyNo = (f.study.match(/\[(\d+)\]/) || [])[1];
  const symbols = [f.iiNote, ...['‡', '||', '¶'].filter((s) => f.name.includes(s)),
    ...(f.subjects.includes('†') ? ['†'] : [])].filter(Boolean);

  body.innerHTML = `
    <div class="sheet-handle" aria-hidden="true"><span></span></div>
    <button type="button" class="icon-btn sheet-close" data-close aria-label="Close details">✕</button>
    ${(() => {
      const p = photoOf(f);
      if (!p) {
        return `<div class="detail-hero" style="${groupStyle(g)}">
          <span class="food-pic no-pic detail-nopic" aria-hidden="true">${ICONS[f.meal === 'SINGLE' ? 'plate' : 'meal']}</span>
          <p class="detail-group">${esc(g.label)}</p></div>`;
      }
      return `<figure class="detail-photo" style="${groupStyle(g)}">
        <img src="${p.src}" alt="${esc(`Example photo: ${p.label}`)}" decoding="async">
        <p class="detail-group">${esc(g.label)}</p>
        <figcaption>Photo shows ${esc(p.label.toLowerCase())} in general, not the exact product tested. ${photoCredit(p)}</figcaption>
      </figure>`;
    })()}
    <div class="detail-content">
      <h2 id="detail-title" class="detail-name">${marked(f.name, true)}</h2>
      <p class="detail-cat">${esc(f.category)}${f.subcategory ? ` · ${esc(f.subcategory)}` : ''}</p>

      <div class="detail-score">
        <div class="detail-ii">
          <span class="ii-num">${esc(f.ii)}</span>${f.iiNote ? footnoteMarker(f.iiNote, true) : ''}
          <span class="ii-unit">insulin index</span>
        </div>
        <div class="detail-badges">${refTag(f.ref)}${mealTag(f.meal)}</div>
      </div>
      <div class="detail-meter">
        ${meter(f.iiValue, true)}
        <div class="meter-scale" aria-hidden="true"><span>0</span><span>210</span></div>
      </div>
      <p class="detail-ref-note">${icon('info')}
        <span>Comparator: <strong>${f.ref}</strong>. Only compare it with other foods whose comparator is ${f.ref}.</span></p>

      <dl class="facts">
        <div><dt>Portion</dt><dd>${esc(f.portion)}</dd></div>
        <div><dt>Subjects</dt><dd>${marked(f.subjects, true)}</dd></div>
        <div class="wide"><dt>Comparator (reference food)</dt><dd>${esc(f.comparator)}</dd></div>
        <div class="wide"><dt>Study</dt><dd>${esc(f.study)}${studyNo ? `<span class="hint">[${studyNo}] is its number in the paper’s reference list</span>` : ''}</dd></div>
        <div><dt>Country</dt><dd>${esc(f.country)}</dd></div>
        <div><dt>Entry</dt><dd>No. ${esc(f.n)} in Table 1</dd></div>
      </dl>

      ${sameFoodList(f)}

      ${symbols.length ? `<div class="footnotes"><p class="footnotes-title">Footnotes</p><ul>
        ${symbols.map((s) => `<li><span class="fn-sym">${esc(s)}</span> ${esc(FOOTNOTES[s])}</li>`).join('')}
      </ul></div>` : ''}

      <div class="detail-actions">
        <button type="button" class="btn ${on ? 'btn-soft' : 'btn-primary'}" data-detail-cmp="${f.n}" aria-pressed="${on}">
          ${on ? '✓ In compare' : '+ Add to compare'}</button>
        <button type="button" class="btn btn-ghost" data-copy-link>Copy link</button>
      </div>
      ${reportLink(f)}
    </div>`;

  openSheet(dialog);
  onDetailChange(f.n);
}

// Other entries with the same published name (the same food tested in other studies or arms).
function sameFoodList(f) {
  const key = plain(f.name).toLowerCase();
  const others = DATA.foods.filter((x) => x.n !== f.n && plain(x.name).toLowerCase() === key);
  if (!others.length) return '';
  return `<div class="same-food">
    <p class="same-title">Same food, other entries <span>${others.length}</span></p>
    <ul>${others.map((x) => `<li><button type="button" class="same-row" data-open="${x.n}">
      <span class="same-ii">${esc(x.ii)}</span>
      <span class="same-meta">${esc(x.study)} · ${esc(x.country)}</span>
      ${refTag(x.ref)}</button></li>`).join('')}</ul>
    <p class="hint">Results differ with portion, preparation, volunteers and reference food.</p>
  </div>`;
}

function barChart(items) {
  const max = Math.max(210, ...items.map((f) => f.iiValue));
  return `<figure class="bars" aria-label="Bar chart of insulin index">
    <div class="bars-plot">
      ${items.map((f) => `<div class="bar-row">
        <span class="bar-label">${esc(plain(f.name))}</span>
        <span class="bar-track"><span class="bar" style="--w:${(f.iiValue / max) * 100}%"></span>
          <span class="bar-val">${esc(f.ii)} <small>comparator: ${f.ref}</small></span></span>
      </div>`).join('')}
    </div>
  </figure>`;
}

// "Report a problem" opens an email with the entry already filled in (hidden if no address is set).
function reportLink(f) {
  if (!SITE.reportEmail) return '';
  const subject = `Insulin Index Explorer: problem with entry No. ${f.n}`;
  const body = `Entry: No. ${f.n} in Supplemental Table 1\nFood: ${plain(f.name)}\nII: ${f.ii}\nStudy: ${f.study}\n\nWhat looks wrong?\n\n\n(Sent from ${SITE.url}#/explorer?food=${f.n})`;
  return `<p class="report"><a href="mailto:${encodeURIComponent(SITE.reportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Report a problem with this entry</a></p>`;
}

/* ---------- Compare ---------- */

export let compareIds = [];
try { compareIds = JSON.parse(sessionStorage.getItem('ii-compare') || '[]').filter((n) => n); } catch { /* ignore */ }

const compareListeners = new Set();
export const onCompareChange = (fn) => compareListeners.add(fn);

function saveCompare() {
  try { sessionStorage.setItem('ii-compare', JSON.stringify(compareIds)); } catch { /* ignore */ }
  renderTray();
  compareListeners.forEach((fn) => fn(compareIds));
}

export function toggleCompare(n) {
  if (compareIds.includes(n)) {
    compareIds = compareIds.filter((x) => x !== n);
  } else {
    if (compareIds.length >= MAX_COMPARE) { toast(`You can compare up to ${MAX_COMPARE} foods. Remove one first.`); return false; }
    compareIds = [...compareIds, n];
    if (compareIds.length >= 2) toast(`${compareIds.length} foods ready to compare`);
  }
  saveCompare();
  return true;
}

export function renderTray() {
  const tray = document.getElementById('compare-tray');
  const items = compareIds.map((n) => FOODS[n]).filter(Boolean);
  if (!items.length) { tray.hidden = true; tray.innerHTML = ''; return; }
  tray.hidden = false;
  tray.innerHTML = `
    <div class="tray-items">
      ${items.map((f) => `<span class="tray-item" style="${groupStyle(GROUPS[f.group])}">
        ${foodPic(f, 'tray-pic')}
        <span class="tray-name">${esc(plain(f.name))}</span>
        <button type="button" class="tray-x" data-cmp="${f.n}" aria-label="Remove ${esc(plain(f.name))} from compare">✕</button>
      </span>`).join('')}
      ${Array.from({ length: MAX_COMPARE - items.length }, () => '<span class="tray-slot" aria-hidden="true"></span>').join('')}
    </div>
    <button type="button" class="btn btn-primary tray-go" data-open-compare ${items.length < 2 ? 'disabled' : ''}>
      Compare ${items.length}/${MAX_COMPARE}</button>`;
}

export function openCompare() {
  const items = compareIds.map((n) => FOODS[n]).filter(Boolean);
  if (items.length < 2) return;
  const refs = new Set(items.map((f) => f.ref));
  const dialog = document.getElementById('compare');
  const rows = [
    ['Insulin index', (f) => `<span class="cmp-ii">${esc(f.ii)}</span>${f.iiNote ? footnoteMarker(f.iiNote, true) : ''}`],
    ['Reference', (f) => refTag(f.ref)],
    ['Type', (f) => mealTag(f.meal)],
    ['Portion', (f) => esc(f.portion)],
    ['Subjects', (f) => marked(f.subjects, true)],
    ['Comparator', (f) => esc(f.comparator)],
    ['Study', (f) => esc(f.study)],
    ['Country', (f) => esc(f.country)],
  ];
  document.getElementById('compare-body').innerHTML = `
    <div class="sheet-handle" aria-hidden="true"><span></span></div>
    <button type="button" class="icon-btn sheet-close" data-close aria-label="Close comparison">✕</button>
    <div class="compare-content">
      <h2 id="compare-title" class="compare-title">Side by side</h2>
      ${refs.size > 1 ? `<div class="warning" role="alert">${icon('warn')}<div>
        <strong>Different reference foods.</strong> Some of these were scored against glucose and some against bread.
        Bread itself scored around 70 against glucose, so these numbers are not directly comparable.</div></div>`
        : `<p class="compare-ok"><span aria-hidden="true">✓</span> All scored against ${[...refs][0]}, but portions and volunteers still differ between studies.</p>`}
      ${barChart(items)}
      <div class="compare-scroll">
        <table class="compare-table" style="--cols:${items.length}">
          <thead><tr><th scope="col"><span class="sr-only">Detail</span></th>
            ${items.map((f) => `<th scope="col" style="${groupStyle(GROUPS[f.group])}">
              ${foodPic(f, 'cmp-pic')}
              <span class="cmp-name">${marked(f.name, true)}</span>
              <span class="cmp-meter">${meter(f.iiValue)}</span></th>`).join('')}</tr></thead>
          <tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${items.map((f) => `<td>${fn(f)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn btn-ghost" data-clear-compare>Clear all</button>
      </div>
    </div>`;
  openSheet(dialog);
}

/* ---------- Global wiring for cards, tray and sheets ---------- */

export function wireGlobal() {
  // A food photo that fails to load becomes the neutral plate outline, never a broken image.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.parentElement?.classList.contains('food-pic')) return;
    img.parentElement.classList.add('no-pic');
    img.replaceWith(document.createRange().createContextualFragment(ICONS.plate));
  }, true);

  const detail = document.getElementById('detail');
  const compare = document.getElementById('compare');
  wireSheet(detail);
  wireSheet(compare);
  detail.addEventListener('close', () => onDetailChange(null));

  document.addEventListener('click', async (e) => {
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) { toggleCompare(cmp.dataset.cmp); return; }

    const open = e.target.closest('[data-open]');
    if (open) { openDetail(open.dataset.open); return; }

    const dcmp = e.target.closest('[data-detail-cmp]');
    if (dcmp) {
      if (toggleCompare(dcmp.dataset.detailCmp)) {
        const on = compareIds.includes(dcmp.dataset.detailCmp);
        dcmp.setAttribute('aria-pressed', on);
        dcmp.className = `btn ${on ? 'btn-soft' : 'btn-primary'}`;
        dcmp.textContent = on ? '✓ In compare' : '+ Add to compare';
      }
      return;
    }

    if (e.target.closest('[data-open-compare]')) { openCompare(); return; }
    if (e.target.closest('[data-clear-compare]')) {
      compareIds = []; saveCompare(); closeSheet(compare); return;
    }
    if (e.target.closest('[data-copy-link]')) {
      try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch { toast('Copy the address bar to share this food'); }
    }
  });

  // Keep compare buttons on visible cards in sync.
  onCompareChange((ids) => {
    document.querySelectorAll('.cmp-btn[data-cmp]').forEach((b) => {
      const on = ids.includes(b.dataset.cmp);
      const f = FOODS[b.dataset.cmp];
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', `${on ? 'Remove from' : 'Add to'} compare: ${plain(f.name)}`);
      b.innerHTML = `<span aria-hidden="true">${on ? '✓' : '+'}</span> ${on ? 'Comparing' : 'Compare'}`;
    });
  });

  renderTray();
}

/* ---------- Images with graceful fallback ---------- */

// Banner photos sit on top of a soft gradient. If a photo fails,
// it is removed, so a broken image is never shown.
export function wireImages(root = document) {
  root.querySelectorAll('img[data-photo]').forEach((img) => {
    const fail = () => img.remove();
    const ok = () => img.classList.add('loaded');
    if (img.complete) { if (img.naturalWidth) ok(); else fail(); }
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', fail, { once: true });
  });
}

/* ---------- Reveal on scroll ---------- */

let revealObserver;
export function wireReveal(root = document) {
  const els = root.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduceMotion()) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  revealObserver ??= new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((el) => revealObserver.observe(el));
}

export const dataset = () => DATA;

/* ---------- Page hero (photo banner with gradient fallback) ---------- */

export function pageHero({ eyebrow, title, lede, photo, tone = '#F9D9C8,#F4B79A', extra = '' }) {
  return `<section class="page-hero" style="--tone:linear-gradient(135deg,${tone})">
    <div class="page-hero-media" aria-hidden="true">
      ${photo ? `<img data-photo src="${PHOTO(photo)}" alt="" decoding="async">` : ''}
    </div>
    <div class="wrap page-hero-content">
      <p class="eyebrow eyebrow-light">${esc(eyebrow)}</p>
      <h1>${title}</h1>
      ${lede ? `<p class="page-hero-lede">${lede}</p>` : ''}
      ${extra}
    </div>
  </section>`;
}

// Median of numbers (site calculation, never shown as a published value).
export function median(values) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
