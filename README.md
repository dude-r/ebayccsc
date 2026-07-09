# Cream City Sports Cards — H1 2026 Breakdown

[![Deploy to GitHub Pages](https://github.com/dude-r/ebayccsc/actions/workflows/deploy.yml/badge.svg)](https://github.com/dude-r/ebayccsc/actions/workflows/deploy.yml)

**▶ Live site: https://dude-r.github.io/ebayccsc/** &nbsp;·&nbsp; [Story summary](https://dude-r.github.io/ebayccsc/#/summary)

A React + Vite implementation of the **CCSC H1 2026 Full Breakdown** dashboard
and its companion **Story** summary, built from the Claude Design handoff
prototypes (kept for reference under `design/`).

Every figure is computed from the pre-reconciled H1 2026 dataset
(`src/data/ccsc-data.js`), which was derived from Cream City Sports Cards'
eBay transaction ledger, orders report, listing-quality report, and Jun 26 YTD
traffic report. No backend, no invented numbers.

## Pages

| Route       | Page             | What it shows |
| ----------- | ---------------- | ------------- |
| `/`         | Full Breakdown   | Month-by-month ledger, Q1-vs-Q2, all 112 cards (search / filter / sort) with a per-card eBay-style order-detail modal, and the traffic story. |
| `/#/summary`| Story            | Narrative "how the first half went" summary with the bottom line, where every dollar went, the January spike, top cards, fixed-cost drag, the visibility gap, and three moves for H2. |

The two pages cross-link (uses `HashRouter`, so deep links work on any static
host with no server config).

## The cost model

eBay's reports never record what you *paid* to acquire each card, so **profit
is modeled**, not measured. The **Cost model** control on the Full Breakdown
page lets you choose the assumption — Net after fees (hard numbers only),
Flat $/card, % of sale price, or By price band — and every "modeled profit"
figure updates live. Drop in real per-card costs later and it becomes exact.

## Develop

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # production build → dist/
npm run preview    # serve the production build
npm test           # reconciliation + privacy tests (Vitest)
npm run build:data # regenerate src/data/ccsc-data.js from design/project/
```

## Data & privacy

`src/data/ccsc-data.js` is **generated** by `scripts/build-data.mjs` from the
canonical dataset in `design/project/`. The build step scrubs buyer PII —
it drops every `city`/`state` field and the unused buyer `orders[]` table, and
masks eBay order ids to their last 4 digits — so no customer data ships in this
public repo. `npm test` enforces both the ledger reconciliation invariants and
the no-PII guarantee, and CI runs it on every push and PR.

## Structure

```
src/
  main.jsx                    # router + entry
  styles.css                  # global palette, fonts, hover/focus treatments
  data/ccsc-data.js           # reconciled dataset (generated; do not hand-edit)
  lib/
    format.js                 # usd / usd2 / signed currency helpers
    costModel.js              # acquisition-cost model + labels
  components/
    SectionHeader.jsx         # numbered section header
    CostModelControl.jsx      # on-page cost-model picker (replaces prototype "Tweaks")
    CardDetailModal.jsx       # per-card eBay-style order breakdown
  pages/
    FullBreakdown.jsx         # the full dashboard
    Story.jsx                 # the narrative summary

design/                       # original Claude Design handoff (reference only)
  README.md                   # handoff notes
  chats/                      # design conversation transcripts
  project/                    # the .dc.html prototypes, source reports, raw data
```

## Typography

Uses Fira Sans (text) and Fira Code (all numbers, tabular figures) from Google
Fonts, matching the design. Falls back to `system-ui` if the font host is
unreachable.
