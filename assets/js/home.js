// Home page: hero + search, quick stats, card legend, section tiles and surprising findings.

import { esc, PHOTO, refTag, mealTag, meter, groupStyle, icon, typePic, foodPic } from './ui.js';

const TILES = [
  { href: '#/explorer', title: 'Food Explorer', text: 'Search and filter all 629 foods', photo: 5966434, tone: '#F9D9C8,#F4B79A' },
  { href: '#/lowest', title: 'Single foods', text: 'Every single food, ranked by II', photo: 557659, tone: '#D8F0DC,#A9DDB4' },
  { href: '#/groups', title: 'Food groups', text: '14 groups, from bread to dairy', photo: 37321079, tone: '#F8EAC0,#F0D584' },
  { href: '#/mixed', title: 'Mixed meals', text: 'All 160 meals and food combos', photo: 11873900, tone: '#E9DFF7,#CDB8EE' },
  { href: '#/guide', title: 'How to read the II', text: 'What the number means, and doesn’t', photo: 4195334, tone: '#D7E8F7,#A9CBEE' },
  { href: '#/about', title: 'About & sources', text: 'The paper, methods and limits', photo: 8851929, tone: '#FADBE5,#F2AFC4' },
];

const FINDINGS = [
  { big: '1', label: 'Lowest single foods', text: 'Gin and acacia fibre (Fibregum) both scored II 1.', href: '#/explorer?sort=asc', photo: 'gin', group: 'drinks' },
  { big: '209', label: 'Highest single food', text: 'Nutricia Karicare Soy infant formula.', href: '#/explorer?food=374', photo: 'infant-formula', group: 'special' },
  { big: '2–31', label: 'Protein & fat foods', text: 'Chicken, lamb, eggs, tuna, butter and cream fell within a lower range.', href: '#/explorer?group=protein', photo: 'roast-chicken', group: 'protein' },
  { big: '37–127', label: '“Healthy” staples', text: 'Skim fat milk, yoghurt, fruits (except avocado), brown rice, wholemeal and sourdough bread, wholegrain cereal, vegetables (except broccoli), honey and oats.', href: '#/explorer?sort=desc', photo: 'brown-rice', group: 'cereals' },
  { big: '13', label: 'Lowest mixed meal', text: 'A corn-tortilla taco with potato, watermelon and honey.', href: '#/explorer?food=497', photo: 'corn-tortilla', group: 'regional' },
  { big: '185', label: 'Highest mixed meal', text: 'Freshly boiled Sava potatoes with water, tea or coffee.', href: '#/explorer?food=461', photo: 'boiled-potato', group: 'potatoes' },
  { big: 'High ≠ bad', label: 'Context matters', text: 'A high II isn’t automatically bad, for example in sports nutrition.', href: '#/explorer?sort=desc', photo: null, group: 'fruit' },
];

// Everyday foods from one study with one comparator (Bao et al., 2011 [46], glucose),
// so the numbers can fairly be compared with each other. Values are read from the data.
const EVERYDAY = ['9', '319', '4', '362', '543', '349', '107', '454'];

const SUGGEST = ['brown rice', 'milk', 'banana', 'sourdough', 'oats', 'chicken', 'honey'];

