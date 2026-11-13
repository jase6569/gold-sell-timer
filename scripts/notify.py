"""Send phone alerts (via ntfy) when the gold sell signal changes, plus a Friday summary.

Uses exactly the same tested rule as the app:
  ext  = % above the 40-week average
  mom4 = % change over the last 4 weeks
  tier 3 strong sell : ext >= 20 and turning down, or ext >= 25
  tier 2 sell zone   : ext >= 15 and turning down, or ext >= 18
  tier 1 getting close: ext >= 10
  tier 0 hold

Buying-in mode (for a shop that buys gold in all the time), same as the app:
  steep slide: ext < -10, stays on until ext recovers above -8
  mode 0 steep slide: keep about a month of buying, send the rest
  mode 1 normal: hold up to your limit
  mode 2 sell zone: sell down to a month of buying, at least a quarter
  mode 3 strong sell: keep only a small reserve
"""
import json
import os
import datetime as dt
import urllib.request
from zoneinfo import ZoneInfo

TOPIC = os.environ.get("NTFY_TOPIC", "").strip()  # private, stored as a GitHub secret
APP = "https://jase6569.github.io/gold-sell-timer/"
# extra private channels that get the same alerts, each opening its own branded app
EXTRA = [(os.environ.get("NTFY_TOPIC_MIKE", "").strip(), "https://jase6569.github.io/dorset-gold-trader/")]
OZ = 31.1034768
STATE = "state.json"


def tier_of(ext, mom4):
    if (ext >= 20 and mom4 < 0) or ext >= 25:
        return 3
    if (ext >= 15 and mom4 < 0) or ext >= 18:
        return 2
    if ext >= 10:
        return 1
    return 0


def slide_flags(ext):
    f = []
    for i, e in enumerate(ext):
        f.append(e is not None and (e < -10 or (i > 0 and f[i - 1] and e < -8)))
    return f


def buy_mode_of(t, slide):
    return 3 if t >= 3 else 2 if t == 2 else 0 if slide else 1


BUY_LINE = [
    "Buying in: steep slide, so don't build stock. Keep about a month's buying and send the rest.",
    "Buying in: fine to hold stock up to your limit.",
    "Buying in: sell down to about a month's buying, at least a quarter.",
    "Buying in: clear most of your stock, keep a small reserve.",
]


def weekly_closes(daily):
    weeks = {}
    for d, v in daily:
        day = dt.date.fromisoformat(d)
        fri = day + dt.timedelta(days=(4 - day.weekday()) % 7)
        weeks[fri] = v
    return [weeks[k] for k in sorted(weeks)]


