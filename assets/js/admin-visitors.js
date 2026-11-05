// Admin · Visitors: visits to the public website, from GoatCounter (anonymous, no cookies).
//
// - Totals per page come from GoatCounter's public visitor counter ("Allow adding visitor counts
//   on your website" must be ticked in GoatCounter → Settings).
// - Countries, referrers, devices and browsers: the "Open full dashboard" button (GoatCounter sign-in).
// - SITE.countFrom (config.js) starts the counts from a date, e.g. the launch day. Nothing is
//   deleted on GoatCounter, so it can always be changed back.

import { esc } from './ui.js';
import { SITE } from './config.js';

const PAGES = [['TOTAL', 'Whole website'], ['/', 'Home'], ['/explorer', 'Food Explorer'], ['/groups', 'Food groups'],
  ['/lowest', 'Single foods'], ['/mixed', 'Mixed meals'], ['/guide', 'How to read the II'], ['/about', 'About & sources']];
const FROM = /^\d{4}-\d{2}-\d{2}$/.test(SITE.countFrom || '') ? new Date(`${SITE.countFrom}T00:00:00Z`) : null;
const RANGES = [['all', FROM ? `Since ${SITE.countFrom}` : 'All time'], ['30', 'Last 30 days'], ['7', 'Last 7 days']];

// An API key was stored here by an earlier version of this tab; it isn't used any more.
try { localStorage.removeItem('ii-gc-key'); } catch { /* ignore */ }

function startFor(range) {
  const d = range === 'all' ? null : new Date(Date.now() - Number(range) * 864e5);
  if (!FROM) return d;
  return !d || d < FROM ? FROM : d;
}

async function count(path, start) {
  const url = `https://${SITE.goatcounter}.goatcounter.com/counter/${encodeURIComponent(path)}.json${start ? `?start=${start.toISOString().slice(0, 10)}` : ''}`;
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`GoatCounter answered ${res.status}`);
  return Number(String((await res.json()).count ?? 0).replace(/[^\d]/g, '')) || 0;
}

export async function renderVisitors(root) {
  const code = SITE.goatcounter;
  if (!code) {
    root.innerHTML = '<div class="admin-card warning">Visitor counting is switched off (no GoatCounter code in <code>assets/js/config.js</code>).</div>';
    return () => {};
  }
  let range = 'all';
  const dash = `https://${code}.goatcounter.com`;
  root.innerHTML = `
    <div class="act-head">
      <div class="seg" role="group" aria-label="Period">
        ${RANGES.map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${v === range}">${esc(l)}</button>`).join('')}
      </div>
      <a class="btn btn-ghost btn-sm" href="${esc(dash)}" target="_blank" rel="noopener">Open full dashboard ↗</a>
    </div>
    <div id="vis-body" aria-live="polite"></div>
    <div class="admin-card vis-dash">
      <div><h2 class="vis-h">Countries, referrers and devices</h2>
        <p class="hint">Where visitors come from, which sites sent them, and their devices and browsers are on the full
          GoatCounter dashboard. Sign in with the GoatCounter account.</p></div>
      <a class="btn btn-sm" href="${esc(dash)}" target="_blank" rel="noopener">Open full dashboard ↗</a>
    </div>
    <p class="hint act-hint">Counted anonymously by GoatCounter: no cookies, no personal data. Admin pages and local previews
      aren’t counted.${FROM ? ` Counts start from ${esc(SITE.countFrom)} (set in config.js); earlier visits are kept on GoatCounter.` : ''}</p>`;
  const body = root.querySelector('#vis-body');

  async function load() {
    body.innerHTML = '<div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading visitor counts…</div>';
    const res = await Promise.allSettled(PAGES.map(([p]) => count(p, startFor(range))));
    if (res[0].status === 'rejected') {
      body.innerHTML = `<div class="admin-card warning"><p><strong>No visitor counts to show yet.</strong> Usually one of these:</p>
        <ul class="vis-help">
          <li>In GoatCounter, open <strong>Settings</strong>, tick <strong>“Allow adding visitor counts on your website”</strong> and save. (Needed once.)</li>
          <li>The website isn’t live yet, so no visits have been counted.</li>
          <li>An ad blocker is blocking GoatCounter on this page.</li>
        </ul></div>`;
      return;
    }
    // A page with no visits yet can fail on its own; the total loaded, so count it as 0.
    const [total, ...pages] = res.map((r) => (r.status === 'fulfilled' ? r.value : 0));
    const max = Math.max(1, ...pages);
    const label = RANGES.find(([v]) => v === range)[1];
    body.innerHTML = `
      <div class="admin-card vis-total"><span class="vis-num">${total.toLocaleString('en')}</span>
        <span class="vis-cap">visits to the website · ${esc(label.toLowerCase())}</span></div>
      <div class="admin-card"><h2 class="vis-h">By page</h2><ul class="vis-list">
        ${PAGES.slice(1).map(([, name], i) => `<li><span class="vis-name">${esc(name)}</span>
          <span class="vis-bar" aria-hidden="true"><span style="width:${Math.round((pages[i] / max) * 100)}%"></span></span>
          <span class="vis-count">${pages[i].toLocaleString('en')}</span></li>`).join('')}
      </ul><p class="hint">A visit opening a food’s details counts towards Food Explorer.</p></div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (!b || b.dataset.range === range) return;
    range = b.dataset.range;
    root.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load();
  });
  await load();
  return () => {};
}
