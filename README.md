# Dhan-Panchang

> A financial almanac for rural micro enterprises. Forecasts the next 6 months
> of money events, warns weeks early with a **named cause**, works with **no
> network**, and gets smarter with every entry.

AI-Driven Cash Flow Prediction & Risk Flagging for Rural Micro Enterprises.

---

## What this build contains

The **enterprise-owner experience**, polished and functional, with a real
on-device forecast engine:

| Screen | What it does |
|---|---|
| **Onboarding** | Pick sector + district, opening balance. Or load the Meena demo. |
| **Almanac (Home)** | Status hero + 3 KPIs + the signature **6-month heat-strip** (surplus/tight/deficit weeks with event markers, tap a week for its drivers). |
| **Alerts** | Risk flags, each with a **named cause + gap week + rupee shortfall + a mapped action**. |
| **Diary (Ledger)** | Append-only money diary. Quick add (income/expense, category chips, optional voice). Every entry sharpens the forecast. |
| **What-if** | Sliders (feed price / monsoon / demand / fuel) recompute the forecast **on-device, instantly**, layered on top of live district conditions. |

Plus: **6 languages** (English, हिन्दी, मराठी, தமிழ், తెలుగు, বাংলা) with a live
switcher, and an **online/offline indicator** driving the airplane-mode demo beat.

And the **field-officer experience** (switch role from the  settings sheet):

| Screen | What it does |
|---|---|
| **Triage** | The officer's whole book, sorted by urgency — status dot, cause snippet, time-to-gap, ₹ at risk. Tap for the full profile. |
| **Monitor** | Portfolio KPIs (at-risk / watch / steady), total cash at risk, and **cluster warnings** — cross-enterprise correlated risk ("3 of 3 poultry units in Nashik under feed-price stress → batch the intervention"). |
| **Profile** | Any enterprise's forecast heat-strip + risk panel, from the officer's side. |

The portfolio is 9 calibrated enterprises across 5 sectors and 4 districts.

## The engine (all on-device, no server, no LLM in the numbers)

- **`engine/sectors.ts`** — sector × district priors. Each of the 5 named sectors
  (dairy, poultry, food processing, handicrafts, rural retail) is a calendar of
  probabilistic, shock-sensitive money events. District **Signal Packs** inject
  price/climate deviations (mock, compiled-from-public-sources in production).
- **`engine/forecast.ts`** — the forecast is the **superposition** of these
  events over a baseline across 26 weeks. **Bayesian personalisation** shrinks
  each category from its sector prior toward the owner's own history as entries
  accumulate; **confidence bands** widen when data is sparse and narrow with use.
- **`engine/anomaly.ts`** — two independent signals: (1) **self-anomaly** — the
  enterprise's recent activity vs. its *own* normal ("batch sale down 24% vs your
  usual"); (2) **structural liquidity gap** from the forecast trough, named to the
  dominant district shock. Every flag carries cause + week + amount + action.

The forecast and risk logic stay fully auditable. An LLM layer (not in this build)
would only *narrate* these numbers, never produce them.

## Stack

Vite + React + TypeScript · **shadcn/ui + Tailwind v4** (design system) ·
**Recharts** (cash-flow + portfolio charts) · **Framer Motion** (transitions) ·
**lucide-react** (icons) · self-hosted Plus Jakarta Sans · installable
offline-first PWA (service worker precache) · zero paid infrastructure ·
deploys as static files (GitHub Pages / any static host). Dependency-free i18n
and forecast engine. Fully responsive (mobile bottom-nav + desktop sidebar),
light + dark themes.

## Run it

```bash
npm install
npm run dev      # app on http://localhost:5173
npm run server   # optional: MongoDB sync server on http://localhost:8787
npm run build    # static PWA bundle in dist/
```

## Cloud backup (MongoDB Atlas)

The app is offline-first: the device is the source of truth. When online, it
pushes a structured copy to the sync server (`server/index.mjs`), which stores
it in MongoDB Atlas with JSON-schema validation and indexes:

| Collection | One doc per | Key fields |
|---|---|---|
| `enterprises` | enterprise (device) | name, sector, state/district, opening balance, goal, lang, timestamps |
| `ledger_entries` | money-diary entry | enterpriseId, income/expense, category, amount, weekOffset |
| `signals` | district | latest live shock multipliers + fetch time |

Put `MONGODB_URI` in `.env` (git-ignored - never ship it to the client).
`GET /api/enterprises` is the seed of a live institutional/officer feed.

Tap **"Explore the demo (Meena's poultry)"** on the welcome screen to load the
calibrated Nashik poultry story used in the pitch.

## Mapping to the brief

| Brief requirement | Delivered by |
|---|---|
| Data entry: savings/loans, income, expenses | Diary — append-only vernacular entry, voice-assisted |
| Risk alerts + actionable suggestions | Alerts — named cause, gap week, rupee amount, mapped action |
| 3–6 month cash-flow forecast | 26-week event-superposition engine + heat-strip |
| Sector-specific risk (5 named sectors) | Sector event templates — risk is structural |
| Climate & market risk | Signal Packs inject price/climate deviations; What-if tests them live |
| Works offline / low-network | Everything runs client-side; PWA precache; offline indicator |
| No sensitive personal info | Only self-entered business records + district-level aggregates |
| Multilingual (optional) | 6 Indian languages, live switch |

## Not yet built (next tracks)

SHG/JLG group mode, the Credit Readiness Passport (bank-facing one-pager), and
the online LLM narration layer. See the concept doc for the full roadmap.
