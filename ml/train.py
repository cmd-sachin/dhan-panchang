"""Train + backtest the cash-flow forecaster, with an A/B on feature engineering.

Model: GLOBAL gradient-boosted regression (HistGradientBoostingRegressor - the
LightGBM-class algorithm). One model across all enterprises → cold-start
friendly. Horizon is a feature (single model forecasts 1..13 weeks). Quantile
loss at 0.1/0.5/0.9 → median + confidence band.

Prints a measured comparison of BASE vs BASE+EXTRA features so the value of the
feature engineering is visible, plus per-horizon skill and permutation
importance of the top features.
"""
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance

from features import make_examples, BASE, EXTRA, CATEG, HORIZONS


def wape(y, p):
    return float(np.sum(np.abs(y - p)) / np.sum(np.abs(y)))


def mae(y, p):
    return float(np.mean(np.abs(y - p)))


def fit_median(X, y, cats):
    m = HistGradientBoostingRegressor(
        loss="quantile", quantile=0.5, learning_rate=0.05, max_iter=500,
        max_depth=6, l2_regularization=1.0, categorical_features=cats,
        random_state=0, early_stopping=True, validation_fraction=0.1,
    )
    m.fit(X, y)
    return m


def main():
    df = pd.read_csv("ml/panel.csv")
    ex = make_examples(df)
    cutoff = df["week"].max() - 12
    tr, te = ex[ex["cutoff_week"] <= cutoff], ex[ex["cutoff_week"] > cutoff]
    ytr, yte = tr["y"].to_numpy(), te["y"].to_numpy()
    print(f"examples {len(ex):,} | train {len(tr):,} | test {len(te):,} | features {len(BASE)}→{len(BASE)+len(EXTRA)}")

    # ---- A/B: BASE features vs BASE+EXTRA ----
    results = {}
    for name, feats in [("BASE (v1)", BASE), ("BASE+EXTRA (v2)", BASE + EXTRA)]:
        cats = [f for f in CATEG if f in feats]
        m = fit_median(tr[feats], ytr, cats)
        p = m.predict(te[feats])
        results[name] = (mae(yte, p), wape(yte, p), feats)
        print(f"  {name:<18} MAE Rs {mae(yte, p):>6,.0f}   WAPE {wape(yte, p):.4f}")

    base_w = results["BASE (v1)"][1]
    v2_w = results["BASE+EXTRA (v2)"][1]
    print(f"\nfeature engineering lift: {(base_w - v2_w) / base_w * 100:.1f}% lower error")

    # ---- naive baselines for context ----
    naive = te["lag1"].to_numpy()
    print(f"  baseline last-week   WAPE {wape(yte, naive):.4f}")

    # ---- full quantile model on the winning feature set ----
    feats = results["BASE+EXTRA (v2)"][2]
    cats = [f for f in CATEG if f in feats]
    band = {}
    for q, key in [(0.1, "lo"), (0.5, "mid"), (0.9, "hi")]:
        m = HistGradientBoostingRegressor(
            loss="quantile", quantile=q, learning_rate=0.05, max_iter=500,
            max_depth=6, l2_regularization=1.0, categorical_features=cats, random_state=0,
        )
        m.fit(tr[feats], ytr)
        band[key] = m.predict(te[feats])
    cover = float(np.mean((yte >= band["lo"]) & (yte <= band["hi"])))
    print(f"\n80% interval coverage (target 0.80): {cover:.3f}")

    print("\nWAPE by horizon (v2 vs last-week):")
    for h in HORIZONS:
        mk = te["horizon"].to_numpy() == h
        if mk.sum() == 0:
            continue
        print(f"  h={h:<3} ours {wape(yte[mk], band['mid'][mk]):.3f}  naive {wape(yte[mk], naive[mk]):.3f}")

    # ---- which features matter (permutation importance, top 10) ----
    mid_model = fit_median(tr[feats], ytr, cats)
    sample = te.sample(min(4000, len(te)), random_state=0)
    imp = permutation_importance(
        mid_model, sample[feats], sample["y"].to_numpy(),
        n_repeats=4, random_state=0, scoring="neg_mean_absolute_error",
    )
    order = np.argsort(imp.importances_mean)[::-1][:10]
    print("\nTop 10 features by permutation importance:")
    for idx in order:
        print(f"  {feats[idx]:<18} {imp.importances_mean[idx]:>8,.1f}")

    json.dump(
        {"base_wape": base_w, "v2_wape": v2_w, "coverage80": cover,
         "n_examples": int(len(ex)), "n_features": len(feats)},
        open("ml/metrics.json", "w"), indent=2,
    )
    print("\nwrote ml/metrics.json")


if __name__ == "__main__":
    main()
