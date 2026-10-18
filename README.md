# Catalogue eSIM en chiffres

Tableau de bord des offres eSIM de 18 fournisseurs, construit pour le test technique MyBestSim.

## Ce qu'il affiche

- Nombre total de cartes eSIM, nombre d'offres à plus de 100 €, fourchette de prix, data moyenne par carte, prix moyen
- Répartition des offres par fournisseur
- Bonus : prix médian au Go par fournisseur, distribution des prix, prix au Go selon le volume du forfait, destinations les plus couvertes, tableau comparatif triable
- Filtres par fournisseur, destination, réseau (4G/5G) et durée : tous les chiffres et graphiques se recalculent

## Comment ça marche

```
data/*.csv  ──►  scripts/build-data.mjs  ──►  src/data/catalog.json  ──►  site statique (Next.js)
```

1. `scripts/build-data.mjs` lit **tous** les CSV du dossier `data/`, vérifie les colonnes, la devise, les prix, les durées et l'unicité des SKU, puis écrit un JSON compact. Les lignes invalides sont écartées et listées.
2. Le dashboard (Next.js, export statique) calcule les statistiques dans le navigateur à partir de ce JSON, ce qui permet les filtres instantanés.
3. Le script tourne automatiquement avant chaque `npm run dev` et `npm run build`. Pour mettre à jour : déposer ou remplacer un CSV dans `data/`, pousser sur GitHub, et Vercel redéploie.

## Tendances de recherche (Google Trends)

Chaque nuit, la GitHub Action `.github/workflows/trends.yml` lance `scripts/fetch-trends.py`, qui récupère sur Google Trends les recherches **« voyage + pays »** en France et écrit `data/trends.json`. Le commit déclenche un redéploiement Vercel : l'onglet *Tendances* se met à jour sans intervention.

- **Pourquoi « voyage + pays »** : testé contre « esim + pays » (trop peu de volume, 0 la plupart des semaines pour beaucoup de pays) et le nom du pays seul (pollué par l'actualité).
- **Pays + ville** quand c'est la ville qu'on cherche (« voyage usa + voyage new york », « voyage dubai + voyage emirats »…), avec l'opérateur `+` de Google Trends.
- **Échelle commune** : Google compare au plus 5 termes par requête ; chaque paquet contient « voyage japon » comme repère pour recaler les 12 paquets.
- **Données hebdomadaires** : en quotidien, Google met à 0 les jours à faible volume, ce qui crée de fausses hausses.
- **Robustesse** : si Google refuse la requête, le fichier n'est pas modifié ; le dashboard affiche la date des dernières données valides.

## Contrôle qualité

`npm run qa` (site servi sur `localhost:3011`) ouvre le dashboard dans Chromium à 6 largeurs d'écran et vérifie l'absence d'erreur JavaScript, de texte coupé, de défilement horizontal et de décalage de mise en page lors des clics, ainsi que les parcours principaux.

## Choix de calcul

- **Forfaits illimités** (653 offres, `data_gb` vide) : comptés dans le nombre d'offres et les prix, **exclus** de la data moyenne et du prix au Go, car leur attribuer un volume arbitraire fausserait ces moyennes.
- **Plus de 100 €** : strictement supérieur à 100 €.
- **Prix au Go** : on affiche la médiane plutôt que la moyenne, pour ne pas être tiré par les petits forfaits de 1 Go, très chers au Go.

## Lancer en local

```bash
npm install
npm run dev     # http://localhost:3010
npm run build   # génère le site statique dans out/
```

Graphiques en SVG faits main, sans bibliothèque de graphiques. Palette vérifiée pour le daltonisme, carte SIM 3D en CSS pur (animation désactivée si l'utilisateur préfère réduire les animations).
