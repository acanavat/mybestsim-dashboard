'use client';

import { useMemo, useState } from 'react';
import {
  NO_FILTERS,
  PRICE_THRESHOLD,
  applyFilters,
  byDestination,
  byProvider,
  destinations,
  fmt,
  meta,
  perGbByVolume,
  priceHistogram,
  products,
  providerLogo,
  providers,
  summarize,
  type Filters,
  type ProviderRow,
} from '@/lib/catalog';
import { BarList, Columns, PriceHistogram, useTooltip } from './charts';
import DestinationMatrix from './DestinationMatrix';
import SimCard from './SimCard';

const total = summarize(products);
const collator = new Intl.Collator('fr');
const providerOptions = providers.map((name, id) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name));
const destinationOptions = destinations.map((d, id) => ({ id, ...d })).sort((a, b) => collator.compare(a.name, b.name));
const importDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(
  new Date(meta.generatedAt),
);

type SortKey = 'count' | 'avgPrice' | 'medianPerGb' | 'destinations' | 'share5g' | 'shareTopUp' | 'shareUnlimited';
const COLUMNS: { key: SortKey; label: string; asc?: boolean }[] = [
  { key: 'count', label: 'Offres' },
  { key: 'avgPrice', label: 'Prix moyen', asc: true },
  { key: 'medianPerGb', label: 'Prix médian / Go', asc: true },
  { key: 'destinations', label: 'Destinations' },
  { key: 'share5g', label: '5G' },
  { key: 'shareTopUp', label: 'Rechargeables' },
  { key: 'shareUnlimited', label: 'Illimités' },
];

