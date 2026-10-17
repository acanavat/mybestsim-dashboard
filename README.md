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
