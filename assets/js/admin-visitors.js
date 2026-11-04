// Admin · Visitors: visits to the public website, from GoatCounter (anonymous, no cookies).
//
// - Totals per page come from GoatCounter's public visitor counter ("Allow adding visitor counts
//   on your website" must be ticked in GoatCounter → Settings).
// - Countries, referrers, devices and browsers come from GoatCounter's API and need a read-only
//   API key, pasted once per device. The key is kept in this browser only, never in the code.
// - SITE.countFrom (config.js) starts all counts from a date, e.g. the launch day. Nothing is
//   deleted on GoatCounter, so it can always be changed back.

import { esc } from './ui.js';
import { SITE } from './config.js';

const PAGES = [['TOTAL', 'Whole website'], ['/', 'Home'], ['/explorer', 'Food Explorer'], ['/groups', 'Food groups'],
  ['/lowest', 'Lowest-II picks'], ['/mixed', 'Mixed meals'], ['/guide', 'How to read the II'], ['/about', 'About & sources']];
const DETAILS = [['locations', 'Countries'], ['toprefs', 'Came from'], ['sizes', 'Devices'], ['browsers', 'Browsers'], ['systems', 'Systems']];
const KEY = 'ii-gc-key';
const FROM = /^\d{4}-\d{2}-\d{2}$/.test(SITE.countFrom || '') ? new Date(`${SITE.countFrom}T00:00:00Z`) : null;
const RANGES = [['all', FROM ? `Since ${SITE.countFrom}` : 'All time'], ['30', 'Last 30 days'], ['7', 'Last 7 days']];

const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const setKey = (k) => { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch { /* ignore */ } };
const num = (v) => Number(String(v ?? 0).replace(/[^\d]/g, '')) || 0;
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

function startFor(range) {
  const d = range === 'all' ? null : new Date(Date.now() - Number(range) * 864e5);
  if (!FROM) return d;
  return !d || d < FROM ? FROM : d;
}

async function count(path, start) {
  const url = `https://${SITE.goatcounter}.goatcounter.com/counter/${encodeURIComponent(path)}.json${start ? `?start=${iso(start).slice(0, 10)}` : ''}`;
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`GoatCounter answered ${res.status}`);
  return num((await res.json()).count);
}

