// How to read the II: what it measures, II vs GI, comparing like with like,
// reading the number without cut-offs, a median-per-group chart (glucose and bread shown separately),
// surprising findings and how to read a study tag.

import { esc, pageHero, refTag, median, groupStyle } from './ui.js';

const fmt = (x) => String(Math.round(x * 1000) / 1000);
const CHART_MAX = 150;

function curveDiagram() {
  const x = (t) => 70 + (t / 120) * 530;
  return `<figure class="diagram reveal">
    <svg viewBox="0 0 640 320" role="img" aria-labelledby="curve-title curve-desc">
      <title id="curve-title">Two insulin curves after eating</title>
      <desc id="curve-desc">Blood insulin rises and falls over 120 minutes. The reference food makes a larger curve than the test food. The II compares the area under the two curves.</desc>
      <g class="d-grid">${[0, 30, 60, 90, 120].map((t) => `<line x1="${x(t)}" y1="40" x2="${x(t)}" y2="260"/>`).join('')}</g>
      <path class="d-ref-fill" d="M70,260 C110,260 135,70 185,70 S310,185 370,222 S550,256 600,258 L600,260 Z"/>
      <path class="d-ref-line" d="M70,260 C110,260 135,70 185,70 S310,185 370,222 S550,256 600,258"/>
      <path class="d-test-fill" d="M70,260 C112,260 140,160 190,160 S325,228 385,242 S550,258 600,259 L600,260 Z"/>
      <path class="d-test-line" d="M70,260 C112,260 140,160 190,160 S325,228 385,242 S550,258 600,259"/>
      <line class="d-axis" x1="70" y1="260" x2="600" y2="260"/>
      <line class="d-axis" x1="70" y1="40" x2="70" y2="260"/>
      ${[0, 30, 60, 90, 120].map((t) => `<text class="d-tick" x="${x(t)}" y="282" text-anchor="middle">${t}</text>`).join('')}
      <text class="d-axis-label" x="335" y="308" text-anchor="middle">Minutes after eating</text>
      <text class="d-axis-label" x="22" y="150" text-anchor="middle" transform="rotate(-90 22 150)">Blood insulin</text>
      <g class="d-key"><circle cx="410" cy="62" r="6" class="d-ref-dot"/><text x="424" y="67">Reference food</text>
        <circle cx="410" cy="90" r="6" class="d-test-dot"/><text x="424" y="95">Test food</text></g>
      <text class="d-note" x="168" y="128">larger area</text>
      <text class="d-note" x="168" y="222">smaller area</text>
    </svg>
    <figcaption><strong>II = the test food’s area ÷ the reference food’s area</strong>, averaged across at least 10 volunteers and shown as a percentage.
      <span>Illustration only, not real data.</span></figcaption>
  </figure>`;
}

function rulers(data) {
  const p = (v) => `${(v / 210) * 100}%`;
  const bread = data.foods.filter((f) => f.ref === 'bread').length;
  const total = data.foods.length;
  const pct = Math.round((bread / total) * 100);
  return `<div class="rulers reveal">
    <div class="ruler">
      <p class="ruler-title">${refTag('glucose')} Glucose is the yardstick</p>
      <div class="ruler-track">
        <span class="ruler-band" style="left:${p(30)};width:${p(110)}"><span>bread across studies, about 30–140</span></span>
        <span class="ruler-mark mark-bread" style="left:${p(70)}"><span>bread ≈ 70</span></span>
        <span class="ruler-mark mark-glucose" style="left:${p(100)}"><span>glucose itself = 100</span></span>
      </div>
    </div>
    <div class="ruler">
      <p class="ruler-title">${refTag('bread')} Bread is the yardstick</p>
      <div class="ruler-track">
        <span class="ruler-mark mark-bread" style="left:${p(100)}"><span>bread itself = 100</span></span>
      </div>
    </div>
    <div class="share">
      <p class="share-title"><strong>${pct}%</strong> of entries (${bread} of ${total}) use bread as the reference</p>
      <div class="share-bar" aria-hidden="true"><span class="share-g" style="flex:${total - bread}"></span><span class="share-b" style="flex:${bread}"></span></div>
      <p class="share-legend"><span><span class="sw sw-g" aria-hidden="true"></span>vs glucose ${total - bread}</span><span><span class="sw sw-b" aria-hidden="true"></span>vs bread ${bread}</span></p>
    </div>
  </div>`;
}

