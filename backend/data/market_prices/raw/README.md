# Market Price Raw Data

Place the 6 source Excel files in this directory before running the seed script.

## File names (must match exactly)

| Series | File name |
|--------|-----------|
| `brebis_suitees` | `evolution-du-prix-moyen-des-brebis-suitees-par-grande-region-en-dinar.xlsx` |
| `genisses_pleines` | `evolution-du-prix-moyen-des-genisses-pleines-par-grande-region-en-dinar.xlsx` |
| `vaches_suitees` | `evolution-du-prix-moyen-des-vaches-suitees-par-grande-region-en-dinar.xlsx` |
| `viandes_rouges` | `evolution-du-prix-moyen-de-vente-des-viandes-rouge-en-dinar-par-kilogramme-vif.xlsx` |
| `bovins_suivis` | `Évolution_des_prix_des_bovins_suivis_par_tête__toutes_races_confondues.xls` |
| `vaches_gestantes` | `Évolution_des_prix_des_vaches_gestantes_par_tête.xls` |

## Seeding the database

```bash
cd backend
python scripts/seed_market_prices.py
```

The script will upsert all historical rows into the `market_price_history` table
and print a per-series, per-region row count summary.
