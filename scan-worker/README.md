# Coin scanner (Cloudflare Worker)

`worker.js` lets the app's **Scan with camera** button ask Claude (Anthropic) what coins are in a photo,
without the AI key ever being in the app's public code.

1. Anthropic: console.anthropic.com, add a little credit, set a monthly spend limit, create an API key.
2. Cloudflare: Workers & Pages, create a Worker named `gold-coin-scan`, paste `worker.js`, deploy.
3. In the Worker: Settings, Variables and secrets, add a **Secret** called `ANTHROPIC_API_KEY` with the key.
4. Put the Worker's address (https://gold-coin-scan.<name>.workers.dev) into `SCAN_URL` in index.html, then re-sync Mike's app.

It only answers pages on jase6569.github.io, takes at most 4 photos, and only asks the fixed coin question.
