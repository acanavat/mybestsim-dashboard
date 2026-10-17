import raw from '@/data/catalog.json';

export type Destination = { code: string; name: string; region: boolean };

export type Product = {
  provider: number;
  destination: number;
  gb: number | null; // null = forfait illimité
  days: number;
  price: number; // en euros
  is5g: boolean;
  topUp: boolean;
};

type RawCatalog = {
  generatedAt: string;
  files: { file: string; rows: number; kept: number }[];
  issues: string[];
  unlimited: number;
  providers: string[];
  providerLogos: string[];
  destinations: Destination[];
  rows: [number, number, number | null, number, number, number, number][];
};

const catalog = raw as unknown as RawCatalog;

export const providers = catalog.providers;
export const providerLogo = (id: number) => `/logos/${catalog.providerLogos[id]}.png`;
export const destinations = catalog.destinations;
// Drapeaux Twemoji, les mêmes que ceux affichés sur mybestsim.com (globes pour les zones).
export const destinationFlag = (id: number) => `/flags/${catalog.destinations[id].code}.svg`;
export const meta = {
  generatedAt: catalog.generatedAt,
  files: catalog.files,
  issues: catalog.issues,
};

export const products: Product[] = catalog.rows.map(([p, d, gb, days, cents, g5, top]) => ({
  provider: p,
  destination: d,
  gb,
  days,
  price: cents / 100,
  is5g: g5 === 1,
  topUp: top === 1,
}));

export const PRICE_THRESHOLD = 100;

export type Filters = {
  provider: number | null;
  destination: number | null;
  network: 'all' | '4G' | '5G';
  days: number | null;
};

export const NO_FILTERS: Filters = { provider: null, destination: null, network: 'all', days: null };

export function applyFilters(list: Product[], f: Filters, ignore?: keyof Filters): Product[] {
  return list.filter(
    (p) =>
      (ignore === 'provider' || f.provider === null || p.provider === f.provider) &&
      (ignore === 'destination' || f.destination === null || p.destination === f.destination) &&
      (ignore === 'network' || f.network === 'all' || p.is5g === (f.network === '5G')) &&
      (ignore === 'days' || f.days === null || p.days === f.days),
  );
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

export type Summary = ReturnType<typeof summarize>;

export function summarize(list: Product[]) {
  const prices = list.map((p) => p.price);
  const metered = list.filter((p) => p.gb !== null);
  const perGb = metered.map((p) => p.price / (p.gb as number));
  return {
    count: list.length,
    over100: list.filter((p) => p.price > PRICE_THRESHOLD).length,
    minPrice: prices.length ? Math.min(...prices) : NaN,
    maxPrice: prices.length ? Math.max(...prices) : NaN,
    avgPrice: mean(prices),
    medianPrice: median(prices),
    avgGb: mean(metered.map((p) => p.gb as number)),
    meteredCount: metered.length,
    unlimitedCount: list.length - metered.length,
    medianPerGb: median(perGb),
    share5g: list.length ? list.filter((p) => p.is5g).length / list.length : NaN,
    shareTopUp: list.length ? list.filter((p) => p.topUp).length / list.length : NaN,
    providerCount: new Set(list.map((p) => p.provider)).size,
    unlimitedPerDay: mean(list.filter((p) => p.gb === null).map((p) => p.price / p.days)),
    expensive: expensiveProfile(list.filter((p) => p.price > PRICE_THRESHOLD)),
    destinationCount: new Set(list.map((p) => p.destination)).size,
  };
}

/** Ce qui caractérise les offres à plus de 100 € : illimitées ? zones multi-pays ? durée ? */
function expensiveProfile(list: Product[]) {
  if (list.length === 0) return null;
  const share = (fn: (p: Product) => boolean) => list.filter(fn).length / list.length;
  const days = new Map<number, number>();
  for (const p of list) days.set(p.days, (days.get(p.days) ?? 0) + 1);
  const [topDays, topDaysCount] = [...days.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    unlimited: share((p) => p.gb === null),
    region: share((p) => destinations[p.destination].region),
    days: topDays,
    daysShare: topDaysCount / list.length,
  };
}

export type ProviderRow = {
  id: number;
  name: string;
  count: number;
  avgPrice: number;
  medianPerGb: number;
  share5g: number;
  shareTopUp: number;
  shareUnlimited: number;
  destinations: number;
};

export function byProvider(list: Product[], includeEmpty = false): ProviderRow[] {
  const groups = new Map<number, Product[]>(includeEmpty ? providers.map((_, id) => [id, []]) : []);
  for (const p of list) {
    const g = groups.get(p.provider);
    if (g) g.push(p);
    else groups.set(p.provider, [p]);
  }
  return [...groups.entries()].map(([id, items]) => {
    const metered = items.filter((p) => p.gb !== null);
    const n = items.length || 1;
    return {
      id,
      name: providers[id],
      count: items.length,
      avgPrice: mean(items.map((p) => p.price)),
      medianPerGb: median(metered.map((p) => p.price / (p.gb as number))),
      share5g: items.filter((p) => p.is5g).length / n,
      shareTopUp: items.filter((p) => p.topUp).length / n,
      shareUnlimited: (items.length - metered.length) / n,
      destinations: new Set(items.map((p) => p.destination)).size,
    };
  });
}

/** Histogramme des prix par tranches de `step` euros. */
export function priceHistogram(list: Product[], step = 5) {
  const max = Math.max(160, ...list.map((p) => p.price));
  const bins = Array.from({ length: Math.ceil(max / step) }, (_, i) => ({
    from: i * step,
    to: (i + 1) * step,
    count: 0,
  }));
  for (const p of list) bins[Math.min(bins.length - 1, Math.floor(p.price / step))].count++;
  return bins;
}

/** Prix médian au Go pour chaque volume de data proposé (hors illimités). */
export function perGbByVolume(list: Product[]) {
  const groups = new Map<number, number[]>();
  for (const p of list) {
    if (p.gb === null) continue;
    const g = groups.get(p.gb);
    if (g) g.push(p.price / p.gb);
    else groups.set(p.gb, [p.price / p.gb]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gb, values]) => ({ gb, medianPerGb: median(values), count: values.length }));
}

