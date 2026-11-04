// About & Sources: citation, methods, inclusion criteria, footnotes, the note on
// Supplemental Table 2, limitations, how this site works, licence and credits.

import { esc, pageHero, FOOTNOTES, groupStyle, toast, typePic, photoCredit } from './ui.js';

const CITATION = 'Hendricks SA, Paul MJ, Subramaniam Y, Vijayam B. A collectanea of food insulinaemic index: 2023. Clinical Nutrition ESPEN. 2024;63:92–104. https://doi.org/10.1016/j.clnesp.2024.06.017';

// Full wording from "Footnotes for Supplemental Table 1" (PDF page 57).
const FOOTNOTES_FULL = {
  '*': 'The II value was derived from a supplementary file provided by the corresponding article.',
  '†': 'No BMI given. The corresponding article stated that it followed standard protocol for GI/II study.',
  '‡': 'This article has two studies (Study 1 and Study 2) but provided the subject details for both in general. This is Study 2, and there were no subjects detail specific for this study.',
  '§': 'II values displayed in this table are the mean II values. The corresponding article reported both the mean and median II values.',
  '||': 'Abstract mentions nine subjects but stated as 10 in study design (Materials and Methods) without mention of any exclusion or drop out, in the respective article.',
  '¶': 'Newly developed rice variants whose abbreviations were not given in the article.',
};
const WHERE = { '*': 'II column', '§': 'II column', '†': 'Subject details', '‡': 'Food name', '||': 'Food name', '¶': 'Food name' };

