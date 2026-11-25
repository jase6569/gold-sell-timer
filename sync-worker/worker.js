// Dorset Gold & Jewellery team sync: a small Cloudflare Worker with a D1 database.
//
// The phones encrypt everything (AES-256-GCM, key made from the business passphrase) before sending it,
// so this Worker and the database only ever hold scrambled data. It can't read customers' details,
// photos or figures, and neither can anyone who gets into the Cloudflare account.
//
// POST /pull  {since}         -> {docs: [{id, rev, at, who, del, data}], rev, more}
// POST /push  {docs: [...]}   -> {rev}  (a document is only replaced by a newer one: last change wins)
// POST /history {id}          -> {versions: [{at, who, del, data, current}]}   every saved version of one item, newest first
// POST /recent {before, limit} -> {changes: [{id, at, who, del}]}              who changed what, newest first (no contents)
// POST /forget {id, photos}   -> {ok}   erase an item's earlier versions and the listed photos, here and in the backup
// POST /backupstatus {}       -> {last, items, size}  when the nightly backup last ran
//
// Nightly backup (needs a second D1 database bound as BACKUP and a Cron Trigger, see README.md): at midnight UK time
// every new or changed item (still encrypted) is copied into the backup database, which keeps every version.
// Versions and backups older than 7 years are removed each night, so personal data isn't kept forever.
//
// Nothing is ever thrown away: when an item is changed or deleted, the version it replaces is kept in "history"
// (still encrypted). Photos are never changed once sent, so they aren't copied.
//
// Setup (see README.md): a D1 database bound as DB, and a secret AUTH_HASH, which the app shows
// when the business passphrase is first set. The table is created automatically.

const ALLOWED = ["https://jase6569.github.io"];
const MAX_DOC = 1_800_000, MAX_BODY = 8_000_000, PAGE = 400, PAGE_BYTES = 2_000_000;

function cors(origin){
  return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400", "Vary": "Origin"};
}
const reply = (obj, status, origin) => new Response(JSON.stringify(obj), {status, headers: {"Content-Type": "application/json", ...cors(origin)}});