export function byDestination(list: Product[]) {
  const groups = new Map<number, Product[]>();
  for (const p of list) {
    const g = groups.get(p.destination);
    if (g) g.push(p);
    else groups.set(p.destination, [p]);
  }
  return [...groups.entries()].map(([id, items]) => ({
    id,
    ...destinations[id],
    count: items.length,
    medianPrice: median(items.map((p) => p.price)),
    providers: new Set(items.map((p) => p.provider)).size,
  }));
}

const euro2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const euro0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('fr-FR');
const dec1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const pct0 = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

const safe = (fn: (n: number) => string) => (n: number) => (Number.isFinite(n) ? fn(n) : '–');
export const fmt = {
  euro: safe((n) => euro2.format(n)),
  euroRound: safe((n) => euro0.format(n)),
  int: safe((n) => int.format(n)),
  dec1: safe((n) => dec1.format(n)),
  pct: safe((n) => pct0.format(n)),
  pct1: safe((n) => pct1.format(n)),
};

export type MatrixCell = { value: number; count: number } | null;
export type MatrixRow = {
  id: number | null; // null = ligne « toutes destinations »
  name: string;
  region: boolean;
  medianPerGb: number;
  cells: MatrixCell[]; // une case par volume de `volumes`, puis la case illimité
};

/**
 * Prix moyen au Go par destination et par volume de forfait.
 * La dernière case est le prix moyen par jour des forfaits illimités,
 * qui n'ont pas de volume en Go.
 */
export function destinationMatrix(list: Product[]) {
  const volumes = [...new Set(list.filter((p) => p.gb !== null).map((p) => p.gb as number))].sort((a, b) => a - b);

  const cellsOf = (items: Product[]): MatrixCell[] => {
    const avg = (values: number[]): MatrixCell =>
      values.length ? { value: values.reduce((a, b) => a + b, 0) / values.length, count: values.length } : null;
    return [
      ...volumes.map((gb) => avg(items.filter((p) => p.gb === gb).map((p) => p.price / gb))),
      avg(items.filter((p) => p.gb === null).map((p) => p.price / p.days)),
    ];
  };
  const perGbMedian = (items: Product[]) =>
    median(items.filter((p) => p.gb !== null).map((p) => p.price / (p.gb as number)));

  const groups = new Map<number, Product[]>();
  for (const p of list) {
    const g = groups.get(p.destination);
    if (g) g.push(p);
    else groups.set(p.destination, [p]);
  }

  const rows: MatrixRow[] = [...groups.entries()].map(([id, items]) => ({
    id,
    name: destinations[id].name,
    region: destinations[id].region,
    medianPerGb: perGbMedian(items),
    cells: cellsOf(items),
  }));
  const overall: MatrixRow = { id: null, name: 'Toutes destinations', region: false, medianPerGb: perGbMedian(list), cells: cellsOf(list) };
  return { volumes, rows, overall };
}

