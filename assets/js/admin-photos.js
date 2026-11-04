// Admin · Photos: add, replace, edit and remove food photos, and choose which foods use
// which photo. Edits are previewed across the whole site in this tab, then published to
// GitHub as one commit (images + data/photos.json). The live site updates about a minute later.

import { esc, plain, toast, applyPhotos, openSheet, closeSheet, photoType } from './ui.js';
import * as gh from './github.js';

const FULL = [800, 600];
const THUMB = [240, 240];
const PAGE = 80;

const LICENCES = [
  ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
  ['CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'],
  ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ['CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'],
  ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Public Domain Mark', 'https://creativecommons.org/publicdomain/mark/1.0/'],
  ['Pexels License', 'https://www.pexels.com/license/'],
  ['Unsplash License', 'https://unsplash.com/license'],
  ['Pixabay Content License', 'https://pixabay.com/service/license-summary/'],
  ['Own photo (used with permission)', ''],
];

// Survives switching tabs or pages, so unpublished edits aren't lost (until the tab closes).
const session = { base: null, pending: emptyPending(), published: {}, note: '' };
let ghAccess = null; // { login, branch } once a GitHub token has been checked

function emptyPending() { return { types: {}, map: {} }; }
const pendingCount = () => Object.keys(session.pending.types).length + Object.keys(session.pending.map).length;
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Apply pending edits to a photos.json object. forCommit: strip preview fields, bump versions.
function applyPending(base, pending, { forCommit = false } = {}) {
  const out = { ...base, types: { ...base.types }, map: { ...base.map } };
  Object.entries(pending.types).forEach(([id, p]) => {
    if (p.deleted) {
      delete out.types[id];
      Object.keys(out.map).forEach((n) => { if (out.map[n] === id) delete out.map[n]; });
      return;
    }
    const t = { ...(out.types[id] || {}), label: p.label ?? out.types[id]?.label, credit: p.credit ?? out.types[id]?.credit ?? {} };
    if (p.image) {
      if (forCommit) t.v = Date.now().toString(36);
      else { t.previewSrc = p.image.fullUrl; t.previewThumb = p.image.thumbUrl; }
    }
    out.types[id] = t;
  });
  Object.entries(pending.map).forEach(([n, id]) => {
    if (id && out.types[id]) out.map[n] = id; else delete out.map[n];
  });
  if (!forCommit) {
    // Images published this session may not be live on GitHub Pages yet: keep showing them.
    Object.entries(session.published).forEach(([id, img]) => {
      if (out.types[id] && !out.types[id].previewSrc) Object.assign(out.types[id], { previewSrc: img.fullUrl, previewThumb: img.thumbUrl });
    });
  } else {
    Object.values(out.types).forEach((t) => { delete t.previewSrc; delete t.previewThumb; });
    out.map = Object.fromEntries(Object.entries(out.map).sort((a, b) => Number(a[0]) - Number(b[0])));
    out.types = Object.fromEntries(Object.entries(out.types).sort((a, b) => a[0].localeCompare(b[0])));
  }
  return out;
}

const preview = () => applyPending(session.base, session.pending);
const refreshSite = () => applyPhotos(preview());

/* ---------- Images: crop and resize in the browser ---------- */

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

function cropTo(src, [w, h], fx = 0.5, fy = 0.5) {
  const bw = src.width; const bh = src.height;
  const scale = Math.max(w / bw, h / bh);
  const sw = w / scale; const sh = h / scale;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (bw - sw) * fx, (bh - sh) * fy, sw, sh, 0, 0, w, h);
  return canvas;
}
const toJpeg = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));

/* ---------- Main view ---------- */

