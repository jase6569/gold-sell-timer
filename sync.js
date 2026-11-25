// Dorset Gold & Jewellery team sync.
// Shares My gold (stock, buys, sent batches), the visit diary, cash, shared prices and the Buy log
// (records, photos and business settings) between everyone who has joined with the business passphrase.
//
// Everything is encrypted on the phone (AES-256-GCM, key made from the passphrase) before it leaves,
// so the server only ever holds scrambled data. The passphrase itself is never stored or sent:
// the phone keeps a locked key it can't export, plus a login token derived from the passphrase.
//
// Each item syncs on its own, and the newest change to an item wins, so two people can work at once.
// Changes made offline wait in a queue and go up next time there's signal.
(function(){
'use strict';
const SYNC_URL = "https://dg-sync.maximus6569.workers.dev";   // the team sync Worker (see sync-worker/README.md)

const LS = window.localStorage, P = "dgs:";
const ARRAYS = ["stock", "buys", "sent", "visits", "cash", "sales", "customers", "safebags", "forsale", "staff", "till", "shopcfg", "stockchecks"];         // lists in localStorage, synced item by item
const SCALARS = ["refiner", "ownPct", "pmM", "buyin"];               // shared settings: refiner price, margin, buying-in
const BL_SHARED = ["biz", "addr", "phone", "prefix", "retain", "revLink", "revMsg", "icoDone", "icoNum", "dpEmail"];   // Buy log settings everyone shares
const BL_DB = "dj-buylog";
const enc = new TextEncoder(), dec = new TextDecoder();
const rawGet = k => LS.getItem(k);
const origSet = Storage.prototype.setItem, origRemove = Storage.prototype.removeItem;
const rawSet = (k, v) => origSet.call(LS, k, v);
let applying = false;
const jget = (k, d) => { try { const v = rawGet(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const jset = (k, v) => rawSet(k, JSON.stringify(v));
const nowISO = () => new Date().toISOString();
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 16);
const me = () => rawGet(P + "me") || "";
// the person actually using the device right now (staff sign-in on a shared shop computer), for the activity log
const actor = () => { try { return sessionStorage.getItem(P + "actor") || me(); } catch(e){ return me(); } };
const joined = () => !!(SYNC_URL && rawGet(P + "tok") && me());
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const sha = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ---------- small IndexedDB helpers ---------- */
function idb(name, ver, upgrade){
  return new Promise((res, rej) => { const r = indexedDB.open(name, ver); r.onupgradeneeded = () => upgrade(r.result); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
let syncDB, blDB;
const sdb = async () => syncDB || (syncDB = await idb("dgsync", 1, d => { d.createObjectStore("kv"); d.createObjectStore("photos"); }));
const bdb = async () => blDB || (blDB = await idb(BL_DB, 1, d => { if (!d.objectStoreNames.contains("records")) d.createObjectStore("records", {keyPath: "id"}); if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); }));
const sGet = async (store, k) => rq((await sdb()).transaction(store).objectStore(store).get(k));
const sDel = async (store, k) => rq((await sdb()).transaction(store, "readwrite").objectStore(store).delete(k));
const sPut = async (store, k, v) => rq((await sdb()).transaction(store, "readwrite").objectStore(store).put(v, k));
const bGet = async (store, k) => rq((await bdb()).transaction(store).objectStore(store).get(k));
const bAll = async () => rq((await bdb()).transaction("records").objectStore("records").getAll());
const bPutRec = async rec => rq((await bdb()).transaction("records", "readwrite").objectStore("records").put(rec));
const bDelRec = async id => rq((await bdb()).transaction("records", "readwrite").objectStore("records").delete(id));
const bPutKV = async (k, v) => rq((await bdb()).transaction("kv", "readwrite").objectStore("kv").put(v, k));

/* ---------- keys and encryption ---------- */
// Capitals, extra spaces and a stray space at the end don't matter, so phones that auto-capitalise still match
const normPass = p => String(p || "").normalize("NFKC").replace(/[\u2018\u2019]/g, "'").trim().replace(/\s+/g, " ").toLowerCase();
async function deriveKey(pass){
  pass = normPass(pass);
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name: "PBKDF2", salt: enc.encode("dgj-enc-v1"), iterations: 210000, hash: "SHA-256"}, base, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]);
}
const tokenFor = pass => sha("dgj-auth|" + normPass(pass));
let keyCache = null;
const theKey = async () => keyCache || (keyCache = await sGet("kv", "key"));
async function seal(obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv}, await theKey(), enc.encode(JSON.stringify(obj))));
  const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12); return b64(all);
}
async function unseal(s){
  const all = unb64(s);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name: "AES-GCM", iv: all.subarray(0, 12)}, await theKey(), all.subarray(12))));
}