export type Deal = {
  key: string;
  destination: number;
  gb: number | null;
  days: number;
  best: { provider: number; price: number; is5g: boolean };
  runnerUp: { provider: number; price: number };
  /** De combien le concurrent suivant est plus cher que la meilleure offre (0,16 = +16 %). */
  lead: number;
  providers: number;
};

/**
 * Meilleures offres du moment : dans chaque catégorie comparable
 * (même destination, même volume, même durée), l'offre la moins chère
 * et son avance sur le fournisseur suivant. Une catégorie doit compter
 * au moins deux fournisseurs pour qu'on puisse parler d'avance.
 */
export function bestDeals(list: Product[]): Deal[] {
  const segments = new Map<string, Map<number, Product>>();
  for (const p of list) {
    const key = `${p.destination}|${p.gb ?? 'u'}|${p.days}`;
    let byProvider = segments.get(key);
    if (!byProvider) segments.set(key, (byProvider = new Map()));
    const current = byProvider.get(p.provider);
    if (!current || p.price < current.price) byProvider.set(p.provider, p);
  }
  const deals: Deal[] = [];
  for (const [key, byProvider] of segments) {
    if (byProvider.size < 2) continue;
    const [first, second] = [...byProvider.values()].sort((a, b) => a.price - b.price);
    deals.push({
      key,
      destination: first.destination,
      gb: first.gb,
      days: first.days,
      best: { provider: first.provider, price: first.price, is5g: first.is5g },
      runnerUp: { provider: second.provider, price: second.price },
      lead: second.price / first.price - 1,
      providers: byProvider.size,
    });
  }
  return deals.sort((a, b) => b.lead - a.lead || b.providers - a.providers);
}

export type CountryRank = {
  id: number;
  name: string;
  /** Écart moyen à la moyenne des pays, à forfait égal (−0,07 = 7 % moins cher). */
  gap: number;
  offers: number;
  reference: { gb: number; days: number; price: number; provider: number } | null;
};

const REFERENCE_PLAN = { gb: 10, days: 30 };

/**
 * Pays les moins chers à forfait égal. Chaque offre est comparée au prix moyen
 * des pays pour le même volume et la même durée ; un pays est classé selon la
 * moyenne de ces écarts, ce qui neutralise les différences de gamme.
 */
export function cheapestCountries(list: Product[]): CountryRank[] {
  const countries = list.filter((p) => !destinations[p.destination].region);
  const category = (p: Product) => `${p.gb ?? 'u'}|${p.days}`;

  const sums = new Map<string, { total: number; n: number }>();
  for (const p of countries) {
    const s = sums.get(category(p)) ?? { total: 0, n: 0 };
    s.total += p.price;
    s.n++;
    sums.set(category(p), s);
  }

  const byCountry = new Map<number, Product[]>();
  for (const p of countries) {
    const g = byCountry.get(p.destination);
    if (g) g.push(p);
    else byCountry.set(p.destination, [p]);
  }

  return [...byCountry.entries()]
    .map(([id, items]) => {
      const ratios = items.map((p) => {
        const s = sums.get(category(p))!;
        return p.price / (s.total / s.n);
      });
      const ref = items
        .filter((p) => p.gb === REFERENCE_PLAN.gb && p.days === REFERENCE_PLAN.days)
        .sort((a, b) => a.price - b.price)[0];
      return {
        id,
        name: destinations[id].name,
        gap: ratios.reduce((a, b) => a + b, 0) / ratios.length - 1,
        offers: items.length,
        reference: ref ? { gb: ref.gb as number, days: ref.days, price: ref.price, provider: ref.provider } : null,
      };
    })
    .sort((a, b) => a.gap - b.gap);
}
