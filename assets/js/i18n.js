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
export const lang = (() => { try { const v = localStorage.getItem(KEY); return v in COLUMN ? v : 'en'; } catch { return 'en'; } })();

const SKIP_TREE = '[translate="no"], script, style, .lang-btn, .brand, .admin, .admin-signin, #ph-editor, #ph-picker, #gh-connect, '
  + '.footer-cite, .photo-credits, .gc-cats, .chip-country, .active-chip[data-remove="country"], .active-chip[data-remove="q"], .map-table td';
const SKIP_PARENT = '.card-name, .detail-name, .detail-cat, .facts > div:not(:last-child) > dd, .same-meta, .bar-label, .tray-name, '
  + '.cmp-name, .compare-table tbody tr:nth-child(n+4) > td, .everyday-name, .hl-name';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'data-tip'];

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
  node.nodeValue = `${v.match(/^\s*/)[0]}${r}${v.match(/\s*$/)[0]}`;
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
  const sel = document.getElementById('lang-btn');
  if (!sel) return;
  sel.value = lang;
  sel.addEventListener('change', () => {
    try { localStorage.setItem(KEY, sel.value); } catch { /* ignore */ }
    location.reload();
  });
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
