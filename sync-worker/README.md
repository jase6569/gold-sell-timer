# Team sync (Cloudflare Worker + D1)

This is what lets Jase and Mike share one app. It stores stock, the Buy log (records and photos), the visit diary, cash and shared prices. Every phone encrypts everything with the team passphrase before sending it, so this server only ever holds scrambled data. Nobody can read customers' details from it, including anyone who gets into the Cloudflare account.

## Setup (about 15 minutes, once)

1. **Pick the team passphrase.** Use four or five random words, at least 12 characters, for example `copper harbour lantern seven`. Share it with Mike by text or WhatsApp, never by email. If you lose it, the shared data can't be read, so keep a copy somewhere safe.
2. **Get the server code.** Open the app, tap **Team**, then **Sharing**. Type the passphrase, open **Setting up the team server?** and tap **Show the server code**. Copy the long code it shows.
3. **Create the database.** In Cloudflare, go to **Storage & Databases**, then **D1**, then **Create database**. Name it `dg-sync`. Nothing else is needed: the table is made automatically.
4. **Create the Worker.** Go to **Workers & Pages**, then **Create**, then **Worker**. Name it `dg-sync`, paste in `worker.js` and deploy it.
5. **Connect the database.** In the Worker, open **Settings**, then **Bindings**, then **Add**, then **D1 database**. Set the variable name to `DB` and choose `dg-sync`.
6. **Add the secret.** In **Settings**, then **Variables and secrets**, add a **Secret** called `AUTH_HASH` and paste in the server code from step 2. Deploy again.
7. **Tell the app where it is.** Copy the Worker's address (`https://dg-sync.<name>.workers.dev`) into `SYNC_URL` at the top of `sync.js`, then push.
8. **Join.** On each phone, go to **Team**, then **Sharing**, choose who you are, type the passphrase and tap **Join the team**. Jase joins first, so his existing stock and records go up. Mike ticks "Bring in anything saved on this phone from the old Dorset Gold app".

## How it works

* Each item (a lot of gold, a Buy log record, a visit, a cash entry, a shared setting) syncs on its own. The newest change to an item wins, so two people can work at once without overwriting each other's other work.
* Photos are sent once each, and records refer to them, so editing a record doesn't upload its photos again.
* Changes made with no signal wait on the phone and go up when signal comes back. Phones check for changes every minute while the app is open, and whenever it's opened.
* Personal settings stay on each phone: the Buy log PIN, the staff name, the lock time and alert codes.
* Receipt numbers carry each person's initial (DG-20261122-J001, DG-20261122-M001), so two phones can never make the same number.

## History and the activity log

Nothing is ever thrown away. When anything is changed or deleted, the version it replaces is kept (still encrypted) in a `history` table, made automatically. The Shop app shows this under Settings, then Activity (who changed what, and when), and on each sale, bag, piece and customer under **History of changes**, where any earlier version can be put back. Cloudflare also keeps its own copy of the whole database for restoring to any point in the last 7 days on the free plan (D1 Time Travel).

## Nightly backup at midnight

A second D1 database, `dg-backup`, bound to the Worker as `BACKUP`, holds a copy of every version of everything (still encrypted). Cron Triggers at `0 0 * * *` and `0 23 * * *` (UTC) run the Worker; whichever is midnight in the UK (GMT in winter, BST in summer) copies everything new or changed since the last run. Versions and backups older than 7 years are removed each night. Erasing a customer or deleting a purchase record removes its old versions from the backup too. The Shop app shows the last run under Settings, Data protection.

## Changing the passphrase

Set a new `AUTH_HASH` from the new passphrase. Then, on each phone, **Leave the team** and join again with the new passphrase. Data already on the server was locked with the old passphrase, so the first phone to rejoin should be the one with the most complete copy, which then uploads everything again.

## Cost

D1's free allowance (5 GB of storage, 5 million reads a day) is far more than two people will use. The Worker's free allowance is 100,000 requests a day, and each phone makes about one a minute while the app is open.