/* ---------- the queue of local changes waiting to go up ---------- */
const queue = () => jget(P + "q", {});
function enqueue(id, del){ if (!joined() && !enqueue.force) return; const q = queue(); q[id] = {at: nowISO(), del: del ? 1 : 0, by: actor()}; jset(P + "q", q); schedulePush(); }

/* ---------- lists in localStorage: give every item an id, spot what changed ---------- */
function onArrayWrite(key, val){
  let arr; try { arr = JSON.parse(val); } catch(e){ return; }
  if (!Array.isArray(arr)) return;
  let touched = false;
  arr.forEach(x => { if (x && typeof x === "object"){ if (!x._id){ x._id = rid(); touched = true; } if (!x._who && me()){ x._who = me(); touched = true; } } });
  if (touched) rawSet(key, JSON.stringify(arr));
  const sh = jget(P + "sh:" + key, {}), next = {};
  arr.forEach(x => { if (!x || !x._id) return; const s = JSON.stringify(x); next[x._id] = s; if (sh[x._id] !== s) enqueue("a:" + key + ":" + x._id); });
  Object.keys(sh).forEach(id => { if (!(id in next)) enqueue("a:" + key + ":" + id, true); });
  jset(P + "sh:" + key, next);
}
Storage.prototype.setItem = function(k, v){
  if (this !== LS || applying || !joined()) return origSet.call(this, k, v);
  if (SCALARS.includes(k)){ const old = rawGet(k); origSet.call(this, k, v); if (old !== String(v)) enqueue("s:" + k); return; }
  origSet.call(this, k, v);
  if (ARRAYS.includes(k)) onArrayWrite(k, String(v));
};
Storage.prototype.removeItem = function(k){
  origRemove.call(this, k);
  if (this === LS && !applying && joined()){ if (SCALARS.includes(k)) enqueue("s:" + k); if (ARRAYS.includes(k)) onArrayWrite(k, "[]"); }
};

/* ---------- Buy log records: photos travel separately, once each ---------- */
const isData = s => typeof s === "string" && s.startsWith("data:");
async function splitPhotos(rec){
  const r = JSON.parse(JSON.stringify(rec)), refs = [];
  const ref = async src => { if (!isData(src)) return src; const h = await sha(src); await sPut("photos", h, src); refs.push(h); return "dgph:" + h; };
  for (const p of (r.idPhotos || [])) p.src = await ref(p.src);
  for (const p of (r.lotPhotos || [])) p.src = await ref(p.src);
  for (const it of (r.items || [])) it.photos = await Promise.all((it.photos || []).map(ref));
  if (r.signature) r.signature = await ref(r.signature);
  return {r, refs};
}
async function joinPhotos(r){
  const get = async src => (typeof src === "string" && src.startsWith("dgph:")) ? ((await sGet("photos", src.slice(5))) || src) : src;
  for (const p of (r.idPhotos || [])) p.src = await get(p.src);
  for (const p of (r.lotPhotos || [])) p.src = await get(p.src);
  for (const it of (r.items || [])) it.photos = await Promise.all((it.photos || []).map(get));
  if (r.signature) r.signature = await get(r.signature);
  return r;
}

/* ---------- build what goes up ---------- */
async function payloadFor(id){
  const [kind, ...rest] = id.split(":");
  if (kind === "a"){ const key = rest[0], iid = rest.slice(1).join(":"); return (jget(key, []).find(x => x && x._id === iid)) || null; }
  if (kind === "s"){ const k = rest.join(":"); return {v: rawGet(k)}; }
  if (kind === "r"){ const rec = await bGet("records", rest.join(":")); if (!rec) return null; const {r, refs} = await splitPhotos(rec); refs.forEach(h => { const q = queue(); if (!q["p:" + h] && !sentPhotos().includes(h)) { q["p:" + h] = {at: "2000-01-01T00:00:00.000Z", del: 0}; jset(P + "q", q); } }); return r; }
  if (kind === "p"){ const v = await sGet("photos", rest.join(":")); return v ? {v} : null; }
  if (kind === "b"){ const s = (await bGet("kv", "settings")) || {}; const o = {}; BL_SHARED.forEach(k => { if (k in s) o[k] = s[k]; }); return o; }
  return null;
}
const sentPhotos = () => jget(P + "sentph", []);

