'use client';

import { useMemo, useState } from 'react';
import { destinationFlag, destinationMatrix, fmt, type MatrixCell, type MatrixRow, type Product } from '@/lib/catalog';
import type { useTooltip } from './charts';

type Tip = ReturnType<typeof useTooltip>;
type Order = 'cheap' | 'expensive' | 'alpha';
const PREVIEW = 12;
const collator = new Intl.Collator('fr');

// Écart à la moyenne de la colonne → teinte : bleu = moins cher, orange = plus cher.
// ±15 % d'écart donne la teinte la plus forte ; le texte reste lisible en encre.
function shade(cell: MatrixCell, reference: MatrixCell) {
  if (!cell || !reference) return undefined;
  const gap = cell.value / reference.value - 1;
  const strength = Math.min(Math.abs(gap) / 0.15, 1);
  if (strength < 0.15) return undefined;
  const color = gap < 0 ? '10 108 240' : '217 119 6';
  return `rgb(${color} / ${(0.08 + strength * 0.4).toFixed(2)})`;
}

export default function DestinationMatrix({
  list,
  selected,
  onSelect,
  tip,
}: {
  list: Product[];
  selected: number | null;
  onSelect: (id: number) => void;
  tip: Tip;
}) {
  const [order, setOrder] = useState<Order>('cheap');
  const [expanded, setExpanded] = useState(false);
  const { volumes, rows, overall } = useMemo(() => destinationMatrix(list), [list]);

  const sorted = useMemo(() => {
    const r = [...rows];
    if (order === 'alpha') return r.sort((a, b) => collator.compare(a.name, b.name));
    const dir = order === 'cheap' ? 1 : -1;
    return r.sort((a, b) => (Number.isFinite(a.medianPerGb) ? dir * (a.medianPerGb - b.medianPerGb) : 1));
  }, [rows, order]);
  // La destination filtrée reste visible même si elle n'est pas dans l'aperçu.
  const visible = useMemo(() => {
    if (expanded) return sorted;
    const head = sorted.slice(0, PREVIEW);
    const picked = sorted.find((r) => r.id === selected);
    return picked && !head.includes(picked) ? [...head, picked] : head;
  }, [sorted, expanded, selected]);

  const labels = [...volumes.map((gb) => `${gb} Go`), 'Illimité'];

  const cell = (row: MatrixRow, c: MatrixCell, i: number) => {
    const unlimited = i === volumes.length;
    const unit = unlimited ? '€/jour' : '€/Go';
    return (
      <td
        key={i}
        className={unlimited ? 'unl' : undefined}
        style={{ background: row.id === null ? undefined : shade(c, overall.cells[i]) }}
        onMouseMove={(e) =>
          c &&
          tip.show(
            e,
            <>
              <b>
                {row.name} · {labels[i]}
              </b>
              <br />
              {fmt.euro(c.value)} {unit} en moyenne
              <br />
              sur {fmt.int(c.count)} offre{c.count > 1 ? 's' : ''}
            </>,
          )
        }
        onMouseLeave={tip.hide}
      >
        {c ? fmt.euro(c.value) : '–'}
      </td>
    );
  };

  return (
    <div className="card matrix-card">
      <div className="matrix-head">
        <div>
          <h3>Prix moyen au Go par destination</h3>
          <p className="sub">
            Une colonne par taille de forfait. Les forfaits illimités n&apos;ont pas de volume : leur colonne donne le prix moyen
            par jour.
          </p>
        </div>
        <div className="pills" role="group" aria-label="Ordre des destinations">
          {(
            [
              ['cheap', 'Moins chères'],
              ['expensive', 'Plus chères'],
              ['alpha', 'A → Z'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className="pill" aria-pressed={order === key} onClick={() => setOrder(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="legend matrix-legend">
        <span>
          <i style={{ background: 'rgb(10 108 240 / 0.48)' }} /> moins cher que la moyenne
        </span>
        <span>
          <i style={{ background: 'rgb(217 119 6 / 0.48)' }} /> plus cher que la moyenne
        </span>
      </div>

      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Destination</th>
              {labels.map((l, i) => (
                <th key={l} scope="col" className={i === volumes.length ? 'unl' : undefined}>
                  {l}
                  <small>{i === volumes.length ? '€ / jour' : '€ / Go'}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="overall">
              <th scope="row">{overall.name}</th>
              {overall.cells.map((c, i) => cell(overall, c, i))}
            </tr>
            {visible.map((row) => (
              <tr
                key={row.id}
                className={selected === row.id ? 'on' : undefined}
                onClick={() => onSelect(row.id as number)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(row.id as number))}
                aria-selected={selected === row.id}
              >
                <th scope="row">
                  <span className="dest-cell">
                    <img className="flag" src={destinationFlag(row.id as number)} alt="" width={22} height={22} loading="lazy" />
                    {row.name}
                    {row.region && <span className="zone">zone</span>}
                  </span>
                </th>
                {row.cells.map((c, i) => cell(row, c, i))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > PREVIEW && (
        <button type="button" className="more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? 'Afficher moins' : `Afficher les ${sorted.length} destinations`}
        </button>
      )}
    </div>
  );
}
