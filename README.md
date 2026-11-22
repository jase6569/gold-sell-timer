# Gold Trader · Dorset Gold & Jewellery

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

## Your week and backups

The My gold tab has a **Your week** card: what you bought (with your margin on the refiner's price that day), what you sent to the refiner and roughly what you made on it, and what you're still holding. "I've sent this batch" now records each batch (`sent` in local storage) and takes the right share of the cost off part-sent items.

Every Sunday evening (after 18:00 UK) `notify.py` sends the same summary to the lot alerts channel. It uses the locked summary the app already sends (`wk` and `bk` fields), so customer details still never leave the phone.

The Buy log's **Back up now** saves one file with every record and the My gold list, using the phone's share sheet so it can go straight to Google Drive or email. If there's no backup in the last 7 days, both the Buy log and Gold Trader show a reminder, and the Sunday summary mentions it.

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

## Google reviews (Buy log)

The Buy log can ask customers for a Google review. Requests always go out as **Dorset Gold & Jewellery** (`REV_BIZ` in `buying-log/index.html`), whatever business name is on the receipts. Adam's app has no Buy log, so he never sees it. `buying-log/qrcode.min.js` (MIT licence) draws the QR code.

* **Settings, Google reviews:** paste Dorset Gold & Jewellery's Google review link and edit the message.
* **Each record:** Show QR code (for the customer to scan at the visit), Ask by text, WhatsApp or email, then "They've left a review". Every step goes in the audit trail.
* **Records:** shows how many customers have reviewed, and "Show who to ask" lists customers from the last 30 days who haven't been asked.
* A customer who has already reviewed (matched by phone number or ID number) is never offered another request.

## Branding

This app is branded Dorset Gold & Jewellery (renamed from Dorset Jewellers in November 2026). The Buy log database keeps its old internal name (`dj-buylog`) so no records are lost, and older receipts keep their DJ- numbers. New receipts start DG-. Adam's app in `adam/` keeps the Dorset Jewellers look with its own copies of the logo and icons. The Android widget still shows the old logo until it's rebuilt.
