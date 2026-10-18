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

Les évolutions (« ce mois-ci », « sur un an ») se calculent sur la courbe propre à chaque pays,
interrogée avec des pays de volume proche : sinon un petit pays, écrasé par un gros dans la même
requête, n'a que des valeurs 1, 2 ou 3 et un passage de 1 à 3 s'afficherait « +200 % ».

Si Google refuse une requête (limite de débit), le script s'arrête sans toucher au fichier :
le dashboard garde les dernières données valides et affiche leur date.
"""

import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pytrends.request import TrendReq

OUT = Path(__file__).resolve().parent.parent / 'data' / 'trends.json'
GEO = 'FR'
# Un peu plus d'un an, pour comparer aux mêmes semaines de l'an dernier. Sur une telle durée, Google
# renvoie des données hebdomadaires : en quotidien, il met à 0 les jours à faible volume.
HISTORY_DAYS = 420
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
BASELINE_WEEKS = 8   # comparaison « ce mois-ci » : les semaines juste avant
YEAR_WEEKS = 52      # comparaison « sur un an » : les mêmes semaines, 52 semaines plus tôt
MIN_RAW = 5          # en dessous (valeur brute Google moyenne), une évolution n'est que de l'arrondi
PAUSE = 12           # secondes entre deux requêtes, pour ne pas être bloqué


def timeframe():
    today = datetime.now(timezone.utc).date()
    return f'{today - timedelta(days=HISTORY_DAYS)} {today}'


def fetch(client, terms):
    for attempt in range(3):
        try:
            client.build_payload(terms, timeframe=timeframe(), geo=GEO)
            df = client.interest_over_time()
            if df.empty or any(t not in df for t in terms):
                raise RuntimeError('réponse vide')
            # La semaine en cours est incomplète (souvent à 0) : on l'écarte.
            if 'isPartial' in df:
                df = df[~df['isPartial'].astype(bool)]
            return df
        except Exception as err:  # noqa: BLE001 - toute erreur réseau / 429 est retentée
            wait = 90 * (attempt + 1)
            print(f'  ! {terms} : {type(err).__name__} {err} — nouvel essai dans {wait} s', file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f'échec définitif pour {terms}')


def mean(values):
    return sum(values) / len(values) if values else 0


def window_mean(values):
    """Moyenne d'une période en ignorant les semaines à 0 isolées (trous de données Google).
    Renvoie None s'il reste moins de 3 semaines sur 4 avec des données."""
    data = [x for x in values if x > 0]
    return mean(data) if values and len(data) >= 0.75 * len(values) else None


def ratio(a, b):
    return round(a / b - 1, 3) if b > 0 else None


def main():
    client = TrendReq(hl='fr-FR', tz=-120)
    codes = list(KEYWORDS)

    # 1. Volume comparé entre pays : chaque paquet contient le repère pour une échelle commune.
    others = [c for c in codes if KEYWORDS[c] != ANCHOR]
    batches = [others[i:i + 4] for i in range(0, len(others), 4)]
    interest = {}
    for n, batch in enumerate(batches, 1):
        print(f'[volume {n}/{len(batches)}] {", ".join(batch)}')
        terms = [ANCHOR] + [KEYWORDS[c] for c in batch]
        df = fetch(client, terms)
        anchor_mean = df[ANCHOR].tail(RECENT_WEEKS).mean()
        if anchor_mean <= 0:
            raise RuntimeError('le terme repère est à 0, échelle impossible')
        interest.setdefault('JP', 100.0)
        for c in batch:
            interest[c] = df[KEYWORDS[c]].tail(RECENT_WEEKS).mean() / anchor_mean * 100
        time.sleep(PAUSE)

    # 2. Évolutions : ce sont des rapports sur la courbe propre à chaque pays, donc sans échelle
    #    commune. On regroupe les pays de volume proche pour qu'aucun ne soit écrasé par un plus
    #    gros (Google arrondit chaque requête à des entiers de 0 à 100).
    by_volume = sorted(codes, key=lambda c: -interest[c])
    groups = [by_volume[i:i + 5] for i in range(0, len(by_volume), 5)]
    curves, weeks = {}, None
    for n, group in enumerate(groups, 1):
        print(f'[évolution {n}/{len(groups)}] {", ".join(group)}')
        df = fetch(client, [KEYWORDS[c] for c in group])
        for c in group:
            curves[c] = [float(v) for v in df[KEYWORDS[c]]]
        weeks = [d.strftime('%Y-%m-%d') for d in df.index]
        time.sleep(PAUSE)

    write(interest, curves, weeks)


def write(interest, curves, weeks, fetched_at=None):
    top = max(interest.values()) or 1
    countries = []
    for c in KEYWORDS:
        v = curves[c]
        recent = v[-RECENT_WEEKS:]
        base = v[-(RECENT_WEEKS + BASELINE_WEEKS):-RECENT_WEEKS]
        last_year = v[-(RECENT_WEEKS + YEAR_WEEKS):-YEAR_WEEKS] if len(v) >= RECENT_WEEKS + YEAR_WEEKS else []
        def compare(ref):
            # Fiable seulement avec assez de volume des deux côtés (sinon ce n'est que de l'arrondi).
            a, b = window_mean(recent), window_mean(ref)
            return ratio(a, b) if a is not None and b is not None and min(a, b) >= MIN_RAW else None
        spark_max = max(v[-12:]) or 1
        countries.append({
            'code': c,
            'keyword': KEYWORDS[c],
            'interest': round(interest[c] / top * 100, 1),
            'change': compare(base),
            'yearChange': compare(last_year) if last_year else None,
            'weekly': [round(x / spark_max * 100, 1) for x in v[-12:]],
            # Valeurs brutes Google (0-100 dans la requête du groupe), pour contrôler la fiabilité.
            'raw': [int(x) for x in v],
        })
    countries.sort(key=lambda c: -c['interest'])

    OUT.write_text(json.dumps({
        'fetchedAt': fetched_at or datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': 'Google Trends',
        'geo': GEO,
        'period': {
            'from': weeks[0], 'to': weeks[-1], 'recentWeeks': RECENT_WEEKS, 'baselineWeeks': BASELINE_WEEKS,
            'lastYearFrom': weeks[-(RECENT_WEEKS + YEAR_WEEKS)], 'lastYearTo': weeks[-(YEAR_WEEKS + 1)],
        },
        'anchor': ANCHOR,
        'countries': countries,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'✓ {len(countries)} destinations écrites dans {OUT}')


def recompute():
    """Recalcule les indicateurs à partir des courbes déjà enregistrées, sans interroger Google."""
    old = json.loads(OUT.read_text(encoding='utf-8'))
    start = datetime.strptime(old['period']['from'], '%Y-%m-%d')
    by_code = {c['code']: c for c in old['countries']}
    curves = {code: [float(x) for x in by_code[code]['raw']] for code in KEYWORDS}
    weeks = [(start + timedelta(weeks=i)).strftime('%Y-%m-%d') for i in range(len(next(iter(curves.values()))))]
    interest = {code: by_code[code]['interest'] for code in KEYWORDS}
    write(interest, curves, weeks, old['fetchedAt'])


if __name__ == '__main__':
    try:
        recompute() if '--recompute' in sys.argv else main()
    except Exception as err:  # noqa: BLE001
        print(f'✗ Tendances non mises à jour : {err}. Les données précédentes sont conservées.', file=sys.stderr)
        sys.exit(1)