function medianChart(data) {
  const rows = data.groups.map((g) => {
    const stat = (ref) => {
      const foods = data.foods.filter((f) => f.group === g.id && f.ref === ref);
      if (!foods.length) return null;
      const sorted = [...foods].sort((a, b) => a.iiValue - b.iiValue);
      return { n: foods.length, med: median(foods.map((f) => f.iiValue)), lo: sorted[0].ii, hi: sorted[sorted.length - 1].ii };
    };
    return { g, glucose: stat('glucose'), bread: stat('bread') };
  }).sort((a, b) => (b.glucose?.med ?? -1) - (a.glucose?.med ?? -1));

  const panel = (ref, title) => `<figure class="chart-panel chart-${ref}">
    <figcaption><span class="chart-title">${title}</span><span class="chart-sub">Median II per group · n = entries</span></figcaption>
    <div class="chart-plot">
      <div class="chart-grid" aria-hidden="true">${[0, 50, 100, 150].map((v) => `<span class="${v === 100 ? 'is-ref' : ''}" style="left:${(v / CHART_MAX) * 100}%"><span>${v === 100 ? '100 = same as reference' : v}</span></span>`).join('')}</div>
      ${rows.map(({ g, [ref]: s }) => `<div class="chart-row">
        <span class="chart-label"><span aria-hidden="true">${g.emoji}</span> ${esc(g.label)}</span>
        <span class="chart-track">${s ? `<a class="chart-bar" href="#/explorer?group=${g.id}&ref=${ref}" style="--w:${Math.min(100, (s.med / CHART_MAX) * 100)}%"
            data-tip="${esc(`${g.label} · vs ${ref}\nMedian ${fmt(s.med)} · ${s.n} entr${s.n === 1 ? 'y' : 'ies'}\nRange ${s.lo}–${s.hi}`)}"
            aria-label="${esc(`${g.label}, vs ${ref}: median ${fmt(s.med)} from ${s.n} entries, range ${s.lo} to ${s.hi}. Open in Explorer.`)}"></a>
          <span class="chart-val">${fmt(s.med)} <small>n=${s.n}</small></span>` : '<span class="chart-none">no entries</span>'}</span>
      </div>`).join('')}
    </div>
  </figure>`;

  return `<div class="chart reveal">
    <div class="chart-panels">${panel('glucose', 'Scored vs glucose')}${panel('bread', 'Scored vs bread')}</div>
    <p class="chart-foot">Medians are this site’s calculation from the published values. Groups are ordered by their “vs glucose” median. Don’t compare a bar in one panel with a bar in the other. Tap a bar to see those foods.</p>
    <details class="chart-table"><summary>Show as a table</summary>
      <div class="x-scroll"><table>
        <thead><tr><th scope="col">Group</th><th scope="col">vs glucose: median (n)</th><th scope="col">vs glucose: range</th><th scope="col">vs bread: median (n)</th><th scope="col">vs bread: range</th></tr></thead>
        <tbody>${rows.map(({ g, glucose: a, bread: b }) => `<tr><th scope="row">${g.emoji} ${esc(g.label)}</th>
          <td>${a ? `${fmt(a.med)} (${a.n})` : '—'}</td><td>${a ? `${esc(a.lo)}–${esc(a.hi)}` : '—'}</td>
          <td>${b ? `${fmt(b.med)} (${b.n})` : '—'}</td><td>${b ? `${esc(b.lo)}–${esc(b.hi)}` : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
    <div class="chart-tip" role="tooltip" hidden></div>
  </div>`;
}

export function renderGuide(app, data) {
  const g = Object.fromEntries(data.groups.map((x) => [x.id, x]));
  const finds = [
    ['37–127', 'Foods often recommended for weight or blood-sugar control', 'Skim fat milk, yoghurt, fruits (except avocado), brown rice, wholemeal and sourdough bread, wholegrain cereal, vegetables (except broccoli), honey and oats.', 'cereals'],
    ['2–31', 'Protein and fat foods', 'Chicken, lamb, eggs, tuna, butter and cream.', 'protein'],
    ['1', 'Lowest single foods', 'Gin and acacia fibre (Fibregum).', 'drinks'],
    ['209', 'Highest single food', 'Nutricia Karicare Soy infant formula.', 'special'],
    ['13', 'Lowest mixed meal', 'A corn-tortilla taco with potato, watermelon and honey.', 'regional'],
    ['185', 'Highest mixed meal', 'Boiled Sava potatoes with water, tea or coffee.', 'potatoes'],
  ];

  app.innerHTML = `
  ${pageHero({
    eyebrow: 'How to read the II',
    title: 'What the number <em>actually</em> tells you',
    lede: 'Five minutes to read the insulin index like a pro: what it measures, why it isn’t the GI, and the one rule that matters most.',
    photo: 4195334, emoji: '📈', tone: '#D7E8F7,#A9CBEE',
  })}

  <article class="wrap guide">
    <nav class="guide-toc reveal" aria-label="On this page">
      <a href="#g-what">What it measures</a><a href="#g-gi">II vs GI</a><a href="#g-like">Compare like with like</a>
      <a href="#g-number">Reading the number</a><a href="#g-chart">Groups at a glance</a><a href="#g-finds">Surprises</a><a href="#g-tag">Study tags</a>
    </nav>

    <section class="guide-sec" id="g-what" aria-labelledby="h-what">
      <p class="eyebrow">1 · What it measures</p>
      <h2 id="h-what">A test meal, a reference meal, two hours of blood tests</h2>
      <ol class="steps reveal">
        <li><span class="step-emoji" aria-hidden="true">🍽️</span><strong>Eat the test food</strong><span>Volunteers eat a set portion of the food being tested.</span></li>
        <li><span class="step-emoji" aria-hidden="true">🧪</span><strong>Eat the reference</strong><span>On another occasion, they eat the reference food: glucose or white bread.</span></li>
        <li><span class="step-emoji" aria-hidden="true">🩸</span><strong>Measure insulin</strong><span>Blood insulin is measured for about 2 hours each time.</span></li>
        <li><span class="step-emoji" aria-hidden="true">➗</span><strong>Compare the areas</strong><span>The average ratio of the two areas across at least 10 volunteers, shown as a percentage.</span></li>
      </ol>
      ${curveDiagram()}
      <aside class="analogy reveal"><span class="analogy-tag">Analogy</span>
        <p>Think of insulin as <strong>keys</strong> that let glucose into your cells. The II asks: over the next 2 hours, how many keys did the body hand out for this food, compared with the reference food? An II of 50 means about half the insulin “area” of the reference.</p>
      </aside>
    </section>

    <section class="guide-sec" id="g-gi" aria-labelledby="h-gi">
      <p class="eyebrow">2 · II vs GI</p>
      <h2 id="h-gi">Why not just use the glycaemic index?</h2>
      <div class="vs reveal">
        <div class="vs-card vs-gi"><span class="vs-emoji" aria-hidden="true">🩸</span><h3>Glycaemic index (GI)</h3><p>Tracks <strong>blood glucose</strong> after a food.</p></div>
        <span class="vs-mid" aria-hidden="true">vs</span>
        <div class="vs-card vs-ii"><span class="vs-emoji" aria-hidden="true">🔑</span><h3>Insulin index (II)</h3><p>Tracks <strong>blood insulin</strong> after a food.</p></div>
      </div>
      <p class="callout reveal"><span aria-hidden="true">💡</span><span>In the GI, carbohydrates drive the value. The II can be affected by carbohydrates, proteins and fat, and by how they are combined, which the GI alone can miss.</span></p>
    </section>

    <section class="guide-sec" id="g-like" aria-labelledby="h-like">
      <p class="eyebrow">3 · The golden rule</p>
      <h2 id="h-like">Compare like with like</h2>
      <p class="guide-p">Glucose and bread give different responses. Bread scored around 70 against glucose, and about 30–140 across studies. So a number scored against bread sits on a different ruler from a number scored against glucose.</p>
      ${rulers(data)}
      <ul class="rules reveal">
        <li><span aria-hidden="true">✓</span> Only compare foods with the <strong>same reference tag</strong>: ${refTag('glucose')} with ${refTag('glucose')}, ${refTag('bread')} with ${refTag('bread')}.</li>
        <li><span aria-hidden="true">⚖️</span> Portion size differs between studies. Check the portion on each food.</li>
        <li><span aria-hidden="true">👥</span> Volunteers differ too, so the same food can score differently in different studies.</li>
      </ul>
    </section>

    <section class="guide-sec" id="g-number" aria-labelledby="h-number">
      <p class="eyebrow">4 · Reading the number</p>
      <h2 id="h-number">No labels, just the number against 100</h2>
      <p class="guide-p">The paper describes the II as “the average ratio of the test food’s iAUC against a reference food” represented “in percentage” (Hendricks et al., 2024, p. 93). So the number already says how a food compares with its reference.</p>
      <div class="read-ex reveal">
        <div><span class="read-num">62</span><span>62% of the reference food’s insulin response</span></div>
        <div><span class="read-num">100</span><span>the same as the reference food</span></div>
        <div><span class="read-num">185</span><span>185% of the reference food’s insulin response</span></div>
      </div>
      <p class="callout reveal"><span aria-hidden="true">ℹ️</span><span>There is no agreed clinical cut-off for a low, medium or high II, so this site doesn’t label foods as low or high. A high II isn’t automatically bad, for example in sports nutrition.</span></p>
    </section>

    <section class="guide-sec" id="g-chart" aria-labelledby="h-chart">
      <p class="eyebrow">5 · Groups at a glance</p>
      <h2 id="h-chart">Median II per food group</h2>
      <p class="guide-p">Shown separately for foods scored against glucose and against bread, because the two can’t share one ruler.</p>
      ${medianChart(data)}
    </section>

    <section class="guide-sec" id="g-finds" aria-labelledby="h-finds">
      <p class="eyebrow">6 · Surprises in the data</p>
      <h2 id="h-finds">Not what you might expect</h2>
      <ul class="finds">${finds.map(([big, label, text, gid]) => `<li class="reveal" style="${groupStyle(g[gid])}">
        <span class="finds-big">${esc(big)}</span><span class="finds-label">${esc(label)}</span><span class="finds-text">${esc(text)}</span></li>`).join('')}</ul>
    </section>

    <section class="guide-sec" id="g-tag" aria-labelledby="h-tag">
      <p class="eyebrow">7 · Reading a study tag</p>
      <h2 id="h-tag">What “Bao et al., 2011 [46]” means</h2>
      <p class="tag-anatomy reveal" aria-label="Bao et al. is the first author, 2011 is the year, and 46 is its number in the paper’s reference list.">
        <span class="ta ta-author"><span>Bao et al.,</span><small>first author</small></span>
        <span class="ta ta-year"><span>2011</span><small>year</small></span>
        <span class="ta ta-ref"><span>[46]</span><small>its number in the paper’s reference list</small></span>
      </p>
    </section>

    <div class="guide-cta reveal">
      <h2>Ready to explore?</h2>
      <p>Search all 629 foods, filter by reference food and compare up to three side by side.</p>
      <a class="btn btn-primary" href="#/explorer">Open the Explorer <span aria-hidden="true">→</span></a>
    </div>
  </article>`;

  // In-page links: scroll without changing the route.
  const root = app.querySelector('.guide');
  root.addEventListener('click', (e) => {
    const a = e.target.closest('.guide-toc a');
    if (!a) return;
    e.preventDefault();
    root.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Chart tooltip on hover and keyboard focus.
  const chart = root.querySelector('.chart');
  const tip = chart.querySelector('.chart-tip');
  const show = (bar) => {
    tip.textContent = bar.dataset.tip;
    tip.hidden = false;
    const b = bar.getBoundingClientRect();
    const c = chart.getBoundingClientRect();
    const left = Math.min(c.width - 230, Math.max(0, b.right - c.left - 40));
    tip.style.left = `${left}px`;
    tip.style.top = `${b.top - c.top - tip.offsetHeight - 8}px`;
  };
  const hide = () => { tip.hidden = true; };
  chart.addEventListener('pointerover', (e) => { const bar = e.target.closest('.chart-bar'); if (bar) show(bar); });
  chart.addEventListener('pointerout', (e) => { if (e.target.closest('.chart-bar')) hide(); });
  chart.addEventListener('focusin', (e) => { const bar = e.target.closest('.chart-bar'); if (bar) show(bar); });
  chart.addEventListener('focusout', hide);
  return null;
}
