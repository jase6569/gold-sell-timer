/* Out today: Gold Trader's page for home visits. It reads and writes the same shared lists as the Shop
   (visits, clock, cash) and the same Buy log, so everything done here shows in the Shop straight away.
   Booking and planning visits stays in the Shop's diary; this is today's work only. */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const jset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const utcDay = () => new Date().toISOString().slice(0, 10);   // the Shop dates clockings this way
const hm = iso => new Date(iso).toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"});
const nowHM = () => new Date().toTimeString().slice(0, 5);
const addMins = (t, m) => { const [h, mi] = String(t || "00:00").split(":").map(Number), x = h * 60 + mi + m; return String(Math.floor(x / 60) % 24).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };
const area = pc => { const m = String(pc || "").toUpperCase().trim().match(/^([A-Z]{1,2}\d[A-Z\d]?)/); return m ? m[1] : ""; };
const digits = p => String(p || "").replace(/[^\d+]/g, "");
const isIOS = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const money = v => (v < 0 ? "−£" : "£") + Math.abs(v).toLocaleString("en-GB", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const me = () => (window.DGSync && DGSync.me && DGSync.me()) || "";
const visitEnd = v => v.end || addMins(v.time || "09:00", parseFloat(v.dur) || 60);
const place = v => [v.address, v.postcode].filter(Boolean).join(", ");

function myVisits(){
  const t = localDay(), m = me();
  return jget("visits", []).filter(v => v.date === t && (!v.who || v.who === m) && v.status !== "cancelled")
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}
function myClock(){ const m = me(); return jget("clock", []).filter(c => c.who === m && String(c.at).slice(0, 10) === utcDay()).sort((a, b) => a.at.localeCompare(b.at)); }
function clock(kind, extra){
  const m = me(); if (!m) return;
  const list = jget("clock", []); list.push(Object.assign({_id: uid(), who: m, at: new Date().toISOString(), kind, by: m}, extra || {})); jset("clock", list);
  render();
}
async function bizPhone(){
  try { const db = await new Promise((res, rej) => { const r = indexedDB.open("dj-buylog", 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("records")) d.createObjectStore("records", {keyPath: "id"}); if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const s = await new Promise(res => { const q = db.transaction("kv").objectStore("kv").get("settings"); q.onsuccess = () => res(q.result || {}); q.onerror = () => res({}); }); db.close(); return s; }
  catch(e){ return {}; }
}
async function buyLogCash(){   // cash paid to customers from someone's own float (not the till)
  try { const db = await new Promise((res, rej) => { const r = indexedDB.open("dj-buylog", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("records")) d.createObjectStore("records", {keyPath: "id"}); if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); }; });
    const recs = await new Promise(res => { const q = db.transaction("records").objectStore("records").getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); db.close();
    return recs.filter(r => !r.deleted && r.payment && r.payment.method === "Cash" && r.payment.from !== "till").map(r => ({who: r._who || r.staff || "", amount: Number(r.total) || 0}));
  } catch(e){ return []; }
}

async function render(){
  const box = $("outBody"); if (!box) return;
  const joined = window.DGSync && DGSync.joined && DGSync.joined(), m = me();
  if (!joined || !m){
    box.innerHTML = `<div class="card"><h2>Out today</h2><p style="margin:0">Join the team first, so this phone is linked to the Shop: open the <b>Shop</b>, Settings, <b>Team</b>.</p>
      <a class="btn" href="shop/?go=set" style="display:block;text-align:center;text-decoration:none;margin-top:12px">Open the Shop's Settings</a></div>`;
    return;
  }
  // where I am
  const cl = myClock(), last = (cl[cl.length - 1] || {}).kind, lastRec = cl[cl.length - 1];
  const vs = myVisits(), open = vs.filter(v => !v.status || v.status === "booked");
  const status = last === "leave" ? `Out: ${esc(lastRec.where || "visit")} since ${hm(lastRec.at)}${lastRec.until ? `, back by ${lastRec.until}` : ""}`
    : last === "in" || last === "back" ? `In the shop since ${hm((cl.find(c => c.kind === "in") || lastRec).at)}` : last === "outday" ? `Finished at ${hm(lastRec.at)}` : "Not clocked in today";
  // cash I'm carrying
  const cash = jget("cash", []), paid = await buyLogCash();
  let bal = 0; cash.forEach(c => { const a = Number(c.amount) || 0; if (c.type === "out" && c.who === m) bal += a; if (c.type === "back" && c.who === m) bal -= a; if (c.type === "give"){ if (c.who === m) bal -= a; if (c.to === m) bal += a; } });
  paid.forEach(p => { if (p.who === m) bal -= p.amount; });
  const stillOpen = $("outBody").querySelector("details[open]") ? [...$("outBody").querySelectorAll("details[open]")].map(d => d.dataset.k) : [];
  box.innerHTML = `
  <div class="card">
    <h2>${esc(m)} · ${new Date().toLocaleDateString("en-GB", {weekday: "long", day: "numeric", month: "long"})}</h2>
    <p style="margin:0 0 8px">${status}</p>
    ${!last || last === "outday" ? `<button class="btn" data-ck="in">Clock in</button>` : ""}
    ${last === "in" || last === "back" ? `<button class="btn" data-ck="go">Going out</button><button class="btn ghost" data-ck="outday">Clock out for the day</button>` : ""}
    ${last === "leave" ? `<button class="btn" data-ck="back">I'm back</button>` : ""}
    <p class="muted" style="margin:8px 0 0">The Shop shows everyone where you are. If you're not back 30 minutes after your time, it warns the others to call you.</p>
  </div>
  <div class="card">
    <h2>Today's visits</h2>
    ${vs.length ? vs.map(v => { const done = v.status && v.status !== "booked";
      return `<div class="ovisit${done ? " done" : ""}">
        <div class="ovtop"><b>${esc(v.time || "Any time")} · ${esc(v.name || "No name")}</b><span class="muted">${done ? ({done: "Bought" + (v.total ? " " + money(Number(v.total)).replace(".00", "") : ""), nosale: "No sale"}[v.status] || v.status) : (v.who ? "" : "Either of us")}</span></div>
        <div class="muted">${esc(place(v) || "No address")}${v.what ? " · " + esc(v.what) : ""}${v.notes ? "<br>" + esc(v.notes) : ""}</div>
        ${done ? "" : `<div class="ovbtns">
          ${v.phone ? `<a class="btn ghost" href="tel:${digits(v.phone)}">Call</a><button class="btn ghost" data-act="remind" data-id="${v._id}">Text</button>` : ""}
          ${place(v) ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place(v))}">Directions</a>` : ""}
          ${last !== "leave" ? `<button class="btn ghost" data-act="leave" data-id="${v._id}">Leaving now</button>` : ""}
        </div>
        <div class="ovbtns">
          <button class="btn" data-act="offer" data-id="${v._id}">Make an offer</button>
          <a class="btn" href="buying-log/?visit=${encodeURIComponent(v._id)}">Start the purchase</a>
          <button class="btn ghost" data-act="nosale" data-id="${v._id}">No sale</button>
        </div>`}
      </div>`; }).join("") : `<p class="muted" style="margin:0">No visits for you today.</p>`}
    <div class="ovbtns" style="margin-top:10px">
      ${open.filter(v => place(v)).length > 1 ? `<button class="btn ghost" data-act="route">Route for all of today's visits</button>` : ""}
      <button class="btn ghost" data-act="offer0">Make an offer (no booking)</button>
    </div>
    <p class="muted" style="margin:8px 0 0">To book or move a visit, use the <a href="shop/?go=diary" style="color:var(--gold2)">Shop's Diary</a>.</p>
  </div>
  <div class="card">
    <h2>Cash I'm carrying</h2>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span>Should be holding</span><b style="font-size:22px${bal < -0.005 ? ";color:var(--down)" : ""}">${money(bal)}</b></div>
    ${bal < -0.005 ? '<p class="muted" style="margin:4px 0 0">You\'ve paid out more than you booked out. Add the cash you took.</p>' : ""}
    <details data-k="cash"${stillOpen.includes("cash") ? " open" : ""} style="margin-top:8px"><summary>Took cash out, paid back or handed over</summary>
      <div class="grid2"><div><label>What</label><select id="ocType"><option value="out">Took cash out</option><option value="back">Paid back in</option><option value="give">Handed to…</option></select></div>
        <div><label>Amount (£)</label><input id="ocAmt" type="number" inputmode="decimal" min="0" step="0.01"></div></div>
      <div id="ocToRow" style="display:none"><label>Handed to</label><select id="ocTo">${[...new Set(jget("staff", []).filter(s => s && !s.gone).map(s => s.name).concat(["Jase", "Mike"]))].filter(p => p !== m).map(p => `<option>${esc(p)}</option>`).join("")}</select></div>
      <button class="btn" id="ocAdd">Save</button></details>
  </div>`;
  box.querySelectorAll("[data-ck]").forEach(b => b.onclick = () => {
    const k = b.dataset.ck;
    if (k === "go"){ const w = prompt("Where are you going? (e.g. bank, Mastermelt)"); if (!w) return; const u = prompt("Back by what time? (e.g. 15:30)", addMins(nowHM(), 60)); if (!u) return; return clock("leave", {where: w.trim(), until: u.trim()}); }
    clock(k);
  });
  box.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
    const act = b.dataset.act, list = jget("visits", []), v = list.find(x => x._id === b.dataset.id);
    if (act === "route"){ const pl = open.filter(x => place(x)).map(place);
      return window.open("https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(pl[pl.length - 1]) + (pl.length > 1 ? "&waypoints=" + encodeURIComponent(pl.slice(0, -1).join("|")) : ""), "_blank"); }
    if (act === "offer0") return window.OfferScreen && OfferScreen.open(null);
    if (!v) return;
    if (act === "offer") return window.OfferScreen && OfferScreen.open(v._id);
    if (act === "leave") return clock("leave", {where: `visit to ${v.name || "customer"}${area(v.postcode) ? " in " + area(v.postcode) : ""}${v.address ? " (" + v.address + ")" : ""}`, until: addMins(visitEnd(v), 20), visitId: v._id});
    if (act === "nosale"){ if (!confirm("Mark this visit as no sale?")) return; v.status = "nosale"; jset("visits", list); return render(); }
    if (act === "remind"){ const s = await bizPhone(); v.reminded = new Date().toISOString(); jset("visits", list);
      const body = `Hi ${String(v.name || "").split(" ")[0]}, just confirming your free home valuation with ${s.biz || "Dorset Gold & Jewellery"} on ${new Date(v.date + "T12:00").toLocaleDateString("en-GB", {weekday: "long", day: "numeric", month: "long"})}${v.time ? " at " + v.time : ""}. Please have photo ID ready. Any questions, call us${s.phone ? " on " + s.phone : ""}.`;
      location.href = "sms:" + digits(v.phone) + (isIOS ? "&" : "?") + "body=" + encodeURIComponent(body); }
  });
  $("ocType").onchange = () => { $("ocToRow").style.display = $("ocType").value === "give" ? "" : "none"; };
  $("ocAdd").onclick = () => { const a = Math.round((parseFloat($("ocAmt").value) || 0) * 100) / 100; if (!(a > 0)) return alert("Type the amount.");
    const t = $("ocType").value, l = jget("cash", []); l.push({_id: uid(), date: localDay(), at: new Date().toISOString(), who: m, type: t, amount: a, to: t === "give" ? $("ocTo").value : "", note: ""}); jset("cash", l); render(); };
}
window.OutToday = {render};
window.addEventListener("dgsync-applied", () => { if (document.querySelector("#p-out.on")) render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && document.querySelector("#p-out.on")) render(); });
setInterval(() => { if (document.querySelector("#p-out.on") && !document.querySelector("#outBody details[open]")) render(); }, 60000);
})();
