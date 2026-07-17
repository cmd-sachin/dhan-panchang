"""Feature engineering for the cash-flow forecaster.

Builds supervised (features -> net at t+h) rows with two tiers so train.py can
A/B them:
  BASE  - the original v1 feature set
  EXTRA - engineered features added on top

All rolling / expanding stats use PAST-ONLY data (indices < i) to avoid
leakage. Known-future district signals at the target week are legitimate
(the signals are themselves forecastable / published ahead).
"""
import numpy as np
import pandas as pd

HORIZONS = [1, 2, 4, 8, 13]
LAGS = [1, 2, 3, 4, 6, 8]

BASE = (
    ["sector", "district", "woy_sin", "woy_cos", "hist_len", "roll_mean4", "roll_std4"]
    + [f"lag{L}" for L in LAGS]
    + ["horizon", "monsoon", "feed_price", "fuel", "demand"]
)

EXTRA = [
    # richer own-history dynamics
    "roll_mean8", "roll_std8", "roll_min4", "roll_max4", "cv8",
    "momentum", "trend6", "accel",
    # enterprise level & shape (cross-sectional normalisation)
    "ent_mean_hist", "ent_std_hist", "expense_share",
    # covariate dynamics (leading indicators)
    "feed_at_cut", "feed_delta", "monsoon_delta", "fuel_delta", "demand_delta",
    # calendar / domain
    "is_festival", "is_harvest", "weeks_since_peak",
    # interactions
    "horizon_x_vol", "demand_x_horizon",
]

CATEG = ["sector", "district"]


def make_examples(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["enterprise_id", "week"]).copy()
    out = []
    for _, g in df.groupby("enterprise_id", sort=False):
        g = g.reset_index(drop=True)
        net = g["net"].to_numpy(dtype=float)
        inc = g["income"].to_numpy(dtype=float)
        exp = g["expense"].to_numpy(dtype=float)
        for i in range(len(g)):
            if i < max(LAGS):
                continue
            hist = net[:i]
            r4, r8 = net[i - 4:i], net[i - 8:i]
            woy = int(g.loc[i, "week"]) % 52
            roll_mean8 = r8.mean()
            roll_std8 = r8.std()
            base = {
                "sector": g.loc[i, "sector"],
                "district": g.loc[i, "district"],
                "woy_sin": np.sin(2 * np.pi * woy / 52),
                "woy_cos": np.cos(2 * np.pi * woy / 52),
                "hist_len": i,
                "roll_mean4": r4.mean(),
                "roll_std4": r4.std(),
                # --- EXTRA ---
                "roll_mean8": roll_mean8,
                "roll_std8": roll_std8,
                "roll_min4": r4.min(),
                "roll_max4": r4.max(),
                "cv8": roll_std8 / roll_mean8 if roll_mean8 else 0.0,
                "momentum": net[i - 1] - net[i - 4],
                "trend6": (net[i - 1] - net[i - 6]) / 5.0,
                "accel": (net[i - 1] - net[i - 2]) - (net[i - 2] - net[i - 3]),
                "ent_mean_hist": hist.mean(),
                "ent_std_hist": hist.std(),
                "expense_share": exp[i - 4:i].sum() / max(inc[i - 4:i].sum(), 1.0),
                "feed_at_cut": g.loc[i, "feed_price"],
                "is_harvest": 1 if 8 <= woy <= 10 else 0,
                "is_festival": 1 if 14 <= woy <= 16 else 0,
                "weeks_since_peak": i - int(np.argmax(r8)) - (i - 8) if i >= 8 else 0,
            }
            for L in LAGS:
                base[f"lag{L}"] = net[i - L]
            for h in HORIZONS:
                j = i + h
                if j >= len(g):
                    continue
                row = dict(base)
                row["horizon"] = h
                for c in ["monsoon", "feed_price", "fuel", "demand"]:
                    row[c] = g.loc[j, c]
                # covariate deltas cutoff -> target (leading indicators)
                row["feed_delta"] = g.loc[j, "feed_price"] - g.loc[i, "feed_price"]
                row["monsoon_delta"] = g.loc[j, "monsoon"] - g.loc[i, "monsoon"]
                row["fuel_delta"] = g.loc[j, "fuel"] - g.loc[i, "fuel"]
                row["demand_delta"] = g.loc[j, "demand"] - g.loc[i, "demand"]
                row["horizon_x_vol"] = h * base["cv8"]
                row["demand_x_horizon"] = g.loc[j, "demand"] * h
                row["cutoff_week"] = g.loc[i, "week"]
                row["y"] = net[j]
                out.append(row)
    ex = pd.DataFrame(out)
    for col in CATEG:
        ex[col] = ex[col].astype("category")
    return ex
