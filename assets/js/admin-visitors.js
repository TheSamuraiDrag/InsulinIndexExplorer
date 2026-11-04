// Admin · Visitors: how many visits each page has had, from GoatCounter (anonymous, no cookies).
// Reads GoatCounter's public visitor counter, which only works after "Allow adding visitor
// counts on your website" is ticked in GoatCounter → Settings. More detail (countries, browsers,
// where visitors came from) is on the full GoatCounter dashboard, linked from this tab.

import { esc } from './ui.js';
import { SITE } from './config.js';

const PAGES = [['TOTAL', 'Whole website'], ['/', 'Home'], ['/explorer', 'Food Explorer'], ['/groups', 'Food groups'],
  ['/lowest', 'Lowest-II picks'], ['/mixed', 'Mixed meals'], ['/guide', 'How to read the II'], ['/about', 'About & sources']];
const RANGES = [['all', 'All time'], ['30', 'Last 30 days'], ['7', 'Last 7 days']];

async function count(path, range) {
  let url = `https://${SITE.goatcounter}.goatcounter.com/counter/${encodeURIComponent(path)}.json`;
  if (range !== 'all') url += `?start=${new Date(Date.now() - Number(range) * 864e5).toISOString().slice(0, 10)}`;
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`GoatCounter answered ${res.status}`);
  const j = await res.json();
  return Number(String(j.count ?? 0).replace(/[^\d]/g, '')) || 0;
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
        ${RANGES.map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${v === range}">${l}</button>`).join('')}
      </div>
      <a class="btn btn-ghost btn-sm" href="${esc(dash)}" target="_blank" rel="noopener">Open full dashboard ↗</a>
    </div>
    <div id="vis-body" aria-live="polite"></div>
    <p class="hint act-hint">Counted anonymously by GoatCounter: no cookies, no personal data. Admin pages and local previews
      aren’t counted. Countries, browsers and where visitors came from are on the full dashboard (sign in with the GoatCounter account).</p>`;
  const body = root.querySelector('#vis-body');

  async function load() {
    body.innerHTML = '<div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading visitor counts…</div>';
    const res = await Promise.allSettled(PAGES.map(([p]) => count(p, range)));
    if (res[0].status === 'rejected') {
      body.innerHTML = `<div class="admin-card warning"><p><strong>No visitor counts to show yet.</strong> Usually one of these:</p>
        <ul class="vis-help">
          <li>In GoatCounter, open <strong>Settings</strong>, tick <strong>“Allow adding visitor counts on your website”</strong> and save. (Needed once.)</li>
          <li>The website isn’t live yet, so no visits have been counted.</li>
          <li>An ad blocker is blocking GoatCounter on this page.</li>
        </ul>
        <p><a href="${esc(dash)}" target="_blank" rel="noopener">Open the GoatCounter dashboard ↗</a></p></div>`;
      return;
    }
    // A page with no visits yet can fail on its own; the total loaded, so count it as 0.
    const [total, ...pages] = res.map((r) => (r.status === 'fulfilled' ? r.value : 0));
    const max = Math.max(1, ...pages);
    const label = RANGES.find(([v]) => v === range)[1].toLowerCase();
    body.innerHTML = `
      <div class="admin-card vis-total"><span class="vis-num">${total.toLocaleString('en')}</span>
        <span class="vis-cap">visits to the website, ${esc(label)}</span></div>
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