export function renderAbout(app, data) {
  const F = data.foods;
  const countFn = (sym) => (sym === '*' || sym === '§'
    ? F.filter((f) => f.iiNote === sym).length
    : F.filter((f) => (sym === '†' ? f.subjects : f.name).includes(sym)).length);

  app.innerHTML = `
  ${pageHero({
    eyebrow: 'About & sources',
    title: 'Where these numbers come from',
    lede: 'Every value on this site is copied as published in Supplemental Table 1 of a 2024 open-access review.',
    photo: 8851929, tone: '#FADBE5,#F2AFC4',
  })}

  <article class="wrap about">
    <section class="about-cite reveal" aria-labelledby="h-cite">
      <p class="eyebrow">The paper</p>
      <h2 id="h-cite">A collectanea of food insulinaemic index: 2023</h2>
      <blockquote class="cite">Hendricks SA, Paul MJ, Subramaniam Y, Vijayam B. A collectanea of food insulinaemic index: 2023. <i>Clinical Nutrition ESPEN</i>. 2024;63:92–104.
        <a href="https://doi.org/10.1016/j.clnesp.2024.06.017" rel="noopener">https://doi.org/10.1016/j.clnesp.2024.06.017</a></blockquote>
      <div class="cite-actions">
        <button type="button" class="btn btn-primary btn-sm" data-copy-cite>Copy citation</button>
        <a class="btn btn-ghost btn-sm" href="https://doi.org/10.1016/j.clnesp.2024.06.017" rel="noopener">Read the paper</a>
      </div>
      <ul class="cite-facts">
        <li>Open access, <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" rel="noopener license">CC BY-NC-ND 4.0</a></li>
        <li>Funded by Newcastle University Medicine Malaysia (NUMed)</li>
      </ul>
    </section>

    <section class="about-sec" aria-labelledby="h-methods">
      <p class="eyebrow">Methods</p>
      <h2 id="h-methods">How the collection was built</h2>
      <ol class="funnel reveal">
        <li><span class="funnel-num">5</span><span><strong>databases searched</strong> up to December 2023, no language restriction: PubMed, Scopus, the Cochrane trials register, Google Scholar and ResearchGate</span></li>
        <li><span class="funnel-num">405</span><span><strong>articles screened</strong></span></li>
        <li><span class="funnel-num">80</span><span><strong>articles included</strong></span></li>
        <li><span class="funnel-num">629</span><span><strong>foods</strong> from 32 countries in 25 categories: 469 single foods and 160 mixed meals</span></li>
      </ol>
      <div class="criteria reveal">
        <h3>To be included, a study needed</h3>
        <ul>
          <li>At least 10 healthy, non-diabetic subjects with a normal BMI</li>
          <li>Glucose or bread as the reference food</li>
          <li>II calculated by the FAO-recommended trapezoid method, indexing the test food’s iAUC to the reference food’s iAUC</li>
        </ul>
        <h3>And</h3>
        <ul>
          <li>Only the first meal was used when several meals were fed in a row</li>
          <li>Three authors extracted the data independently</li>
        </ul>
      </div>
    </section>

    <section class="about-sec" aria-labelledby="h-fn">
      <p class="eyebrow">Footnotes</p>
      <h2 id="h-fn">The little symbols</h2>
      <p class="guide-p">They appear exactly where the paper puts them. Tap one on any food to see what it means.</p>
      <ul class="fn-cards">${Object.keys(FOOTNOTES).map((s) => `<li class="reveal">
        <span class="fn-big">${esc(s)}</span>
        <div><p class="fn-short">${esc(FOOTNOTES[s])}</p>
          <p class="fn-full">In the paper: “${esc(FOOTNOTES_FULL[s])}”</p>
          <p class="fn-where">${WHERE[s]} · ${countFn(s)} entr${countFn(s) === 1 ? 'y' : 'ies'}</p></div></li>`).join('')}</ul>
    </section>

    <section class="about-sec" aria-labelledby="h-t2">
      <div class="t2 reveal">
        <span class="t2-num">124</span>
        <div><h2 id="h-t2">What about Supplemental Table 2?</h2>
          <p>The paper also lists <strong>124 foods from 31 studies</strong> that did not meet its main inclusion criteria, mainly because they had <strong>9 or fewer subjects</strong>, <strong>not enough information on BMI or health</strong>, or <strong>subjects over 65</strong>. The authors kept them separate in Supplemental Table 2 because they may still help researchers and clinicians. They are <strong>not included on this site</strong>, so every number here meets the inclusion criteria above.</p></div>
      </div>
    </section>

    <section class="about-sec" aria-labelledby="h-limits">
      <p class="eyebrow">Limitations</p>
      <h2 id="h-limits">Read with care</h2>
      <ul class="limits reveal">
        <li><strong>Studies differ</strong> in reference food, portion and volunteers.</li>
        <li><strong>People differ.</strong> Insulin responses can differ by ethnicity, sex and hormonal factors such as menopause.</li>
        <li><strong>No agreed cut-off.</strong> There is no agreed clinical cut-off for a low, medium or high II.</li>
      </ul>
    </section>

    <section class="about-sec" aria-labelledby="h-site">
      <p class="eyebrow">This site</p>
      <h2 id="h-site">How the site handles the data</h2>
      <ul class="site-rules reveal">
        <li><strong>Exactly as published.</strong> Numbers, food names and study names are never rounded, renamed or “fixed”.</li>
        <li><strong>Reference tag.</strong> A food is tagged “vs bread” when its comparator mentions bread, otherwise “vs glucose” (${F.filter((f) => f.ref === 'bread').length} and ${F.filter((f) => f.ref === 'glucose').length}).</li>
        <li><strong>No low/high labels.</strong> Because there is no agreed cut-off, foods aren’t labelled or colour-coded as low or high. Each II is shown as published, against the reference food’s 100.</li>
        <li><strong>Groups.</strong> The paper’s 25 categories are folded into 14 browsing groups:</li>
      </ul>
      <div class="x-scroll reveal"><table class="map-table">
        <thead><tr><th scope="col">Site group</th><th scope="col">Paper categories</th><th scope="col">Foods</th></tr></thead>
        <tbody>${data.groups.map((g) => `<tr><th scope="row"><span class="mini-group" style="${groupStyle(g)}">${esc(g.label)}</span></th>
          <td>${g.categories.map(esc).join('<br>')}</td><td>${F.filter((f) => f.group === g.id).length}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="downloads reveal">
        <a class="btn btn-ghost btn-sm" href="data/mmc1_insulinaemic_index.csv" download>Download the data (CSV)</a>
        <a class="btn btn-ghost btn-sm" href="data/foods.json" download>Download foods.json</a>
        <a class="btn btn-ghost btn-sm" href="#/admin">Data check (admin)</a>
      </div>
    </section>

    <section class="about-sec" aria-labelledby="h-lic">
      <p class="eyebrow">Licence & credits</p>
      <h2 id="h-lic">Thank you</h2>
      <ul class="credits reveal">
        <li><strong>Data:</strong> Hendricks et al., 2024, used under <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" rel="noopener license">CC BY-NC-ND 4.0</a>: shown unchanged, with attribution, for non-commercial education.</li>
        <li><strong>Banner photos:</strong> <a href="https://www.pexels.com" rel="noopener">Pexels</a>.</li>
        <li><strong>Food photos:</strong> openly licensed photos (CC BY, CC BY-SA, CC0 or public domain), found through <a href="https://openverse.org" rel="noopener">Openverse</a> and credited below. Each shows the <em>type</em> of food, not the exact product tested. Photos were cropped and resized for this site; each keeps its original licence.</li>
        <li><strong>Fonts:</strong> Fraunces and Plus Jakarta Sans from Google Fonts.</li>
      </ul>
      ${Object.keys(data.photos || {}).length ? `<details class="credits-more reveal"><summary>Food photo credits (${Object.keys(data.photos).length})</summary>
        <ul class="photo-credits">${Object.entries(data.photos).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([id, ph]) => `<li>
          ${typePic(id)}<span><strong>${esc(ph.label)}</strong>${ph.credit.title ? `“${esc(ph.credit.title)}”. ` : ''}${photoCredit(ph)}</span></li>`).join('')}</ul>
      </details>` : ''}
    </section>
  </article>`;

  app.querySelector('[data-copy-cite]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(CITATION); toast('Citation copied'); } catch { toast('Select the citation above to copy it'); }
  });
  return null;
}