async function stats(page, start) {
  // GoatCounter wants whole hours: start rounded down, end rounded up.
  const hour = (d, up) => { const t = new Date(d); t.setUTCMinutes(0, 0, 0); if (up && t < d) t.setUTCHours(t.getUTCHours() + 1); return t; };
  const q = new URLSearchParams({ start: iso(hour(start || new Date('2024-01-01T00:00:00Z'))), end: iso(hour(new Date(), true)), limit: '8' });
  const res = await fetch(`https://${SITE.goatcounter}.goatcounter.com/api/v0/stats/${page}?${q}`,
    { headers: { Authorization: `Bearer ${getKey()}` }, cache: 'no-store', credentials: 'omit' });
  if (!res.ok) { const e = new Error(`GoatCounter answered ${res.status}`); e.status = res.status; throw e; }
  return ((await res.json()).stats || []).map((s) => ({ name: s.name || '', count: num(s.count) }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// GoatCounter's API allows 4 requests a second and its "slow down" reply can't be read by the
// browser (it shows as "Failed to fetch"), so ask one list at a time and retry after a pause.
async function statsPolitely(page, start) {
  for (let i = 0; ; i += 1) {
    try { return await stats(page, start); } catch (e) {
      if (i === 2 || e.status === 401 || e.status === 403) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

const bars = (rows, empty = 'Nothing yet.') => {
  if (!rows.length) return `<p class="hint">${empty}</p>`;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return `<ul class="vis-list">${rows.map((r) => `<li><span class="vis-name">${esc(r.name)}</span>
    <span class="vis-bar" aria-hidden="true"><span style="width:${Math.round((r.count / max) * 100)}%"></span></span>
    <span class="vis-count">${r.count.toLocaleString('en')}</span></li>`).join('')}</ul>`;
};

const connectForm = (msg = '') => `
  <div class="admin-card vis-connect">
    <h2 class="vis-h">See countries, referrers and devices here</h2>
    ${msg ? `<p class="vis-err">${esc(msg)}</p>` : ''}
    <ol class="vis-help">
      <li>Open the <a href="https://${esc(SITE.goatcounter)}.goatcounter.com/user/api" target="_blank" rel="noopener">GoatCounter API page ↗</a>
        (Settings → API) and press <strong>New API key</strong>.</li>
      <li>Name it “Website admin” and tick <strong>only “Read statistics”</strong>. Save.</li>
      <li>Copy the key and paste it below. It stays in this browser only (once per device).</li>
    </ol>
    <form class="vis-form" id="gc-form">
      <label class="sr-only" for="gc-key">GoatCounter API key</label>
      <input id="gc-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste the API key">
      <button type="submit" class="btn btn-sm">Connect</button>
    </form>
  </div>`;

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
    <div id="vis-more"></div>
    <p class="hint act-hint">Counted anonymously by GoatCounter: no cookies, no personal data. Admin pages and local previews
      aren’t counted.${FROM ? ` Counts start from ${esc(SITE.countFrom)} (set in config.js); earlier visits are kept on GoatCounter.` : ''}</p>`;
  const body = root.querySelector('#vis-body');
  const more = root.querySelector('#vis-more');

  async function loadCounts() {
    body.innerHTML = '<div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading visitor counts…</div>';
    const start = startFor(range);
    const res = await Promise.allSettled(PAGES.map(([p]) => count(p, start)));
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
    const label = RANGES.find(([v]) => v === range)[1];
    body.innerHTML = `
      <div class="admin-card vis-total"><span class="vis-num">${total.toLocaleString('en')}</span>
        <span class="vis-cap">visits to the website · ${esc(label.toLowerCase())}</span></div>
      <div class="admin-card"><h2 class="vis-h">By page</h2>
        ${bars(PAGES.slice(1).map(([, name], i) => ({ name, count: pages[i] })))}
        <p class="hint">A visit opening a food’s details counts towards Food Explorer.</p></div>`;
  }

  let ticket = 0;
  async function loadDetails() {
    const mine = ++ticket;
    if (!getKey()) { more.innerHTML = connectForm(); return; }
    more.innerHTML = '<div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading countries, referrers and devices…</div>';
    const start = startFor(range);
    try {
      const lists = [];
      for (const [page] of DETAILS) {
        lists.push(await statsPolitely(page, start));
        if (mine !== ticket) return;
        await sleep(350);
      }
      more.innerHTML = `<div class="vis-grid">${DETAILS.map(([page, title], i) => `<div class="admin-card"><h2 class="vis-h">${title}</h2>
        ${bars(lists[i].map((r) => ({ ...r, name: r.name || (page === 'toprefs' ? 'Typed the address or a direct link' : 'Unknown') })))}</div>`).join('')}</div>
        <p class="hint vis-key">GoatCounter connected on this device (read-only key) ·
          <button type="button" class="link-btn" data-gc-disconnect>Disconnect</button></p>`;
    } catch (e) {
      if (mine !== ticket) return;
      if (e.status === 401 || e.status === 403) {
        setKey('');
        more.innerHTML = connectForm('GoatCounter didn’t accept that key. Make a new one with “Read statistics” ticked and paste it again.');
        return;
      }
      more.innerHTML = `<div class="admin-card warning vis-connect"><p><strong>GoatCounter didn’t answer just now.</strong>
        It may be busy, or an ad blocker may be blocking it on this page. (${esc(e.message)})</p>
        <p class="vis-form"><button type="button" class="btn btn-sm" data-gc-retry>Try again</button>
        <button type="button" class="link-btn" data-gc-disconnect>Disconnect GoatCounter</button></p></div>`;
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (b && b.dataset.range !== range) {
      range = b.dataset.range;
      root.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      loadCounts(); loadDetails();
      return;
    }
    if (e.target.closest('[data-gc-disconnect]')) { setKey(''); loadDetails(); return; }
    if (e.target.closest('[data-gc-retry]')) loadDetails();
  });
  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'gc-form') return;
    e.preventDefault();
    const k = root.querySelector('#gc-key').value.trim();
    if (!/^[A-Za-z0-9_-]{16,}$/.test(k)) { more.innerHTML = connectForm('That doesn’t look like a GoatCounter API key. Copy the whole key and try again.'); return; }
    setKey(k); loadDetails();
  });
  await Promise.all([loadCounts(), loadDetails()]);
  return () => {};
}
