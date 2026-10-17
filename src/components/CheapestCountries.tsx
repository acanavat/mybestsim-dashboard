'use client';

import { destinationFlag, fmt, providerLogo, providers, type CountryRank } from '@/lib/catalog';

export default function CheapestCountries({
  ranks,
  selected,
  onSelect,
}: {
  ranks: CountryRank[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const top = ranks.slice(0, 5);
  if (top.length === 0) return null;

  return (
    <div className="card">
      <h3>Top 5 des pays où le forfait coûte le moins cher</h3>
      <p className="sub">
        À forfait égal (même volume, même durée), comparé à la moyenne des {ranks.length} pays du catalogue. Zones multi-pays
        exclues.
      </p>
      <ol className="podium">
        {top.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              className={`podium-item${selected === c.id ? ' on' : ''}`}
              aria-pressed={selected === c.id}
              onClick={() => onSelect(c.id)}
            >
              <span className="podium-rank">{i + 1}</span>
              <img className="flag" src={destinationFlag(c.id)} alt="" width={36} height={36} loading="lazy" />
              <span className="podium-name">{c.name}</span>
              <span className="podium-gap">{fmt.pct1(Math.abs(c.gap))} {c.gap < 0 ? 'moins cher' : 'plus cher'}</span>
              <span className="podium-ref">
                {c.reference ? (
                  <>
                    <img className="logo" src={providerLogo(c.reference.provider)} alt="" width={20} height={20} loading="lazy" />
                    <span>
                      {c.reference.gb} Go · {c.reference.days} j dès <b>{fmt.euro(c.reference.price)}</b>
                      <br />
                      chez {providers[c.reference.provider]}
                    </span>
                  </>
                ) : (
                  <span>{fmt.int(c.offers)} offres comparées</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {ranks.length > 1 && (
        <p className="insight">
          Entre le pays le moins cher ({ranks[0].name}) et le plus cher ({ranks[ranks.length - 1].name}), l&apos;écart à forfait égal
          n&apos;est que de <b>{fmt.pct1(ranks[ranks.length - 1].gap - ranks[0].gap)}</b> : les prix varient beaucoup plus selon le
          volume et le fournisseur que selon le pays.
        </p>
      )}
    </div>
  );
}
