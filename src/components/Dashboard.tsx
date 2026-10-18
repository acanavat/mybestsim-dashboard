'use client';

import { useMemo, useRef, useState } from 'react';
import {
  NO_FILTERS,
  PRICE_THRESHOLD,
  applyFilters,
  bestDeals,
  byProvider,
  cheapestCountries,
  destinationFlag,
  destinations,
  fmt,
  meta,
  perGbByVolume,
  priceHistogram,
  products,
  providerLogo,
  providers,
  summarize,
  trends,
  type Filters,
  type ProviderRow,
} from '@/lib/catalog';
import { BarList, Columns, PriceHistogram, useTooltip } from './charts';
import BestDeals from './BestDeals';
import CheapestCountries from './CheapestCountries';
import DestinationMatrix from './DestinationMatrix';
import SimCard from './SimCard';
import TrendsPanel from './TrendsPanel';

const total = summarize(products);
const collator = new Intl.Collator('fr');
const providerOptions = providers.map((name, id) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name));
const destinationOptions = destinations.map((d, id) => ({ id, ...d })).sort((a, b) => collator.compare(a.name, b.name));
const importDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(
  new Date(meta.generatedAt),
);

type SortKey = 'count' | 'avgPrice' | 'medianPerGb' | 'share5g' | 'shareTopUp' | 'shareUnlimited';
const COLUMNS: { key: SortKey; label: string; asc?: boolean }[] = [
  { key: 'count', label: 'Offres' },
  { key: 'avgPrice', label: 'Prix moyen', asc: true },
  { key: 'medianPerGb', label: 'Médiane / Go', asc: true },
  { key: 'share5g', label: '5G' },
  { key: 'shareTopUp', label: 'Rechargeables' },
  { key: 'shareUnlimited', label: 'Illimités' },
];

