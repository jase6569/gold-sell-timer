"""Fetch daily gold prices in GBP and write data.json for the Gold Sell Timer app.

Runs in GitHub Actions. Gold in USD (COMEX GC=F) is converted to GBP with
GBPUSD=X closes on the same day, giving a daily GBP per troy ounce series.
"""
import json
import datetime as dt
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (gold-sell-timer)"}


def yahoo_daily(symbol, rng="max"):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range={rng}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    closes = res["indicators"]["quote"][0]["close"]
    out = {}
    for t, c in zip(ts, closes):
        if c is None:
            continue
        day = dt.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d")
        out[day] = c
    return out


def main():
    gold = yahoo_daily("GC=F")
    fx = yahoo_daily("GBPUSD=X")
    days = sorted(gold)
    series = []
    last_fx = None
    fx_days = sorted(fx)
    i = 0
    for d in days:
        while i < len(fx_days) and fx_days[i] <= d:
            last_fx = fx[fx_days[i]]
            i += 1
        if last_fx:
            series.append([d, round(gold[d] / last_fx, 2)])
    out = {
        "updated": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "unit": "GBP per troy ounce",
        "daily": series,
    }
    with open("data.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(series)} days, last {series[-1]}")


if __name__ == "__main__":
    main()
