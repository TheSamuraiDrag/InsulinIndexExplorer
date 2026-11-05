// Boot, data loading and hash routing.
// Hash routes (#/explorer?group=bread) keep every view shareable and refresh-safe on GitHub Pages.

import { setData, applyPhotos, wireGlobal, wireImages, wireReveal, setDetailListener, closeSheet } from './ui.js';
import { renderHome } from './home.js';
import { renderExplorer } from './explorer.js';
import { renderAdmin } from './admin.js';
import { SITE } from './config.js';
import { initI18n } from './i18n.js';
import { renderGroups } from './groups.js';
import { renderCollection } from './collection.js';
import { renderGuide } from './guide.js';
import { renderAbout } from './about.js';

const app = document.getElementById('app');
let data = null;
let current = { route: null, cleanup: null };

const PAGES = {
  explorer: { title: 'Food Explorer', render: (p) => renderExplorer(app, data, p) },
  groups: { title: 'Food groups', render: () => renderGroups(app, data) },
  lowest: { title: 'Single foods', render: (p) => renderCollection(app, data, p, 'lowest') },
  mixed: { title: 'Mixed meals', render: (p) => renderCollection(app, data, p, 'mixed') },
  guide: { title: 'How to read the II', render: () => renderGuide(app, data) },
  about: { title: 'About & sources', render: () => renderAbout(app, data) },
  admin: { title: 'Admin', render: (p) => renderAdmin(app, data, p) },
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { route: path.split('/')[0] || 'home', params: new URLSearchParams(query) };
}

function render() {
  const { route, params } = parseHash();
  const sameRoute = route === current.route;
  current.cleanup?.();
  current.cleanup = null;

  document.querySelectorAll('.nav-list a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  closeNav();
  const detail = document.getElementById('detail');
  if (detail.open && !params.get('food')) closeSheet(detail);

  if (route === 'home') current.cleanup = renderHome(app, data);
  else if (PAGES[route]) current.cleanup = PAGES[route].render(params);
  else { location.replace('#/'); return; }

  document.title = route === 'home' ? 'Insulin Index Explorer' : `${PAGES[route].title} · Insulin Index Explorer`;

  wireImages(app);
  wireReveal(app);
  if (!sameRoute) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    app.focus({ preventScroll: true });
  }
  current.route = route;
  countVisit(route);
}

/* ---------- Anonymous visitor counts (GoatCounter: no cookies, no personal data) ---------- */

function countVisit(route) {
  if (!SITE.goatcounter || route === 'admin' || !window.goatcounter?.count) return;
  window.goatcounter.count({ path: `/${route === 'home' ? '' : route}`, title: document.title });
}

function loadCounter() {
  if (!SITE.goatcounter || !/^[a-z0-9-]+$/.test(SITE.goatcounter)) return;
  if (SITE.countOnlyOn?.length && !SITE.countOnlyOn.includes(location.hostname)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${SITE.goatcounter}.goatcounter.com/count`;
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
  s.addEventListener('load', () => countVisit(parseHash().route));
  document.head.append(s);
}

function navigate() {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const t = document.startViewTransition(render);
    // Tapping again mid-animation skips the old animation; that's expected, not an error.
    const skipped = (e) => { if (e?.name !== 'AbortError' && e?.name !== 'InvalidStateError') throw e; };
    t.ready.catch(skipped); t.finished.catch(skipped);
  } else {
    render();
  }
}

/* ---------- Mobile nav ---------- */

const toggle = document.querySelector('.nav-toggle');
function closeNav() {
  toggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('nav-open', open);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

// Header gets a soft shadow once the page scrolls.
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Boot ---------- */

async function boot() {
  let photos = null;
  try {
    const [res, pres] = await Promise.all([fetch('data/foods.json'), fetch('data/photos.json').catch(() => null)]);
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
    photos = pres && pres.ok ? await pres.json() : null;
  } catch (err) {
    app.innerHTML = `<section class="wrap page-soon"><h1>Couldn’t load the food data</h1>
      <p>Please refresh the page. If you opened the file directly, serve the folder with a local web server.</p></section>`;
    return;
  }
  setData(data);
  applyPhotos(photos);
  const ver = document.getElementById('footer-version');
  if (ver) ver.textContent = `Data: ${SITE.dataSource}, ${data.foods.length} entries · Website v${SITE.version}`;
  loadCounter();
  await initI18n();
  wireGlobal();
  setDetailListener((n) => {
    // Keep the open food in the URL on the Explorer so the view can be shared.
    const { route, params } = parseHash();
    if (route !== 'explorer') return;
    if (n) params.set('food', n); else params.delete('food');
    const q = params.toString();
    history.replaceState(null, '', `#/explorer${q ? `?${q}` : ''}`);
  });
  window.addEventListener('hashchange', navigate);
  render();
}

boot();