let pushing = false, pushTimer = null;
function schedulePush(){ clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(), 2000); }
async function post(path, body){
  const r = await fetch(SYNC_URL.replace(/\/$/, "") + path, {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + rawGet(P + "tok")}, body: JSON.stringify(body)});
  let j = {}; try { j = await r.json(); } catch(e){}
  if (!r.ok) { const e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
  return j;
}
async function push(){
  for (let round = 0; round < 50; round++){
    const q = queue();
    // photos first, so a record never arrives before its pictures
    const ids = Object.keys(q).sort((a, b) => (a[0] === "p" ? 0 : 1) - (b[0] === "p" ? 0 : 1)).slice(0, 60);
    if (!ids.length) return;
    const docs = [], snap = {}; let size = 0;
    for (const id of ids){
      if (size > 1_500_000) break;   // keep each upload small, well inside Cloudflare's limits
      const e = q[id]; snap[id] = e.at;
      const data = e.del ? null : await payloadFor(id);
      const del = e.del || data == null;
      const sealed = del ? null : await seal(data);
      size += sealed ? sealed.length : 0;
      docs.push({id, at: id[0] === "p" ? "2000-01-01T00:00:00.000Z" : e.at, who: e.by || me(), del: del ? 1 : 0, data: sealed});
    }
    // payloadFor may have queued photos that aren't in this batch: hold the records back until those have gone up
    const q2 = queue(), waiting = Object.keys(q2).some(k => k[0] === "p" && !(k in snap));
    const send = waiting ? docs.filter(d => d.id[0] !== "r") : docs;
    if (!send.length) continue;
    await post("/push", {docs: send});
    const after = queue(), sp = sentPhotos();
    send.forEach(d => { if (after[d.id] && after[d.id].at === snap[d.id]) delete after[d.id]; if (d.id[0] === "p") sp.push(d.id.slice(2)); });
    jset(P + "q", after); jset(P + "sentph", sp.slice(-5000));
  }
}

/* ---------- bring down other people's changes ---------- */
async function pull(collectIds){
  let since = +(rawGet(P + "rev") || 0), changed = {arrays: new Set(), records: false, settings: false};
  for (let round = 0; round < 200; round++){
    const res = await post("/pull", {since});
    const q = queue();
    // photos first within a page
    const docs = res.docs.slice().sort((a, b) => (a.id[0] === "p" ? 0 : 1) - (b.id[0] === "p" ? 0 : 1));
    for (const d of docs){
      const mine = q[d.id];
      if (mine && mine.at > d.at){ if (collectIds) collectIds.add(d.id); continue; }   // our own newer change is still waiting to go up
      let data = null;
      if (!d.del){ try { data = await unseal(d.data); } catch(e){ continue; } }       // locked with a different passphrase: ignore
      if (collectIds) collectIds.add(d.id);
      await apply(d.id, d.del, data, changed);
      if (mine){ const q2 = queue(); delete q2[d.id]; jset(P + "q", q2); }
    }
    since = res.rev; rawSet(P + "rev", String(since));
    if (!res.more) break;
  }
  return changed;
}
async function apply(id, del, data, changed){
  const [kind, ...rest] = id.split(":");
  applying = true;
  try {
    if (kind === "a"){
      const key = rest[0], iid = rest.slice(1).join(":");
      if (!ARRAYS.includes(key)) return;
      const arr = jget(key, []), i = arr.findIndex(x => x && x._id === iid), sh = jget(P + "sh:" + key, {});
      if (del){ if (i >= 0) arr.splice(i, 1); delete sh[iid]; }
      else { if (i >= 0) arr[i] = data; else arr.push(data); sh[iid] = JSON.stringify(data); }
      jset(key, arr); jset(P + "sh:" + key, sh); changed.arrays.add(key);
    } else if (kind === "s"){
      const k = rest.join(":"); if (!SCALARS.includes(k)) return;
      if (del || data.v == null) origRemove.call(LS, k); else rawSet(k, data.v);
      changed.arrays.add(k);
    } else if (kind === "p"){
      if (del) { await sDel("photos", rest.join(":")); return; }
      if (!del && data && data.v) { await sPut("photos", rest.join(":"), data.v); const sp = sentPhotos(); sp.push(rest.join(":")); jset(P + "sentph", sp.slice(-5000)); }
    } else if (kind === "r"){
      const recId = rest.join(":");
      if (del) await bDelRec(recId); else await bPutRec(await joinPhotos(data));
      changed.records = true;
    } else if (kind === "b"){
      if (del) return;
      const s = (await bGet("kv", "settings")) || {};
      BL_SHARED.forEach(k => { if (k in data) s[k] = data[k]; });
      await bPutKV("settings", s); changed.settings = true;
    }
  } finally { applying = false; }
}