export default function Dashboard() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('count');
  const tip = useTooltip();

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const view = useMemo(() => {
    const list = applyFilters(products, filters);
    const providerRows = byProvider(list);
    return {
      list,
      s: summarize(list),
      // Les graphiques par fournisseur / destination ignorent leur propre filtre :
      // la sélection est mise en avant au lieu de faire disparaître les autres barres.
      providerShare: byProvider(applyFilters(products, filters, 'provider')).sort((a, b) => b.count - a.count),
      providerRows,
      cheapest: byProvider(applyFilters(products, filters, 'provider')).filter((r) => Number.isFinite(r.medianPerGb)).sort((a, b) => a.medianPerGb - b.medianPerGb),
      hist: priceHistogram(list),
      volume: perGbByVolume(list),
      destList: applyFilters(products, filters, 'destination'),
      dest: byDestination(applyFilters(products, filters, 'destination')).sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }, [filters]);

  const { s } = view;
  const empty = s.count === 0;
  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort)!;
    return [...view.providerRows].sort((a, b) => (col.asc ? a[sort] - b[sort] : b[sort] - a[sort]));
  }, [view.providerRows, sort]);
  const cheapestId = view.cheapest[0]?.id;
  const firstVolume = view.volume[0];
  const lastVolume = view.volume[view.volume.length - 1];

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <a className="brand" href="#top">
            MyBestSim <span>Tableau de bord catalogue</span>
          </a>
          <span className="stamp">Données du {importDate}</span>
        </div>
      </header>

      <div className="wrap" id="top">
        <section className="hero">
          <div>
            <h1>
              Le catalogue eSIM <em>en chiffres</em>
            </h1>
            <p className="lede">
              <strong>
                {fmt.int(total.count)} offres de {total.providerCount} fournisseurs, pour {total.destinationCount} destinations.
              </strong>{' '}
              Les statistiques sont recalculées automatiquement à chaque import des fichiers CSV fournisseurs. Filtrez par fournisseur,
              destination, réseau ou durée : tous les chiffres et graphiques s&apos;adaptent.
            </p>
          </div>
          <SimCard count={total.count} providers={total.providerCount} />
        </section>
      </div>

      <div className="filters">
        <div className="wrap">
          <label className="field">
            <span className="field-label">Fournisseur</span>
            <select
              className="select"
              value={filters.provider ?? ''}
              onChange={(e) => set({ provider: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Tous les fournisseurs</option>
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Destination</span>
            <select
              className="select"
              value={filters.destination ?? ''}
              onChange={(e) => set({ destination: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Toutes les destinations</option>
              <optgroup label="Zones multi-pays">
                {destinationOptions.filter((d) => d.region).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
              <optgroup label="Pays">
                {destinationOptions.filter((d) => !d.region).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <div className="field" role="group" aria-labelledby="f-net">
            <span className="field-label" id="f-net">Réseau</span>
            <div className="pills">
              {(['all', '4G', '5G'] as const).map((n) => (
                <button key={n} type="button" className="pill" aria-pressed={filters.network === n} onClick={() => set({ network: n })}>
                  {n === 'all' ? 'Tous' : n}
                </button>
              ))}
            </div>
          </div>
          <div className="field" role="group" aria-labelledby="f-days">
            <span className="field-label" id="f-days">Validité</span>
            <div className="pills">
              {[null, 7, 15, 30].map((d) => (
                <button key={d ?? 'all'} type="button" className="pill" aria-pressed={filters.days === d} onClick={() => set({ days: d })}>
                  {d === null ? 'Toutes' : `${d} j`}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="reset" onClick={() => setFilters(NO_FILTERS)} disabled={!active}>
            Réinitialiser
          </button>
          <p className="result-count" aria-live="polite">
            <b>{fmt.int(s.count)}</b> offre{s.count > 1 ? 's' : ''} {active ? 'sélectionnée' + (s.count > 1 ? 's' : '') : 'au total'}
          </p>
        </div>
      </div>

      <main className="wrap">
        {empty ? (
          <section className="section card">
            <h3>Aucune offre ne correspond à ces filtres</h3>
            <p className="sub">Retirez un filtre pour élargir la sélection.</p>
            <button type="button" className="pill" onClick={() => setFilters(NO_FILTERS)}>Réinitialiser les filtres</button>
          </section>
        ) : (
          <>
            <section className="section" aria-labelledby="h-kpi">
              <div className="section-head">
                <h2 id="h-kpi">L&apos;essentiel</h2>
                <p>{active ? 'Sur la sélection en cours' : 'Sur l’ensemble du catalogue'}</p>
              </div>
              <div className="kpis">
                <div className="kpi">
                  <span className="kpi-label">Cartes eSIM</span>
                  <span className="kpi-value">{fmt.int(s.count)}</span>
                  <span className="kpi-note">
                    <b>{s.providerCount}</b> fournisseur{s.providerCount > 1 ? 's' : ''} · <b>{s.destinationCount}</b> destination
                    {s.destinationCount > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="kpi alert">
                  <span className="kpi-label">Offres à plus de 100&nbsp;€</span>
                  <span className="kpi-value">{fmt.int(s.over100)}</span>
                  <span className="kpi-note">
                    soit <b>{s.count ? fmt.dec1((s.over100 / s.count) * 100) : '–'} %</b> du {active ? 'résultat' : 'catalogue'}
                  </span>
                </div>
                <div className="kpi wide">
                  <span className="kpi-label">Fourchette de prix</span>
                  <span className="kpi-value">
                    {fmt.euro(s.minPrice)} <small>à</small> {fmt.euro(s.maxPrice)}
                  </span>
                  <PriceRange min={s.minPrice} max={s.maxPrice} median={s.medianPrice} />
                </div>
                <div className="kpi">
                  <span className="kpi-label">Data moyenne par carte</span>
                  <span className="kpi-value">
                    {fmt.dec1(s.avgGb)} <small>Go</small>
                  </span>
                  <span className="kpi-note">
                    calculée sur {fmt.int(s.meteredCount)} offres, <b>hors {fmt.int(s.unlimitedCount)} illimitées</b>
                  </span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Prix moyen</span>
                  <span className="kpi-value">{fmt.euro(s.avgPrice)}</span>
                  <span className="kpi-note">
                    médiane <b>{fmt.euro(s.medianPrice)}</b> : la moitié des offres coûte moins
                  </span>
                </div>
                <div className="kpi wide">
                  <span className="kpi-label">Prix médian au Go</span>
                  <span className="kpi-value">{fmt.euro(s.medianPerGb)}</span>
                  <span className="kpi-note">
                    <b>{fmt.pct(s.share5g)}</b> en 5G · <b>{fmt.pct(s.shareTopUp)}</b> rechargeables
                  </span>
                </div>
              </div>
            </section>

            <section className="section" aria-labelledby="h-prov">
              <div className="section-head">
                <h2 id="h-prov">Fournisseurs</h2>
                <p>Cliquez sur une barre pour filtrer le tableau de bord sur ce fournisseur</p>
              </div>
              <div className="grid-2">
                <div className="card">
                  <h3>Répartition des offres par fournisseur</h3>
                  <p className="sub">Nombre de cartes proposées et part du total</p>
                  <BarList
                    items={view.providerShare.map((r) => ({
                      id: r.id,
                      label: r.name,
                      icon: providerLogo(r.id),
                      value: r.count,
                      display: (
                        <>
                          {fmt.int(r.count)} <span>· {fmt.pct(r.count / view.providerShare.reduce((a, b) => a + b.count, 0))}</span>
                        </>
                      ),
                      tip: <ProviderTip r={r} />,
                    }))}
                    selected={filters.provider}
                    onSelect={(id) => set({ provider: filters.provider === id ? null : id })}
                    showTip={tip.show}
                    hideTip={tip.hide}
                  />
                </div>
                <div className="card">
                  <h3>Prix médian au Go par fournisseur</h3>
                  <p className="sub">Du moins cher au plus cher, hors forfaits illimités. Échelle resserrée pour montrer les écarts.</p>
                  <BarList
                    items={view.cheapest.map((r) => ({
                      id: r.id,
                      label: r.name,
                      icon: providerLogo(r.id),
                      value: r.medianPerGb,
                      display: fmt.euro(r.medianPerGb),
                      tip: <ProviderTip r={r} />,
                    }))}
                    dots
                    selected={filters.provider}
                    onSelect={(id) => set({ provider: filters.provider === id ? null : id })}
                    showTip={tip.show}
                    hideTip={tip.hide}
                  />
                  {view.cheapest.length > 1 && (
                    <p className="insight">
                      <b>{view.cheapest[0].name}</b> est le moins cher au Go ({fmt.euro(view.cheapest[0].medianPerGb)}),{' '}
                      {fmt.dec1(view.cheapest[view.cheapest.length - 1].medianPerGb / view.cheapest[0].medianPerGb)} fois moins que{' '}
                      {view.cheapest[view.cheapest.length - 1].name}.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="section" aria-labelledby="h-price">
              <div className="section-head">
                <h2 id="h-price">Prix</h2>
                <p>Survolez les colonnes pour le détail</p>
              </div>
              <div className="grid-2">
                <div className="card">
                  <h3>Distribution des prix</h3>
                  <p className="sub">Nombre d&apos;offres par tranche de 5 €</p>
                  <PriceHistogram bins={view.hist} showTip={tip.show} hideTip={tip.hide} />
                  <p className="insight">
                    {s.over100 > 0 ? (
                      <>
                        <b>{fmt.int(s.over100)} offres</b> dépassent 100 €. La médiane est à <b>{fmt.euro(s.medianPrice)}</b> : le
                        catalogue est surtout composé de petits forfaits.
                      </>
                    ) : (
                      <>Aucune offre ne dépasse 100 € dans cette sélection.</>
                    )}
                  </p>
                </div>
                <div className="card">
                  <h3>Prix au Go selon le volume</h3>
                  <p className="sub">Prix médian d&apos;un Go pour chaque taille de forfait</p>
                  <Columns
                    items={view.volume.map((v) => ({
                      key: String(v.gb),
                      label: `${v.gb} Go`,
                      value: v.medianPerGb,
                      display: fmt.euro(v.medianPerGb),
                      tip: (
                        <>
                          <b>Forfaits {v.gb} Go</b>
                          <br />
                          {fmt.euro(v.medianPerGb)} / Go (médiane)
                          <br />
                          {fmt.int(v.count)} offres
                        </>
                      ),
                    }))}
                    showTip={tip.show}
                    hideTip={tip.hide}
                  />
                  {firstVolume && lastVolume && firstVolume !== lastVolume && (
                    <p className="insight">
                      Le Go coûte <b>{fmt.dec1(firstVolume.medianPerGb / lastVolume.medianPerGb)} fois moins cher</b> dans un forfait{' '}
                      {lastVolume.gb} Go que dans un forfait {firstVolume.gb} Go.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="section" aria-labelledby="h-matrix">
              <div className="section-head">
                <h2 id="h-matrix">Prix par destination</h2>
                <p>Cliquez sur une destination pour filtrer le tableau de bord</p>
              </div>
              <DestinationMatrix
                list={view.destList}
                selected={filters.destination}
                onSelect={(id) => set({ destination: filters.destination === id ? null : id })}
                tip={tip}
              />
            </section>

            <section className="section" aria-labelledby="h-table">
              <div className="section-head">
                <h2 id="h-table">Comparatif des fournisseurs</h2>
                <p>Cliquez sur un en-tête pour trier</p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Fournisseur</th>
                      {COLUMNS.map((c) => (
                        <th key={c.key} scope="col">
                          <button type="button" aria-pressed={sort === c.key} onClick={() => setSort(c.key)}>
                            {c.label}
                            {sort === c.key ? (c.asc ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="provider-cell">
                            <img className="logo" src={providerLogo(r.id)} alt="" width={28} height={28} loading="lazy" />
                            {r.name}
                          </span>
                        </td>
                        <td>{fmt.int(r.count)}</td>
                        <td>{fmt.euro(r.avgPrice)}</td>
                        <td>
                          {fmt.euro(r.medianPerGb)}
                          {r.id === cheapestId && sortedRows.length > 1 && <span className="best">le moins cher</span>}
                        </td>
                        <td>{r.destinations}</td>
                        <td>{fmt.pct(r.share5g)}</td>
                        <td>{fmt.pct(r.shareTopUp)}</td>
                        <td>{fmt.pct(r.shareUnlimited)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <details className="section fold">
              <summary className="section-head">
                <h2>Destinations</h2>
                <p>
                  {total.destinationCount} destinations, dont {destinations.filter((d) => d.region).length} zones multi-pays
                </p>
              </summary>
              <div className="card wide-labels">
                <h3>Les 10 destinations les plus couvertes</h3>
                <p className="sub">Nombre d&apos;offres et prix médian par destination</p>
                <BarList
                  items={view.dest.map((d) => ({
                    id: d.id,
                    label: d.region ? `${d.name} (zone)` : d.name,
                    value: d.count,
                    display: (
                      <>
                        {fmt.int(d.count)} <span>· médiane {fmt.euro(d.medianPrice)}</span>
                      </>
                    ),
                    tip: (
                      <>
                        <b>{d.name}</b>
                        <br />
                        {fmt.int(d.count)} offres · {d.providers} fournisseurs
                        <br />
                        Prix médian {fmt.euro(d.medianPrice)}
                      </>
                    ),
                  }))}
                  selected={filters.destination}
                  onSelect={(id) => set({ destination: filters.destination === id ? null : id })}
                  showTip={tip.show}
                  hideTip={tip.hide}
                />
              </div>
            </details>

          </>
        )}

        <details className="section fold">
          <summary className="section-head">
            <h2>Méthode et qualité des données</h2>
            <p>Les choix faits pour calculer ces chiffres</p>
          </summary>
          <div className="method">
            <div className="card">
              <h3>Contrôles à l&apos;import</h3>
              <ul>
                <li>{meta.files.length} fichiers CSV lus, un par fournisseur</li>
                <li>{fmt.int(products.length)} lignes retenues sur {fmt.int(meta.files.reduce((a, f) => a + f.rows, 0))}</li>
                <li>Colonnes, devise (EUR), prix, durée et SKU uniques vérifiés</li>
                <li>
                  {meta.issues.length === 0 ? (
                    <span className="ok">Aucune anomalie détectée</span>
                  ) : (
                    `${meta.issues.length} ligne(s) écartée(s)`
                  )}
                </li>
              </ul>
            </div>
            <div className="card">
              <h3>Forfaits illimités</h3>
              <p>
                {fmt.int(total.unlimitedCount)} offres sont illimitées et n&apos;ont pas de volume en Go. Elles comptent dans le nombre
                d&apos;offres et les prix, mais sont <b>exclues de la data moyenne et du prix au Go</b> : leur donner une valeur arbitraire
                fausserait ces deux moyennes.
              </p>
            </div>
            <div className="card">
              <h3>Mise à jour automatique</h3>
              <p>
                Un script lit tous les fichiers du dossier <code>data/</code> à chaque déploiement, contrôle chaque ligne et
                recalcule le tableau de bord. Ajouter ou remplacer un CSV fournisseur suffit : aucune modification de code n&apos;est
                nécessaire.
              </p>
            </div>
          </div>
        </details>
      </main>

      <footer>
        <div className="wrap">
          <span>Tableau de bord réalisé par Alexandre Canavate pour le test MyBestSim</span>
          <span>Seuil « offre chère » : plus de {PRICE_THRESHOLD} €</span>
        </div>
      </footer>
      {tip.node}
    </>
  );
}

function PriceRange({ min, max, median }: { min: number; max: number; median: number }) {
  const pos = max > min ? ((median - min) / (max - min)) * 100 : 0;
  return (
    <>
      <div className="range" title={`Médiane ${fmt.euro(median)}`}>
        <i style={{ left: `calc(${pos}% - 1px)` }} />
      </div>
      <div className="range-legend">
        <span style={{ left: `clamp(0px, calc(${pos}% - 40px), calc(100% - 110px))` }}>médiane {fmt.euro(median)}</span>
      </div>
    </>
  );
}

function ProviderTip({ r }: { r: ProviderRow }) {
  return (
    <>
      <b>{r.name}</b>
      <br />
      {fmt.int(r.count)} offres · prix moyen {fmt.euro(r.avgPrice)}
      <br />
      {fmt.euro(r.medianPerGb)} / Go (médiane) · {fmt.pct(r.share5g)} en 5G
    </>
  );
}
