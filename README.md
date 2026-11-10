# Gold Trader · Dorset Jewellers

A phone app that tells you when to sell gold, using UK prices only.

Live: https://jase6569.github.io/gold-sell-timer/

## What's in here

| File | What it does |
|---|---|
| `index.html` | The whole app: page, styles and logic in one file |
| `data.json` | Daily UK gold prices (£ per troy oz) since 2004. Updated automatically |
| `news.json` | Latest gold headlines and upcoming US/UK announcements. Updated automatically |
| `state.json` | The alert system's memory (last signal sent) |
| `scripts/fetch_data.py` | Downloads prices (gold in USD ÷ GBP/USD) |
| `scripts/fetch_news.py` | Downloads headlines and the economic calendar |
| `scripts/notify.py` | Sends phone alerts via ntfy (topic `gold-trader-jase-2b05ab99`) |
| `.github/workflows/update.yml` | Runs the three scripts every 3 hours on GitHub |

## The sell signal

Tested on 22 years of UK gold prices. `ext` = % above the 40-week average, `mom4` = % change over 4 weeks.

| Zone | Rule |
|---|---|
| Strong sell | ext ≥ 20 and mom4 < 0, or ext ≥ 25 |
| Sell (a quarter) | ext ≥ 15 and mom4 < 0, or ext ≥ 18 |
| Getting close | ext ≥ 10 |
| Hold | otherwise |

The same rule lives in `index.html` (`tierOf`) and `scripts/notify.py` (`tier_of`). If you change one, change both.

## Working on it in VS Code

```bash
git clone https://github.com/jase6569/gold-sell-timer.git
cd gold-sell-timer
code .
```

Run it locally (it needs a local server to load `data.json`):

```bash
python -m http.server 8000
```

Then open http://localhost:8000

Test the alert logic without sending anything:

```bash
python -c "import sys; sys.path.insert(0,'scripts'); import notify; notify.send=lambda *a,**k: print('WOULD SEND:', a[0]); notify.STATE='/tmp/state.json'; notify.main()"
```

## Publishing changes

Pushing to `main` updates the live app within about a minute.

The bot commits fresh data every 3 hours, so always pull before you start:

```bash
git pull
```