async function sha256hex(s){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function sameText(a, b){   // constant-time compare
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

let ready = false;
async function setup(db){
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS docs (id TEXT PRIMARY KEY, rev INTEGER NOT NULL, at TEXT NOT NULL, who TEXT, del INTEGER NOT NULL DEFAULT 0, data TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS docs_rev ON docs(rev)"),
    db.prepare("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)"),
    db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('rev', 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS history (id TEXT NOT NULL, rev INTEGER, at TEXT NOT NULL, who TEXT, del INTEGER NOT NULL DEFAULT 0, data TEXT, replaced TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS history_id ON history(id, at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS history_at ON history(at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS docs_at ON docs(at)")
  ]);
  ready = true;
}

/* ---------- nightly backup ---------- */
let bready = false;
async function setupBackup(b){
  if (bready) return;
  await b.batch([
    b.prepare("CREATE TABLE IF NOT EXISTS bdocs (id TEXT NOT NULL, at TEXT NOT NULL, who TEXT, del INTEGER NOT NULL DEFAULT 0, data TEXT, copied TEXT NOT NULL, PRIMARY KEY (id, at))"),
    b.prepare("CREATE INDEX IF NOT EXISTS bdocs_copied ON bdocs(copied)"),
    b.prepare("CREATE TABLE IF NOT EXISTS bruns (at TEXT PRIMARY KEY, items INTEGER, copied INTEGER, upto INTEGER)")
  ]);
  bready = true;
}
const londonHour = d => +new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/London", hour: "numeric", hourCycle: "h23"}).format(d);
async function runBackup(env){
  await setup(env.DB); await setupBackup(env.BACKUP);
  const last = await env.BACKUP.prepare("SELECT upto FROM bruns ORDER BY at DESC LIMIT 1").first();
  let since = last ? last.upto : 0, copied = 0; const now = new Date().toISOString(), started = Date.now();
  // copy every item changed since the last run (photos included), a page at a time, still encrypted
  while (Date.now() - started < 25000){
    const {results} = await env.DB.prepare("SELECT id, rev, at, who, del, data FROM docs WHERE rev > ? ORDER BY rev LIMIT 50").bind(since).all();
    if (!results.length) break;
    await env.BACKUP.batch(results.map(r => env.BACKUP.prepare("INSERT OR IGNORE INTO bdocs (id, at, who, del, data, copied) VALUES (?, ?, ?, ?, ?, ?)").bind(r.id, r.at, r.who, r.del, r.data, now)));
    copied += results.length; since = results[results.length - 1].rev;
  }
  const items = (await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE del = 0").first()).n;
  await env.BACKUP.prepare("INSERT OR REPLACE INTO bruns (at, items, copied, upto) VALUES (?, ?, ?, ?)").bind(now, items, copied, since).run();
  // data protection: nothing older than 7 years is kept, in the history or the backup (the current version of each item stays)
  const cut = new Date(Date.now() - 7 * 365.25 * 864e5).toISOString();
  await env.DB.prepare("DELETE FROM history WHERE replaced < ?").bind(cut).run();
  await env.BACKUP.prepare("DELETE FROM bdocs WHERE at < ?1 AND EXISTS (SELECT 1 FROM bdocs b2 WHERE b2.id = bdocs.id AND b2.at > bdocs.at)").bind(cut).run();
  await env.BACKUP.prepare("DELETE FROM bruns WHERE at < ?").bind(cut).run();
  return {copied, items};
}

export default {
  // Cron Triggers at 23:00 and 00:00 UTC: whichever is midnight in the UK (GMT or BST) does the backup
  async scheduled(event, env, ctx){
    if (!env.DB || !env.BACKUP) return;
    if (londonHour(new Date(event.scheduledTime || Date.now())) !== 0) return;
    ctx.waitUntil(runBackup(env));
  },
  async fetch(req, env){
    const origin = req.headers.get("Origin") || "";
    const allowed = ALLOWED.concat(String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean));
    if (!allowed.includes(origin)) return new Response("Not allowed", {status: 403});
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: cors(origin)});
    if (req.method !== "POST") return reply({error: "POST only"}, 405, origin);
    if (!env.DB || !env.AUTH_HASH) return reply({error: "The sync service isn't set up yet."}, 500, origin);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/, "");
    if (!/^[0-9a-f]{64}$/.test(token) || !sameText(await sha256hex(token), env.AUTH_HASH.trim().toLowerCase()))
      return reply({error: "Wrong business passphrase."}, 401, origin);

    const len = +(req.headers.get("Content-Length") || 0);
    if (len > MAX_BODY) return reply({error: "Too much at once."}, 413, origin);
    let body;
    try { body = await req.json(); } catch(e){ return reply({error: "Bad request"}, 400, origin); }
    await setup(env.DB);
    const path = new URL(req.url).pathname.replace(/\/$/, "");

    if (path === "/pull"){
      const since = Math.max(0, parseInt(body.since, 10) || 0);
      // look at sizes first, so a page never carries more than about 2 MB (photos add up fast on a new phone)
      const {results: sizes} = await env.DB.prepare("SELECT rev, COALESCE(length(data), 0) AS n FROM docs WHERE rev > ? ORDER BY rev LIMIT ?").bind(since, PAGE).all();
      let upto = since, total = 0;
      for (const x of sizes){ if (total > 0 && total + x.n > PAGE_BYTES) break; total += x.n; upto = x.rev; }
      const {results} = sizes.length ? await env.DB.prepare("SELECT id, rev, at, who, del, data FROM docs WHERE rev > ? AND rev <= ? ORDER BY rev").bind(since, upto).all() : {results: []};
      const top = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'rev'").first()).v;
      const rev = results.length ? results[results.length - 1].rev : top;
      return reply({docs: results, rev, more: rev < top}, 200, origin);
    }

    if (path === "/push"){
      const docs = Array.isArray(body.docs) ? body.docs.slice(0, 500) : [];
      for (const d of docs){
        if (typeof d.id !== "string" || d.id.length > 200 || typeof d.at !== "string" || d.at.length > 40) return reply({error: "Bad document"}, 400, origin);
        if (d.data != null && (typeof d.data !== "string" || d.data.length > MAX_DOC)) return reply({error: "A document is too large"}, 413, origin);
      }
      let rev = 0;
      for (const d of docs){
        // newer change wins; equal times keep the first one in
        const r = await env.DB.batch([
          env.DB.prepare(`INSERT INTO history (id, rev, at, who, del, data, replaced) SELECT id, rev, at, who, del, data, ?3 FROM docs
            WHERE id = ?1 AND ?2 > docs.at AND substr(id, 1, 2) <> 'p:'`).bind(d.id, d.at, new Date().toISOString()),
          env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"),
          env.DB.prepare(`INSERT INTO docs (id, rev, at, who, del, data) VALUES (?1, (SELECT v FROM meta WHERE k = 'rev'), ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET rev = excluded.rev, at = excluded.at, who = excluded.who, del = excluded.del, data = excluded.data
            WHERE excluded.at > docs.at`).bind(d.id, d.at, String(d.who || "").slice(0, 40), d.del ? 1 : 0, d.del ? null : d.data),
          env.DB.prepare("SELECT v FROM meta WHERE k = 'rev'")
        ]);
        rev = r[3].results[0].v;
      }
      return reply({rev}, 200, origin);
    }
    if (path === "/history"){
      const id = String(body.id || "");
      if (!id || id.length > 200) return reply({error: "Bad request"}, 400, origin);
      const cur = await env.DB.prepare("SELECT at, who, del, data FROM docs WHERE id = ?").bind(id).first();
      const {results} = await env.DB.prepare("SELECT at, who, del, data FROM history WHERE id = ? ORDER BY at DESC LIMIT 60").bind(id).all();
      return reply({versions: (cur ? [Object.assign({current: 1}, cur)] : []).concat(results)}, 200, origin);
    }

    if (path === "/forget"){   // data protection: erase the old versions of one item, and photos no longer needed
      const id = String(body.id || ""), photos = Array.isArray(body.photos) ? body.photos.slice(0, 50) : [];
      if (!id || id.length > 200 || photos.some(h => !/^[0-9a-f]{64}$/.test(h))) return reply({error: "Bad request"}, 400, origin);
      const st = [env.DB.prepare("DELETE FROM history WHERE id = ?").bind(id)];
      for (const h of photos) st.push(env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"),
        env.DB.prepare("UPDATE docs SET del = 1, data = NULL, at = ?2, rev = (SELECT v FROM meta WHERE k = 'rev') WHERE id = ?1").bind("p:" + h, new Date().toISOString()));
      await env.DB.batch(st);
      if (env.BACKUP){   // the backup keeps only the current version of an erased item, and none of its photos
        await setupBackup(env.BACKUP);
        const cur = await env.DB.prepare("SELECT at FROM docs WHERE id = ?").bind(id).first();
        const bs = [env.BACKUP.prepare("DELETE FROM bdocs WHERE id = ?1 AND at <> ?2").bind(id, cur ? cur.at : "")];
        for (const h of photos) bs.push(env.BACKUP.prepare("DELETE FROM bdocs WHERE id = ?").bind("p:" + h));
        await env.BACKUP.batch(bs);
      }
      return reply({ok: 1}, 200, origin);
    }

    if (path === "/backupstatus"){
      if (!env.BACKUP) return reply({set: false}, 200, origin);
      await setupBackup(env.BACKUP);
      const m = await env.BACKUP.prepare("SELECT at, items, copied FROM bruns ORDER BY at DESC LIMIT 1").first();
      const n = await env.BACKUP.prepare("SELECT COUNT(*) AS n FROM bdocs").first();
      return reply({set: true, last: m ? m.at : null, copied: m ? m.copied : 0, items: m ? m.items : 0, versions: n ? n.n : 0}, 200, origin);
    }

    if (path === "/recent"){
      const before = typeof body.before === "string" && body.before.length < 40 ? body.before : "9999";
      const limit = Math.min(200, Math.max(1, parseInt(body.limit, 10) || 100));
      const {results} = await env.DB.prepare(`SELECT id, at, who, del FROM (
          SELECT id, at, who, del FROM docs WHERE at < ?1 AND at > '2001' AND substr(id, 1, 2) <> 'p:'
          UNION ALL SELECT id, at, who, del FROM history WHERE at < ?1 AND at > '2001')
        ORDER BY at DESC LIMIT ?2`).bind(before, limit).all();
      return reply({changes: results}, 200, origin);
    }

    return reply({error: "Not found"}, 404, origin);
  }
};
