"""Send phone alerts (via ntfy) when the gold sell signal changes, plus a Friday summary.

Uses exactly the same tested rule as the app:
  ext  = % above the 40-week average
  mom4 = % change over the last 4 weeks
  tier 3 strong sell : ext >= 20 and turning down, or ext >= 25
  tier 2 sell zone   : ext >= 15 and turning down, or ext >= 18
  tier 1 getting close: ext >= 10
  tier 0 hold
"""
import json
import os
import datetime as dt
import urllib.request

TOPIC = os.environ.get("NTFY_TOPIC", "").strip()  # private, stored as a GitHub secret
APP = "https://jase6569.github.io/gold-sell-timer/"
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


def weekly_closes(daily):
    weeks = {}
    for d, v in daily:
        day = dt.date.fromisoformat(d)
        fri = day + dt.timedelta(days=(4 - day.weekday()) % 7)
        weeks[fri] = v
    return [weeks[k] for k in sorted(weeks)]


def send(title, body, priority="default", tags="moneybag"):
    req = urllib.request.Request(
        f"https://ntfy.sh/{TOPIC}", data=body.encode("utf-8"), method="POST",
        headers={"Title": title.encode("utf-8").decode("latin-1", "ignore"), "Priority": priority,
                 "Tags": tags, "Click": APP},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        print("sent", r.status, title)


def write_widget(p, s40, p4, t, ext, mom4):
    calls = ["Hold", "Hold: getting close", "Sell about a quarter", "Strong sell: sell more"]
    json.dump({
        "updated": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "price_g": round(p / OZ, 2), "s40_g": round(s40 / OZ, 2), "p4_g": round(p4 / OZ, 2),
        "ext": round(ext, 2), "mom4": round(mom4, 2), "tier": t, "call": calls[t],
        "zone_close_g": round(s40 * 1.10 / OZ, 2), "zone_sell_g": round(s40 * 1.18 / OZ, 2), "zone_strong_g": round(s40 * 1.25 / OZ, 2),
    }, open("widget.json", "w"))


def main():
    daily = json.load(open("data.json"))["daily"]
    c = weekly_closes(daily)
    p = c[-1]
    s40 = sum(c[-40:]) / 40
    ext = (p / s40 - 1) * 100
    mom4 = (p / c[-5] - 1) * 100
    t = tier_of(ext, mom4)
    write_widget(p, s40, c[-5], t, ext, mom4)
    if not TOPIC:
        print("NTFY_TOPIC secret not set, so no alerts sent")
        return
    g = p / OZ
    z18, z25, z10 = s40 * 1.18 / OZ, s40 * 1.25 / OZ, s40 * 1.10 / OZ

    state = {}
    if os.path.exists(STATE):
        state = json.load(open(STATE))
    prev = state.get("tier")
    now = dt.datetime.utcnow()

    msgs = {
        3: ("STRONG SELL: sell more gold now",
            f"24ct £{g:.2f}/g, {ext:.0f}% above its 40-week average"
            + (" and turning down" if mom4 < 0 else "")
            + ". Historically gold was lower 6 months later 87% of the time from here. Sell another good portion.", "high", "rotating_light,moneybag"),
        2: ("SELL ZONE: sell about a quarter",
            f"24ct £{g:.2f}/g, {ext:.0f}% above its 40-week average. Sell around a quarter now and more if it reaches £{z25:.2f}/g.", "high", "moneybag"),
        1: ("Gold getting close to the sell zone",
            f"24ct £{g:.2f}/g. Still rising, so hold for now. The sell zone starts at about £{z18:.2f}/g.", "default", "eyes"),
        0: ("Sell zone over: hold",
            f"24ct £{g:.2f}/g. Gold has come back below the sell zone. Hold the rest. The sell zone starts at about £{z18:.2f}/g.", "default", "white_check_mark"),
    }

    if prev is None:
        send("Gold Trader alerts are on",
             f"You'll get a message when gold nears or enters the sell zone. Right now: 24ct £{g:.2f}/g, sell zone from about £{z18:.2f}/g.",
             "default", "white_check_mark")
    elif t > prev:
        title, body, pr, tags = msgs[t]
        send(title, body, pr, tags)
    elif t < prev and prev >= 2 and t <= 1:
        title, body, pr, tags = msgs[0]
        send(title, body, pr, tags)

    # Friday evening summary, once per week, after the close
    wk = now.strftime("%G-%V")
    if now.weekday() == 4 and now.hour >= 21 and state.get("summary") != wk:
        call = ["Hold: not in the sell zone", "Hold: rising, sell zone getting close",
                "Sell zone: sell about a quarter", "Strong sell zone: sell more"][t]
        where = f"{ext:.0f}% {'above' if ext >= 0 else 'below'} its 40-week average"
        send(f"Weekly gold: {call}",
             f"24ct £{g:.2f}/g ({mom4:+.1f}% over 4 weeks), {where}. Get ready £{z10:.2f}/g · Sell zone £{z18:.2f}/g · Strong £{z25:.2f}/g.",
             "low", "calendar")
        state["summary"] = wk

    state.update({"tier": t, "ext": round(ext, 2), "price_g": round(g, 2), "checked": now.strftime("%Y-%m-%dT%H:%M:%SZ")})
    json.dump(state, open(STATE, "w"))
    print(f"tier {t} ext {ext:.1f} mom4 {mom4:.1f} price £{g:.2f}/g")


if __name__ == "__main__":
    main()
