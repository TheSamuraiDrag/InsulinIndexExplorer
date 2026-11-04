// Admin · Activity: a logbook of what was published to the website, read from the
// repository's GitHub history. Every Publish on the Photos tab is one entry, recorded by
// GitHub with the account that made it. Sign-ins and Data check ticks aren't recorded
// (the site has no server), only published changes.

import { esc, photoType } from './ui.js';
import * as gh from './github.js';

const PER_PAGE = 30;
const VERBS = { add: 'Added photo', replace: 'Replaced image', edit: 'Edited details of', remove: 'Removed photo' };

function parse(message) {
  const [first, ...rest] = message.split('\n');
  const lines = rest.map((l) => l.trim()).filter(Boolean);
  const field = (name) => (lines.find((l) => l.startsWith(`${name}: `)) || '').slice(name.length + 2);
  const isPhotos = first.startsWith('Admin photos: ');
  const items = isPhotos ? first.slice('Admin photos: '.length).split('; ').map((part) => {
    const m = part.match(/^(add|replace|edit|remove) (.+)$/);
    if (m) {
      const label = photoType(m[2])?.label || m[2];
      return `${VERBS[m[1]]}: ${label}`;
    }
    return part.replace(/^change the photo of/, 'Changed the photo of');
  }) : [];
  return { isPhotos, title: first, items, foods: field('Foods'), note: field('Note'), login: field('Admin login'),
    body: isPhotos ? '' : lines.filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l)).slice(0, 6).join('\n') };
}

function when(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  const rel = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : '';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { rel, time, day: d.toDateString(), full: d.toLocaleString() };
}

