"""Build the training panel from REAL accumulated data in MongoDB Atlas.

Run this instead of generate.py once enough real ledger history exists. It
aggregates ledger_entries into weekly net per enterprise, joins the district
signal at each point, and writes the same ml/panel.csv the trainer expects - so
swapping synthetic data for real data is a one-line change.

    MONGODB_URI=... ml/.venv/bin/python ml/from_mongo.py

Note: needs real weekly history per enterprise (many months). The current app
stores entries by relative weekOffset; production should stamp real ISO weeks so
this aggregation is meaningful.
"""
import os
import sys
import pandas as pd

try:
    from pymongo import MongoClient
except ImportError:
    sys.exit("pip install pymongo first (see ml/requirements.txt)")

URI = os.environ.get("MONGODB_URI")
if not URI:
    sys.exit("set MONGODB_URI (see .env)")

client = MongoClient(URI)
db = client["dhan_panchang"]

ent = {e["_id"]: e for e in db.enterprises.find({})}
if not ent:
    sys.exit("no enterprises in MongoDB yet - accumulate real usage first.")

signals = {s["_id"]: s.get("shocks", {}) for s in db.signals.find({})}

rows = []
for e in db.ledger_entries.find({}):
    eid = e["enterpriseId"]
    meta = ent.get(eid)
    if not meta:
        continue
    rows.append(dict(
        enterprise_id=eid,
        sector=meta.get("sector"),
        district=meta.get("districtId"),
        week=int(e.get("weekOffset", 0)),
        signed=(e["amount"] if e["type"] == "income" else -e["amount"]),
    ))

if not rows:
    sys.exit("no ledger entries yet.")

df = pd.DataFrame(rows)
# weekly net per enterprise
weekly = df.groupby(["enterprise_id", "sector", "district", "week"], as_index=False)["signed"].sum()
weekly = weekly.rename(columns={"signed": "net"})

# join the latest district signal (until historical signals are stored)
for c in ["monsoon", "feed_price", "fuel", "demand"]:
    weekly[c] = weekly["district"].map(lambda d: signals.get(d, {}).get(c, 1.0))

weekly["income"] = weekly["net"].clip(lower=0)
weekly["expense"] = (-weekly["net"]).clip(lower=0)
weekly = weekly.sort_values(["enterprise_id", "week"])
weekly.to_csv("ml/panel.csv", index=False)
print(f"wrote ml/panel.csv from MongoDB: {len(weekly):,} rows, "
      f"{weekly.enterprise_id.nunique()} enterprises")
print("If this is sparse, keep accumulating real usage before trusting the model.")
