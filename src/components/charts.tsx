'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PRICE_THRESHOLD, fmt } from '@/lib/catalog';

/* ---------- Infobulle partagée ---------- */

type Tip = { x: number; y: number; content: ReactNode } | null;

export function useTooltip() {
  const [tip, setTip] = useState<Tip>(null);
  const show = useCallback((e: React.MouseEvent | React.FocusEvent, content: ReactNode) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const raw = 'clientX' in e ? e.clientX : r.left + r.width / 2;
    // L'infobulle est centrée sur x : on la garde à l'écran près des bords.
    const margin = Math.min(130, window.innerWidth / 2);
    const x = Math.min(Math.max(raw, margin), window.innerWidth - margin);
    setTip({ x, y: r.top, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);

  // Sur mobile, un toucher affiche l'infobulle mais rien ne la referme : on la retire
  // dès que la page défile ou change de taille.
  useEffect(() => {
    if (!tip) return;
    window.addEventListener('scroll', hide, { passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', hide);
    };
  }, [tip, hide]);
  const node = tip ? (
    <div className="tooltip" role="status" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  ) : null;
  return { node, show, hide };
}

type TipFn = ReturnType<typeof useTooltip>['show'];

/* ---------- Barres horizontales (une seule série) ---------- */

export type BarItem = { id: number; label: string; icon?: string; value: number; display: ReactNode; tip: ReactNode };

export function BarList({
  items,
  selected,
  onSelect,
  showTip,
  hideTip,
  max,
  dots,
  iconKind = 'logo',
}: {
  items: BarItem[];
  selected: number | null;
  onSelect?: (id: number) => void;
  showTip: TipFn;
  hideTip: () => void;
  max?: number;
  /** Points sur une échelle resserrée (min → max) au lieu de barres partant de zéro. */
  dots?: boolean;
  iconKind?: 'logo' | 'flag';
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 0);
  const lo = Math.min(...items.map((i) => i.value));
  const span = top - lo || 1;
  return (
    <ul className="bars">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`bar-row${selected !== null && selected !== item.id ? ' dim' : ''}`}
            aria-pressed={selected === item.id}
            onClick={() => {
              hideTip();
              onSelect?.(item.id);
            }}
            onMouseMove={(e) => showTip(e, item.tip)}
            onMouseLeave={hideTip}
            onFocus={(e) => showTip(e, item.tip)}
            onBlur={hideTip}
          >
            <span className="bar-name">
              {item.icon && <img className={iconKind} src={item.icon} alt="" width={24} height={24} loading="lazy" />}
              <span>{item.label}</span>
            </span>
            {dots ? (
              <span className="dot-track">
                <span className="dot-line" />
                <span className="dot" style={{ left: `calc((100% - 80px) * ${(item.value - lo) / span})` }}>
                  <span className="bar-value">{item.display}</span>
                </span>
              </span>
            ) : (
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `calc((100% - var(--reserve, 92px)) * ${top ? item.value / top : 0})` }} />
                <span className="bar-value">{item.display}</span>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Histogramme des prix ---------- */

const niceMax = (n: number) => {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((v) => v >= n) as number;
};

export function PriceHistogram({
  bins,
  showTip,
  hideTip,
  height = 230,
  thresholdLabel = 'seuil 100 €',
}: {
  bins: { from: number; to: number; count: number }[];
  showTip: TipFn;
  hideTip: () => void;
  height?: number;
  thresholdLabel?: string;
}) {
  const W = 600, H = height, L = 34, R = 8, T = 22, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const yMax = niceMax(Math.max(...bins.map((b) => b.count)));
  const xMax = bins[bins.length - 1].to;
  const x = (v: number) => L + (v / xMax) * pw;
  const y = (v: number) => T + ph - (v / yMax) * ph;
  const slot = pw / bins.length;
  const colW = Math.max(2, slot - 2);
  const ticks = [0, yMax / 2, yMax];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Nombre d'offres par tranche de prix de 5 euros">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          {t > 0 && <text x={L - 8} y={y(t) + 4} textAnchor="end">{fmt.int(t)}</text>}
        </g>
      ))}
      {Array.from({ length: Math.floor(xMax / 20) + 1 }, (_, i) => i * 20).map((v) => (
        <text key={v} className={v % 40 ? 'minor' : undefined} x={x(v)} y={H - 6} textAnchor="middle">{v} €</text>
      ))}
      {bins.map((b, i) => {
        const h = (b.count / yMax) * ph;
        const cx = L + i * slot + 1;
        const over = b.from >= PRICE_THRESHOLD;
        const tip = (
          <>
            <b>{b.from} – {b.to} €</b>
            <br />
            {fmt.int(b.count)} offre{b.count > 1 ? 's' : ''}
          </>
        );
        return (
          <g key={b.from}>
            {b.count > 0 && (
              <path
                className="col"
                d={roundedTop(cx, y(b.count), colW, h, Math.min(3, colW / 2, h))}
                fill={over ? 'var(--red)' : 'var(--blue)'}
              />
            )}
            <rect
              className="hit"
              x={L + i * slot}
              y={T}
              width={slot}
              height={ph}
              onMouseMove={(e) => showTip(e, tip)}
              onMouseLeave={hideTip}
            />
          </g>
        );
      })}
      <line x1={x(PRICE_THRESHOLD)} x2={x(PRICE_THRESHOLD)} y1={T - 14} y2={T + ph} stroke="var(--red)" strokeWidth="1.5" />
      <text x={x(PRICE_THRESHOLD) + 6} y={T - 4} style={{ fill: 'var(--red)' }}>{thresholdLabel}</text>
    </svg>
  );
}

/* ---------- Colonnes simples (prix au Go selon le volume) ---------- */

export function Columns({
  items,
  showTip,
  hideTip,
  height = 230,
}: {
  items: { key: string; label: string; value: number; display: string; tip: ReactNode }[];
  showTip: TipFn;
  hideTip: () => void;
  height?: number;
}) {
  const W = 600, H = height, L = 8, R = 8, T = 24, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const yMax = Math.max(...items.map((i) => i.value), 0) * 1.08 || 1;
  const slot = pw / Math.max(items.length, 1);
  const colW = Math.min(44, slot * 0.5);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Prix médian au Go selon le volume du forfait">
      <line className="grid" x1={L} x2={W - R} y1={T + ph} y2={T + ph} />
      {items.map((item, i) => {
        const h = (item.value / yMax) * ph;
        const cx = L + i * slot + (slot - colW) / 2;
        return (
          <g key={item.key}>
            <path className="col" d={roundedTop(cx, T + ph - h, colW, h, Math.min(4, h))} fill="var(--blue)" />
            <text x={cx + colW / 2} y={T + ph - h - 7} textAnchor="middle" style={{ fill: 'var(--ink-2)', fontWeight: 500 }}>
              {item.display}
            </text>
            <text x={cx + colW / 2} y={H - 6} textAnchor="middle">{item.label}</text>
            <rect
              className="hit"
              x={L + i * slot}
              y={T}
              width={slot}
              height={ph}
              onMouseMove={(e) => showTip(e, item.tip)}
              onMouseLeave={hideTip}
            />
          </g>
        );
      })}
    </svg>
  );
}

// Colonne aux coins supérieurs arrondis, posée à plat sur la ligne de base.
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  r = Math.max(0, r);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
