// Gold Trader offline support: lets the team app and Buy log open with no signal.
// Everything is "network first": with signal you always get the newest version and prices,
// and the copy saved here is only used when there's no signal (or it's too slow).
// Adam's app (adam/) is left completely alone.
const CACHE = "gt-offline-v1";
const CORE = ["./", "index.html", "sync.js?v=15", "coins.js?v=1", "team.js?v=4", "keep.js?v=1", "offer.js?v=2", "manifest.json",
  "icon.png", "logo.png", "favicon.png", "apple-touch-icon.png", "data.json", "news.json", "mastermelt.json", "widget.json",
  "buying-log/", "buying-log/index.html", "buying-log/qrcode.min.js", "shop/", "shop/index.html", "shop/manifest.json",
  "https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"];
const SLOW_MS = 4000;   // weak signal: after this long, use the saved copy instead of waiting

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("gt-offline-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;                                   // saving, syncing and scanning go straight through
  if (url.origin === self.location.origin){
    if (url.pathname.includes("/adam/")) return;                      // Adam's app: untouched
    if (!url.pathname.startsWith(new URL("./", self.location).pathname)) return;
    if (/\.apk$/.test(url.pathname)) return;
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.hostname === "unpkg.com") e.respondWith(cacheFirst(req));    // chart library never changes (fixed version)
  // live price feeds: straight through; the app shows the last saved price if they fail
});

async function networkFirst(req){
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  const saved = () => cache.match(req, {ignoreSearch: true}).then(r => r || (req.mode === "navigate" ? cache.match("index.html") : undefined));
  try {
    return await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error("slow")), SLOW_MS))]);
  } catch(e){
    const r = await saved();
    if (r) return r;
    return net;                                                       // nothing saved yet: keep waiting for the network
  }
}
async function cacheFirst(req){
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
  return res;
}
