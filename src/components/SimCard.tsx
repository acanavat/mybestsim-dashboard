import { fmt } from '@/lib/catalog';

// Carte SIM en 3D (CSS pur) : une face avec la puce, une face bleue avec le
// résumé du catalogue, et des couches empilées qui donnent l'épaisseur.
const LAYERS = [-2, -1, 0, 1, 2];

export default function SimCard({ count, providers, mini = false }: { count: number; providers: number; mini?: boolean }) {
  return (
    <div className={`sim-stage${mini ? ' sim-mini' : ''}`} aria-hidden="true">
      <div className="sim-tilt">
        <div className="sim">
          {LAYERS.map((z) => (
            <div key={z} className="sim-layer" style={{ transform: `translateZ(${z}px)` }} />
          ))}
          <div className="sim-face sim-front">
            <svg className="sim-chip" viewBox="0 0 62 48">
              <defs>
                <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f3d27a" />
                  <stop offset="0.55" stopColor="#d9a93b" />
                  <stop offset="1" stopColor="#b8862a" />
                </linearGradient>
              </defs>
              <rect x="0.5" y="0.5" width="61" height="47" rx="8" fill="url(#gold)" stroke="#a8791f" />
              <g fill="none" stroke="#8a6418" strokeWidth="1.2" opacity="0.75">
                <path d="M0 16h20M0 32h20M42 16h20M42 32h20M20 0v48M42 0v48" />
                <rect x="20" y="12" width="22" height="24" rx="3" />
              </g>
            </svg>
            <span className="sim-tag">eSIM · 4G/5G</span>
            <span className="sim-word">
              MyBest<i>Sim</i>
            </span>
          </div>
          <div className="sim-face sim-back">
            <small>CATALOGUE</small>
            <div>
              <b>{fmt.int(count)}</b>
              <p>offres de {providers} fournisseurs</p>
            </div>
          </div>
        </div>
      </div>
      {!mini && <div className="sim-shadow" />}
    </div>
  );
}
