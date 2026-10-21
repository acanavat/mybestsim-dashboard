'use client';

import { destinationFlag, destinations, fmt, providerLogo, providers, referenceOffer, type Product, type Trends } from '@/lib/catalog';

// En dessous de cet indice, le volume de recherche est trop faible pour qu'une hausse soit significative.
const MIN_INTEREST = 5;

const LOW_VOLUME = 'Volume de recherche trop faible pour une évolution fiable';

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="trend-chip flat" title={LOW_VOLUME}>–</span>;
  if (Math.abs(value) < 0.01) return <span className="trend-chip flat">= stable</span>;
  const up = value > 0;
  return (
    <span className={`trend-chip ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {up ? '+' : '−'}
      {fmt.pct(Math.abs(value))}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 120, H = 34, P = 4;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [P + (i * (W - 2 * P)) / Math.max(values.length - 1, 1), H - P - (v / max) * (H - 2 * P)]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill="var(--blue)" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export default function TrendsPanel({
  data,
  list,
  selected,
  onSelect,
}: {
  data: Trends | null;
  list: Product[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  if (!data) {
    return (
      <div className="tile">
        <h2>Tendances indisponibles</h2>
        <p className="sub">Les données Google Trends n&apos;ont pas encore été récupérées. Lancez scripts/fetch-trends.py.</p>
      </div>
    );
  }

  const top = data.countries.slice(0, 10);
  // « En vogue » = plus recherché qu'à la même époque l'an dernier : neutralise les effets de saison.
  const rising = data.countries
    .filter((c) => c.interest >= MIN_INTEREST && c.yearChange !== null && c.yearChange > 0)
    .sort((a, b) => (b.yearChange as number) - (a.yearChange as number))
    .slice(0, 5);
  const lastYear = new Date(data.period.lastYearTo).getFullYear();

  return (
    <>
      <p className="panel-intro">
        Recherches Google « voyage + pays » en France, mises à jour automatiquement chaque jour. C&apos;est un indicateur
        d&apos;intention de voyage, en amont de l&apos;achat d&apos;une eSIM : il sert à repérer les destinations à mettre en avant.
      </p>

      <div className="trends-grid">
        <div className="tile">
          <div className="tile-head">
            <div>
              <h2>Les plus recherchées</h2>
              <p className="sub">
                Indice sur les {data.period.recentWeeks} dernières semaines, 100 = la destination la plus recherchée
              </p>
            </div>
          </div>
          <div className="trend-row trend-head" aria-hidden="true">
            <span />
            <span />
            <span>Destination</span>
            <span />
            <span>Indice</span>
            <span>
              <span className="hide-sm">Ce mois-ci</span>
              <span className="show-sm">Mois</span>
            </span>
            <span>
              <span className="hide-sm">Sur un an</span>
              <span className="show-sm">1 an</span>
            </span>
          </div>
          <ol className="trend-list">
            {top.map((c, i) => (
              <li key={c.destination}>
                <button
                  type="button"
                  className={`trend-row${selected === c.destination ? ' on' : ''}`}
                  aria-pressed={selected === c.destination}
                  onClick={() => onSelect(c.destination)}
                  title={`Recherche : ${c.keyword}`}
                >
                  <span className="trend-rank">{i + 1}</span>
                  <img className="flag" src={destinationFlag(c.destination)} alt="" width={22} height={22} loading="lazy" />
                  <span className="trend-name">{destinations[c.destination].name}</span>
                  <span className="trend-bar">
                    <i style={{ width: `${c.interest}%` }} />
                  </span>
                  <span className="trend-index">{fmt.int(Math.round(c.interest))}</span>
                  <Change value={c.change} />
                  <Change value={c.yearChange} />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="tile">
          <div className="tile-head">
            <div>
              <h2>En vogue</h2>
              <p className="sub">
                Plus recherchées qu&apos;aux mêmes semaines de {lastYear}, et l&apos;offre à pousser
              </p>
            </div>
          </div>
          {rising.length === 0 ? (
            <p className="sub">Aucune destination n&apos;est plus recherchée qu&apos;à la même époque l&apos;an dernier.</p>
          ) : (
            <ul className="rising">
              {rising.map((c) => {
                const offer = referenceOffer(list, c.destination);
                return (
                  <li key={c.destination}>
                    <button
                      type="button"
                      className={`rising-item${selected === c.destination ? ' on' : ''}`}
                      aria-pressed={selected === c.destination}
                      onClick={() => onSelect(c.destination)}
                      title={`Recherche : ${c.keyword}`}
                    >
                      <span className="rising-head">
                        <img className="flag" src={destinationFlag(c.destination)} alt="" width={24} height={24} loading="lazy" />
                        <b>{destinations[c.destination].name}</b>
                        <Change value={c.yearChange} />
                      </span>
                      <Sparkline values={c.weekly} />
                      <span className="rising-month">
                        ce mois-ci : {c.change === null ? '–' : `${c.change >= 0 ? '+' : '−'}${fmt.pct(Math.abs(c.change))}`}
                      </span>
                      <span className="rising-offer">
                        {offer ? (
                          <>
                            <img className="logo" src={providerLogo(offer.provider)} alt="" width={20} height={20} loading="lazy" />
                            <span>
                              {offer.gb} Go · {offer.days} j dès <b>{fmt.euro(offer.price)}</b> chez {providers[offer.provider]}
                            </span>
                          </>
                        ) : (
                          <span>Aucune offre avec ces filtres</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
