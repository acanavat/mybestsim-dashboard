import { PRICE_THRESHOLD, fmt, type Summary } from '@/lib/catalog';

// Les six chiffres clés, chacun sur une « carte SIM » (coin coupé) avec un graphique
// miniature qui montre la répartition derrière le chiffre. Tout suit les filtres.

type Bin = { from: number; to: number; count: number };
type Volume = { gb: number; medianPerGb: number; count: number };

const pct = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);

function Chip() {
  return (
    <svg className="kpi-chip" viewBox="0 0 30 23" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="22" rx="4" fill="#e9c46a" stroke="#b8862a" />
      <path d="M0 8h10M0 15h10M20 8h10M20 15h10M10 0v23M20 0v23" stroke="#8a6418" strokeWidth="0.9" opacity="0.7" fill="none" />
    </svg>
  );
}

function Card({ label, value, chart, note, hero, alert, title }: {
  label: React.ReactNode;
  value: React.ReactNode;
  chart: React.ReactNode;
  note: React.ReactNode;
  hero?: boolean;
  alert?: boolean;
  title?: string;
}) {
  return (
    <div className={`kpi${hero ? ' hero' : ''}${alert ? ' alert' : ''}`} title={title}>
      <div className="kpi-inner">
        <span className="kpi-top">
          <span className="kpi-label">{label}</span>
          {hero && <Chip />}
        </span>
        <span className="kpi-value">{value}</span>
        <span className="kpi-chart" aria-hidden="true">{chart}</span>
        <span className="kpi-note">{note}</span>
      </div>
    </div>
  );
}

export function expensiveNote(e: Summary['expensive'], long: boolean) {
  if (!e) return 'aucune';
  const parts: string[] = [];
  if (e.unlimited === 1) parts.push(long ? 'toutes illimitées' : 'illimité');
  else if (e.unlimited >= 0.5) parts.push(`${fmt.pct(e.unlimited)} illimitées`);
  if (e.daysShare === 1) parts.push(long ? `${e.days} jours` : `${e.days} j`);
  if (e.region === 1) parts.push(long ? 'zones multi-pays' : 'zones');
  return parts.length ? parts.join(long ? ', ' : ' · ') : `surtout ${e.days} jours`;
}

export default function KpiCards({ s, hist, volume }: { s: Summary; hist: Bin[]; volume: Volume[] }) {
  const share5g = Number.isFinite(s.share5g) ? s.share5g : 0;
  const range = s.maxPrice - s.minPrice;
  const at = (v: number) => (range > 0 ? pct(((v - s.minPrice) / range) * 100) : 0);

  const volumeCounts = [...volume.map((v) => ({ key: String(v.gb), count: v.count, unl: false })), { key: 'u', count: s.unlimitedCount, unl: true }];
  const maxVol = Math.max(1, ...volumeCounts.map((v) => v.count));
  const bins = hist.slice(0, 32);
  const maxHist = Math.max(1, ...bins.map((b) => b.count));
  const histMax = bins.length ? bins[bins.length - 1].to : 160;
  const maxGb = Math.max(0, ...volume.map((v) => v.medianPerGb));
  const first = volume[0];
  const last = volume[volume.length - 1];

  return (
    <section className="kpis" aria-label="Chiffres clés">
      <Card
        hero
        label="Cartes eSIM"
        value={fmt.int(s.count)}
        title={`${s.providerCount} fournisseurs, ${s.destinationCount} destinations`}
        chart={
          <span className="mini-split">
            {s.count > 0 && (
              <>
                <i style={{ width: `${(1 - share5g) * 100}%` }} />
                <i style={{ width: `${share5g * 100}%` }} />
              </>
            )}
          </span>
        }
        note={
          <>
            <b className="key k4" /> 4G {fmt.pct(1 - share5g)} <b className="key k5" /> 5G {fmt.pct(share5g)}
          </>
        }
      />
      <Card
        alert
        label={
          <>
            <span className="hide-sm">Offres à plus de {PRICE_THRESHOLD}&nbsp;€</span>
            <span className="show-sm">Offres &gt; {PRICE_THRESHOLD}&nbsp;€</span>
          </>
        }
        value={fmt.int(s.over100)}
        title={`${expensiveNote(s.expensive, true)} ; ${s.count ? fmt.dec1((s.over100 / s.count) * 100) : '0'} % des offres`}
        chart={
          <span className="mini-meter">
            {s.over100 > 0 && <i style={{ width: `max(3px, ${pct((s.over100 / s.count) * 100)}%)` }} />}
          </span>
        }
        note={expensiveNote(s.expensive, false)}
      />
      <Card
        label="Fourchette de prix"
        value={
          <span className="range-value">
            {fmt.euro(s.minPrice)} <small>–</small> {fmt.euro(s.maxPrice)}
          </span>
        }
        chart={
          <span className="mini-range">
            {s.count > 0 && (
              <>
                <i className="iqr" style={{ left: `${at(s.q1)}%`, width: `${at(s.q3) - at(s.q1)}%` }} />
                <i className="med" style={{ left: `${at(s.medianPrice)}%` }} />
              </>
            )}
          </span>
        }
        note={s.count > 0 ? `50 % entre ${fmt.euroRound(s.q1)} et ${fmt.euroRound(s.q3)}` : 'aucune offre'}
      />
      <Card
        label="Data moyenne"
        value={
          <>
            {fmt.dec1(s.avgGb)} <small>Go</small>
          </>
        }
        title="Nombre d'offres par volume : 1, 3, 5, 10, 20, 50 Go puis illimité (en orange)"
        chart={
          <span className="mini-cols">
            {volumeCounts.map((v) => (
              <i key={v.key} className={v.unl ? 'unl' : undefined} style={{ height: `${Math.max(v.count ? 8 : 0, (v.count / maxVol) * 100)}%` }} />
            ))}
          </span>
        }
        note={`hors ${fmt.int(s.unlimitedCount)} illimitées`}
      />
      <Card
        label="Prix moyen"
        value={fmt.euro(s.avgPrice)}
        title="Répartition des prix par tranche de 5 € ; le trait marque la moyenne"
        chart={
          <span className="mini-hist">
            {bins.map((b) => (
              <i key={b.from} style={{ height: `${b.count ? Math.max(6, (b.count / maxHist) * 100) : 0}%` }} />
            ))}
            {s.count > 0 && <em style={{ left: `${pct((s.avgPrice / histMax) * 100)}%` }} />}
          </span>
        }
        note={`médiane ${fmt.euro(s.medianPrice)}`}
      />
      <Card
        label="Prix médian au Go"
        value={fmt.euro(s.medianPerGb)}
        title="Prix médian d'un Go selon la taille du forfait, de 1 à 50 Go"
        chart={
          <svg className="mini-line" viewBox="0 0 120 28" preserveAspectRatio="none">
            {volume.length > 1 && maxGb > 0 && (
              <polyline
                points={volume.map((v, i) => `${(i / (volume.length - 1)) * 116 + 2},${26 - (v.medianPerGb / maxGb) * 22}`).join(' ')}
                fill="none"
                stroke="var(--blue)"
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        }
        note={
          first && last && first !== last
            ? `${first.gb} Go → ${last.gb} Go : ${fmt.dec1(first.medianPerGb)} → ${fmt.dec1(last.medianPerGb)} €`
            : 'selon le volume'
        }
      />
    </section>
  );
}