/* ---------- one full sync ---------- */
let running = null;
function setStatus(o){ const s = Object.assign(jget(P + "st", {}), o); jset(P + "st", s); window.dispatchEvent(new CustomEvent("dgsync-status", {detail: s})); }
async function syncNow(){
  if (!joined()) return;
  if (running) return running;
  running = (async () => {
    try {
      const changed = await pull();
      await push();
      setStatus({ok: nowISO(), err: "", pending: Object.keys(queue()).length});
      if (changed.arrays.size || changed.records || changed.settings) window.dispatchEvent(new CustomEvent("dgsync-applied", {detail: {arrays: [...changed.arrays], records: changed.records, settings: changed.settings}}));
    } catch(e){
      setStatus({err: e.status === 401 ? "The business passphrase doesn't match the server. Leave the team and join again." : (navigator.onLine === false ? "No signal. Changes are saved and will go up later." : "Couldn't reach the team server. Changes are saved and will go up later."), pending: Object.keys(queue()).length});
    }
    running = null;
  })();
  return running;
}

/* ---------- joining ---------- */
async function serverCode(pass){ return sha(await tokenFor(pass)); }
async function join(pass, who, importOld){
  if (!SYNC_URL) throw new Error("The team server address hasn't been added to the app yet.");
  pass = normPass(pass); who = String(who || "").trim();
  if (pass.length < 12) throw new Error("The passphrase needs to be at least 12 characters. Use four or five random words.");
  if (!who) throw new Error("Choose who you are.");
  const tok = await tokenFor(pass);
  const r = await fetch(SYNC_URL.replace(/\/$/, "") + "/pull", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + tok}, body: JSON.stringify({since: 999999999})});
  if (r.status === 401) throw new Error("That passphrase doesn't match the one set on the team server.");
  if (!r.ok) throw new Error("Couldn't reach the team server. Check your signal and try again.");
  keyCache = await deriveKey(pass); await sPut("kv", "key", keyCache);
  rawSet(P + "tok", tok); rawSet(P + "me", who); rawSet(P + "rev", "0"); jset(P + "q", {}); jset(P + "sentph", []);
  rawSet("buyingLog", "1");   // the Buy log and Make money are part of the team app
  if (importOld) await importOldApp();
  // bring everyone else's data down first, then send up whatever only this phone had
  const seen = new Set();
  await pull(seen);
  enqueue.force = true;
  try {
    for (const key of ARRAYS){
      const arr = jget(key, []);
      let touched = false; arr.forEach(x => { if (x && typeof x === "object"){ if (!x._id){ x._id = rid(); touched = true; } if (!x._who){ x._who = who; touched = true; } } });
      if (touched) rawSet(key, JSON.stringify(arr));
      const sh = {}; arr.forEach(x => { if (x && x._id){ sh[x._id] = JSON.stringify(x); if (!seen.has("a:" + key + ":" + x._id)) enqueue("a:" + key + ":" + x._id); } });
      jset(P + "sh:" + key, sh);
    }
    for (const k of SCALARS) if (rawGet(k) != null && !seen.has("s:" + k)) enqueue("s:" + k);
    for (const rec of await bAll()){ if (!seen.has("r:" + rec.id)){ if (!rec._who){ rec._who = rec.staff || who; await bPutRec(rec); } enqueue("r:" + rec.id); } }
    if (!seen.has("b:settings") && await bGet("kv", "settings")) enqueue("b:settings");
  } finally { enqueue.force = false; }
  await syncNow(); startLoop();
  window.dispatchEvent(new CustomEvent("dgsync-applied", {detail: {arrays: ARRAYS.concat(SCALARS), records: true, settings: true}}));
}
// Mike's earlier app on this phone kept its data under "dg:" and in its own Buy log database
async function importOldApp(){
  let n = 0;
  for (const key of ["stock", "buys", "sent"]){
    const old = jget("dg:" + key, []); if (!old.length) continue;
    const cur = jget(key, []), have = new Set(cur.map(x => JSON.stringify(Object.assign({}, x, {_id: 0, _who: 0}))));
    old.forEach(x => { if (!have.has(JSON.stringify(Object.assign({}, x, {_id: 0, _who: 0})))) { cur.push(x); n++; } });
    rawSet(key, JSON.stringify(cur));
  }
  try {
    const old = await idb("dg-buylog", 1, d => { d.createObjectStore("records", {keyPath: "id"}); d.createObjectStore("kv"); });
    const recs = await rq(old.transaction("records").objectStore("records").getAll());
    for (const rec of recs){ if (!(await bGet("records", rec.id))){ await bPutRec(rec); n++; } }
    const s = await rq(old.transaction("kv").objectStore("kv").get("settings"));
    if (s && s.revLink){ const cur = (await bGet("kv", "settings")) || {}; if (!cur.revLink){ cur.revLink = s.revLink; await bPutKV("settings", cur); } }
    old.close();
  } catch(e){}
  return n;
}
async function leave(){
  for (const k of Object.keys(LS)) if (k.startsWith(P)) origRemove.call(LS, k);
  try { await sPut("kv", "key", null); } catch(e){}
  keyCache = null;
}

