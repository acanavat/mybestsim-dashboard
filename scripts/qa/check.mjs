// Contrôle qualité du dashboard dans un vrai navigateur (Playwright).
// Usage : npm run build && npx serve out -l 3011 & npm run qa
//
// Vérifie, à plusieurs largeurs d'écran :
//  - aucune erreur JavaScript dans la console ;
//  - aucun texte coupé (« … ») ni défilement horizontal, filtres actifs ou non ;
//  - aucun décalage de mise en page quand on clique sur un filtre ou une barre
//    (seul un changement d'onglet a le droit de modifier la hauteur de la page) ;
//  - les parcours principaux : filtres, onglets, accroche copiée, clic sur une tendance.

import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:3011/';
const WIDTHS = [1440, 1280, 1100, 1024, 768, 390];
const failures = [];
const fail = (msg) => failures.push(msg);

const CLIPPABLE = [
  '.kpi-label', '.kpi-note', '.kpi-value', '.select', '.bar-name span', '.tab', '.pill', '.result-count',
  '.deal-dest span', '.trend-name', '.rising-head b', '.stamp', '.brand b', '.brand span', '.hint',
].join(',');

async function clipped(page) {
  return page.evaluate((sel) => {
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      if (el.offsetParent === null) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        bad.push(el.tagName === 'SELECT' ? el.options[el.selectedIndex].text : el.textContent.trim().slice(0, 40));
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) bad.push(`défilement horizontal (${document.documentElement.scrollWidth}px)`);
    return bad;
  }, CLIPPABLE);
}

async function layout(page) {
  return page.evaluate(() => {
    const box = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return `${Math.round(r.top + scrollY)}/${Math.round(r.height)}`;
    };
    return { barre: box('.toolbar'), kpis: box('.kpis'), grille: box('.overview'), onglets: box('.tablist') };
  });
}

const ACTIONS = [
  ['clic sur la barre Holafly', (p) => p.click('.overview .bar-row:has-text("Holafly")')],
  ['clic 5G', (p) => p.click('.pill:has-text("5G")')],
  ['clic 7 j', (p) => p.click('.pill:has-text("7 j")')],
  ['destination Japon (0 offre)', (p) => p.selectOption('select >> nth=1', { label: 'Japon' })],
  ['destination Émirats', (p) => p.selectOption('select >> nth=1', { label: 'Émirats arabes unis' })],
  ['fournisseur Maya Mobile', (p) => p.selectOption('select >> nth=0', { label: 'Maya Mobile' })],
  ['réinitialiser', (p) => p.click('.reset')],
  ['clic 4G', (p) => p.click('.pill:has-text("4G")')],
  ['clic sur la barre Airalo', (p) => p.click('.overview .bar-row:has-text("Airalo")')],
  ['re-clic sur Airalo', (p) => p.click('.overview .bar-row:has-text("Airalo")')],
];

const browser = await chromium.launch();

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', (e) => fail(`${width}px : erreur JS ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && fail(`${width}px : console ${m.text()}`));
  await page.goto(URL, { waitUntil: 'networkidle' });

  for (const t of await clipped(page)) fail(`${width}px : texte coupé « ${t} »`);

  let before = await layout(page);
  for (const [name, act] of ACTIONS) {
    await act(page);
    await page.waitForTimeout(120);
    const after = await layout(page);
    for (const k of Object.keys(after)) {
      if (after[k] !== before[k]) fail(`${width}px : « ${name} » déplace ${k} (${before[k]} → ${after[k]})`);
    }
    for (const t of await clipped(page)) fail(`${width}px après « ${name} » : texte coupé « ${t} »`);
    before = after;
  }
  await page.close();
}

// Parcours principaux, sur grand écran
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => fail(`parcours : erreur JS ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle' });

const total = await page.locator('.kpi-value').first().innerText();
if (total.replace(/\s/g, '') !== '5056') fail(`total affiché ${total}, attendu 5 056`);

await page.locator('.copy').first().click();
const hook = await page.evaluate(() => navigator.clipboard.readText());
if (!/plus cher\.$/.test(hook)) fail(`accroche copiée inattendue : ${hook}`);

for (const tab of ['Tendances', 'Destinations', 'Fournisseurs', 'Méthode', 'Meilleures offres']) {
  await page.click(`.tab:has-text("${tab}")`);
  const panel = await page.locator('.panel').innerText();
  if (panel.trim().length < 40) fail(`onglet ${tab} vide`);
}

await page.click('.tab:has-text("Tendances")');
const rising = page.locator('.rising-item').first();
if (await rising.count()) {
  const name = await rising.locator('b').first().innerText();
  await rising.click();
  const chosen = await page.locator('select >> nth=1').evaluate((s) => s.options[s.selectedIndex].text);
  if (chosen !== name) fail(`clic sur la tendance ${name} filtre sur ${chosen}`);
}

await browser.close();

if (failures.length) {
  console.error(`✗ ${failures.length} problème(s) :`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✓ Contrôle OK : ${WIDTHS.length} largeurs d'écran, ${ACTIONS.length} interactions chacune, parcours principaux.`);
