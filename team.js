// Team page: joining the shared app, the visit diary, cash and figures for each person.
// Uses the main app's helpers (store, stock, buys, sentLog, fmt, g, closeOn, payRatio, refinerG, CT, esc, todayISO, gbpPerGram).
(function(){
'use strict';
const $ = id => document.getElementById(id);
const S = window.DGSync;
const SHOP_PHONE = "01202 117896", BIZ = "Dorset Gold & Jewellery";
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const jset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const me = () => (S && S.me()) || "";
const people = () => { const p = new Set(["Jase", "Mike"]); if (me()) p.add(me()); jget("visits", []).forEach(v => v.who && p.add(v.who)); return [...p]; };
const money = (v, dp = 0) => "£" + (Number(v) || 0).toLocaleString("en-GB", {minimumFractionDigits: dp, maximumFractionDigits: dp});
const day = d => new Date(d + "T12:00:00");
const dayName = d => { const t = todayISO(), tm = new Date(Date.now() + 864e5); const tom = new Date(tm.getTime() - tm.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  return d === t ? "Today" : d === tom ? "Tomorrow" : day(d).toLocaleDateString("en-GB", {weekday: "long", day: "numeric", month: "short"}); };
const digits = p => String(p || "").replace(/[^\d+]/g, "");
const isIOS = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const sms = (p, body) => "sms:" + digits(p) + (isIOS ? "&" : "?") + "body=" + encodeURIComponent(body);
const mapUrl = v => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([v.address, v.postcode].filter(Boolean).join(", "));
let tmTab = localStorage.getItem("tmTab") || "diary";

/* ================= sharing card ================= */
function renderShare(){
  const box = $("tmShare"); if (!box) return;
  if (!S || !S.configured()){
    box.innerHTML = `<h2>Team sharing</h2><p class="muted" style="margin:0">Team sharing isn't switched on yet. Once the team server is set up (see sync-worker/README.md in the app's code), you'll each join here with the business passphrase.</p>`;
    return;
  }
  if (!S.joined()){
    box.innerHTML = `<h2>Join the team</h2>
      <p style="margin-top:0">Share stock, the Buy log, the diary and prices with everyone in the business. Everything is locked with the business passphrase before it leaves this phone.</p>
      <label>Who are you?</label>
      <select id="tmWho">${["Jase", "Mike"].map(p => `<option>${p}</option>`).join("")}<option value="">Someone else…</option></select>
      <input id="tmWhoOther" placeholder="Your first name" style="display:none;margin-top:8px">
      <label>Business passphrase</label>
      <input id="tmPass" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="The words you agreed between you">
      <label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:15px"><input type="checkbox" id="tmShow" style="width:20px;height:20px"> Show what I'm typing</label>
      <p class="muted" style="margin:4px 0 0">Capitals and spaces don't matter, but every word must be the same.</p>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:15px"><input type="checkbox" id="tmImport" style="width:20px;height:20px" checked> Bring in anything saved on this phone from the old Dorset Gold app</label>
      <button class="btn" id="tmJoin">Join the team</button>
      <p class="muted" id="tmMsg" style="margin:8px 0 0"></p>
      <details style="margin-top:10px"><summary>Setting up the team server?</summary>
        <p class="muted">Type the passphrase above, then tap below. Copy the code it shows into Cloudflare as the <b>AUTH_HASH</b> secret. The passphrase itself is never sent anywhere.</p>
        <button class="btn ghost" id="tmCode">Show the server code</button><p id="tmCodeOut" style="word-break:break-all"></p></details>`;
    $("tmShow").onchange = e => { $("tmPass").type = e.target.checked ? "text" : "password"; };
    $("tmWho").onchange = () => { $("tmWhoOther").style.display = $("tmWho").value ? "none" : ""; };
    $("tmCode").onclick = async () => { const p = $("tmPass").value; if (p.length < 12){ $("tmCodeOut").textContent = "Type a passphrase of at least 12 characters first."; return; } $("tmCodeOut").innerHTML = "<code>" + await S.serverCode(p) + "</code>"; };
    $("tmJoin").onclick = async () => {
      const who = $("tmWho").value || $("tmWhoOther").value.trim();
      $("tmJoin").disabled = true; $("tmMsg").textContent = "Joining and bringing everything across. This can take a minute the first time…";
      try { await S.join($("tmPass").value, who, $("tmImport").checked); location.reload(); }
      catch(e){ if ($("tmMsg")) $("tmMsg").textContent = e.message; if ($("tmJoin")) $("tmJoin").disabled = false; }
    };
    return;
  }
  const st = S.status();
  const when = st.ok ? new Date(st.ok).toLocaleString("en-GB", {weekday: "short", hour: "2-digit", minute: "2-digit"}) : "not yet";
  box.innerHTML = `<h2>Team sharing</h2>
    <p style="margin:0">Signed in as <b>${esc(me())}</b>. Last shared: ${when}.${st.pending ? ` ${st.pending} change${st.pending === 1 ? "" : "s"} waiting to go up.` : ""}</p>
    ${st.err ? `<div class="warn">${esc(st.err)}</div>` : ""}
    <button class="btn ghost" id="tmSync">Share now</button>
    <details style="margin-top:6px"><summary>Leave the team on this phone</summary>
      <p class="muted">Stops sharing on this phone. Everything already here stays on the phone, and nothing is deleted for anyone else.</p>
      <button class="btn ghost" id="tmLeave">Leave the team</button></details>`;
  $("tmSync").onclick = async () => { $("tmSync").textContent = "Sharing…"; await S.syncNow(); renderShare(); };
  $("tmLeave").onclick = async () => { if (!confirm("Stop sharing on this phone?")) return; await S.leave(); location.reload(); };
}
window.addEventListener("dgsync-status", () => { if (S && S.joined()) renderShare(); });

/* ================= visit diary ================= */
const visits = () => jget("visits", []);
function saveVisits(a){ a.forEach(v => { if (!v._id) v._id = rid(); }); jset("visits", a); renderDiary(); }
let editing = null, mineOnly = localStorage.getItem("tmMine") === "1";
function visitForm(v){
  v = v || {date: todayISO(), time: "", who: me() || ""};
  return `<div class="lot" id="vForm">
    <div class="grid2"><div><label>Day</label><input id="vDate" type="date" value="${esc(v.date || "")}"></div><div><label>Time</label><input id="vTime" type="time" value="${esc(v.time || "")}"></div></div>
    <label>Customer's name</label><input id="vName" value="${esc(v.name || "")}" autocomplete="off">
    <label>Phone</label><input id="vPhone" type="tel" value="${esc(v.phone || "")}" autocomplete="off">
    <label>Address</label><input id="vAddr" value="${esc(v.address || "")}" autocomplete="off">
    <label>Postcode</label><input id="vPc" value="${esc(v.postcode || "")}" autocomplete="off" style="text-transform:uppercase">
    <label>What they've got</label><input id="vWhat" value="${esc(v.what || "")}" placeholder="e.g. box of gold chains, 2 sovereigns, a watch">
    <label>Notes</label><input id="vNotes" value="${esc(v.notes || "")}" placeholder="e.g. ring the side door, mum's jewellery">
    <label>Who's going</label><select id="vWho"><option value="">Either of us</option>${people().map(p => `<option ${p === v.who ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
    <button class="btn" id="vSave">${editing ? "Save changes" : "Add to the diary"}</button>
    <button class="btn ghost" id="vCancel">Cancel</button></div>`;
}
function visitCard(v){
  const st = {done: `<span class="pos">Bought${v.receipt ? " · " + esc(v.receipt) : ""}${v.total ? " · " + money(v.total) : ""}</span>`, nosale: '<span class="muted">No sale</span>', cancelled: '<span class="muted">Cancelled</span>'}[v.status] || "";
  const open = !v.status || v.status === "booked";
  return `<div class="lot" data-v="${v._id}">
    <div class="hd"><span>${esc(v.time || "Any time")} · ${esc(v.name || "No name")}</span><span style="color:var(--gold2)">${esc(v.who || "Either")}</span></div>
    <div class="sm">${esc([v.address, (v.postcode || "").toUpperCase()].filter(Boolean).join(", ") || "No address yet")}</div>
    ${v.what ? `<div class="sm">${esc(v.what)}</div>` : ""}${v.notes ? `<div class="sm">${esc(v.notes)}</div>` : ""}
    ${st ? `<div class="sm" style="margin-top:6px">${st}</div>` : ""}
    ${v.reminded && open ? `<div class="sm">Reminder sent ${new Date(v.reminded).toLocaleDateString("en-GB", {weekday: "short"})}</div>` : ""}
    ${open ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px">
      ${v.phone ? `<a class="btn ghost" style="margin:0;padding:9px;font-size:14px" href="tel:${digits(v.phone)}">Call</a>` : ""}
      ${v.address || v.postcode ? `<a class="btn ghost" style="margin:0;padding:9px;font-size:14px" href="${mapUrl(v)}" target="_blank" rel="noopener">Map</a>` : ""}
      ${v.phone ? `<button class="btn ghost" style="margin:0;padding:9px;font-size:14px" data-act="remind">Remind</button>` : ""}
    </div>
    <a class="btn" style="padding:11px" href="buying-log/?visit=${encodeURIComponent(v._id)}">Start the purchase</a>` : ""}
    <details><summary>More</summary><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <button class="btn ghost" style="margin:0;padding:9px;font-size:14px" data-act="edit">Edit</button>
      ${open ? `<button class="btn ghost" style="margin:0;padding:9px;font-size:14px" data-act="nosale">No sale</button>
      <button class="btn ghost" style="margin:0;padding:9px;font-size:14px" data-act="cancel">Cancelled</button>` : `<button class="btn ghost" style="margin:0;padding:9px;font-size:14px" data-act="reopen">Back to booked</button>`}
      <button class="btn ghost" style="margin:0;padding:9px;font-size:14px" data-act="delete">Delete</button></div></details></div>`;
}
const reminderText = v => `Hi ${String(v.name || "").split(" ")[0]}, just confirming your free home valuation with ${BIZ} ${dayName(v.date).toLowerCase() === "tomorrow" ? "tomorrow" : "on " + dayName(v.date)}${v.time ? " at " + v.time : ""}. Have everything you might sell ready, plus photo ID in case you decide to sell. Any questions, call ${SHOP_PHONE}. ${v.who || ""}`.trim();
function renderDiary(){
  const box = $("tmDiary"); if (!box) return;
  const t = todayISO(), all = visits().filter(v => !mineOnly || !v.who || v.who === me());
  const upcoming = all.filter(v => v.date >= t && (!v.status || v.status === "booked")).sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
  const recent = all.filter(v => (v.status && v.status !== "booked") || v.date < t).filter(v => v.date >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const groups = new Map(); upcoming.forEach(v => { if (!groups.has(v.date)) groups.set(v.date, []); groups.get(v.date).push(v); });
  const tm = new Date(Date.now() + 864e5), tom = new Date(tm.getTime() - tm.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const toRemind = upcoming.filter(v => v.date === tom && v.phone && !v.reminded);
  box.innerHTML = `<h2>Visit diary</h2>
    ${editing !== null ? visitForm(editing === "new" ? null : visits().find(v => v._id === editing)) : `<button class="btn" id="vAdd" style="margin-top:0">Add a visit</button>`}
    ${me() ? `<label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:15px;margin-top:12px"><input type="checkbox" id="vMine" style="width:20px;height:20px" ${mineOnly ? "checked" : ""}> Only show my visits</label>` : ""}
    ${toRemind.length && new Date().getHours() >= 15 ? `<div class="warn">${toRemind.length} of tomorrow's customer${toRemind.length === 1 ? " hasn't" : "s haven't"} had a reminder text yet. Tap <b>Remind</b> on each one below.</div>` : ""}
    ${[...groups.entries()].map(([d, vs]) => `<div class="sub">${dayName(d)}</div>${vs.map(visitCard).join("")}`).join("") || '<p class="muted">No visits booked. Add one when a customer calls.</p>'}
    ${recent.length ? `<details style="margin-top:10px"><summary>Last two weeks (${recent.length})</summary>${recent.map(v => `<div class="sub">${dayName(v.date)}</div>` + visitCard(v)).join("")}</details>` : ""}`;
  if ($("vAdd")) $("vAdd").onclick = () => { editing = "new"; renderDiary(); $("vName").focus(); };
  if ($("vMine")) $("vMine").onchange = e => { mineOnly = e.target.checked; localStorage.setItem("tmMine", mineOnly ? "1" : "0"); renderDiary(); };
  if ($("vForm")){
    $("vCancel").onclick = () => { editing = null; renderDiary(); };
    $("vSave").onclick = () => {
      const v = {date: $("vDate").value, time: $("vTime").value, name: $("vName").value.trim(), phone: $("vPhone").value.trim(), address: $("vAddr").value.trim(), postcode: $("vPc").value.trim().toUpperCase(), what: $("vWhat").value.trim(), notes: $("vNotes").value.trim(), who: $("vWho").value};
      if (!v.date || !v.name){ alert("Add at least the day and the customer's name."); return; }
      const a = visits();
      if (editing === "new") a.push(Object.assign(v, {_id: rid(), status: "booked", added: new Date().toISOString(), addedBy: me()}));
      else { const x = a.find(y => y._id === editing); if (x) Object.assign(x, v); }
      editing = null; saveVisits(a);
    };
  }
  box.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
    const id = b.closest("[data-v]").dataset.v, a = visits(), v = a.find(x => x._id === id); if (!v) return;
    const act = b.dataset.act;
    if (act === "edit"){ editing = id; renderDiary(); $("vForm").scrollIntoView({behavior: "smooth"}); return; }
    if (act === "remind"){ v.reminded = new Date().toISOString(); saveVisits(a); location.href = sms(v.phone, reminderText(v)); return; }
    if (act === "nosale") v.status = "nosale";
    if (act === "cancel") v.status = "cancelled";
    if (act === "reopen") v.status = "booked";
    if (act === "delete"){ if (!confirm("Delete this visit from the diary for everyone?")) return; a.splice(a.indexOf(v), 1); }
    saveVisits(a);
  });
}

/* ================= cash ================= */
const cashLog = () => jget("cash", []);
async function cashPurchases(){
  // cash paid to customers, from the Buy log
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("dj-buylog", 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("records")) d.createObjectStore("records", {keyPath: "id"}); if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const recs = await new Promise((res, rej) => { const r = db.transaction("records").objectStore("records").getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return recs.filter(r => r.payment && r.payment.method === "Cash").map(r => ({date: r.createdAt.slice(0, 10), at: r.createdAt, who: r._who || r.staff || "", type: "paid", amount: r.total, note: `${r.receipt} · ${r.seller.first} ${r.seller.last}`}));
  } catch(e){ return []; }
}
async function renderCash(){
  const box = $("tmCash"); if (!box) return;
  const log = cashLog(), paid = await cashPurchases();
  const bal = {}; const add = (p, v) => { if (!p) return; bal[p] = (bal[p] || 0) + v; };
  log.forEach(c => { if (c.type === "out") add(c.who, c.amount); if (c.type === "back") add(c.who, -c.amount); if (c.type === "give"){ add(c.who, -c.amount); add(c.to, c.amount); } });
  paid.forEach(c => add(c.who, -c.amount));
  people().forEach(p => { if (!(p in bal)) bal[p] = 0; });
  const moves = log.map(c => Object.assign({at: c.at || c.date}, c)).concat(paid).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 25);
  const label = c => ({out: "Took out", back: "Paid back in", give: "Handed to " + esc(c.to || ""), paid: "Paid a customer"}[c.type]);
  box.innerHTML = `<h2>Cash</h2>
    <p class="muted" style="margin-top:0">What each of you should be holding: cash taken out, less what's been paid to customers in the Buy log, paid back in, or handed over.</p>
    <table>${Object.entries(bal).map(([p, v]) => `<tr><td>${esc(p)}</td><td class="${v < 0 ? "neg" : ""}">${money(v, 2)}</td></tr>`).join("")}</table>
    ${Object.values(bal).some(v => v < -0.005) ? '<div class="warn">A negative figure means more cash was paid to customers than was booked out. Add the cash taken out so the figures add up.</div>' : ""}
    <div class="sub">Add a movement</div>
    <div class="grid2"><div><label>What</label><select id="cType"><option value="out">Took cash out</option><option value="back">Paid cash back in</option><option value="give">Handed cash to…</option></select></div>
      <div><label>Amount (£)</label><input id="cAmt" type="number" inputmode="decimal" min="0" step="0.01"></div></div>
    <div id="cToRow" style="display:none"><label>Handed to</label><select id="cTo">${people().filter(p => p !== me()).map(p => `<option>${esc(p)}</option>`).join("")}</select></div>
    <label>Note (optional)</label><input id="cNote" placeholder="e.g. from the bank, float for Saturday">
    <button class="btn" id="cAdd">Add</button>
    ${moves.length ? `<div class="sub">Recent</div><table>${moves.map(c => `<tr><td>${esc(c.who || "")}: ${label(c)}<div class="muted">${new Date(c.date + "T12:00:00").toLocaleDateString("en-GB", {day: "numeric", month: "short"})}${c.note ? " · " + esc(c.note) : ""}</div></td><td class="${c.type === "out" ? "pos" : ""}">${c.type === "out" ? "+" : "−"}${money(c.amount, 2)}</td></tr>`).join("")}</table>` : ""}`;
  $("cType").onchange = () => { $("cToRow").style.display = $("cType").value === "give" ? "" : "none"; };
  $("cAdd").onclick = () => {
    const amount = parseFloat($("cAmt").value);
    if (!(amount > 0)){ alert("Type the amount."); return; }
    if (!me()){ alert("Join the team first, so the app knows whose cash this is."); return; }
    const a = cashLog();
    a.push({_id: rid(), date: todayISO(), at: new Date().toISOString(), who: me(), type: $("cType").value, amount: Math.round(amount * 100) / 100, to: $("cType").value === "give" ? $("cTo").value : "", note: $("cNote").value.trim()});
    jset("cash", a); renderCash();
  };
}

/* ================= figures ================= */
function monthName(k){ return new Date(k + "-15").toLocaleDateString("en-GB", {month: "short", year: "numeric"}); }
function renderFigures(){
  const box = $("tmFigures"); if (!box) return;
  if (typeof buys !== "function"){ box.innerHTML = ""; return; }
  const lines = buys().concat(stock().filter(x => !x.bl).map(x => ({d: x.d, w: x.w0 || x.w, k: x.k, paid: x.paid0 || x.paid, _who: x._who}))).filter(x => x.d && x.w > 0);
  const rows = new Map();   // month -> person -> totals
  lines.forEach(x => {
    const m = x.d.slice(0, 7), who = x._who || "Not set";
    if (!rows.has(m)) rows.set(m, new Map());
    const t = rows.get(m).get(who) || {w: 0, pure: 0, paid: 0, ref: 0, n: 0};
    t.w += x.w; t.pure += x.w * parseFloat(x.k); t.paid += x.paid || 0; t.n++;
    const oz = typeof closeOn === "function" ? closeOn(x.d) : null;
    if (oz && x.paid > 0 && gbpPerGram) t.ref += x.w * parseFloat(x.k) * g(oz) * payRatio();
    rows.get(m).set(who, t);
  });
  const sent = new Map(); sentLog().forEach(r => { const m = (r.d || "").slice(0, 7); if (!m) return; const t = sent.get(m) || {pure: 0, value: 0, cost: 0}; t.pure += r.pure || 0; t.value += r.value || 0; t.cost += r.cost || 0; sent.set(m, t); });
  const months = [...new Set([...rows.keys(), ...sent.keys()])].sort().reverse().slice(0, 6);
  const holding = new Map(); stock().forEach(x => { const who = x._who || "Not set"; const t = holding.get(who) || {w: 0, pure: 0, value: 0}; t.w += x.w; t.pure += x.w * parseFloat(x.k); if (gbpPerGram) t.value += x.w * refinerG(x.k); holding.set(who, t); });
  const tot = [...holding.values()].reduce((a, t) => ({w: a.w + t.w, pure: a.pure + t.pure, value: a.value + t.value}), {w: 0, pure: 0, value: 0});
  box.innerHTML = `<h2>Figures</h2>
    <div class="sub" style="margin-top:0">Stock held now</div>
    <table>${[...holding.entries()].map(([p, t]) => `<tr><td>Bought by ${esc(p)}<div class="muted">${t.w.toFixed(1)}g, ${t.pure.toFixed(1)}g pure gold</div></td><td>${gbpPerGram ? money(t.value) : "…"}</td></tr>`).join("")}
      <tr><td><b>Business total</b><div class="muted">${tot.w.toFixed(1)}g, ${tot.pure.toFixed(1)}g pure gold, at the refiner's price today</div></td><td><b>${gbpPerGram ? money(tot.value) : "…"}</b></td></tr></table>
    ${months.map(m => { const per = rows.get(m) || new Map(), s = sent.get(m);
      const all = [...per.values()].reduce((a, t) => ({w: a.w + t.w, paid: a.paid + t.paid, ref: a.ref + t.ref, n: a.n + t.n}), {w: 0, paid: 0, ref: 0, n: 0});
      const mg = t => t.ref > 0 ? ((1 - t.paid / t.ref) * 100).toFixed(0) + "% margin" : "";
      return `<div class="sub">${monthName(m)}</div><table>
        ${[...per.entries()].map(([p, t]) => `<tr><td>${esc(p)} bought<div class="muted">${t.w.toFixed(1)}g${mg(t) ? " · " + mg(t) : ""}</div></td><td>${money(t.paid)}</td></tr>`).join("")}
        ${per.size > 1 ? `<tr><td><b>Business bought</b><div class="muted">${all.w.toFixed(1)}g${mg(all) ? " · " + mg(all) : ""}</div></td><td><b>${money(all.paid)}</b></td></tr>` : ""}
        ${s ? `<tr><td>Sent to the refiner<div class="muted">${s.pure.toFixed(1)}g pure · cost ${money(s.cost)} · roughly ${money(s.value - s.cost)} profit</div></td><td>${money(s.value)}</td></tr>` : ""}</table>`; }).join("") || '<p class="muted">Fills in as you buy and send gold.</p>'}
    <p class="muted" style="margin:10px 0 0">Margin is what you paid against what the refiner was paying on the day you bought. Refiner figures are estimates until Mastermelt's statement comes in.</p>
    <button class="btn ghost" id="fCsv">Export for the accountant (CSV)</button>`;
  $("fCsv").onclick = () => {
    const out = [["Month", "Person", "Grams bought", "Pure gold (g)", "Paid (£)", "Refiner value on the day (£)"]];
    [...rows.entries()].sort().forEach(([m, per]) => per.forEach((t, p) => out.push([m, p, t.w.toFixed(2), t.pure.toFixed(3), t.paid.toFixed(2), t.ref.toFixed(2)])));
    out.push([]); out.push(["Month", "Sent to refiner: pure gold (g)", "Cost (£)", "Estimated payout (£)"]);
    [...sent.entries()].sort().forEach(([m, s]) => out.push([m, s.pure.toFixed(3), s.cost.toFixed(2), s.value.toFixed(2)]));
    const csv = out.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"})); a.download = `dorset-gold-figures-${todayISO()}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
  };
}

/* ================= page ================= */
function render(){
  document.querySelectorAll("#tmTabs button").forEach(b => b.classList.toggle("on", b.dataset.t === tmTab));
  ["diary", "cash", "figures", "share"].forEach(t => { const el = $("tm" + t[0].toUpperCase() + t.slice(1)); if (el) el.style.display = t === tmTab || (t === "share" && tmTab === "diary" && S && S.configured() && !S.joined()) ? "" : "none"; });
  renderShare();
  if (tmTab === "diary") renderDiary(); else if (tmTab === "cash") renderCash(); else if (tmTab === "figures") renderFigures();
}
document.querySelectorAll("#tmTabs button").forEach(b => b.onclick = () => { tmTab = b.dataset.t; localStorage.setItem("tmTab", tmTab); render(); });
window.addEventListener("dgsync-applied", () => { if (editing === null) render(); });
window.TeamPage = {render};
render();
})();
