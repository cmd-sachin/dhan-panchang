# Data sources for training the forecaster

The model's ceiling is data, not features (see the A/B in the README: 21 extra
features added only +0.3% on synthetic data — because synthetic data has no
hidden structure to discover). Real accuracy needs real history. Sources:

## Targets (the thing we predict) — the real unlock
| Source | What | Status |
|---|---|---|
| **App ledgers in MongoDB** | Real weekly income/expense per enterprise | Accumulating now; needs real ISO-week dating in prod |
| **NABARD NAFIS** (All-India Rural Financial Inclusion Survey) | Rural household income/expense/credit | Public reports; request microdata from NABARD |
| **NSSO / MoSPI** consumption & enterprise surveys | Household + unincorporated enterprise finances | Public microdata |
| **SHG e-Shakti** (NABARD) | SHG savings/loan/repayment records | Via NABARD partnership |

## Covariates (the drivers) — mostly already reachable
| Source | Signal | Status |
|---|---|---|
| **Open-Meteo Archive API** | Historical daily rainfall/temp → monsoon | ✅ tested, works, free, no key |
| **Agmarknet (data.gov.in)** | Daily mandi commodity prices → feed/input | ✅ live snapshot works; log daily to build history |
| **PPAC** | Retail fuel prices | Page reachable; scrape/periodic table |
| **NPCI UPI product statistics** | Digital-txn volume → demand proxy | Aggregate/monthly public |
| **IMD** | Rainfall/forecast | Public |
| **Festival calendar** | Diwali/harvest windows | Static, encoded |

## Practical path to real training data
1. **Log covariates daily**: the sync server already fetches Agmarknet + weather
   per district; write a dated snapshot to a `signal_history` collection each
   day → within weeks you have a real covariate time series.
2. **Stamp real dates** on ledger entries (prod), so `from_mongo.py` aggregates
   true weekly nets.
3. **Backfill weather** with the Open-Meteo Archive API for any historical window
   (already verified working).
4. Retrain with `from_mongo.py` → `train.py`; the feature engineering already in
   place should then show real lift.
