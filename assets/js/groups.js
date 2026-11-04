// Food Groups: 14 coloured containers, each with its count, II range, reference-food split
// and a dot strip of every food. Each container opens the Explorer filtered to it.

import { esc, groupStyle, pageHero, typePic, icon } from './ui.js';

const SCALE = 210;

export function renderGroups(app, data) {
  const cards = data.groups.map((g) => {
    const foods = data.foods.filter((f) => f.group === g.id);
    const byValue = [...foods].sort((a, b) => a.iiValue - b.iiValue);
    const lo = byValue[0];
    const hi = byValue[byValue.length - 1];
    const refs = [['glucose', foods.filter((f) => f.ref === 'glucose').length], ['bread', foods.filter((f) => f.ref === 'bread').length]];
    const single = foods.filter((f) => f.meal === 'SINGLE').length;
    // Deterministic vertical jitter so dots at similar values don't hide each other.
    const dots = byValue.map((f, i) => `<span class="gc-dot" style="left:${((f.iiValue / SCALE) * 100).toFixed(2)}%;top:${10 + ((i * 37) % 70)}%"></span>`).join('');

    return `<li class="reveal"><a class="group-card" href="#/explorer?group=${g.id}" style="${groupStyle(g)}">
      <span class="gc-photo">${typePic(g.photo, '', true)}<span class="gc-count"><strong>${foods.length}</strong> foods</span></span>
      <h2 class="gc-title">${esc(g.label)}</h2>
      <span class="gc-range">II <strong>${esc(lo.ii)}</strong> to <strong>${esc(hi.ii)}</strong></span>
      <span class="gc-strip" aria-hidden="true">${dots}</span>
      <span class="gc-scale" aria-hidden="true"><span>0</span><span>210</span></span>
      <span class="gc-refs">${refs.map(([r, n]) => `<span><span class="sw sw-${r === 'glucose' ? 'g' : 'b'}" aria-hidden="true"></span>${n} comparator: ${r}</span>`).join('')}</span>
      <span class="gc-meta">${single} single · ${foods.length - single} mixed</span>
      <span class="gc-cats"><span class="sr-only">Paper categories: </span>${g.categories.map((c) => `<span>${esc(c)}</span>`).join('')}</span>
      <span class="gc-cta">Explore ${foods.length} foods <span aria-hidden="true">→</span></span>
    </a></li>`;
  }).join('');

  app.innerHTML = `
  ${pageHero({
    eyebrow: 'Food groups',
    title: 'Fourteen groups, one plate',
    lede: 'The paper sorts its 629 foods into 25 categories. This site folds them into 14 groups for browsing. Each dot is one food, placed by its II.',
    photo: 37321079, tone: '#F8EAC0,#F0D584',
  })}
  <section class="wrap section-tight">
    <p class="note reveal">${icon('info')}<span>Groups mix foods scored against glucose and against bread, so treat each range as a rough spread, not a ranking. The paper’s own category is shown on every food. Each group photo is an example of the group, not a particular food.</span></p>
    <ul class="group-grid">${cards}</ul>
  </section>`;
  return null;
}
