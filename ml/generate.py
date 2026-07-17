"""Synthesise a realistic panel of rural micro-enterprise weekly cash flow.

Matches the app's domain (5 sectors, per-district covariates) and, crucially,
the SHAPE of the real problem: many enterprises, each with a SHORT history,
sharing sector/district structure and driven by exogenous signals. This is the
data the training pipeline learns from until real ledger history accumulates in
MongoDB (train.py can read from Mongo instead - see --source).
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)

SECTORS = {
    #                base_in base_out  seasonal_amp  sensitivities (to covariates, on NET)
    "dairy":          (2600,  1400,    0.10,  dict(monsoon=+0.30, feed_price=-0.25, fuel=-0.10, demand=+0.20)),
    "poultry":        (2200,   900,    0.28,  dict(monsoon=+0.15, feed_price=-0.45, fuel=-0.15, demand=+0.55)),
    "food_processing":(3000,  1400,    0.22,  dict(monsoon=+0.15, feed_price=-0.35, fuel=-0.25, demand=+0.60)),
    "handicrafts":    (900,    400,    0.45,  dict(monsoon=+0.20, feed_price=-0.05, fuel=-0.15, demand=+0.80)),
    "rural_retail":   (3500,  2600,    0.20,  dict(monsoon=+0.35, feed_price=-0.10, fuel=-0.30, demand=+0.50)),
}
DISTRICTS = ["nashik", "pune", "ludhiana", "guntur", "coimbatore",
             "jaipur", "indore", "lucknow", "ahmedabad", "mysuru"]

N_ENTERPRISES = 320
WEEKS = 78            # ~18 months of weekly history
START = pd.Timestamp("2025-01-06")


def district_covariates():
    """Time-varying per-district signals (index ~1.0). Shared across a district
    so the model can learn cross-enterprise, covariate-driven structure."""
    cov = {}
    for d in DISTRICTS:
        t = np.arange(WEEKS)
        woy = (t % 52)
        # monsoon: seasonal hump (weeks ~22-38) + district phase + noise
        monsoon = 1.0 + 0.18 * np.sin(2 * np.pi * (woy - 18) / 52) + RNG.normal(0, 0.05, WEEKS)
        # feed/commodity price: slow drift + shocks
        feed = 1.0 + np.cumsum(RNG.normal(0, 0.01, WEEKS)) + RNG.normal(0, 0.03, WEEKS)
        feed = np.clip(feed, 0.8, 1.35)
        fuel = 1.0 + np.cumsum(RNG.normal(0, 0.006, WEEKS))
        fuel = np.clip(fuel, 0.9, 1.2)
        demand = 1.0 + 0.10 * np.sin(2 * np.pi * (woy - 40) / 52) + RNG.normal(0, 0.04, WEEKS)
        cov[d] = dict(monsoon=monsoon, feed_price=feed, fuel=fuel, demand=demand)
    return cov


def build():
    cov = district_covariates()
    rows = []
    for eid in range(N_ENTERPRISES):
        sector = RNG.choice(list(SECTORS))
        district = RNG.choice(DISTRICTS)
        base_in, base_out, amp, sens = SECTORS[sector]
        scale = RNG.uniform(0.6, 1.6)          # enterprise size
        skill = RNG.normal(1.0, 0.12)          # enterprise-level effect
        # each enterprise starts recording at a random week (short history!)
        start_wk = RNG.integers(0, WEEKS - 20)
        ar = 0.0
        c = cov[district]
        for t in range(start_wk, WEEKS):
            woy = t % 52
            season = 1.0 + amp * np.sin(2 * np.pi * (woy - RNG.integers(0, 8)) / 52)
            income = base_in * scale * skill * season
            expense = base_out * scale * season
            net = income - expense
            # covariate effects on net
            eff = 0.0
            for k, w in sens.items():
                eff += w * (c[k][t] - 1.0)
            net *= (1.0 + eff)
            ar = 0.55 * ar + RNG.normal(0, 0.06)   # autocorrelated shock
            net *= (1.0 + ar)
            rows.append(dict(
                enterprise_id=f"e{eid:04d}", sector=sector, district=district,
                week=t, date=START + pd.Timedelta(weeks=int(t)),
                income=round(income, 1), expense=round(expense, 1), net=round(net, 1),
                monsoon=round(c["monsoon"][t], 4), feed_price=round(c["feed_price"][t], 4),
                fuel=round(c["fuel"][t], 4), demand=round(c["demand"][t], 4),
            ))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = build()
    df.to_csv("ml/panel.csv", index=False)
    print(f"wrote ml/panel.csv: {len(df):,} rows, "
          f"{df.enterprise_id.nunique()} enterprises, "
          f"median history {int(df.groupby('enterprise_id').size().median())} weeks")
