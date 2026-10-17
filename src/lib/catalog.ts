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
    destinationCount: new Set(list.map((p) => p.destination)).size,
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

export function byProvider(list: Product[]): ProviderRow[] {
  const groups = new Map<number, Product[]>();
  for (const p of list) {
    const g = groups.get(p.provider);
    if (g) g.push(p);
    else groups.set(p.provider, [p]);
  }
  return [...groups.entries()].map(([id, items]) => {
    const metered = items.filter((p) => p.gb !== null);
    return {
      id,
      name: providers[id],
      count: items.length,
      avgPrice: mean(items.map((p) => p.price)),
      medianPerGb: median(metered.map((p) => p.price / (p.gb as number))),
      share5g: items.filter((p) => p.is5g).length / items.length,
      shareTopUp: items.filter((p) => p.topUp).length / items.length,
      shareUnlimited: (items.length - metered.length) / items.length,
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

const safe = (fn: (n: number) => string) => (n: number) => (Number.isFinite(n) ? fn(n) : '–');
export const fmt = {
  euro: safe((n) => euro2.format(n)),
  euroRound: safe((n) => euro0.format(n)),
  int: safe((n) => int.format(n)),
  dec1: safe((n) => dec1.format(n)),
  pct: safe((n) => pct0.format(n)),
};
