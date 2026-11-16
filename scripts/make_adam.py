"""Rebuild Adam's own copy of the app (adam/index.html) from the main app.

Usage: python scripts/make_adam.py

Adam's copy lives at /gold-sell-timer/adam/. It is the main app with:
  - every file path pointing one folder up (same data, logo and widget),
  - its own saved data on the phone (keys start "ad:"), so it never shares
    My gold, settings or anything else with Jase's app on the same phone,
  - no Buying log, Make money or lot alerts (those stay off: they can't be switched on).
Run it after every change to the main app's index.html.
"""
import re, sys

s = open("index.html").read()

def rep(a, b, count=1):
    global s
    n = s.count(a)
    if n != count:
        sys.exit(f"main app changed, expected {count} of: {a!r}, found {n}")
    s = s.replace(a, b)

# paths: Adam's page sits one folder down
rep('href="favicon.png"', 'href="../favicon.png"')
rep('href="apple-touch-icon.png"', 'href="../apple-touch-icon.png"')
rep('src="logo.png"', 'src="../logo.png"')
s, n = re.subn(r'href="(gold-trader-widget-v[0-9-]+\.apk)"', r'href="../\1"', s)
if n != 1: sys.exit("widget link not found")
rep('fetchJSON("data.json?', 'fetchJSON("../data.json?', 2)
rep('fetchJSON("news.json?', 'fetchJSON("../news.json?', 2)
rep('const MM_URL = "mastermelt.json";', 'const MM_URL = "../mastermelt.json";')

# Adam's own saved data
rep('''const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
''', '''// Adam's app keeps its saved data under its own keys, separate from every other Gold Trader copy.
const SP = "ad:";
const store = {
  get(k){ try { let v = localStorage.getItem(SP + k); if (v === null && !localStorage.getItem(SP + "migrated")) { v = localStorage.getItem(k); } return v; } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(SP + k, v); } catch(e){} },
  del(k){ try { localStorage.removeItem(SP + k); } catch(e){} }
};
// one-off: bring over My gold and settings from the shared app on Adam's phone (never on Jase's phone)
try { if (!localStorage.getItem(SP + "migrated") && localStorage.getItem("buyingLog") === "1") localStorage.setItem(SP + "migrated", "1");
  if (!localStorage.getItem(SP + "migrated")) { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.includes(":") && localStorage.getItem(SP + k) === null) localStorage.setItem(SP + k, localStorage.getItem(k)); } localStorage.setItem(SP + "migrated", "1"); } } catch(e){}
''')

# Buying log, Make money and lot alerts are Jase's only: off for good in Adam's copy
rep('const PRO_ON = () => store.get("buyingLog") === "1";', 'const PRO_ON = () => false;')
s, n = re.subn(r'/\* Buying log: only shown on phones where it has been switched on[^\n]*\n[^\n]*\nif \(store\.get\("buyingLog"\) === "1"\)[^\n]*\n', '', s, flags=re.S)
if n != 1: sys.exit("Buying log switch not found")

left = [m for m in ('href="favicon.png"', 'fetchJSON("data.json', 'buyinglog"') if m in s]
if left: sys.exit("Not fully converted: " + ", ".join(left))
open("adam/index.html", "w").write(s)
print("adam/index.html rebuilt from the main app")
