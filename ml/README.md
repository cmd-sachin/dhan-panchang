# Dhan-Panchang — forecasting model

The recommended production forecaster: a **global gradient-boosted regression
with quantile loss** (here `sklearn.HistGradientBoostingRegressor`, the same
histogram-boosted-tree algorithm as LightGBM/XGBoost).

## Why this model (not ARIMA / Prophet / LSTM / plain regression)

| Requirement | Why boosted trees win |
|---|---|
| Cold-start: many enterprises, short histories | **One global model** pools across all enterprises → a new unit forecasts from sector/district structure. Per-series models (ARIMA/Prophet/per-series LSTM) can't. |
| Exogenous signals (price, monsoon, fuel, demand, festivals) | Trees ingest arbitrary covariates + interactions natively. |
| Interpretability for credit decisions | Trees + SHAP explain every prediction; deep nets don't. |
| Confidence bands | **Quantile loss** at 0.1/0.5/0.9 gives the band directly. |
| Cheap / offline | Small model; trees can be evaluated on-device in JS. |

Deep learning (Temporal Fusion Transformer, DeepAR, N-HiTS) only pays off at
scale (thousands of enterprises × 12+ months) and costs interpretability.

**Hybrid deployment:** the on-device Bayesian model stays as the cold-start /
offline fallback; this trained model takes over once an enterprise has enough
history.

## Pipeline

```bash
python3 -m venv ml/.venv
ml/.venv/bin/pip install -r ml/requirements.txt

ml/.venv/bin/python ml/generate.py    # synthetic panel (until real data exists)
# — or, from accumulated real data —
MONGODB_URI=... ml/.venv/bin/python ml/from_mongo.py

ml/.venv/bin/python ml/train.py       # train + rolling-origin backtest
```

- **Multi-horizon**: horizon is a feature, so one model forecasts 1–13 weeks.
- **Features**: lagged net, rolling mean/std, week-of-year (sin/cos), history
  length (cold-start signal), sector + district (categorical), known-future
  district signals, horizon.
- **Backtest**: rolling-origin (train early weeks → test the held-out tail),
  compared against last-week and recent-average baselines.

## Result on the synthetic panel (320 enterprises)

| Model | WAPE (error) |
|---|---|
| **Boosted trees (ours)** | **0.077** |
| Baseline: last-week | 0.091 |
| Baseline: recent-average | 0.082 |

Advantage grows with horizon: **+13%** better at 1 week → **+23%** at 8 weeks.
80% interval coverage ≈ 0.76. These prove the *pipeline and relative model
skill*; real-world accuracy requires real accumulated data (`from_mongo.py`).
