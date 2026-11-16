// Gold Trader coin scanner: a small Cloudflare Worker that keeps the AI key secret.
// The app sends 1 to 4 photos plus its list of known coins; this asks Claude what coins are in them
// and returns a short JSON answer. It only answers the Gold Trader apps (jase6569.github.io) and only
// ever runs this one fixed coin question, so it can't be used as a general AI.
// Needs one secret in Cloudflare: ANTHROPIC_API_KEY.

const ALLOWED = ["https://jase6569.github.io"];
const MODEL = "claude-sonnet-5-5";
const MAX_PHOTOS = 4, MAX_PHOTO_CHARS = 2_000_000;

const SYSTEM = `You identify coins for a UK gold and silver dealer from photos taken at the counter.
Reply with JSON only, no other text, in exactly this shape:
{"photo_ok": true, "photo_tip": "", "set": null, "coins": [], "warnings": []}
- "coins": one entry per different coin type you can see:
  {"catalogue": "<exact name copied from the catalogue list, or null if none fits>", "name": "<plain name, e.g. Sovereign 1912 George V>",
   "year": "<year shown, or null>", "count": <how many of this coin>, "metal": "gold" | "silver" | "base" | "unknown",
   "proof": <true if it is a proof or presentation strike>, "confidence": "high" | "medium" | "low", "note": "<under 20 words, or empty>"}
- The same coin photographed on both sides, or in several photos, counts once. Count every separate coin.
- "set": if the coins are a boxed or cased set, {"name": "<set name and year>", "catalogue": "<exact set name from the catalogue, or null>",
  "complete": true | false | null, "certificate": "<what the certificate says, e.g. limited edition and number, or empty>"}; otherwise null.
- For the catalogue field, only use a name that is in the catalogue list and fits the coin's size, design and date. Pre-1920 UK silver and 1920 to 1946 silver differ only by date, so read the date carefully.
- Don't judge whether a coin is genuine from the photo, apart from obvious problems (wrong design, plated wear, a copy stamp). Put any concern in "warnings".
- If the photo is too dark, blurred or far away to read the coins, set "photo_ok": false and say how to retake it in "photo_tip".
- Never invent coins you can't see. If unsure, use "confidence": "low".`;

function cors(origin){
  return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin"};
}
const reply = (obj, status, origin) => new Response(JSON.stringify(obj), {status, headers: {"Content-Type": "application/json", ...cors(origin)}});

export default {
  async fetch(req, env){
    const origin = req.headers.get("Origin") || "";
    if (!ALLOWED.includes(origin)) return new Response("Not allowed", {status: 403});
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: cors(origin)});
    if (req.method !== "POST") return reply({error: "POST only"}, 405, origin);
    if (!env.ANTHROPIC_API_KEY) return reply({error: "The scanner's AI key isn't set up yet."}, 500, origin);

    let body;
    try { body = await req.json(); } catch(e){ return reply({error: "Bad request"}, 400, origin); }
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
    if (!photos.length) return reply({error: "No photo"}, 400, origin);
    for (const p of photos){
      if (typeof p !== "string" || p.length > MAX_PHOTO_CHARS || !/^[A-Za-z0-9+/=]+$/.test(p)) return reply({error: "Photo too large or not a JPEG"}, 400, origin);
    }
    const catalogue = (Array.isArray(body.catalogue) ? body.catalogue : []).slice(0, 300).map(s => String(s).slice(0, 160));

    const content = photos.map(data => ({type: "image", source: {type: "base64", media_type: "image/jpeg", data}}));
    content.push({type: "text", text: "Catalogue list (use these exact names in the catalogue fields):\n" + catalogue.join("\n") + "\n\nIdentify the coins in the photo" + (photos.length > 1 ? "s" : "") + "."});

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {"x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
      body: JSON.stringify({model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{role: "user", content}]})
    });
    if (!r.ok){
      const t = await r.text();
      const why = r.status === 401 ? "The AI key is wrong." : r.status === 429 ? "Too many scans just now, try again in a minute." : /credit|billing/i.test(t) ? "The AI account is out of credit." : "The AI service had a problem.";
      return reply({error: why}, 502, origin);
    }
    const out = await r.json();
    const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    try { return reply({result: JSON.parse(text.slice(a, b + 1))}, 200, origin); }
    catch(e){ return reply({error: "Couldn't read the answer, please try again."}, 502, origin); }
  }
};
