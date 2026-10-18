// Lit tous les CSV fournisseurs de /data, contrôle leur qualité et produit
// src/data/catalog.json, le seul fichier que le dashboard consomme.
// Lancé automatiquement avant chaque `npm run dev` / `npm run build` :
// déposer un nouveau CSV dans /data puis redéployer suffit à mettre le dashboard à jour.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'src', 'data');

const EXPECTED_COLUMNS = [
  'sku', 'provider', 'product_name', 'country_code', 'country_name', 'data_gb',
  'data_display', 'validity_days', 'price', 'currency', 'network', 'top_up',
];

// Codes qui désignent une zone multi-pays et non un pays.
const REGION_CODES = new Set(['EU', 'AS', 'NA', 'WW']);

// Parseur CSV minimal mais correct : gère les guillemets, les virgules et
// les retours à la ligne à l'intérieur d'un champ, ainsi que le BOM UTF-8.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

function indexOf(list, map, value) {
  if (!map.has(value)) { map.set(value, list.length); list.push(value); }
  return map.get(value);
}

async function main() {
  const files = (await readdir(DATA_DIR)).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
  if (files.length === 0) throw new Error(`Aucun fichier CSV trouvé dans ${DATA_DIR}`);

  const providers = [], providerIdx = new Map();
  const providerFiles = [];
  const destinations = [], destinationIdx = new Map();
  const rows = [];
  const seenSku = new Set();
  const issues = [];
  const fileReport = [];
  let unlimited = 0;

  for (const file of files) {
    const [header, ...lines] = parseCsv(await readFile(path.join(DATA_DIR, file), 'utf8'));
    const cols = header.map((h) => h.trim());
    const missing = EXPECTED_COLUMNS.filter((c) => !cols.includes(c));
    if (missing.length) {
      issues.push(`${file} : colonnes manquantes (${missing.join(', ')}), fichier ignoré`);
      fileReport.push({ file, rows: 0, kept: 0 });
      continue;
    }
    const at = Object.fromEntries(cols.map((c, i) => [c, i]));
    let kept = 0;

    lines.forEach((line, n) => {
      const get = (c) => (line[at[c]] ?? '').trim();
      const where = `${file} ligne ${n + 2}`;
      const sku = get('sku');
      const price = Number(get('price'));
      const days = Number(get('validity_days'));
      const gbRaw = get('data_gb');
      const isUnlimited = gbRaw === '' && /illimit/i.test(get('data_display'));
      const gb = isUnlimited ? null : Number(gbRaw);

      if (!sku) return issues.push(`${where} : SKU vide, ligne ignorée`);
      if (seenSku.has(sku)) return issues.push(`${where} : SKU ${sku} en double, ligne ignorée`);
      if (get('currency') !== 'EUR') return issues.push(`${where} : devise ${get('currency') || 'absente'} (attendu EUR), ligne ignorée`);
      if (!Number.isFinite(price) || price <= 0) return issues.push(`${where} : prix invalide « ${get('price')} », ligne ignorée`);
      if (!Number.isFinite(days) || days <= 0) return issues.push(`${where} : validité invalide « ${get('validity_days')} », ligne ignorée`);
      if (!isUnlimited && (!Number.isFinite(gb) || gb <= 0)) return issues.push(`${where} : data invalide « ${gbRaw} », ligne ignorée`);

      seenSku.add(sku);
      if (isUnlimited) unlimited++;
      const code = get('country_code');
      const provider = indexOf(providers, providerIdx, get('provider'));
      providerFiles[provider] ??= path.basename(file, path.extname(file));
      rows.push([
        provider,
        indexOf(destinations, destinationIdx, `${code}|${get('country_name')}`),
        gb,
        days,
        Math.round(price * 100),
        get('network') === '5G' ? 1 : 0,
        get('top_up').toLowerCase() === 'oui' ? 1 : 0,
      ]);
      kept++;
    });
    fileReport.push({ file, rows: lines.length, kept });
  }

  // Tendances Google Trends (data/trends.json, mis à jour chaque jour par une GitHub Action).
  // Facultatif : sans ce fichier, l'onglet Tendances l'indique simplement.
  let trends = null;
  try {
    const raw = JSON.parse(await readFile(path.join(DATA_DIR, 'trends.json'), 'utf8'));
    const byCode = new Map(destinations.map((d, i) => [d.split('|')[0], i]));
    trends = {
      fetchedAt: raw.fetchedAt,
      period: raw.period,
      anchor: raw.anchor,
      countries: raw.countries
        .filter((c) => byCode.has(c.code))
        .map((c) => ({ destination: byCode.get(c.code), keyword: c.keyword, interest: c.interest, change: c.change, weekly: c.weekly })),
    };
  } catch (err) {
    if (err.code !== 'ENOENT') issues.push(`trends.json illisible : ${err.message}`);
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    trends,
    files: fileReport,
    issues,
    unlimited,
    providers,
    // Logo de chaque fournisseur : public/logos/<nom du fichier CSV>.png
    providerLogos: providerFiles,
    destinations: destinations.map((d) => {
      const [code, name] = d.split('|');
      return { code, name, region: REGION_CODES.has(code) };
    }),
    // [fournisseur, destination, Go (null = illimité), jours, prix en centimes, 5G, rechargeable]
    rows,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog));

  console.log(`✓ ${files.length} fichiers lus, ${rows.length} produits retenus, ${unlimited} illimités, ${issues.length} anomalie(s)`);
  for (const issue of issues.slice(0, 20)) console.log(`  ! ${issue}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
