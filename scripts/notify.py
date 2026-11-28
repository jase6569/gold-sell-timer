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
    seen = set()
    for topic, app in [(TOPIC, APP)] + [e for e in EXTRA if e[0]]:
        if topic in seen:
            continue
        seen.add(topic)
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



# =============== lot alerts ===============
# The Gold Trader app (Jase's and Mike's) sends a locked summary of its My gold lots (month, pure grams,
# cost, grams per carat; never customer details) to a hidden ntfy channel worked out from the person's
# private alert code. Only someone with that code can find the channel or read it. Here we read it,
# work out each lot's position at Mastermelt's price, and ping when a lot needs sending.
import hashlib, hmac, base64

def lot_keys(code):
    h = lambda s: hashlib.sha256(s.encode()).digest()
    return {"sync": "gts" + h("sync|" + code).hex()[:28], "lots": "gtl" + h("lots|" + code).hex()[:28],
            "enc": h("enc|" + code), "mac": h("mac|" + code)}

def unseal(k, text):
    if not text.startswith("v1:"):
        return None
    raw = base64.b64decode(text[3:])
    n, ct, tag = raw[:16], raw[16:-32], raw[-32:]
    if not hmac.compare_digest(hmac.new(k["mac"], n + ct, hashlib.sha256).digest(), tag):
        return None
    out = bytearray()
    for i in range(0, len(ct), 32):
        ks = hashlib.sha256(k["enc"] + n + (i // 32).to_bytes(4, "big")).digest()
        out += bytes(a ^ b for a, b in zip(ct[i:i + 32], ks))
    return json.loads(out.decode())

def ntfy_latest(topic):
    with urllib.request.urlopen(f"https://ntfy.sh/{topic}/json?poll=1&since=all", timeout=20) as r:
        msgs = [json.loads(l) for l in r.read().decode().splitlines() if l.strip()]
    msgs = [m for m in msgs if m.get("event") == "message" and m.get("message", "").startswith("v1:")]
    return max(msgs, key=lambda m: m["time"]) if msgs else None

def ntfy_post(topic, body, title=None, priority="default", tags=None, click=None):
    headers = {}
    if title: headers["Title"] = title.encode("utf-8").decode("latin-1", "ignore")
    if priority: headers["Priority"] = priority
    if tags: headers["Tags"] = tags
    if click: headers["Click"] = click
    req = urllib.request.Request(f"https://ntfy.sh/{topic}", data=body.encode("utf-8"), method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status

CT_NAME = {"0.375": "9ct", "0.585": "14ct", "0.75": "18ct", "0.916": "22ct", "0.999": "24ct"}

def bad_week(daily):
    c = [v for _, v in daily[-265:]]
    r = sorted(abs(c[i] / c[i - 5] - 1) * 100 for i in range(5, len(c)))
    return r[int(len(r) * 0.8)] if r else 4.0

def lot_status(cush, tier, bad):
    if cush < 0: return "loss"
    if cush < bad: return "send"
    if tier >= 2: return "lock"
    return "safe"

def money(v):
    return f"£{abs(v):,.0f}"

def week_summary(data, sent_at, to_topic, app, spot_g, pay, state, sid, now):
    """Sunday evening: what you bought, sent and made this week, and what's still unsold."""
    uk = now.replace(tzinfo=dt.timezone.utc).astimezone(ZoneInfo("Europe/London"))
    if uk.weekday() != 6 or uk.hour < 18:
        return
    mon = (uk.date() - dt.timedelta(days=6)).isoformat()
    done = state.setdefault("wsum", {})
    if done.get(sid) == mon:
        return
    wk = data.get("wk")
    if not wk:
        return
    done[sid] = mon
    parts = []
    fresh = wk.get("mon") == mon
    if fresh:
        n, g, pure, cost, margin = wk["b"]
        if n:
            parts.append(f"Bought {n} item{'s' if n != 1 else ''}, {g:g}g ({pure:.1f}g pure) for {money(cost)}"
                         + (f", a margin of {margin:.1f}% on the refiner's price." if margin is not None else "."))
        else:
            parts.append("Nothing bought this week.")
        sn, sg, spure, scost, svalpaid, sval = wk["s"]
        if sn:
            line = f"Sent {sg:g}g to the refiner, about {money(sval)}"
            if scost:
                made = svalpaid - scost
                line += f", roughly {money(made)} {'more' if made >= 0 else 'less'} than you paid for it"
            parts.append(line + ".")
        else:
            parts.append("Nothing sent to the refiner.")
    else:
        parts.append("You haven't opened Gold Trader this week, so this only covers what you're holding.")
    hg, hpure, hpaid, hcost = wk["h"]
    if hg:
        worth = hpure * spot_g * pay
        line = f"Still holding {hg:g}g ({hpure:.1f}g pure), worth about {money(worth)} at today's price"
        if hcost:
            pnl = hpaid * spot_g * pay - hcost
            line += f". It cost {money(hcost)}, so you'd be {'up' if pnl >= 0 else 'down'} {money(pnl)} if you sent it all now"
        parts.append(line + ".")
    else:
        parts.append("No gold left in stock.")
    bk = data.get("bk")
    days = (now - dt.datetime.fromisoformat(bk.replace("Z", "+00:00")).replace(tzinfo=None)).days if bk else None
    if days is None:
        parts.append("Your buy log has never been backed up. Open it and tap Back up now.")
    elif days >= 7:
        parts.append(f"Your buy log was last backed up {days} days ago. Open it and tap Back up now.")
    if fresh and (now.timestamp() - sent_at) > 36 * 3600:
        parts.append("Figures are from the last time you opened the app.")
    if fresh and wk["b"][0]:
        title = f"Your week: bought {money(wk['b'][3])}"
        if wk["s"][0] and wk["s"][3]:
            made = wk["s"][4] - wk["s"][3]
            title += f", {'made' if made >= 0 else 'lost'} {money(made)}"
    else:
        title = "Your week in gold"
    ntfy_post(to_topic, " ".join(parts), title, "low", "calendar", app)
    print("week summary sent")

def run_lot_alerts(code, to_topic, app, tier, daily, state, now):
    k = lot_keys(code)
    msg = ntfy_latest(k["sync"])
    if not msg:
        return
    data = unseal(k, msg["message"])
    if data is None:
        print("lot alerts: couldn't read the locked lot summary")
        return
    # ntfy.sh keeps messages for about 12 hours, so re-send the same locked summary to keep it available
    if now.timestamp() - msg["time"] > 8 * 3600:
        try: ntfy_post(k["sync"], msg["message"], priority="min")
        except Exception as e: print("lot keepalive failed", e)
    spot_g = daily[-1][1] / OZ
    pay = 0.95
    try:
        mm = json.load(open("mastermelt.json"))
        if mm.get("ok") and (now.date() - dt.date.fromisoformat(mm["date"])).days < 5:
            # Mastermelt's rate as a share of the gold price on the day they set it, applied to the latest price
            on_day = [v for d, v in daily if d <= mm["date"]]
            pay = mm["pure_g"] / (on_day[-1] / OZ) if on_day else mm["pure_g"] / spot_g
    except Exception:
        pass
    sid = hmac.new(k["mac"], b"state", hashlib.sha256).hexdigest()[:10]
    try:
        week_summary(data, msg["time"], to_topic, app, spot_g, pay, state, sid, now)
    except Exception as e:
        print("week summary failed", e)
    bad = bad_week(daily)
    prev = state.setdefault("lots", {}).get(sid)
    cur, news = {}, []
    for month, pure_paid, cost, by_carat in data.get("lots", []):
        if not (pure_paid > 0 and cost > 0):
            continue
        be = cost / (pure_paid * pay)
        cush = (spot_g / be - 1) * 100
        st = lot_status(cush, tier, bad)
        lk = hmac.new(k["mac"], ("lot|" + month).encode(), hashlib.sha256).hexdigest()[:8]
        cur[lk] = st
        if prev is not None and st != prev.get(lk) and st in ("send", "lock", "loss"):
            label = dt.date.fromisoformat(month + "-01").strftime("%B %Y")
            grams = ", ".join(f"{w:g}g {CT_NAME.get(c, c)}" for c, w in by_carat.items())
            gain = pure_paid * spot_g * pay - cost
            news.append((st, label, grams, cush, gain, be))
    state["lots"][sid] = cur
    if prev is None:
        n_send = sum(1 for v in cur.values() if v == "send")
        ntfy_post(to_topic, f"You'll get a message when one of your lots should be sent to the refiner. Right now {len(cur)} lot{'s' if len(cur) != 1 else ''} with a price paid, {n_send} to send now. Open My gold for details.",
                  "Lot alerts are on", "default", "white_check_mark", app)
        return
    if not news:
        return
    order = {"send": 0, "lock": 1, "loss": 2}
    news.sort(key=lambda x: order[x[0]])
    lines = []
    for st, label, grams, cush, gain, be in news:
        if st == "send":
            lines.append(f"Send now: {label} ({grams}). Only {cush:.1f}% above break-even. A bad week (about {bad:.1f}%) would turn the +£{gain:,.0f} into a loss.")
        elif st == "lock":
            lines.append(f"Lock it in: {label} ({grams}). +£{gain:,.0f} and gold is in the sell zone.")
        else:
            lines.append(f"Now at a loss: {label} ({grams}). Sending today loses £{-gain:,.0f}. It breaks even if 24ct gets back to £{be:.2f}/g.")
    first = news[0]
    title = {"send": f"Send your {first[1].split()[0]} lot now", "lock": f"Lock in your {first[1].split()[0]} lot",
             "loss": f"Your {first[1].split()[0]} lot is now at a loss"}[first[0]]
    if len(news) > 1:
        title += f" (+{len(news) - 1} more)"
    pr = "high" if first[0] in ("send", "lock") else "default"
    ntfy_post(to_topic, " ".join(lines) + " Open My gold for details.", title, pr, "moneybag", app)
    print("lot alert sent:", title)

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

    # a newly added channel gets a one-off "alerts are on" message (only a scrambled id is saved)
    first_time = "channels" not in state
    known = state.setdefault("channels", [])
    for topic, app in [(TOPIC, APP)] + [e for e in EXTRA if e[0]]:
        cid = hashlib.sha256(("chan|" + topic).encode()).hexdigest()[:10]
        if cid in known:
            continue
        if prev is not None and not first_time:   # channels in use before this feature already had their welcome
            title, body, pr, tags = dealer[bm]
            try:
                ntfy_post(topic, f"Your Gold Trader alerts are on. You'll get a message whenever the call on your stock changes. Right now: {title}. {body}", "Gold Trader alerts are on", "default", "white_check_mark", app)
            except Exception as e:
                print("welcome failed", e)
        known.append(cid)

    # lot alerts: Jase's go to their own channel, Mike's to his usual channel
    for code, to_topic, app in [(TOPIC, None, APP)] + [(e[0], e[0], e[1]) for e in EXTRA if e[0]]:
        try:
            run_lot_alerts(code, to_topic or lot_keys(code)["lots"], app, t, daily, state, now)
        except Exception as e:
            print("lot alerts failed", app, e)

    state.update({"buymode": bm, "tier": t, "ext": round(ext, 2), "price_g": round(g, 2), "checked": now.strftime("%Y-%m-%dT%H:%M:%SZ")})
    json.dump(state, open(STATE, "w"))
    print(f"buymode {bm} tier {t} ext {ext:.1f} mom4 {mom4:.1f} price £{g:.2f}/g")


if __name__ == "__main__":
    main()
