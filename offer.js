// Offer screen: at the customer's table, price each piece from today's refiner price and the shared margin,
// show the customer a clean offer (no margin or refiner figures), and if they accept, open the Buy log with
// the items filled in. Uses the main app's helpers (refinerG, gbpPerGram, store, esc, todayISO).
(function(){
'use strict';
const CARATS = [["0.375", "9ct"], ["0.585", "14ct"], ["0.75", "18ct"], ["0.916", "22ct"], ["0.999", "24ct"], ["other", "Other"]];
const PURITY = {"0.375": "9ct (375)", "0.585": "14ct (585)", "0.75": "18ct (750)", "0.916": "22ct (916)", "0.999": "24ct (999)"};
const label = k => (CARATS.find(c => c[0] === k) || [k, k])[1];
const money = (v, dp = 0) => "£" + (Number(v) || 0).toLocaleString("en-GB", {minimumFractionDigits: dp, maximumFractionDigits: dp});
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const margin = () => Math.min(90, Math.max(0, parseFloat(store.get("pmM") || "20") || 0)) / 100;
const rate = k => (k === "other" || !gbpPerGram) ? 0 : refinerG(k) * (1 - margin());
const lineOffer = l => l.manual ? (parseFloat(l.price) || 0) : Math.floor((parseFloat(l.w) || 0) * rate(l.k));

const css = document.createElement("style");
css.textContent = `
  .offer{position:fixed;inset:0;z-index:200;background:var(--bg);overflow-y:auto;padding:calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 24px)}
  .offer .in{max-width:640px;margin:0 auto}
  .offer .top{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .offer h2{margin:0;font-size:20px}
  .offer .x{background:none;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:8px 12px;font-size:15px}
  .offer .ln{border:1px solid var(--line);border-radius:12px;padding:10px;margin:10px 0;background:#12110f}
  .offer .ln .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .offer .ln label{margin:6px 0 3px}
  .offer .ln input,.offer .ln select{padding:10px;font-size:16px}
  .offer .tot{display:flex;justify-content:space-between;font-size:22px;font-weight:800;margin:14px 2px}
  .offer .rates{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0}
  .offer .rates div{background:#12110f;border:1px solid var(--line);border-radius:10px;padding:6px 2px;text-align:center;font-size:12px;color:var(--muted)}
  .offer .rates b{display:block;color:var(--text);font-size:14px}
  .offer.cust{background:#faf7f1;color:#1b120c}
  .offer.cust .card2{background:#fff;border-top:3px solid #cdaa5c;border-radius:4px;padding:22px 18px;box-shadow:0 10px 30px rgba(27,18,12,.08)}
  .offer.cust h1{font-family:Georgia,serif;font-weight:500;font-size:30px;margin:0 0 4px}
  .offer.cust .who{color:#6f6254;margin:0 0 16px}
  .offer.cust table td{border-top:1px solid #ece4d6;color:#1b120c;font-size:17px;padding:12px 0}
  .offer.cust .muted{color:#6f6254}
  .offer.cust .big{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid #1b120c;margin-top:6px;padding-top:14px}
  .offer.cust .big span{font-size:18px} .offer.cust .big b{font-family:Georgia,serif;font-size:40px;font-weight:500;color:#1b120c}
  .offer.cust .btn{border-radius:4px}
  .offer.cust .btn.ghost{color:#1b120c;border-color:#d3c7b4}`;
document.head.appendChild(css);

let st = null, box = null, rendering = false, pending = 0;
// redraw after the current tap or blur has finished, never in the middle of one
function later(){ clearTimeout(pending); pending = setTimeout(renderBuild, 0); }
function save(){ localStorage.setItem("offerDraft", JSON.stringify(st)); }
function open(visitId){
  const v = visitId ? jget("visits", []).find(x => x._id === visitId) : null;
  const draft = jget("offerDraft", null);
  st = draft && draft.visitId === (visitId || null) ? draft : {visitId: visitId || null, name: v ? v.name : "", lines: [{k: "0.375", w: "", desc: "", price: "", manual: false}]};
  if (!box){ box = document.createElement("div"); document.body.appendChild(box); }
  box.style.display = ""; renderBuild();
}
function close(){ if (box) box.style.display = "none"; document.body.style.overflow = ""; }
function total(){ return st.lines.reduce((t, l) => t + lineOffer(l), 0); }

function renderBuild(){
  rendering = true;
  document.body.style.overflow = "hidden";
  box.className = "offer";
  const m = margin();
  box.innerHTML = `<div class="in">
    <div class="top"><h2>Make an offer${st.name ? " · " + esc(st.name) : ""}</h2><button class="x" id="ofClose">Close</button></div>
    ${gbpPerGram ? `<div class="rates">${CARATS.slice(0, 5).map(([k, n]) => `<div><b>${money(rate(k), 2)}</b>${n}/g</div>`).join("")}</div>
      <p class="muted" style="margin:0">What to pay per gram: the refiner's price today, keeping your ${Math.round(m * 100)}% margin (set in My gold, Make money). Only you see this screen.</p>`
      : `<div class="warn">Waiting for today's gold price. Check your signal.</div>`}
    ${st.lines.map((l, i) => `<div class="ln" data-i="${i}">
      <label>Item ${i + 1}</label><input data-f="desc" value="${esc(l.desc)}" placeholder="e.g. curb chain, wedding ring, broken earrings">
      <div class="g3">
        <div><label>Carat</label><select data-f="k">${CARATS.map(([k, n]) => `<option value="${k}" ${l.k === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><label>Weight (g)</label><input data-f="w" inputmode="decimal" value="${esc(l.w)}" placeholder="0.0"></div>
        <div><label>Offer (£)</label><input data-f="price" inputmode="decimal" value="${l.manual ? esc(l.price) : (lineOffer(l) || "")}" placeholder="${l.k === "other" ? "Type it" : "Auto"}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span class="muted">${l.manual ? 'Your own price. <a href="#" data-auto style="color:var(--gold2)">Use the auto price</a>' : (l.k === "other" ? "Type a price for this one" : "Worked out from the weight")}</span>
        ${st.lines.length > 1 ? `<button class="x" data-rm style="padding:5px 10px;font-size:13px">Remove</button>` : ""}</div></div>`).join("")}
    <button class="btn ghost" id="ofAdd">+ Add another item</button>
    <div class="tot"><span>Total offer</span><span>${money(total())}</span></div>
    <button class="btn" id="ofShow" ${total() > 0 ? "" : "disabled"}>Show the customer</button>
    <p class="muted">Test every piece first. Offers use today's price, so make a new one if you come back another day.</p></div>`;
  box.querySelector("#ofClose").onclick = close;
  box.querySelector("#ofAdd").onclick = () => { st.lines.push({k: "0.375", w: "", desc: "", price: "", manual: false}); save(); renderBuild(); };
  box.querySelector("#ofShow").onclick = () => { if (total() > 0) renderCustomer(); };
  box.querySelectorAll(".ln").forEach(el => {
    const i = +el.dataset.i, l = st.lines[i];
    el.querySelectorAll("[data-f]").forEach(inp => {
      inp.onchange = () => {
        if (rendering) return;
        const f = inp.dataset.f;
        if (f === "price"){ l.price = inp.value; l.manual = inp.value.trim() !== ""; } else l[f] = inp.value;
        if (f === "k" && inp.value === "other") l.manual = true;
        save(); later();
      };
    });
    const rm = el.querySelector("[data-rm]"); if (rm) rm.onclick = () => { st.lines.splice(i, 1); save(); renderBuild(); };
    const au = el.querySelector("[data-auto]"); if (au) au.onclick = e => { e.preventDefault(); l.manual = false; l.price = ""; save(); renderBuild(); };
  });
  rendering = false;
}

function renderCustomer(){
  box.className = "offer cust";
  const lines = st.lines.filter(l => lineOffer(l) > 0);
  box.innerHTML = `<div class="in"><div class="card2">
    <p style="margin:0 0 6px;letter-spacing:2px;font-size:11px;font-weight:700;color:#cdaa5c;text-transform:uppercase">Dorset Gold &amp; Jewellery</p>
    <h1>Your offer</h1><p class="who">${st.name ? esc(st.name) + " · " : ""}${new Date().toLocaleDateString("en-GB", {weekday: "long", day: "numeric", month: "long", year: "numeric"})}</p>
    <table>${lines.map(l => `<tr><td>${esc(l.desc || (label(l.k) === "Other" ? "Item" : label(l.k) + " gold"))}<div class="muted" style="font-size:14px">${l.k === "other" ? "" : label(l.k) + " · "}${parseFloat(l.w) ? parseFloat(l.w).toFixed(2) + "g" : ""}</div></td><td>${money(lineOffer(l))}</td></tr>`).join("")}</table>
    <div class="big"><span>Total</span><b>${money(lines.reduce((t, l) => t + lineOffer(l), 0))}</b></div>
    <p class="muted" style="margin:14px 0 0;font-size:14px">Based on today's gold price. Each piece has been tested and weighed in front of you. There's no obligation to sell.</p></div>
    <button class="btn" id="ofYes" style="margin-top:18px">Customer accepts: record the purchase</button>
    <button class="btn ghost" id="ofBack">Back to the figures</button>
    ${st.visitId ? `<button class="btn ghost" id="ofNo">Customer said no thanks</button>` : ""}</div>`;
  box.querySelector("#ofBack").onclick = renderBuild;
  box.querySelector("#ofYes").onclick = () => {
    localStorage.setItem("offerAccepted", JSON.stringify({visitId: st.visitId, at: new Date().toISOString(),
      items: lines.map(l => ({desc: l.desc || (l.k === "other" ? "Item" : label(l.k) + " gold"), metal: l.k === "other" ? "Mixed / other" : "Gold", purity: PURITY[l.k] || "", hallmark: "", weight: String(l.w || ""), price: String(lineOffer(l)), photos: []}))}));
    localStorage.removeItem("offerDraft");
    location.href = "buying-log/?offer=1" + (st.visitId ? "&visit=" + encodeURIComponent(st.visitId) : "");
  };
  const no = box.querySelector("#ofNo");
  if (no) no.onclick = () => {
    const a = jget("visits", []), v = a.find(x => x._id === st.visitId);
    if (v){ v.status = "nosale"; v.offered = lines.reduce((t, l) => t + lineOffer(l), 0); localStorage.setItem("visits", JSON.stringify(a)); }
    localStorage.removeItem("offerDraft"); close(); if (window.TeamPage) TeamPage.render();
  };
  window.scrollTo(0, 0); box.scrollTop = 0;
}
window.OfferScreen = {open, close};
})();
