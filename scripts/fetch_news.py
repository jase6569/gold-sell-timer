"""Gather gold news headlines and this/next week's major economic events.

Writes news.json for the Gold Trader app. Each headline is scored for whether
it points to gold rising (+) or falling (-), using the drivers professional
gold traders watch: interest rates, the dollar, bond yields, safe-haven demand,
central bank buying and fund flows.
"""
import json
import re
import datetime as dt
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

UA = {"User-Agent": "Mozilla/5.0 (gold-trader-news)"}

FEEDS = [
    "https://news.google.com/rss/search?q=gold+price+when:3d&hl=en-GB&gl=GB&ceid=GB:en",
    "https://news.google.com/rss/search?q=gold+bullion+market+when:3d&hl=en-GB&gl=GB&ceid=GB:en",
]

# (pattern, weight, driver label)
BULL = [
    (r"rate cuts?|cuts? rates|cutting rates|dovish|easing cycle", 2, "Interest rate cuts expected (good for gold)"),
    (r"safe[- ]haven|haven demand", 2, "Safe-haven buying"),
    (r"central banks? (buy|bought|buying|add|purchas)", 2, "Central banks buying gold"),
    (r"(dollar|greenback|usd) (falls?|fell|slips?|slid|weakens?|weaker|drops?|retreats?|eases?)|weaker dollar", 2, "Weaker US dollar"),
    (r"yields? (falls?|fell|drops?|slips?|ease)", 1, "Falling bond yields"),
    (r"geopolitic|tensions?|conflict|war\b|escalat|sanction|tariff", 1, "Geopolitical or trade tension"),
    (r"record high|all[- ]time high|fresh high|multi[- ](week|month) high", 2, "Gold making new highs"),
    (r"gold(?: prices?| futures| spot)?\s+(?:\w+\s+){0,2}(rall(y|ies|ied)|jumps?|jumped|surges?|surged|soars?|soared|climbs?|climbed|rebounds?|rebounded|gains?|gained|rises?|rose|higher|spikes?|hits? .*high)\b", 1, "Price rising"),
    (r"inflows?|etf buying|strong demand|demand (picks up|rises|jumps)", 1, "Investor buying"),
]
BEAR = [
    (r"rate (hike|rise|increase)s?|raise rates|raising rates|hawkish|higher for longer", 2, "Interest rate rises expected (bad for gold)"),
    (r"(dollar|greenback|usd) (rises?|rose|gains?|gained|strengthens?|firms?|climbs?|jumps?)|stronger dollar|strong dollar|lifts? (the )?dollar|lifting (the )?dollar|boosts? (the )?dollar|(dollar|yields) and (yields|dollar) (rise|rose|climb|gain)", 2, "Stronger US dollar"),
    (r"yields? (rise|rose|climb|jump|surge|higher|above|hit)|lifting dollar and yields|(higher|rising|surging) yields", 1, "Rising bond yields"),
    (r"hot (us )?inflation|inflation (tops|beats|hotter)|cpi (tops|beats|hotter)|fed (rate )?hike", 2, "Hot inflation means rates stay high (bad for gold)"),
    (r"gold(?: prices?| futures| spot)?\s+(?:\w+\s+){0,2}(falls?|fell|drops?|dropped|slides?|slid|slumps?|slumped|tumbles?|tumbled|plunges?|plunged|sinks?|sank|retreats?|dips?|dipped|lower|declines?|declined|eases?|eased|dives?|dived|crash(es)?|crashed|loses|lost|sheds?|shed)\b", 1, "Price falling"),
    (r"sell[- ]?off|liquidat|profit[- ]taking|outflows?", 2, "Investors selling"),
    (r"lowest|\blows?\b|multi[- ](week|month) low|year low", 1, "Gold at fresh lows"),
    (r"risk[- ]on|stocks rally|equities rally|ceasefire|peace deal|de-?escalat", 1, "Calmer markets reduce safe-haven demand"),
]


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def score(title):
    t = title.lower()
    s, drivers = 0, []
    for pat, w, label in BULL:
        if re.search(pat, t):
            s += w
            drivers.append(["+", label])
    for pat, w, label in BEAR:
        if re.search(pat, t):
            s -= w
            drivers.append(["-", label])
    return s, drivers


def headlines():
    seen, items = set(), []
    for url in FEEDS:
        try:
            root = ET.fromstring(get(url))
        except Exception as e:
            print("feed failed", url, e)
            continue
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            link = it.findtext("link") or ""
            src = it.findtext("source") or ""
            if " - " in title and src and title.endswith(src):
                title = title[: -len(src) - 3].strip()
            key = title.lower()[:70]
            if "gold" not in key or key in seen or re.search(r"\bstocks?\b|shares|miner|mining|supply|etf|jewellery|jewelry|egr", key):
                continue
            seen.add(key)
            try:
                when = parsedate_to_datetime(it.findtext("pubDate")).astimezone(dt.timezone.utc)
            except Exception:
                continue
            s, drivers = score(title)
            items.append({
                "title": title, "source": src, "link": link,
                "date": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "score": s, "drivers": drivers,
            })
    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:30]


def events():
    out = []
    for week in ("thisweek", "nextweek"):
        try:
            data = json.loads(get(f"https://nfs.faireconomy.media/ff_calendar_{week}.json"))
        except Exception as e:
            print("calendar failed", week, e)
            continue
        for ev in data:
            if ev.get("impact") != "High" or ev.get("country") not in ("USD", "GBP"):
                continue
            out.append({
                "title": ev.get("title"), "country": ev.get("country"),
                "date": ev.get("date"), "forecast": ev.get("forecast") or "",
                "previous": ev.get("previous") or "",
            })
    now = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=12)
    keep = []
    for e in out:
        try:
            if dt.datetime.fromisoformat(e["date"]) >= now:
                keep.append(e)
        except Exception:
            pass
    keep.sort(key=lambda e: e["date"])
    return keep[:12]


def main():
    news = headlines()
    total = sum(n["score"] for n in news)
    tally = {}
    for n in news:
        for sign, label in n["drivers"]:
            tally[(sign, label)] = tally.get((sign, label), 0) + 1
    top = sorted(tally.items(), key=lambda kv: -kv[1])[:6]
    out = {
        "updated": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "netScore": total,
        "count": len(news),
        "bullish": sum(1 for n in news if n["score"] > 0),
        "bearish": sum(1 for n in news if n["score"] < 0),
        "drivers": [{"sign": k[0], "label": k[1], "count": v} for k, v in top],
        "headlines": news,
        "events": events(),
    }
    with open("news.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(news)} headlines, net {total}, {len(out['events'])} events")


if __name__ == "__main__":
    main()
