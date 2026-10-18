"""Récupère sur Google Trends l'intérêt des Français pour chaque destination du catalogue
et écrit data/trends.json. Lancé chaque jour par .github/workflows/trends.yml.

Choix de méthode (testés avant d'écrire ce script) :
- On mesure « voyage + pays » : « esim + pays » a trop peu de volume en France (0 la plupart
  des semaines pour beaucoup de pays) et le nom du pays seul est pollué par l'actualité.
- Pour les pays surtout recherchés par leur ville principale, on additionne pays + ville
  avec l'opérateur « + » de Google Trends (ex. « voyage usa + voyage new york »).
- La France est exclue : un voyageur français n'a pas besoin d'eSIM en France.
- Google Trends compare au plus 5 termes par requête, sur une échelle relative de 0 à 100.
  Chaque paquet contient donc le même terme repère (« voyage japon ») pour remettre tous
  les paquets sur une échelle commune.

Si Google refuse une requête (limite de débit), le script s'arrête sans toucher au fichier :
le dashboard garde les dernières données valides et affiche leur date.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from pytrends.request import TrendReq

OUT = Path(__file__).resolve().parent.parent / 'data' / 'trends.json'
GEO = 'FR'
TIMEFRAME = 'today 12-m'  # hebdomadaire : en quotidien, Google met à 0 les jours à faible volume
ANCHOR = 'voyage japon'

KEYWORDS = {
    'AE': 'voyage dubai + voyage emirats',
    'AR': 'voyage argentine',
    'AT': 'voyage autriche',
    'AU': 'voyage australie',
    'BE': 'voyage belgique',
    'BR': 'voyage bresil',
    'CA': 'voyage canada',
    'CH': 'voyage suisse',
    'CL': 'voyage chili',
    'CN': 'voyage chine',
    'CO': 'voyage colombie',
    'CZ': 'voyage prague + voyage republique tcheque',
    'DE': 'voyage allemagne',
    'DO': 'voyage republique dominicaine + voyage punta cana',
    'EG': 'voyage egypte',
    'ES': 'voyage espagne',
    'GB': 'voyage angleterre + voyage londres',
    'GR': 'voyage grece',
    'HR': 'voyage croatie',
    'ID': 'voyage indonesie + voyage bali',
    'IE': 'voyage irlande',
    'IL': 'voyage israel',
    'IN': 'voyage inde',
    'IT': 'voyage italie',
    'JO': 'voyage jordanie',
    'JP': ANCHOR,
    'KE': 'voyage kenya',
    'KR': 'voyage coree',
    'MA': 'voyage maroc',
    'MX': 'voyage mexique',
    'MY': 'voyage malaisie',
    'NG': 'voyage nigeria',
    'NL': 'voyage amsterdam + voyage pays bas',
    'NO': 'voyage norvege',
    'NZ': 'voyage nouvelle zelande',
    'PE': 'voyage perou',
    'PH': 'voyage philippines',
    'PL': 'voyage pologne',
    'PT': 'voyage portugal',
    'QA': 'voyage qatar',
    'SA': 'voyage arabie saoudite',
    'SE': 'voyage suede',
    'SG': 'voyage singapour',
    'TH': 'voyage thailande',
    'TR': 'voyage turquie',
    'TZ': 'voyage tanzanie + voyage zanzibar',
    'US': 'voyage usa + voyage etats unis + voyage new york',
    'VN': 'voyage vietnam',
    'ZA': 'voyage afrique du sud',
}

RECENT_WEEKS = 4     # période « en ce moment »
BASELINE_WEEKS = 8   # période de comparaison, juste avant
PAUSE = 12           # secondes entre deux requêtes, pour ne pas être bloqué


def fetch(client, terms):
    for attempt in range(3):
        try:
            client.build_payload(terms, timeframe=TIMEFRAME, geo=GEO)
            df = client.interest_over_time()
            if df.empty or ANCHOR not in df:
                raise RuntimeError('réponse vide')
            # La semaine en cours est incomplète (souvent à 0) : on l'écarte.
            if 'isPartial' in df:
                df = df[~df['isPartial'].astype(bool)]
            return df
        except Exception as err:  # noqa: BLE001 - toute erreur réseau / 429 est retentée
            wait = 60 * (attempt + 1)
            print(f'  ! {terms[1:]} : {type(err).__name__} {err} — nouvel essai dans {wait} s', file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f'échec définitif pour {terms}')


def main():
    client = TrendReq(hl='fr-FR', tz=-120)
    others = [(code, kw) for code, kw in KEYWORDS.items() if kw != ANCHOR]
    batches = [others[i:i + 4] for i in range(0, len(others), 4)]

    series = {}  # code -> liste hebdomadaire, en % de la moyenne du repère
    weeks = None
    for n, batch in enumerate(batches, 1):
        terms = [ANCHOR] + [kw for _, kw in batch]
        print(f'[{n}/{len(batches)}] {", ".join(code for code, _ in batch)}')
        df = fetch(client, terms)
        anchor_mean = df[ANCHOR].mean()
        if anchor_mean <= 0:
            raise RuntimeError('le terme repère est à 0, échelle impossible')
        scale = 100 / anchor_mean
        series.setdefault('JP', [round(v * scale, 2) for v in df[ANCHOR]])
        for code, kw in batch:
            series[code] = [round(v * scale, 2) for v in df[kw]]
        weeks = [d.strftime('%Y-%m-%d') for d in df.index]
        time.sleep(PAUSE)

    countries = []
    for code, values in series.items():
        recent = values[-RECENT_WEEKS:]
        base = values[-(RECENT_WEEKS + BASELINE_WEEKS):-RECENT_WEEKS]
        recent_mean = sum(recent) / len(recent)
        base_mean = sum(base) / len(base) if base else 0
        weekly = values[-12:]
        countries.append({
            'code': code,
            'keyword': KEYWORDS[code],
            'interest': recent_mean,
            'change': (recent_mean / base_mean - 1) if base_mean > 0 else None,
            'weekly': weekly,
        })

    top = max(c['interest'] for c in countries) or 1
    for c in countries:
        c['interest'] = round(c['interest'] / top * 100, 1)
        c['weekly'] = [round(v / top * 100, 1) for v in c['weekly']]
        if c['change'] is not None:
            c['change'] = round(c['change'], 3)
    countries.sort(key=lambda c: -c['interest'])

    OUT.write_text(json.dumps({
        'fetchedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': 'Google Trends',
        'geo': GEO,
        'period': {'from': weeks[0], 'to': weeks[-1], 'recentWeeks': RECENT_WEEKS, 'baselineWeeks': BASELINE_WEEKS},
        'anchor': ANCHOR,
        'countries': countries,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'✓ {len(countries)} destinations écrites dans {OUT}')


if __name__ == '__main__':
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(f'✗ Tendances non mises à jour : {err}. Les données précédentes sont conservées.', file=sys.stderr)
        sys.exit(1)
