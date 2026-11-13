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
| `scripts/notify.py` | Sends phone alerts via ntfy. The topic is private and stored as the `NTFY_TOPIC` repository secret, never in the code |
| `.github/workflows/update.yml` | Runs the three scripts every hour on GitHub |

## The sell signal

Tested on 22 years of UK gold prices. `ext` = % above the 40-week average, `mom4` = % change over 4 weeks.

| Zone | Rule |
|---|---|
| Strong sell | ext ≥ 20 and mom4 < 0, or ext ≥ 25 |
| Sell (a quarter) | ext ≥ 15 and mom4 < 0, or ext ≥ 18 |
| Getting close | ext ≥ 10 |
| Hold | otherwise |

The same rule lives in `index.html` (`tierOf`) and `scripts/notify.py` (`tier_of`). If you change one, change both.

## Buying-in mode (My gold tab)

For a shop that buys gold in all the time. You enter how much you buy in a month and the most stock you want to hold (in months of buying). Each week it says how many grams of each carat to send to the refiner, oldest first, and an "I've sent this batch" button takes them off the list.

| Mode | When | Keep at most |
|---|---|---|
| Steep slide | ext < −10 (stays on until ext > −8) | 1 month of buying |
| Normal | anything else below the sell zone | your limit (default 2 months) |
| Sell zone | tier 2 | 1 month of buying, and sell at least a quarter |
| Strong sell | tier 3 | a quarter of stock, at most half a month of buying |

Evidence (UK prices 2004–2026, 6 months later): from −10% to +18% against the 40-week average, gold was lower only 26–30% of the time, so holding stock up to a limit has usually paid. Below −10% there are only two past slides: 2013 kept falling 10–15%, 2021 recovered. That's too uncertain to build stock on.

Same rule in `index.html` (`slideFlags`, `buyModeOf`) and `scripts/notify.py` (`slide_flags`, `buy_mode_of`). The phone alerts tell you when a steep slide starts or ends, and the Friday summary includes the buying-in line.

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
python -c "import sys; sys.path.insert(0,'scripts'); import notify; notify.TOPIC='test'; notify.send=lambda *a,**k: print('WOULD SEND:', a[0]); notify.STATE='/tmp/state.json'; notify.main()"
```

## Publishing changes

Pushing to `main` updates the live app within about a minute.

The bot commits fresh data every hour, so always pull before you start:

```bash
git pull
```