const TABS = [
  { id: 'deals', label: 'Meilleures offres' },
  { id: 'trends', label: 'Tendances' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'providers', label: 'Fournisseurs' },
  { id: 'method', label: 'Méthode' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function Dashboard() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('count');
  const [tab, setTab] = useState<TabId>('deals');
  const tip = useTooltip();
  const tablistRef = useRef<HTMLDivElement>(null);

  // Changer d'onglet change la hauteur de la page : si les onglets sont sortis de l'écran
  // par le haut, on les ramène en vue pour ne pas laisser le lecteur dans le vide.
  const openTab = (id: TabId) => {
    setTab(id);
    const el = tablistRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
    const offset = toolbar && getComputedStyle(toolbar).position === 'sticky' ? toolbar.offsetHeight + 8 : 8;
    if (top < offset) window.scrollTo({ top: window.scrollY + top - offset });
  };

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleProvider = (id: number) => set({ provider: filters.provider === id ? null : id });
  const toggleDestination = (id: number) => set({ destination: filters.destination === id ? null : id });
  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const view = useMemo(() => {
    const list = applyFilters(products, filters);
    // Les vues par fournisseur / destination ignorent leur propre filtre :
    // la sélection est mise en avant au lieu de faire disparaître les autres.
    // Les 18 fournisseurs restent toujours listés (0 si aucune offre) pour que la tuile ne change pas de taille.
    const allProviders = byProvider(applyFilters(products, filters, 'provider'), true);
    const destList = applyFilters(products, filters, 'destination');
    return {
      s: summarize(list),
      providerRows: byProvider(list),
      providerShare: [...allProviders].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name)),
      cheapest: allProviders.filter((r) => Number.isFinite(r.medianPerGb)).sort((a, b) => a.medianPerGb - b.medianPerGb),
      hist: priceHistogram(list),
      volume: perGbByVolume(list),
      // Toutes les catégories sont comparées sans le filtre fournisseur ; s'il est actif,
      // on garde celles où ce fournisseur est le moins cher.
      deals: bestDeals(applyFilters(products, filters, 'provider')).filter(
        (d) => filters.provider === null || d.best.provider === filters.provider,
      ),
      destList,
      countries: cheapestCountries(destList),
    };
  }, [filters]);

  const { s } = view;
  const empty = s.count === 0;
  const shareTotal = view.providerShare.reduce((a, b) => a + b.count, 0);
  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort)!;
    return [...view.providerRows].sort((a, b) => (col.asc ? a[sort] - b[sort] : b[sort] - a[sort]));
  }, [view.providerRows, sort]);
  const cheapestId = view.cheapest[0]?.id;

  return (
    <>
      <header className="appbar">
        <div className="wrap">
          <div className="brand">
            <SimCard count={total.count} providers={total.providerCount} mini />
            <div>
              <b>MyBestSim</b>
              <span>Tableau de bord du catalogue eSIM</span>
            </div>
          </div>
          <span className="stamp">
            <span className="hide-sm">Données du </span>
            {importDate}
          </span>
        </div>
      </header>

      <div className="toolbar">
        <div className="wrap">
          <label className="field">
            <span className="sr-only">Fournisseur</span>
            <span className="select-wrap">
              {filters.provider !== null && (
                <img className="logo" src={providerLogo(filters.provider)} alt="" width={20} height={20} />
              )}
              <select
                className={`select${filters.provider !== null ? ' has-icon' : ''}`}
                value={filters.provider ?? ''}
                onChange={(e) => set({ provider: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Tous les fournisseurs</option>
                {providerOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="sr-only">Destination</span>
            <span className="select-wrap">
              {filters.destination !== null && (
                <img className="flag" src={destinationFlag(filters.destination)} alt="" width={20} height={20} />
              )}
              <select
                className={`select${filters.destination !== null ? ' has-icon' : ''}`}
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
            </span>
          </label>
          <div className="field inline" role="group" aria-labelledby="f-net">
            <span className="field-label" id="f-net">Réseau</span>
            <div className="pills">
              {(['all', '4G', '5G'] as const).map((n) => (
                <button key={n} type="button" className="pill" aria-pressed={filters.network === n} onClick={() => set({ network: n })}>
                  {n === 'all' ? 'Tous' : n}
                </button>
              ))}
            </div>
          </div>
          <div className="field inline" role="group" aria-labelledby="f-days">
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
            <b>{fmt.int(s.count)}</b> offre{s.count > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <main className="wrap dash">
        <h1 className="sr-only">Tableau de bord du catalogue eSIM</h1>
        {empty && (
          <div className="notice" role="status">
            <span>
              <b>Aucune offre ne correspond à ces filtres.</b> Retirez un filtre pour élargir la sélection.
            </span>
            <button type="button" className="pill" onClick={() => setFilters(NO_FILTERS)}>Réinitialiser</button>
          </div>
        )}
        <>
            <section className="kpis" aria-label="Chiffres clés">
              <div className="kpi">
                <span className="kpi-label">Cartes eSIM</span>
                <span className="kpi-value">{fmt.int(s.count)}</span>
                <span className="kpi-note">
                  {s.providerCount} fournisseur{s.providerCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="kpi alert">
                <span className="kpi-label">Offres à plus de 100&nbsp;€</span>
                <span className="kpi-value">{fmt.int(s.over100)}</span>
                <span className="kpi-note" title={expensiveNote(s.expensive, true)}>{expensiveNote(s.expensive, false)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Fourchette de prix</span>
                <span className="kpi-value range-value">
                  {fmt.euro(s.minPrice)} <small>–</small> {fmt.euro(s.maxPrice)}
                </span>
                <span className="kpi-note">minimum et maximum</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Data moyenne</span>
                <span className="kpi-value">
                  {fmt.dec1(s.avgGb)} <small>Go</small>
                </span>
                <span className="kpi-note">hors {fmt.int(s.unlimitedCount)} illimitées</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Prix moyen</span>
                <span className="kpi-value">{fmt.euro(s.avgPrice)}</span>
                <span className="kpi-note">médiane {fmt.euro(s.medianPrice)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Prix médian au Go</span>
                <span className="kpi-value">{fmt.euro(s.medianPerGb)}</span>
                <span className="kpi-note">{fmt.pct(s.share5g)} des offres en 5G</span>
              </div>
            </section>

            <section className="overview" aria-label="Vue d'ensemble">
              <div className="tile">
                <div className="tile-head">
                  <div>
                    <h2>Offres par fournisseur</h2>
                    <p className="sub">Nombre de cartes et part du catalogue</p>
                  </div>
                  <span className="hint">Cliquez pour filtrer</span>
                </div>
                <BarList
                  items={view.providerShare.map((r) => ({
                    id: r.id,
                    label: r.name,
                    icon: providerLogo(r.id),
                    value: r.count,
                    display: (
                      <>
                        {fmt.int(r.count)} <span>· {fmt.pct(r.count / shareTotal)}</span>
                      </>
                    ),
                    tip: <ProviderTip r={r} />,
                  }))}
                  selected={filters.provider}
                  onSelect={toggleProvider}
                  showTip={tip.show}
                  hideTip={tip.hide}
                />
              </div>
              <div className="stack">
                <div className="tile">
                  <div className="tile-head">
                    <div>
                      <h2>Distribution des prix</h2>
                      <p className="sub">Nombre d&apos;offres par tranche de 5 €</p>
                    </div>
                  </div>
                  <PriceHistogram
                    bins={view.hist}
                    height={180}
                    thresholdLabel={`${fmt.int(s.over100)} offre${s.over100 > 1 ? 's' : ''} > ${PRICE_THRESHOLD} €`}
                    showTip={tip.show}
                    hideTip={tip.hide}
                  />
                </div>
                <div className="tile">
                  <div className="tile-head">
                    <div>
                      <h2>Prix selon le volume</h2>
                      <p className="sub">Prix médian d&apos;un Go par taille de forfait ; l&apos;illimité, sans volume, est en prix par jour</p>
                    </div>
                  </div>
                  <div className="volume-wrap">
                  <Columns
                    height={180}
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
                  <div className="unlimited-col" aria-label="Forfaits illimités">
                    <span className="unl-value">{fmt.euro(s.unlimitedPerDay)}</span>
                    <span className="unl-unit">par jour</span>
                    <span className="unl-count">{fmt.int(s.unlimitedCount)} offre{s.unlimitedCount > 1 ? 's' : ''}</span>
                    <span className="unl-label">Illimité</span>
                  </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="tabs" aria-label="Analyses détaillées">
              <div className="tablist" role="tablist" ref={tablistRef}>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`panel-${t.id}`}
                    className="tab"
                    onClick={() => openTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'deals' && (
                  <>
                    <p className="panel-intro">
                      Pour chaque catégorie (même destination, même volume, même durée), l&apos;offre la moins chère et son avance sur
                      le concurrent suivant. Les plus grosses avances sont les meilleurs arguments publicitaires.
                    </p>
                    <BestDeals deals={view.deals} hasFilters={active} />
                  </>
                )}

                {tab === 'trends' && (
                  <TrendsPanel data={trends} list={view.destList} selected={filters.destination} onSelect={toggleDestination} />
                )}

                {tab === 'destinations' && (
                  <div className="panel-stack">
                    <CheapestCountries ranks={view.countries} selected={filters.destination} onSelect={toggleDestination} />
                    <DestinationMatrix list={view.destList} selected={filters.destination} onSelect={toggleDestination} tip={tip} />
                  </div>
                )}

                {tab === 'providers' && (
                  <div className="providers-grid">
                    <div className="tile">
                      <div className="tile-head">
                        <div>
                          <h2>Prix médian au Go</h2>
                          <p className="sub">Du moins cher au plus cher, hors illimités. Échelle resserrée.</p>
                        </div>
                      </div>
                      <BarList
                        items={view.cheapest.map((r) => ({
                          id: r.id,
                          label: r.name,
                          icon: providerLogo(r.id),
                          value: r.medianPerGb,
                          display: fmt.euro(r.medianPerGb),
                          tip: <ProviderTip r={r} />,
                        }))}
                        selected={filters.provider}
                        onSelect={toggleProvider}
                        showTip={tip.show}
                        hideTip={tip.hide}
                        dots
                      />
                    </div>
                    <div className="tile">
                      <div className="tile-head">
                        <div>
                          <h2>Comparatif des fournisseurs</h2>
                          <p className="sub">Cliquez sur un en-tête pour trier</p>
                        </div>
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
                                    <img className="logo" src={providerLogo(r.id)} alt="" width={24} height={24} loading="lazy" />
                                    {r.name}
                                    {r.id === cheapestId && sortedRows.length > 1 && <span className="best">moins cher / Go</span>}
                                  </span>
                                </td>
                                <td>{fmt.int(r.count)}</td>
                                <td>{fmt.euro(r.avgPrice)}</td>
                                <td>{fmt.euro(r.medianPerGb)}</td>
                                <td>{fmt.pct(r.share5g)}</td>
                                <td>{fmt.pct(r.shareTopUp)}</td>
                                <td>{fmt.pct(r.shareUnlimited)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'method' && (
                  <div className="method">
                    <div className="tile">
                      <h2>Contrôles à l&apos;import</h2>
                      <ul>
                        <li>{meta.files.length} fichiers CSV lus, un par fournisseur</li>
                        <li>
                          {fmt.int(products.length)} lignes retenues sur {fmt.int(meta.files.reduce((a, f) => a + f.rows, 0))}
                        </li>
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
                    <div className="tile">
                      <h2>Forfaits illimités</h2>
                      <p>
                        {fmt.int(total.unlimitedCount)} offres sont illimitées et n&apos;ont pas de volume en Go. Elles comptent dans le
                        nombre d&apos;offres et les prix, mais sont <b>exclues de la data moyenne et du prix au Go</b> : leur donner une
                        valeur arbitraire fausserait ces deux moyennes. Dans le tableau par destination, elles sont comparées en prix
                        par jour.
                      </p>
                    </div>
                    <div className="tile">
                      <h2>Tendances de recherche</h2>
                      <p>
                        Chaque jour, une tâche planifiée interroge Google Trends sur « voyage + pays » en France (pays + ville
                        principale quand c&apos;est elle qu&apos;on cherche : Dubaï, New York, Prague…). « esim + pays » a été testé
                        mais n&apos;a pas assez de volume par pays. Si Google refuse la requête, les dernières données valides sont
                        gardées et leur date est affichée.
                      </p>
                    </div>
                    <div className="tile">
                      <h2>Mise à jour automatique</h2>
                      <p>
                        Un script lit tous les fichiers du dossier <code>data/</code> à chaque déploiement, contrôle chaque ligne et
                        recalcule le tableau de bord. Ajouter ou remplacer un CSV fournisseur suffit : aucune modification de code
                        n&apos;est nécessaire.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
        </>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <span>Tableau de bord réalisé par Alexandre Canavate pour le test MyBestSim</span>
          <span>« Offre chère » : plus de {PRICE_THRESHOLD} €</span>
        </div>
      </footer>
      {tip.node}
    </>
  );
}

function expensiveNote(e: ReturnType<typeof summarize>['expensive'], long: boolean) {
  if (!e) return 'aucune';
  const parts: string[] = [];
  if (e.unlimited === 1) parts.push(long ? 'toutes illimitées' : 'illimité');
  else if (e.unlimited >= 0.5) parts.push(`${fmt.pct(e.unlimited)} illimitées`);
  if (e.daysShare === 1) parts.push(long ? `${e.days} jours` : `${e.days} j`);
  if (e.region === 1) parts.push(long ? 'zones multi-pays' : 'multi-pays');
  return parts.length ? parts.join(long ? ', ' : ' · ') : `surtout ${e.days} jours`;
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
