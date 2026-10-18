'use client';

import { useState } from 'react';
import { destinationFlag, destinations, fmt, providerLogo, providers, type Deal } from '@/lib/catalog';

const PREVIEW = 6;
const MORE = 24;

const planLabel = (d: Deal) => `${d.gb === null ? 'Illimité' : `${d.gb} Go`} · ${d.days} jours`;

export default function BestDeals({ deals, hasFilters }: { deals: Deal[]; hasFilters: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = deals.slice(0, expanded ? PREVIEW + MORE : PREVIEW);

  if (deals.length === 0) {
    return (
      <div className="card">
        <h3>Aucune offre à mettre en avant</h3>
        <p className="sub">
          {hasFilters
            ? 'Avec ces filtres, aucune catégorie ne compte au moins deux fournisseurs. Retirez un filtre pour comparer davantage d’offres.'
            : 'Aucune catégorie ne compte au moins deux fournisseurs.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="deals">
        {visible.map((d, i) => (
          <article key={d.key} className="deal">
            <header className="deal-top">
              <span className="deal-dest">
                <img className="flag" src={destinationFlag(d.destination)} alt="" width={22} height={22} loading="lazy" />
                <span>{destinations[d.destination].name}</span>
              </span>
              <span className="deal-rank">n° {i + 1}</span>
            </header>
            <p className="deal-plan">
              {planLabel(d)} <span className="chip">{d.best.is5g ? '5G' : '4G'}</span>
            </p>

            <div className="deal-best">
              <img className="logo" src={providerLogo(d.best.provider)} alt="" width={40} height={40} loading="lazy" />
              <div>
                <b>{providers[d.best.provider]}</b>
                <span>le moins cher</span>
              </div>
              <strong>{fmt.euro(d.best.price)}</strong>
            </div>

            <div className="deal-gap">
              <span className="deal-lead" title={`Le concurrent suivant est ${fmt.pct(d.lead)} plus cher`}>{`+${fmt.pct(d.lead)}`}</span>
              <p>
                <span>
                  devant <b>{providers[d.runnerUp.provider]}</b> à {fmt.euro(d.runnerUp.price)}
                </span>
              </p>
            </div>

            <footer className="deal-foot">
              <span>{d.providers} fournisseurs comparés dans cette catégorie</span>
            </footer>
          </article>
        ))}
      </div>
      {deals.length > PREVIEW && (
        <button type="button" className="more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? 'Afficher moins' : `Voir les ${Math.min(MORE, deals.length - PREVIEW)} offres suivantes`}
        </button>
      )}
    </>
  );
}
