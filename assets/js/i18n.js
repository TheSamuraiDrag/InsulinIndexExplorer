// Language switch: English / Bahasa Melayu / 中文 (Simplified Chinese).
//
// Translations live in data/translations.csv (columns: English, Bahasa Melayu, 中文), so they can be
// checked and edited in Excel or Google Sheets. Text that isn't in the sheet stays in English.
// Rows with {n} (a number) or {x} (any text) match changing text, e.g. "Show {n} foods".
// Food data (names, categories, studies, comparators, portions) and the Admin area always stay
// in English, exactly as published.

const KEY = 'ii-lang';
const COLUMN = { ms: 1, zh: 2 }; // column in translations.csv
const HTML_LANG = { en: 'en', ms: 'ms', zh: 'zh-Hans' };
const lang = (() => { try { const v = localStorage.getItem(KEY); return v in COLUMN ? v : 'en'; } catch { return 'en'; } })();

const SKIP_TREE = '[translate="no"], script, style, .lang, .brand, .admin, .admin-signin, #ph-editor, #ph-picker, #gh-connect, '
  + '.footer-cite, .photo-credits, .gc-cats, .chip-country, .active-chip[data-remove="country"], .active-chip[data-remove="q"], .map-table td';
const SKIP_PARENT = '.card-name, .detail-name, .detail-cat, .facts > div:not(:last-child) > dd, .same-meta, .bar-label, .tray-name, '
  + '.cmp-name, .compare-table tbody tr:nth-child(n+4) > td, .everyday-name, .hl-name';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'data-tip'];
const CJK = lang === 'zh' ? /[\u3000-\u9fff\uff00-\uffef]/ : null;

const exact = new Map();
const patterns = [];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function addRow(en, ms) {
  en = norm((en || '').replace(/^﻿/, '')); ms = (ms || '').trim();
  if (!en || !ms) return;
  if (!/\{\w+\}/.test(en)) { exact.set(en, ms); return; }
  const names = [];
  const src = en.split(/(\{\w+\})/).map((part) => {
    const m = part.match(/^\{(\w+)\}$/);
    if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    names.push(m[1]);
    return /^n\d*$/.test(m[1]) ? '(\\d[\\d,.]*)' : '(.+?)';
  }).join('');
  patterns.push({ re: new RegExp(`^${src}$`), names, ms });
}

export function t(s) {
  const k = norm(s || '');
  if (!k) return null;
  if (exact.has(k)) return exact.get(k);
  for (const p of patterns) {
    const m = k.match(p.re);
    if (m) return p.ms.replace(/\{(\w+)\}/g, (all, name) => { const v = m[p.names.indexOf(name) + 1]; return v == null ? all : (exact.get(v) || v); });
  }
  return null;
}

function trText(node) {
  const el = node.parentElement;
  if (!el || el.closest(SKIP_TREE) || el.matches(SKIP_PARENT)) return;
  const v = node.nodeValue; const r = t(v);
  if (r == null || r === norm(v)) return;
  // Chinese doesn't put spaces between words: drop the English spacing next to Chinese characters.
  const lead = CJK && CJK.test(r[0]) ? '' : v.match(/^\s*/)[0];
  const trail = CJK && CJK.test(r[r.length - 1]) ? '' : v.match(/\s*$/)[0];
  node.nodeValue = lead + r + trail;
}
function trAttrs(el) {
  if (el.closest(SKIP_TREE)) return;
  ATTRS.forEach((a) => {
    if (!el.hasAttribute(a)) return;
    const r = t(el.getAttribute(a));
    if (r != null && r !== el.getAttribute(a)) el.setAttribute(a, r);
  });
}
function translateTree(root) {
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) trText(n);
  trAttrs(root);
  root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach(trAttrs);
}

function setupSwitch() {
  const wrap = document.getElementById('lang');
  const btn = document.getElementById('lang-btn');
  const menu = document.getElementById('lang-menu');
  if (!wrap || !btn || !menu) return;
  const items = [...menu.querySelectorAll('[data-lang]')];
  document.getElementById('lang-cur').textContent = { en: 'EN', ms: 'BM', zh: '中文' }[lang];
  items.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
  const current = () => items.findIndex((b) => b.dataset.lang === lang);
  const open = (i = current()) => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); items[i].focus(); };
  const close = (refocus) => {
    if (menu.hidden) return;
    menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  };
  btn.addEventListener('click', () => (menu.hidden ? open() : close(true)));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowDown' ? 0 : items.length - 1); }
  });
  menu.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement);
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (go != null) { e.preventDefault(); items[(go + items.length) % items.length].focus(); } else if (e.key === 'Escape') { e.stopPropagation(); close(true); } else if (e.key === 'Tab') close(false);
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    if (b.dataset.lang === lang) { close(true); return; }
    try { localStorage.setItem(KEY, b.dataset.lang); } catch { /* ignore */ }
    location.reload();
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(false); });
}

export async function initI18n() {
  document.documentElement.lang = HTML_LANG[lang];
  setupSwitch();
  if (lang === 'en') return;
  try {
    const res = await fetch('data/translations.csv', { cache: 'no-cache' });
    if (!res.ok) return;
    parseCSV(await res.text()).slice(1).forEach((row) => addRow(row[0], row[COLUMN[lang]]));
  } catch { return; }
  translateTree(document.body);
  const trTitle = () => { const r = t(document.title); if (r && r !== document.title) document.title = r; };
  trTitle();
  new MutationObserver(trTitle).observe(document.querySelector('title'), { childList: true });
  new MutationObserver((muts) => muts.forEach((m) => {
    if (m.type === 'childList') m.addedNodes.forEach(translateTree);
    else if (m.type === 'characterData') trText(m.target);
    else trAttrs(m.target);
  })).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
