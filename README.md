# Cream City Sports Cards — H1 2026 Breakdown

[![Deploy to GitHub Pages](https://github.com/dude-r/ebayccsc/actions/workflows/deploy.yml/badge.svg)](https://github.com/dude-r/ebayccsc/actions/workflows/deploy.yml)

**▶ Live site: https://dude-r.github.io/ebayccsc/** &nbsp;·&nbsp; [Story summary](https://dude-r.github.io/ebayccsc/#/summary)

A React + Vite implementation of the **CCSC H1 2026 Full Breakdown** dashboard
and its companion **Story** summary, built from the Claude Design handoff
prototypes (kept for reference under `design/`).

Every figure is computed from the pre-reconciled H1 2026 dataset, derived from
Cream City Sports Cards' eBay transaction ledger, orders report, listing-quality
report, and Jun 26 YTD traffic report. No backend, no invented numbers.

The report is **password-protected**: the site ships only encrypted data and
decrypts it in the browser once the viewer enters the password (see
[Password protection](#password-protection)).

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
npm run data       # regenerate + re-encrypt the dataset (build:data → encrypt)
```

## Password protection

The dashboard is gated. Only `public/ccsc-data.enc.json` (AES-256-GCM ciphertext,
PBKDF2-derived key) is committed and deployed — **no plaintext financials ship**
in the repo or the JS bundle. On load, the site shows a password screen; the
correct password decrypts the data in the browser (Web Crypto) and the report
renders. A wrong password can't decrypt anything.

**Set / change the password** (do this before sharing the link):

```bash
SITE_PASSWORD='your-strong-password' npm run encrypt
git add public/ccsc-data.enc.json && git commit -m "Rotate report password" && git push
```

That re-encrypts the blob with the new password and redeploys. The password is
never stored in the repo or the deployed site.

Notes / limits:
- It's **one shared password** — anyone you give it to can view; there's no
  per-person access or logout, and it can't be revoked short of rotating it.
- A weak password can be brute-forced offline against the downloaded blob, so
  pick a strong one. (PBKDF2 at 250k iterations slows that down.)
- For real per-person logins (revocable, logged), put the site behind Cloudflare
  Access on a custom domain instead.

## Data & privacy

The dataset flows through a scrub + encrypt pipeline, none of which commits
plaintext data to this public repo:

1. Your raw eBay-derived dataset lives untracked at `raw/ccsc-data-source.js`.
2. `npm run build:data` (`scripts/build-data.mjs`) scrubs buyer PII — drops every
   `city`/`state` field and the buyer `orders[]` table, masks eBay order ids to
   their last 4 digits — and writes the scrubbed data to `raw/` (also untracked).
3. `npm run encrypt` (`scripts/encrypt-data.mjs`) encrypts that into
   `public/ccsc-data.enc.json`, the only data form that is committed/deployed.

`npm test` enforces the ledger reconciliation invariants and that the shipped
blob is opaque ciphertext with no PII; CI runs it on every push and PR.

## Structure

```
src/
  main.jsx                    # router + entry, wrapped in the password gate
  styles.css                  # global palette, fonts, hover/focus treatments
  lib/
    crypto.js                 # in-browser fetch + AES-GCM decrypt of the data
    dataContext.js            # React context + useData() for the unlocked data
    format.js                 # usd / usd2 / signed currency helpers
    costModel.js              # acquisition-cost model + labels
  components/
    PasswordGate.jsx          # password screen; decrypts + provides data
    SectionHeader.jsx         # numbered section header
    CostModelControl.jsx      # on-page cost-model picker (replaces prototype "Tweaks")
    CardDetailModal.jsx       # per-card eBay-style order breakdown
  pages/
    FullBreakdown.jsx         # the full dashboard
    Story.jsx                 # the narrative summary
public/
  ccsc-data.enc.json          # encrypted dataset (the only data that ships)
scripts/
  build-data.mjs              # scrub PII → raw/ (untracked)
  encrypt-data.mjs            # encrypt scrubbed data → public/ccsc-data.enc.json

design/                       # original Claude Design handoff (reference only)
  README.md                   # handoff notes
  chats/                      # design conversation transcripts
  project/                    # the .dc.html prototypes + runtime (no raw data —
                              # the source eBay reports carry buyer PII and are
                              # kept out of this repo; see "Data & privacy")
```

## Typography

Uses Fira Sans (text) and Fira Code (all numbers, tabular figures) from Google
Fonts, matching the design. Falls back to `system-ui` if the font host is
unreachable.