def send(title, body, priority="default", tags="moneybag"):
    for topic, app in [(TOPIC, APP)] + [e for e in EXTRA if e[0]]:
        req = urllib.request.Request(
            f"https://ntfy.sh/{topic}", data=body.encode("utf-8"), method="POST",
            headers={"Title": title.encode("utf-8").decode("latin-1", "ignore"), "Priority": priority,
                     "Tags": tags, "Click": app},
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                print("sent", r.status, title, "->", app)
        except Exception as e:
            print("send failed", app, e)


DEALER_SHORT = ["Don't build stock: send extra", "Fine to hold stock", "Sell zone: sell stock down", "Strong sell: clear stock"]


def write_widget(p, s40, p4, t, ext, mom4, slide=False, bm=1):
    calls = DEALER_SHORT
    json.dump({
        "updated": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "price_g": round(p / OZ, 2), "s40_g": round(s40 / OZ, 2), "p4_g": round(p4 / OZ, 2),
        "ext": round(ext, 2), "mom4": round(mom4, 2), "tier": t, "slide": bool(slide), "buymode": bm, "call": calls[bm],
        "zone_close_g": round(s40 * 1.10 / OZ, 2), "zone_sell_g": round(s40 * 1.18 / OZ, 2), "zone_strong_g": round(s40 * 1.25 / OZ, 2),
        # ready-made text lines for home-screen widget apps
        "line1": f"Gold 24ct £{p / OZ:.2f}/g",
        "line2": calls[bm],
        "line3": (f"Strong zone from £{s40 * 1.25 / OZ:.2f}/g" if t >= 2 else f"Sell zone from £{s40 * 1.18 / OZ:.2f}/g"),
        "line4": "Updated " + dt.datetime.now(ZoneInfo("Europe/London")).strftime("%d %b %H:%M"),
    }, open("widget.json", "w"))


def main():
    daily = json.load(open("data.json"))["daily"]
    c = weekly_closes(daily)
    p = c[-1]
    s40 = sum(c[-40:]) / 40
    ext = (p / s40 - 1) * 100
    mom4 = (p / c[-5] - 1) * 100
    t = tier_of(ext, mom4)
    exts = [None if i < 39 else (c[i] / (sum(c[i - 39:i + 1]) / 40) - 1) * 100 for i in range(len(c))]
    slide = slide_flags(exts)[-1]
    bm = buy_mode_of(t, slide)
    write_widget(p, s40, c[-5], t, ext, mom4, slide, bm)
    if not TOPIC:
        print("NTFY_TOPIC secret not set, so no alerts sent")
        return
    if os.environ.get("TEST_ALERT") == "true":
        send("Gold Trader test alert",
             f"Your alerts are working. 24ct is £{p / OZ:.2f}/g right now. The sell zone starts at about £{s40 * 1.18 / OZ:.2f}/g.",
             "default", "white_check_mark")
    g = p / OZ
    z18, z25, z10 = s40 * 1.18 / OZ, s40 * 1.25 / OZ, s40 * 1.10 / OZ

    state = {}
    if os.path.exists(STATE):
        state = json.load(open(STATE))
    prev = state.get("tier")
    now = dt.datetime.utcnow()

    # alerts are worded for a gold dealer: how much stock to keep, and when to send it to the refiner
    dealer = {
        3: ("STRONG SELL: clear most of your stock",
            f"24ct £{g:.2f}/g, {ext:.0f}% above its 40-week average. Gold was lower 6 months later 87% of the time from here. Send most of your gold to the refiner now and keep only a small reserve. Open My gold for the grams.",
            "high", "rotating_light,moneybag"),
        2: ("SELL ZONE: sell your stock down",
            f"24ct £{g:.2f}/g, {ext:.0f}% above its 40-week average, so gold is expensive. Send your stock down to about a month's buying, and at least a quarter of what you hold. Open My gold for the grams.",
            "high", "moneybag"),
        1: ("Normal: fine to hold stock",
            f"24ct £{g:.2f}/g. Gold isn't stretched or sliding, so it's fine to hold stock up to your limit. Keep sending the oldest gold first.",
            "default", "white_check_mark"),
        0: ("Steep slide: don't build up stock",
            f"24ct £{g:.2f}/g, {abs(ext):.0f}% below its 40-week average. Keep about a month's buying and send the rest to the refiner, oldest first. Buy in at today's price, not last week's. Open My gold for the grams.",
            "default", "chart_with_downwards_trend"),
    }
    prev_bm = state.get("buymode")
    if prev is None and prev_bm is None:
        title, body, pr, tags = dealer[bm]
        send("Gold Trader alerts are on", f"You'll get a message whenever the call on your stock changes. Right now: {title}. {body}", "default", "white_check_mark")
    elif prev_bm is not None and prev_bm != bm:
        title, body, pr, tags = dealer[bm]
        send(title, body, pr, tags)
    # heads-up when gold starts getting expensive, before the sell zone
    if prev is not None and t == 1 and prev == 0 and bm == 1:
        send("Gold getting expensive: sell zone close",
             f"24ct £{g:.2f}/g. The sell zone starts at about £{z18:.2f}/g. Get ready to send more stock to the refiner.",
             "default", "eyes")

    # Friday evening summary, once per week, after the close
    wk = now.strftime("%G-%V")
    if now.weekday() == 4 and now.hour >= 21 and state.get("summary") != wk:
        where = f"{ext:.0f}% {'above' if ext >= 0 else 'below'} its 40-week average"
        send(f"Weekly gold: {DEALER_SHORT[bm]}",
             f"24ct £{g:.2f}/g ({mom4:+.1f}% over 4 weeks), {where}. {BUY_LINE[bm]} Sell zone from £{z18:.2f}/g. Open My gold for this week's grams.",
             "low", "calendar")
        state["summary"] = wk

    state.update({"buymode": bm, "tier": t, "ext": round(ext, 2), "price_g": round(g, 2), "checked": now.strftime("%Y-%m-%dT%H:%M:%SZ")})
    json.dump(state, open(STATE, "w"))
    print(f"buymode {bm} tier {t} ext {ext:.1f} mom4 {mom4:.1f} price £{g:.2f}/g")


if __name__ == "__main__":
    main()
