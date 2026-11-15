"""Read Mastermelt's public trade scrap counter prices (hallmarked gold, £ per gram).

Writes mastermelt.json so the app's money figures match what Mastermelt pays.
Mastermelt sets these once a day for its trade counter, so this keeps the last
good reading if the page can't be read, and refuses figures that don't add up.
"""
import json, re, html, datetime as dt, urllib.request

URL = "https://www.mastermeltgroup.com/scrap-prices/"
FINE = {9: 0.375, 14: 0.585, 18: 0.75, 22: 0.916, 24: 1.0}
OUT = "mastermelt.json"


def main():
    try:
        old = json.load(open(OUT))
    except Exception:
        old = {}
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (gold-trader; daily price check)"})
        raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
        text = re.sub(r"\s+", " ", text)
        prices = {}
        for ct in FINE:
            m = re.search(rf"\b{ct}\s*ct\s*HM\b[^£]{{0,80}}£\s*([\d,]+\.\d{{2}})", text, re.I)
            if m:
                prices[ct] = float(m.group(1).replace(",", ""))
        if 9 not in prices or 18 not in prices:
            raise ValueError(f"couldn't find the 9ct/18ct prices, found {prices}")
        base = prices.get(24) or prices[9] / FINE[9]
        # every carat must agree with the same pure-gold price, or the page has changed shape
        for ct, p in prices.items():
            if abs(p / FINE[ct] - base) / base > 0.02:
                raise ValueError(f"{ct}ct £{p} doesn't fit a pure price of £{base:.2f}")
        if not 40 < base < 400:
            raise ValueError(f"pure price £{base:.2f}/g looks wrong")
        d = re.search(r"Last update:?\s*([A-Za-z]{3,9}\.? \d{1,2},? \d{4})", text)
        day = None
        if d:
            for fmt in ("%b %d %Y", "%B %d %Y", "%b %d, %Y", "%B %d, %Y"):
                try:
                    day = dt.datetime.strptime(d.group(1).replace(".", ""), fmt).date().isoformat(); break
                except ValueError:
                    pass
        out = {"source": URL, "date": day or dt.date.today().isoformat(),
               "checked": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
               "pure_g": round(base, 4), "prices": {f"{k}ct": v for k, v in sorted(prices.items())}, "ok": True}
        print("Mastermelt:", out["date"], out["prices"])
    except Exception as e:
        print("Mastermelt prices not updated:", e)
        if not old:
            return
        out = dict(old, ok=False, error=str(e)[:200],
                   checked_failed=dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z")
    json.dump(out, open(OUT, "w"), indent=1)


if __name__ == "__main__":
    main()