export function renderHome(app, data) {
  const g = Object.fromEntries(data.groups.map((x) => [x.id, x]));
  app.innerHTML = `
  <section class="hero">
    <div class="hero-media" aria-hidden="true">
      <div class="hero-fallback"></div>
      <img data-photo src="${PHOTO(3978392)}" alt="" fetchpriority="high" decoding="async">
    </div>
    <div class="wrap hero-content">
      <p class="eyebrow eyebrow-light">A food-by-food guide · 2023 collectanea</p>
      <h1 class="hero-title">How much insulin does your <span class="hl">food</span> call for?</h1>
      <p class="hero-lede">The insulin index (II) compares the body’s insulin response over 2 hours after a food with its response to a reference food, glucose or bread.</p>
      <form class="hero-search" role="search" action="#/explorer">
        <label for="home-q" class="sr-only">Search foods</label>
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="home-q" type="search" name="q" placeholder="Search 629 foods… try “brown rice”" autocomplete="off" enterkeyhint="search">
        <button type="submit" class="btn btn-primary">Search</button>
      </form>
      <p class="suggest"><span>Try</span>${SUGGEST.map((s) => `<a href="#/explorer?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join('')}</p>
    </div>
  </section>

  <section class="wrap stats" aria-label="Quick stats">
    <div class="stat reveal"><span class="stat-num" data-count="629">629</span><span class="stat-label">foods</span></div>
    <div class="stat reveal"><span class="stat-num" data-count="80">80</span><span class="stat-label">studies</span></div>
    <div class="stat reveal"><span class="stat-num" data-count="32">32</span><span class="stat-label">countries</span></div>
  </section>

  <section class="section" aria-labelledby="groups-title">
    <div class="wrap section-head section-head-row reveal">
      <div><p class="eyebrow">Browse by food group</p>
      <h2 id="groups-title">14 groups, one tap away</h2></div>
      <a class="see-all" href="#/groups">All groups <span aria-hidden="true">→</span></a>
    </div>
    <ul class="group-strip">
      ${data.groups.map((gr) => {
        const items = data.foods.filter((f) => f.group === gr.id);
        const vals = items.map((f) => f.iiValue);
        const lo = items.find((f) => f.iiValue === Math.min(...vals)).ii;
        const hi = items.find((f) => f.iiValue === Math.max(...vals)).ii;
        return `<li><a class="group-tile" href="#/explorer?group=${gr.id}" style="${groupStyle(gr)}">
          ${typePic(gr.photo, 'group-pic', true)}
          <span class="group-name">${esc(gr.label)}</span>
          <span class="group-meta">${items.length} foods · II ${esc(lo)}–${esc(hi)}</span>
        </a></li>`;
      }).join('')}
    </ul>
  </section>

  <section class="wrap section" aria-labelledby="everyday-title">
    <div class="everyday reveal">
      <div class="everyday-intro">
        <p class="eyebrow">Compare like with like</p>
        <h2 id="everyday-title">Everyday foods, measured the same way</h2>
        <p>These eight foods all come from one study, <strong>Bao et al., 2011 [46]</strong>, and were all scored against glucose. That is what makes it fair to line them up.</p>
        <a class="btn btn-ghost" href="#/guide">Why this matters <span aria-hidden="true">→</span></a>
      </div>
      <ol class="everyday-list">
        ${EVERYDAY.map((n) => data.foods.find((f) => f.n === n)).sort((a, b) => a.iiValue - b.iiValue).map((f) => `
        <li><button type="button" class="everyday-row" data-open="${f.n}" style="${groupStyle(g[f.group])}">
          ${foodPic(f, 'everyday-pic')}
          <span class="everyday-name">${esc(f.name)}</span>
          <span class="everyday-bar"><span class="bar" style="--w:${(f.iiValue / 100) * 100}%"></span></span>
          <span class="everyday-ii">${esc(f.ii)}</span>
        </button></li>`).join('')}
      </ol>
    </div>
  </section>

  <section class="wrap section legend" aria-labelledby="legend-title">
    <div class="section-head reveal">
      <p class="eyebrow">Reading the cards</p>
      <h2 id="legend-title">Three things on every card</h2>
    </div>
    <div class="legend-grid">
      <div class="legend-card reveal">
        <p class="legend-kicker">The number</p>
        <p class="legend-ii"><span class="ii-num">62</span><span class="ii-unit">II</span></p>
        ${meter(62)}
        <p>The II exactly as published, from 1 to 209 across all 629 foods. The bar shows where it sits in that range.</p>
      </div>
      <div class="legend-card reveal">
        <p class="legend-kicker">The reference food</p>
        <div class="legend-tagrow">${refTag('glucose')}${refTag('bread')}</div>
        <p>What the food was measured against. <strong>Only compare foods with the same tag.</strong></p>
      </div>
      <div class="legend-card reveal">
        <p class="legend-kicker">Single or mixed</p>
        <div class="legend-tagrow">${mealTag('SINGLE')}${mealTag('MIXED MEAL')}</div>
        <p>One food on its own, or a meal of several foods eaten together.</p>
      </div>
    </div>
    <p class="note reveal">${icon('info')}<span>There is no agreed clinical cut-off for a low or high II, so this site doesn’t label foods as low or high. Compare the numbers, like with like.</span></p>
  </section>

  <section class="wrap section" aria-labelledby="tiles-title">
    <div class="section-head reveal">
      <p class="eyebrow">Start exploring</p>
      <h2 id="tiles-title">Pick a way in</h2>
    </div>
    <ul class="tiles">
      ${TILES.map((t) => `<li class="reveal"><a class="tile" href="${t.href}" style="--tone:linear-gradient(135deg,${t.tone})">
        <span class="tile-media" aria-hidden="true">
          <img data-photo src="${PHOTO(t.photo, 900)}" alt="" loading="lazy" decoding="async">
        </span>
        <span class="tile-body"><span class="tile-title">${esc(t.title)}</span><span class="tile-text">${esc(t.text)}</span></span>
        <span class="tile-arrow" aria-hidden="true">→</span>
      </a></li>`).join('')}
    </ul>
  </section>

  <section class="section findings" aria-labelledby="findings-title">
    <div class="wrap section-head reveal">
      <p class="eyebrow">From the paper</p>
      <h2 id="findings-title">Surprising findings</h2>
      <p class="section-sub">Swipe through. Tap a card to see the foods.</p>
    </div>
    <div class="carousel-wrap">
      <ul class="carousel" tabindex="0" aria-label="Surprising findings, scrolls sideways">
        ${FINDINGS.map((f) => `<li><a class="finding" href="${f.href}" style="${groupStyle(g[f.group])}">
          <span class="finding-top">
            <span class="finding-label">${esc(f.label)}</span>
            ${typePic(f.photo, 'finding-pic')}
          </span>
          <span class="finding-big${/\d/.test(f.big) ? '' : ' is-words'}">${esc(f.big)}</span>
          <span class="finding-text">${esc(f.text)}</span>
          <span class="finding-more">See the foods <span aria-hidden="true">→</span></span>
        </a></li>`).join('')}
      </ul>
      <div class="carousel-nav">
        <button type="button" class="icon-btn" data-scroll="-1" aria-label="Previous findings">←</button>
        <button type="button" class="icon-btn" data-scroll="1" aria-label="Next findings">→</button>
      </div>
    </div>
  </section>`;

  const form = app.querySelector('.hero-search');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.q.value.trim();
    location.hash = `#/explorer${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  });

  const carousel = app.querySelector('.carousel');
  app.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    carousel.scrollBy({ left: Number(b.dataset.scroll) * carousel.clientWidth * 0.8, behavior: 'smooth' });
  }));

  countUp(app);
  return null;
}

function countUp(root) {
  const nums = root.querySelectorAll('[data-count]');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target;
      const target = Number(el.dataset.count);
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / 900);
        el.textContent = Math.round(target * (1 - (1 - p) ** 3));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
  nums.forEach((n) => io.observe(n));
}