/* ---------- history: every saved version of an item, and who changed what ---------- */
async function history(id){
  if (!joined()) throw new Error("This device hasn't joined the team, so there's no history on the server.");
  let res; try { res = await post("/history", {id}); } catch(e){ throw new Error(e.status === 404 ? "The team server needs its update before history can be shown." : e.message); }
  const out = [];
  for (const v of res.versions || []){ let data = null; if (!v.del && v.data){ try { data = await unseal(v.data); } catch(e){ continue; } } out.push({at: v.at, who: v.who, del: !!v.del, current: !!v.current, data}); }
  return out;
}
async function activity(before, limit){
  if (!joined()) throw new Error("This device hasn't joined the team.");
  try { return (await post("/recent", {before, limit})).changes || []; }
  catch(e){ throw new Error(e.status === 404 ? "The team server needs its update before the activity log can be shown." : e.message); }
}
// put an earlier version back (it becomes the newest change, so it goes to everyone)
async function restore(id, data){
  const [kind, ...rest] = id.split(":");
  if (kind === "a"){ const key = rest[0], iid = rest.slice(1).join(":"); if (!ARRAYS.includes(key)) throw new Error("Can't restore that");
    const arr = jget(key, []), i = arr.findIndex(x => x && x._id === iid); if (i >= 0) arr[i] = data; else arr.push(data); LS.setItem(key, JSON.stringify(arr)); }
  else if (kind === "r"){ await bPutRec(await joinPhotos(JSON.parse(JSON.stringify(data)))); enqueue("r:" + rest.join(":")); }
  else throw new Error("Can't restore that");
  window.dispatchEvent(new CustomEvent("dgsync-applied", {detail: {arrays: kind === "a" ? [rest[0]] : [], records: kind === "r", settings: false}}));
}
// photos kept apart from the lists (so they don't fill the browser's small list storage), sent once each like Buy log photos
async function putPhoto(dataUrl){ const h = await sha(dataUrl); await sPut("photos", h, dataUrl); if (joined() && !sentPhotos().includes(h)) enqueue("p:" + h); return "dgph:" + h; }
async function getPhoto(ref){ if (!ref) return ""; if (!String(ref).startsWith("dgph:")) return ref; return (await sGet("photos", ref.slice(5))) || ""; }
// after ID is removed from a record: erase its earlier versions on the server, and photos nothing else uses
async function forget(id, refs){
  if (!joined()) return;
  await syncNow();
  if (queue()[id]) throw new Error("The change hasn't reached the team server yet. Try again when there's signal.");
  const hashes = (refs || []).filter(r => String(r).startsWith("dgph:")).map(r => r.slice(5));
  try { await post("/forget", {id, photos: hashes}); } catch(e){ throw new Error(e.status === 404 ? "The team server needs its update first." : e.message); }
  for (const h of hashes) await sDel("photos", h);
}
function setActor(name){ try { if (name) sessionStorage.setItem(P + "actor", name); else sessionStorage.removeItem(P + "actor"); } catch(e){} }

/* ---------- hooks for the Buy log page ---------- */
const recordChanged = id => enqueue("r:" + id);
const recordDeleted = id => enqueue("r:" + id, true);
const settingsChanged = () => enqueue("b:settings");

window.DGSync = {
  configured: () => !!SYNC_URL, joined, me, join, leave, syncNow, serverCode,
  status: () => Object.assign({pending: Object.keys(queue()).length}, jget(P + "st", {})),
  recordChanged, recordDeleted, settingsChanged, history, activity, restore, setActor, actor, putPhoto, getPhoto, forget, people: () => jget(P + "people", ["Jase", "Mike"])
};

let looping = false;
function startLoop(){
  if (looping || !joined()) return; looping = true;
  syncNow();
  setInterval(syncNow, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); });
  window.addEventListener("online", () => syncNow());
}
startLoop();
})();
