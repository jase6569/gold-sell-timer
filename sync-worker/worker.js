// Dorset Gold & Jewellery team sync: a small Cloudflare Worker with a D1 database.
//
// The phones encrypt everything (AES-256-GCM, key made from the business passphrase) before sending it,
// so this Worker and the database only ever hold scrambled data. It can't read customers' details,
// photos or figures, and neither can anyone who gets into the Cloudflare account.
//
// POST /pull  {since}         -> {docs: [{id, rev, at, who, del, data}], rev, more}
// POST /push  {docs: [...]}   -> {rev}  (a document is only replaced by a newer one: last change wins)
//
// Setup (see README.md): a D1 database bound as DB, and a secret AUTH_HASH, which the app shows
// when the business passphrase is first set. The table is created automatically.

const ALLOWED = ["https://jase6569.github.io"];
const MAX_DOC = 1_800_000, MAX_BODY = 20_000_000, PAGE = 400;

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
    db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('rev', 0)")
  ]);
  ready = true;
}

export default {
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
      const {results} = await env.DB.prepare("SELECT id, rev, at, who, del, data FROM docs WHERE rev > ? ORDER BY rev LIMIT ?").bind(since, PAGE).all();
      const top = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'rev'").first()).v;
      const rev = results.length ? results[results.length - 1].rev : top;
      return reply({docs: results, rev, more: results.length === PAGE}, 200, origin);
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
          env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"),
          env.DB.prepare(`INSERT INTO docs (id, rev, at, who, del, data) VALUES (?1, (SELECT v FROM meta WHERE k = 'rev'), ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET rev = excluded.rev, at = excluded.at, who = excluded.who, del = excluded.del, data = excluded.data
            WHERE excluded.at > docs.at`).bind(d.id, d.at, String(d.who || "").slice(0, 40), d.del ? 1 : 0, d.del ? null : d.data),
          env.DB.prepare("SELECT v FROM meta WHERE k = 'rev'")
        ]);
        rev = r[2].results[0].v;
      }
      return reply({rev}, 200, origin);
    }
    return reply({error: "Not found"}, 404, origin);
  }
};