function dayLabel(dayStr) {
  const today = new Date().toDateString();
  const yest = new Date(Date.now() - 864e5).toDateString();
  if (dayStr === today) return 'Today';
  if (dayStr === yest) return 'Yesterday';
  return new Date(dayStr).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export async function renderActivity(root) {
  const cfg = gh.repoConfig();
  const state = { filter: 'all', page: 1, commits: [], done: false, branch: cfg.branch, isPrivate: false };

  root.innerHTML = `
    <div class="act-head">
      <div class="seg" role="group" aria-label="Show">
        <button type="button" data-filter="all" aria-pressed="true">Everything</button>
        <button type="button" data-filter="photos" aria-pressed="false">Photo changes</button>
        <button type="button" data-filter="site" aria-pressed="false">Site updates</button>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-refresh>Refresh</button>
    </div>
    <div id="act-list"><div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading activity from GitHub…</div></div>
    <p class="hint act-hint">Every change published to the website is listed here, newest first, with the GitHub account that made it.
      Sign-ins and Data check ticks aren’t recorded.</p>`;
  const list = root.querySelector('#act-list');

  async function load() {
    try {
      if (!state.branch) {
        const info = await gh.repoInfo(cfg);
        state.branch = info.defaultBranch;
        state.isPrivate = info.isPrivate;
      }
      const page = await gh.listCommits(cfg, { branch: state.branch, page: state.page, perPage: PER_PAGE });
      state.commits.push(...page);
      state.done = page.length < PER_PAGE;
      render();
    } catch (e) {
      const msg = e.status === 403 || e.status === 429
        ? 'GitHub limits how often activity can be loaded without a connection. Connect GitHub (press Publish once on the Photos tab) or try again in an hour.'
        : e.status === 404 || e.status === 401
          ? 'Couldn’t read the history. If the repository is private, connect GitHub first (press Publish once on the Photos tab).'
          : `Couldn’t load activity: ${e.message}`;
      list.innerHTML = `<div class="admin-card warning">${esc(msg)}</div>`;
    }
  }

  function render() {
    const rows = state.commits.map((c) => ({ c, p: parse(c.commit.message) }))
      .filter(({ p }) => state.filter === 'all' || (state.filter === 'photos') === p.isPhotos);
    let lastDay = null;
    let html = '';
    rows.forEach(({ c, p }) => {
      const w = when(c.commit.author.date);
      if (w.day !== lastDay) { html += `<li class="act-day">${esc(dayLabel(w.day))}</li>`; lastDay = w.day; }
      const who = c.author?.login ? c.author.login : c.commit.author.name;
      const avatar = c.author?.avatar_url ? `<img class="act-avatar" src="${esc(c.author.avatar_url)}&s=64" alt="" loading="lazy" onerror="this.removeAttribute('src')">` : '<span class="act-avatar act-avatar-blank" aria-hidden="true"></span>';
      html += `<li class="act-item${p.isPhotos ? ' is-photos' : ''}">
        ${avatar}
        <div class="act-main">
          <p class="act-meta"><strong>${esc(who)}</strong>${p.login ? ` <span class="act-login">signed in as ${esc(p.login)}</span>` : ''}
            · <time datetime="${esc(c.commit.author.date)}" title="${esc(w.full)}">${esc(w.rel || w.time)}</time>
            <span class="act-kind">${p.isPhotos ? 'Photo change' : 'Site update'}</span></p>
          ${p.isPhotos
            ? `<ul class="act-items">${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
               ${p.foods ? `<p class="act-foods">Foods: ${p.foods.split(', ').map((n) => `<a href="#/explorer?food=${esc(n)}">No. ${esc(n)}</a>`).join(', ')}</p>` : ''}
               ${p.note ? `<p class="act-note">“${esc(p.note)}”</p>` : ''}`
            : `<p class="act-title">${esc(p.title)}</p>`}
          <div class="act-tools">
            <button type="button" class="link-btn" data-details="${esc(c.sha)}" aria-expanded="false">Details</button>
            <a class="link-btn" href="${esc(c.html_url)}" target="_blank" rel="noopener">View on GitHub</a>
          </div>
          <div class="act-details" id="d-${esc(c.sha)}" hidden></div>
        </div>
      </li>`;
    });
    list.innerHTML = `<ul class="act-list">${html || '<li class="admin-empty">Nothing here yet.</li>'}</ul>
      ${state.done ? '' : '<button type="button" class="btn btn-ghost btn-block" data-more>Load older activity</button>'}`;
  }

  async function details(sha, btn) {
    const box = root.querySelector(`#d-${CSS.escape(sha)}`);
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    box.hidden = open;
    if (open || box.dataset.loaded) return;
    box.innerHTML = '<span class="hint">Loading…</span>';
    try {
      const c = await gh.getCommit(cfg, sha);
      const parent = c.parents?.[0]?.sha;
      const imgs = (c.files || []).filter((f) => /^assets\/img\/foods\/thumb\/.+\.jpg$/.test(f.filename));
      const others = (c.files || []).filter((f) => !/^assets\/img\/foods\//.test(f.filename));
      const label = { added: 'added', modified: 'changed', removed: 'removed', renamed: 'renamed' };
      box.innerHTML = `
        ${imgs.length && !state.isPrivate ? `<ul class="act-thumbs">${imgs.map((f) => {
          const ref = f.status === 'removed' ? parent : sha;
          const id = f.filename.split('/').pop().replace(/\.jpg$/, '');
          return `<li class="${f.status === 'removed' ? 'is-removed' : ''}"><span class="food-pic"><img src="${esc(gh.rawUrl(cfg, ref, f.filename))}" alt="" loading="lazy" onerror="this.remove()"></span>
            <span>${esc(photoType(id)?.label || id)}<span class="ph-meta">${esc(label[f.status] || f.status)}</span></span></li>`;
        }).join('')}</ul>` : ''}
        <p class="act-files">${(c.files || []).length} file${(c.files || []).length === 1 ? '' : 's'} changed${others.length ? `: ${others.slice(0, 8).map((f) => `<code>${esc(f.filename)}</code> (${esc(label[f.status] || f.status)})`).join(', ')}${others.length > 8 ? ', …' : ''}` : ''}</p>
        ${parse(c.commit.message).body ? `<pre class="act-body">${esc(parse(c.commit.message).body)}</pre>` : ''}`;
      box.dataset.loaded = '1';
    } catch (e) {
      box.innerHTML = `<span class="hint">Couldn’t load details (${esc(e.message)}). Use “View on GitHub”.</span>`;
    }
  }

  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      state.filter = f.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
      render();
      return;
    }
    const d = e.target.closest('[data-details]');
    if (d) { details(d.dataset.details, d); return; }
    if (e.target.closest('[data-more]')) { state.page += 1; load(); return; }
    if (e.target.closest('[data-refresh]')) {
      Object.assign(state, { page: 1, commits: [], done: false });
      list.innerHTML = '<div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading activity from GitHub…</div>';
      load();
    }
  });

  await load();
  return () => {};
}