export async function renderPhotos(root, data, params) {
  root.innerHTML = '<div class="admin-card ph-loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading photos…</div>';
  if (!session.base) {
    try {
      const res = await fetch('data/photos.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      session.base = await res.json();
    } catch (e) {
      root.innerHTML = `<div class="admin-card warning">Couldn’t load <code>data/photos.json</code> (${esc(e.message)}). Please reload the page.</div>`;
      return () => {};
    }
  }
  refreshSite();

  const F = data.foods;
  const state = { view: params.get('view') === 'foods' ? 'foods' : 'library', q: params.get('q') || '', filter: 'all', shown: PAGE };
  const usage = () => {
    const counts = {};
    Object.values(preview().map).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    return counts;
  };

  root.innerHTML = `
    <div class="ph-bar" id="ph-bar"></div>
    <div class="ph-head">
      <div class="seg" role="group" aria-label="Photos view">
        <button type="button" data-view="library" aria-pressed="${state.view === 'library'}">Photo library</button>
        <button type="button" data-view="foods" aria-pressed="${state.view === 'foods'}">Foods and their photos</button>
      </div>
      <div class="search search-sm">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <label for="ph-q" class="sr-only">Search</label>
        <input id="ph-q" type="search" autocomplete="off" value="${esc(state.q)}">
      </div>
      <label class="sel ph-filter"><span class="sr-only">Show</span><select id="ph-filter">
        <option value="all">All foods</option><option value="none">Foods without a photo</option><option value="has">Foods with a photo</option>
        <option value="single">Single foods</option><option value="mixed">Mixed meals</option></select></label>
      <button type="button" class="btn btn-primary btn-sm" data-add>+ Add a photo</button>
    </div>
    <div id="ph-body"></div>
    <p class="hint ph-hint">Photos are cropped in your browser to 800×600 and 240×240 and saved as JPEG. Use JPG, PNG or WebP files.
      Every photo needs a licence that allows use on a public website, or your team’s own photo.</p>`;

  const $ = (s) => root.querySelector(s);
  const body = $('#ph-body');

  function renderBar() {
    const n = pendingCount();
    $('#ph-bar').className = `ph-bar${n ? ' has-changes' : ''}`;
    $('#ph-bar').innerHTML = n
      ? `<span><strong>${n}</strong> unpublished change${n === 1 ? '' : 's'}. You’re seeing them across the site in this tab only.</span>
        <label class="ph-note"><span class="sr-only">Note for the logbook (optional)</span>
          <input id="ph-note" type="text" maxlength="200" placeholder="Note for the logbook (optional)" value="${esc(session.note)}"></label>
        <span class="ph-bar-actions"><button type="button" class="btn btn-ghost btn-sm" data-discard>Discard</button>
        <button type="button" class="btn btn-primary btn-sm" data-publish>Publish to website</button></span>`
      : '<span>No unpublished changes. Edits you make here are previewed first, then published in one go.</span>';
  }

  function statusOf(id) {
    const p = session.pending.types[id];
    if (!p) return '';
    if (p.deleted) return '<span class="ph-flag is-del">Will be removed</span>';
    if (p.isNew) return '<span class="ph-flag is-new">New</span>';
    if (p.image) return '<span class="ph-flag">New image</span>';
    return '<span class="ph-flag">Edited</span>';
  }

  function renderLibrary() {
    const pv = preview();
    const counts = usage();
    const q = state.q.trim().toLowerCase();
    const ids = Object.keys({ ...pv.types, ...Object.fromEntries(Object.keys(session.pending.types).map((k) => [k, 1])) })
      .filter((id) => {
        const t = pv.types[id] || session.base.types[id];
        return !q || id.includes(q) || (t && t.label.toLowerCase().includes(q));
      })
      .sort((a, b) => ((pv.types[a] || session.base.types[a]).label).localeCompare((pv.types[b] || session.base.types[b]).label));
    body.innerHTML = `<p class="count ph-count"><strong>${Object.keys(pv.types).length}</strong> photos · ${Object.keys(pv.map).length} foods have one</p>
      <ul class="ph-grid">${ids.map((id) => {
        const deleted = session.pending.types[id]?.deleted;
        const t = pv.types[id] || session.base.types[id];
        const ph = photoType(id);
        const src = ph ? ph.thumb : `assets/img/foods/thumb/${id}.jpg?v=${encodeURIComponent(t.v || '')}`;
        return `<li class="ph-card${deleted ? ' is-deleted' : ''}">
          <span class="food-pic"><img src="${esc(src)}" alt="" loading="lazy"></span>
          <span class="ph-info"><strong>${esc(t.label)}</strong>
            <span class="ph-meta">${counts[id] || 0} food${counts[id] === 1 ? '' : 's'} · ${esc(t.credit?.licence || 'no licence')}</span>${statusOf(id)}</span>
          <span class="ph-actions">${deleted
            ? `<button type="button" class="btn btn-ghost btn-xs" data-undo="${esc(id)}">Undo remove</button>`
            : `<button type="button" class="btn btn-ghost btn-xs" data-edit="${esc(id)}">Edit</button>
               <button type="button" class="btn btn-ghost btn-xs" data-del="${esc(id)}">Remove</button>`}</span>
        </li>`;
      }).join('') || '<li class="admin-empty">No photos match.</li>'}</ul>`;
  }

  function foodRows() {
    const pv = preview();
    const q = state.q.trim().toLowerCase();
    return F.filter((f) => {
      const has = Boolean(pv.map[f.n] && pv.types[pv.map[f.n]]);
      if (state.filter === 'none' && has) return false;
      if (state.filter === 'has' && !has) return false;
      if (state.filter === 'single' && f.meal !== 'SINGLE') return false;
      if (state.filter === 'mixed' && f.meal === 'SINGLE') return false;
      if (!q) return true;
      if (/^\d+$/.test(q)) return f.n === q;
      return f.searchKey.includes(q) || (has && pv.types[pv.map[f.n]].label.toLowerCase().includes(q));
    });
  }

  function renderFoods() {
    const pv = preview();
    const rows = foodRows();
    body.innerHTML = `<p class="count ph-count"><strong>${rows.length}</strong> food${rows.length === 1 ? '' : 's'}</p>
      <ul class="ph-foods">${rows.slice(0, state.shown).map((f) => {
        const id = pv.map[f.n];
        const ph = id ? photoType(id) : null;
        const changed = f.n in session.pending.map;
        return `<li class="ph-food${changed ? ' is-changed' : ''}">
          <span class="ph-no">${esc(f.n)}.</span>
          ${ph ? `<span class="food-pic"><img src="${esc(ph.thumb)}" alt="" loading="lazy"></span>` : '<span class="food-pic no-pic" aria-hidden="true"></span>'}
          <span class="ph-food-name">${esc(plain(f.name))}<span class="ph-meta">${f.meal === 'SINGLE' ? 'Single food' : 'Mixed meal'} · ${ph ? esc(ph.label) : 'No photo'}${changed ? ' · changed' : ''}</span></span>
          <button type="button" class="btn btn-ghost btn-xs" data-pick="${esc(f.n)}" aria-label="Change photo for entry ${esc(f.n)}">Change</button>
        </li>`;
      }).join('') || '<li class="admin-empty">No foods match.</li>'}</ul>
      ${rows.length > state.shown ? `<button type="button" class="btn btn-ghost btn-block" data-more>Show more (${rows.length - state.shown} left)</button>` : ''}`;
  }

  function render() {
    $('#ph-q').placeholder = state.view === 'library' ? 'Search photos, e.g. rice' : 'Search foods by name or number';
    $('.ph-filter').hidden = state.view !== 'foods';
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderBar();
    if (state.view === 'library') renderLibrary(); else renderFoods();
    const p = new URLSearchParams({ tab: 'photos' });
    if (state.view === 'foods') p.set('view', 'foods');
    if (state.q) p.set('q', state.q);
    history.replaceState(null, '', `#/admin?${p}`);
  }

  const changed = () => { refreshSite(); render(); };

  /* ----- photo picker (for one food) ----- */
  function openPicker(n) {
    const f = F.find((x) => x.n === n);
    const pv = preview();
    const dialog = ensureDialog('ph-picker');
    const current = pv.map[n] || '';
    const list = (q) => Object.entries(pv.types)
      .filter(([id, t]) => !q || t.label.toLowerCase().includes(q) || id.includes(q))
      .sort((a, b) => a[1].label.localeCompare(b[1].label));
    dialog.querySelector('.sheet-inner').innerHTML = `
      <button type="button" class="icon-btn sheet-close" data-close aria-label="Close">✕</button>
      <div class="compare-content">
        <h2 class="compare-title">Photo for no. ${esc(n)}</h2>
        <p class="lede">${esc(plain(f.name))}</p>
        <div class="search search-sm"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <label for="pk-q" class="sr-only">Search photos</label><input id="pk-q" type="search" placeholder="Search photos" autocomplete="off"></div>
        <ul class="ph-pick" id="pk-list"></ul>
      </div>`;
    const ul = dialog.querySelector('#pk-list');
    const draw = (q = '') => {
      ul.innerHTML = `<li><button type="button" class="ph-pick-item${current ? '' : ' is-on'}" data-choose="">
          <span class="food-pic no-pic" aria-hidden="true"></span><span>No photo</span></button></li>`
        + list(q.toLowerCase()).map(([id, t]) => `<li><button type="button" class="ph-pick-item${id === current ? ' is-on' : ''}" data-choose="${esc(id)}">
          <span class="food-pic"><img src="${esc(photoType(id)?.thumb || '')}" alt="" loading="lazy"></span><span>${esc(t.label)}</span></button></li>`).join('');
    };
    draw();
    dialog.querySelector('#pk-q').addEventListener('input', (e) => draw(e.target.value.trim()));
    dialog.onclick = (e) => {
      if (e.target === dialog || e.target.closest('[data-close]')) { closeSheet(dialog); return; }
      const c = e.target.closest('[data-choose]');
      if (!c) return;
      const id = c.dataset.choose || null;
      if ((session.base.map[n] || null) === id) delete session.pending.map[n]; else session.pending.map[n] = id;
      closeSheet(dialog);
      changed();
    };
    openSheet(dialog);
    dialog.querySelector('#pk-q').focus();
  }

  /* ----- editor (add / edit one photo) ----- */
  function openEditor(id = null) {
    const pv = preview();
    const isNew = !id;
    const t = id ? pv.types[id] : { label: '', credit: {} };
    const c = t.credit || {};
    const pendingImg = id ? session.pending.types[id]?.image : null;
    const assigned = new Set(Object.entries(pv.map).filter(([, v]) => v === id).map(([n]) => n));
    const ed = { bitmap: null, fx: 0.5, fy: 0.5, picked: new Set(assigned) };
    const dialog = ensureDialog('ph-editor');
    const licOpts = LICENCES.map(([l]) => l);
    const otherLic = c.licence && !licOpts.includes(c.licence);
    dialog.querySelector('.sheet-inner').innerHTML = `
      <button type="button" class="icon-btn sheet-close" data-close aria-label="Close">✕</button>
      <form class="compare-content ph-editor" novalidate>
        <h2 class="compare-title">${isNew ? 'Add a photo' : `Edit photo: ${esc(t.label)}`}</h2>
        <div class="ph-drop" tabindex="0">
          <input type="file" id="ed-file" accept="image/jpeg,image/png,image/webp" class="sr-only">
          <label for="ed-file" class="ph-drop-label"><strong>${isNew ? 'Choose a photo' : 'Replace the image (optional)'}</strong>
            <span>or drag a JPG, PNG or WebP file here</span></label>
          <div class="ph-previews" ${isNew && !pendingImg ? 'hidden' : ''}>
            <figure><img id="ed-full" alt="" src="${esc(pendingImg?.fullUrl || (id ? photoType(id)?.src || '' : ''))}"><figcaption>Large (detail page)</figcaption></figure>
            <figure><img id="ed-thumb" alt="" src="${esc(pendingImg?.thumbUrl || (id ? photoType(id)?.thumb || '' : ''))}"><figcaption>Small (cards)</figcaption></figure>
          </div>
          <div class="ph-crop" hidden>
            <label>Crop left ↔ right <input type="range" id="ed-fx" min="0" max="100" value="50"></label>
            <label>Crop top ↕ bottom <input type="range" id="ed-fy" min="0" max="100" value="50"></label>
          </div>
          <p class="ph-img-note" id="ed-imgnote"></p>
        </div>
        <div class="ph-fields">
          <label class="wide"><span>What it shows <span class="req">*</span></span><input id="ed-label" required value="${esc(t.label)}" placeholder="e.g. Brown rice">
            <span class="hint">Shown under the photo as “Photo shows … in general, not the exact product tested.”</span></label>
          ${isNew ? '<label class="wide">Photo id <input id="ed-id" pattern="[a-z0-9-]+" placeholder="made from the name"><span class="hint">Used for the file name. Lowercase letters, numbers and dashes.</span></label>' : ''}
          <label><span>Licence <span class="req">*</span></span><select id="ed-lic">${licOpts.map((l) => `<option${l === c.licence ? ' selected' : ''}>${esc(l)}</option>`).join('')}
            <option value="__other"${otherLic ? ' selected' : ''}>Other…</option></select></label>
          <label id="ed-lic-other-wrap" ${otherLic ? '' : 'hidden'}>Licence name<input id="ed-lic-other" value="${esc(otherLic ? c.licence : '')}"></label>
          <label>Licence link<input id="ed-licurl" type="url" value="${esc(c.licenceUrl || '')}"></label>
          <label>Photographer / author<input id="ed-author" value="${esc(c.author || '')}"></label>
          <label>Author link<input id="ed-authorurl" type="url" value="${esc(c.authorUrl || '')}"></label>
          <label>Photo title<input id="ed-title" value="${esc(c.title || '')}"></label>
          <label>Source page<input id="ed-source" type="url" value="${esc(c.source || '')}" placeholder="where the photo was found"></label>
          <label>Found via<input id="ed-via" value="${esc(c.via || '')}" placeholder="e.g. Flickr, Wikimedia Commons, own photo"></label>
        </div>
        <fieldset class="ph-assign"><legend>Foods that use this photo (<span id="ed-n">${ed.picked.size}</span>)</legend>
          <div class="search search-sm"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <label for="ed-fq" class="sr-only">Find foods</label><input id="ed-fq" type="search" placeholder="Find foods to add, by name or number" autocomplete="off"></div>
          <ul class="ph-assign-list" id="ed-foods"></ul>
        </fieldset>
        <p class="signin-error" id="ed-err" role="alert"></p>
        <div class="detail-actions"><button type="submit" class="btn btn-primary">${isNew ? 'Add photo' : 'Save changes'}</button>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button></div>
        <p class="hint">Nothing is published yet: “${isNew ? 'Add photo' : 'Save changes'}” adds this to your unpublished changes.</p>
      </form>`;

    const q = (s) => dialog.querySelector(s);
    const lic = q('#ed-lic');
    lic.addEventListener('change', () => {
      q('#ed-lic-other-wrap').hidden = lic.value !== '__other';
      const known = LICENCES.find(([l]) => l === lic.value);
      if (known) q('#ed-licurl').value = known[1];
    });
    if (isNew) {
      q('#ed-label').addEventListener('input', () => { if (!q('#ed-id').dataset.touched) q('#ed-id').value = slug(q('#ed-label').value); });
      q('#ed-id').addEventListener('input', () => { q('#ed-id').dataset.touched = '1'; });
    }

    const drawFoods = () => {
      const fq = q('#ed-fq').value.trim().toLowerCase();
      const matches = fq ? F.filter((f) => (/^\d+$/.test(fq) ? f.n === fq : f.searchKey.includes(fq))).slice(0, 40) : [];
      const ticked = F.filter((f) => ed.picked.has(f.n));
      const shown = [...ticked, ...matches.filter((f) => !ed.picked.has(f.n))];
      q('#ed-foods').innerHTML = shown.map((f) => {
        const other = pv.map[f.n] && pv.map[f.n] !== id ? pv.types[pv.map[f.n]]?.label : '';
        return `<li><label><input type="checkbox" data-food="${esc(f.n)}" ${ed.picked.has(f.n) ? 'checked' : ''}>
          <span><strong>${esc(f.n)}.</strong> ${esc(plain(f.name))}${other ? `<span class="ph-meta">now uses: ${esc(other)}</span>` : ''}${f.meal === 'SINGLE' ? '' : '<span class="ph-meta">mixed meal</span>'}</span></label></li>`;
      }).join('') || '<li class="hint">Search above to add foods.</li>';
      q('#ed-n').textContent = ed.picked.size;
    };
    drawFoods();
    q('#ed-fq').addEventListener('input', drawFoods);
    q('#ed-foods').addEventListener('change', (e) => {
      const cb = e.target.closest('[data-food]');
      if (!cb) return;
      if (cb.checked) ed.picked.add(cb.dataset.food); else ed.picked.delete(cb.dataset.food);
      q('#ed-n').textContent = ed.picked.size;
    });

    const redraw = async () => {
      if (!ed.bitmap) return;
      const full = cropTo(ed.bitmap, FULL, ed.fx, ed.fy);
      const thumb = cropTo(ed.bitmap, THUMB, ed.fx, ed.fy);
      q('#ed-full').src = full.toDataURL('image/jpeg', 0.7);
      q('#ed-thumb').src = thumb.toDataURL('image/jpeg', 0.7);
    };
    const takeFile = async (file) => {
      q('#ed-err').textContent = '';
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) { q('#ed-imgnote').textContent = 'Please choose a JPG, PNG or WebP image.'; return; }
      try { ed.bitmap = await loadBitmap(file); } catch { q('#ed-imgnote').textContent = 'That image couldn’t be read. Try saving it as a JPG first.'; return; }
      const { width: w, height: h } = ed.bitmap;
      q('#ed-imgnote').textContent = w < FULL[0] || h < FULL[1] ? `This image is ${w}×${h}. It will work, but a photo at least 800×600 looks sharper.` : `${w}×${h} image.`;
      q('.ph-previews').hidden = false;
      q('.ph-crop').hidden = false;
      redraw();
    };
    q('#ed-file').addEventListener('change', (e) => takeFile(e.target.files[0]));
    const drop = q('.ph-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); takeFile(e.dataTransfer.files[0]); });
    q('#ed-fx').addEventListener('input', (e) => { ed.fx = e.target.value / 100; redraw(); });
    q('#ed-fy').addEventListener('input', (e) => { ed.fy = e.target.value / 100; redraw(); });

    dialog.onclick = (e) => { if (e.target === dialog || e.target.closest('[data-close]')) closeSheet(dialog); };
    q('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = (m) => { q('#ed-err').textContent = m; };
      const label = q('#ed-label').value.trim();
      const licence = lic.value === '__other' ? q('#ed-lic-other').value.trim() : lic.value;
      let newId = id;
      if (!label) return err('Please say what the photo shows.');
      if (!licence) return err('Please give the photo’s licence.');
      if (isNew) {
        newId = (q('#ed-id').value.trim() || slug(label));
        if (!/^[a-z0-9-]+$/.test(newId)) return err('The photo id can only use lowercase letters, numbers and dashes.');
        if (pv.types[newId] || session.base.types[newId]) return err(`A photo called “${newId}” already exists. Choose another id, or edit that photo instead.`);
        if (!ed.bitmap) return err('Please choose an image.');
      }
      const entry = { ...(session.pending.types[newId] || {}), label, isNew: isNew || session.pending.types[newId]?.isNew,
        credit: { title: q('#ed-title').value.trim(), author: q('#ed-author').value.trim(), authorUrl: q('#ed-authorurl').value.trim(),
          licence, licenceUrl: q('#ed-licurl').value.trim(), source: q('#ed-source').value.trim(), via: q('#ed-via').value.trim() } };
      if (ed.bitmap) {
        const [full, thumb] = await Promise.all([toJpeg(cropTo(ed.bitmap, FULL, ed.fx, ed.fy)), toJpeg(cropTo(ed.bitmap, THUMB, ed.fx, ed.fy))]);
        if (entry.image) { URL.revokeObjectURL(entry.image.fullUrl); URL.revokeObjectURL(entry.image.thumbUrl); }
        entry.image = { full, thumb, fullUrl: URL.createObjectURL(full), thumbUrl: URL.createObjectURL(thumb) };
      }
      session.pending.types[newId] = entry;
      // Food assignments chosen in the editor.
      F.forEach((f) => {
        const was = preview().map[f.n] === newId;
        const want = ed.picked.has(f.n);
        if (want === was) return;
        const target = want ? newId : null;
        if ((session.base.map[f.n] || null) === target) delete session.pending.map[f.n]; else session.pending.map[f.n] = target;
      });
      closeSheet(dialog);
      changed();
      toast(isNew ? `Added “${label}”. Publish when you’re ready.` : `Saved “${label}”. Publish when you’re ready.`);
    });
    openSheet(dialog);
  }

  /* ----- publish ----- */
  async function publish(btn) {
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    const cfg = await ensureGitHub();
    if (!cfg) { btn.disabled = false; btn.textContent = 'Publish to website'; return; }
    try {
      const head = await gh.headSha(cfg);
      const latest = JSON.parse(await gh.readText(cfg, 'data/photos.json', head));
      const next = applyPending(latest, session.pending, { forCommit: true });
      const files = [];
      const remove = [];
      const summary = [];
      for (const [id, p] of Object.entries(session.pending.types)) {
        if (p.deleted) {
          if (latest.types[id]) remove.push(`assets/img/foods/${id}.jpg`, `assets/img/foods/thumb/${id}.jpg`);
          summary.push(`remove ${id}`);
        } else {
          if (p.image) {
            files.push({ path: `assets/img/foods/${id}.jpg`, b64: await gh.blobToB64(p.image.full) });
            files.push({ path: `assets/img/foods/thumb/${id}.jpg`, b64: await gh.blobToB64(p.image.thumb) });
          }
          summary.push(`${p.isNew ? 'add' : p.image ? 'replace' : 'edit'} ${id}`);
        }
      }
      const movedNos = Object.keys(session.pending.map).sort((a, b) => a - b);
      const moved = movedNos.length;
      if (moved) summary.push(`change the photo of ${moved} food${moved === 1 ? '' : 's'}`);
      // Extra lines the Activity tab reads back.
      const details = [];
      if (moved) details.push(`Foods: ${movedNos.join(', ')}`);
      if (session.note.trim()) details.push(`Note: ${session.note.trim().replace(/\s+/g, ' ')}`);
      if (adminUser()) details.push(`Admin login: ${adminUser()}`);
      files.push({ path: 'data/photos.json', b64: gh.textToB64(`${JSON.stringify(next, null, 1)}\n`) });
      const message = `Admin photos: ${summary.join('; ')}${details.length ? `\n\n${details.join('\n')}` : ''}`;
      await gh.commit(cfg, { message, parent: head, files, remove });
      Object.entries(session.pending.types).forEach(([id, p]) => { if (p.image && !p.deleted) session.published[id] = p.image; });
      session.base = next;
      session.pending = emptyPending();
      session.note = '';
      changed();
      toast('Published. The live website updates in about a minute.');
    } catch (e) {
      if (e.status === 401) { gh.signOut(); ghAccess = null; updateStatus(); }
      const msg = e.status === 401 ? 'The GitHub connection has expired. Press Publish again to reconnect.'
        : e.status === 403 || e.status === 404 ? 'GitHub refused the change. Check your token has “Contents: Read and write” for this repository.'
          : e.status === 409 || e.status === 422 ? 'Someone else published at the same moment. Press Publish again.'
            : `Publishing failed: ${e.message}`;
      toast(msg);
      btn.disabled = false;
      btn.textContent = 'Publish to website';
    }
  }

  /* ----- events ----- */
  root.addEventListener('input', (e) => { if (e.target.id === 'ph-note') session.note = e.target.value; });
  let t;
  $('#ph-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; render(); }, 120); });
  $('#ph-filter').addEventListener('change', (e) => { state.filter = e.target.value; state.shown = PAGE; render(); });
  root.addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]');
    if (v) { state.view = v.dataset.view; state.q = ''; $('#ph-q').value = ''; state.shown = PAGE; render(); return; }
    if (e.target.closest('[data-add]')) { openEditor(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { openEditor(ed.dataset.edit); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const id = del.dataset.del;
      const n = usage()[id] || 0;
      if (!confirm(`Remove this photo${n ? ` and take it off ${n} food${n === 1 ? '' : 's'}` : ''}? (Nothing is published until you press Publish.)`)) return;
      const p = session.pending.types[id];
      if (p?.isNew) {
        delete session.pending.types[id];
        Object.keys(session.pending.map).forEach((k) => { if (session.pending.map[k] === id) delete session.pending.map[k]; });
      } else session.pending.types[id] = { ...(p || {}), deleted: true };
      changed(); return;
    }
    const undo = e.target.closest('[data-undo]');
    if (undo) {
      const p = session.pending.types[undo.dataset.undo];
      delete p.deleted;
      if (!p.image && p.label === undefined) delete session.pending.types[undo.dataset.undo];
      changed(); return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) { openPicker(pick.dataset.pick); return; }
    if (e.target.closest('[data-more]')) { state.shown += PAGE; renderFoods(); return; }
    if (e.target.closest('[data-discard]')) {
      if (!confirm('Discard all unpublished changes?')) return;
      Object.values(session.pending.types).forEach((p) => { if (p.image) { URL.revokeObjectURL(p.image.fullUrl); URL.revokeObjectURL(p.image.thumbUrl); } });
      session.pending = emptyPending();
      changed(); return;
    }
    const pub = e.target.closest('[data-publish]');
    if (pub) publish(pub);
  });

  const beforeUnload = (e) => { if (pendingCount()) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  render();
  return () => window.removeEventListener('beforeunload', beforeUnload);
}

export const hasUnpublished = () => pendingCount() > 0;

// Drop unpublished edits and the cached copy (used on sign-out).
export function discardAll() {
  Object.values(session.pending.types).forEach((p) => { if (p.image) { URL.revokeObjectURL(p.image.fullUrl); URL.revokeObjectURL(p.image.thumbUrl); } });
  if (session.base) applyPhotos(session.base);
  Object.assign(session, { base: null, pending: emptyPending(), published: {} });
}

// The admin username shown in the header (read from the sign-in stored by admin.js).
function adminUser() {
  try { return sessionStorage.getItem('ii-admin-user') || localStorage.getItem('ii-admin-user') || ''; } catch { return ''; }
}

const updateStatus = () => document.querySelectorAll('[data-gh-status]').forEach((el) => { el.innerHTML = gh.statusHtml(); });

/* ---------- GitHub connection (asked for the first time someone publishes) ---------- */

async function ensureGitHub() {
  const base = gh.repoConfig();
  if (gh.getToken()) {
    try {
      ghAccess ??= await gh.verify(base, gh.getToken());
      return { ...base, branch: ghAccess.branch };
    } catch (e) {
      gh.signOut(); ghAccess = null; updateStatus();
      return connectDialog(e.message);
    }
  }
  return connectDialog();
}

function connectDialog(error = '') {
  return new Promise((resolve) => {
    const dialog = ensureDialog('gh-connect');
    dialog.querySelector('.sheet-inner').innerHTML = `
      <button type="button" class="icon-btn sheet-close" data-close aria-label="Close">✕</button>
      <form class="compare-content signin-form" novalidate>
        <h2 class="compare-title">Connect GitHub to publish</h2>
        <p class="lede">The website’s files are kept on GitHub. To change the live site, connect a GitHub access token once on this device. GitHub checks it every time you publish, so only people the repository owner has added can change the site.</p>
        <label for="gc-token">GitHub access token</label>
        <input id="gc-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
        <label class="signin-remember"><input type="checkbox" id="gc-remember" checked> Remember on this device <span class="hint">(untick on shared computers)</span></label>
        <p class="signin-error" role="alert">${esc(error)}</p>
        <div class="detail-actions"><button type="submit" class="btn btn-primary">Connect and publish</button>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button></div>
        <details class="signin-help" open>
          <summary>How to get a token (about 2 minutes)</summary>
          <ol>
            <li>Ask the repository owner to add your GitHub account as a collaborator (repository <em>Settings → Collaborators</em>).</li>
            <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">New fine-grained token</a> on GitHub.</li>
            <li>Name it, for example “Insulin Index admin”, and choose an expiry date.</li>
            <li><strong>Resource owner:</strong> the account that owns the website’s repository. <strong>Repository access:</strong> Only select repositories → the website’s repository.</li>
            <li><strong>Permissions → Repository permissions → Contents:</strong> Read and write.</li>
            <li>Press <em>Generate token</em>, copy it and paste it above. Treat it like a password.</li>
          </ol>
        </details>
        <details class="signin-help">
          <summary>Repository settings</summary>
          <div class="signin-repo">
            <label>Owner<input id="gc-owner" placeholder="detected automatically"></label>
            <label>Repository<input id="gc-repo" placeholder="detected automatically"></label>
            <label>Branch<input id="gc-branch" placeholder="the branch the site is published from"></label>
          </div>
        </details>
      </form>`;
    const q = (s) => dialog.querySelector(s);
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeSheet(dialog); resolve(v); };
    dialog.onclick = (e) => { if (e.target === dialog || e.target.closest('[data-close]')) finish(null); };
    dialog.addEventListener('close', () => finish(null), { once: true });
    q('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = q('#gc-token').value.trim();
      if (!token) { q('.signin-error').textContent = 'Paste your GitHub token first.'; return; }
      const saved = gh.repoConfig();
      const cfg = { owner: q('#gc-owner').value.trim() || saved.owner, repo: q('#gc-repo').value.trim() || saved.repo, branch: q('#gc-branch').value.trim() || saved.branch || '' };
      const btn = q('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Checking…'; q('.signin-error').textContent = '';
      try {
        ghAccess = await gh.verify(cfg, token);
        if (q('#gc-owner').value.trim() || q('#gc-repo').value.trim() || q('#gc-branch').value.trim()) gh.saveRepoConfig(cfg);
        gh.setToken(token, q('#gc-remember').checked);
        updateStatus();
        finish({ ...cfg, branch: ghAccess.branch });
      } catch (err) {
        q('.signin-error').textContent = err.message;
        btn.disabled = false; btn.textContent = 'Connect and publish';
      }
    });
    openSheet(dialog);
    q('#gc-token').focus();
  });
}

function ensureDialog(id) {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement('dialog');
    d.id = id;
    d.className = 'sheet sheet-wide';
    d.innerHTML = '<div class="sheet-inner"></div>';
    d.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(d); });
    document.body.append(d);
  }
  return d;
}
