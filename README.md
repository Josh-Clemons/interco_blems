# blem-bot

Discord bot that scrapes off-road tire sources, tracks inventory changes, and alerts on new blemished tires. Runs as a persistent Node.js process with a built-in scheduler and SQLite database.

---

## Setup

**Prerequisites:** Node.js 18+, PM2 (for production)

```bash
npm install
cp .env.example .env   # fill in values — see .env.example for descriptions
node index.js          # starts the bot, registers slash commands, begins scraping
```

The bot registers slash commands on startup. If `DISCORD_GUILD_ID` is set, commands appear instantly in that server. Without it, global registration takes up to an hour to propagate.

### Discord application setup (one-time)

1. [discord.com/developers](https://discord.com/developers/applications) → New Application
2. **Bot** tab → Reset Token → copy to `DISCORD_BOT_TOKEN`
3. **OAuth2 → General** → copy Application ID → `DISCORD_CLIENT_ID`
4. **OAuth2 → URL Generator** — Scopes: `bot`, `applications.commands` — Permissions: `Send Messages`, `Send Messages in Threads`, `Embed Links`, `Use Slash Commands`, `Read Message History` — invite the bot with the generated URL

### Production (PM2)

```bash
pm2 start index.js --name blem-bot
pm2 save
pm2 startup   # installs pm2 as a system service so it restarts on reboot
```

The bot requires a persistent WebSocket connection. PM2 (or equivalent supervisor) is mandatory — if the process dies without auto-restart, scraping and alerts stop.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | — | Bot token from Discord developer portal |
| `DISCORD_CLIENT_ID` | — | Application ID for command registration |
| `DISCORD_GUILD_ID` | — | Server ID for dev (instant commands); omit for global |
| `DISCORD_ALERT_CHANNEL_ID` | — | Channel that receives automatic blem alerts |
| `DB_PATH` | `./blems.db` | SQLite database path |
| `CRON_SCHEDULE` | `0 */30 6-18 * * 1-5` | node-cron schedule for regular scrapers |
| `ALERTS_ENABLED` | `true` | Set `false` to scrape without sending any notifications |
| `PUBLIC_ALERT_MIN_DIAMETER` | `35` | Minimum tire diameter (inches) for public feed alerts; set `0` to disable |
| `SMTP_HOST/PORT/USER/PASS/FROM` | — | Email notifier (leave `SMTP_USER` blank to disable) |
| `NOTIFY_EMAILS` | — | Comma-separated email alert recipients |
| `SIMPLETIRE_MAX_FAILURES` | `2` | Consecutive failures before SimpleTire circuit opens |
| `SIMPLETIRE_COOLDOWN_MINS` | `60` | Minutes before SimpleTire circuit allows retry |

---

## Run modes

**Normal (scheduler + bot):**
```bash
node index.js
```
Starts the Discord bot, registers commands, runs all regular scrapers immediately, then on schedule.

**SimpleTire-only full crawl (no bot):**
```bash
npm run simple-tire
# or: node index.js --simple-tire
```
Runs `runSimpleTireFull()` directly and exits. Use this to trigger the nightly crawl manually or from an external scheduler.

**Testing:**
```bash
npm test
```

---

## Scrape schedule

| Scrapers | Schedule | Times |
|---|---|---|
| interco, treadwright, tiremart | Mon–Fri, every 30 min | 6:00 AM – 6:00 PM Central |
| simpletire | Daily | 2:00 AM Central |

Regular scrapers run on the first tick after startup, then on schedule. Simpletire runs as a separate nightly crawl because the full catalog takes several hours — it is intentionally excluded from the 30-minute loop.

To override the schedule: set `CRON_SCHEDULE` (6-field node-cron format, `America/Chicago` timezone) or `NIGHTLY_SCHEDULE` (simpletire) in `.env`.

---

## Discord commands

### Browse

**`/blems`** — List currently available blemished tires. All options are optional.

| Option | Type | Description |
|---|---|---|
| `source` | string | Filter by source name (e.g. `interco`) |
| `brand` | string | Brand substring match (case-insensitive) |
| `size_min` | integer | Minimum overall tire diameter in inches |
| `size_max` | integer | Maximum overall tire diameter in inches |
| `rim` | integer | Exact rim diameter in inches (e.g. `17`) |
| `price_max` | number | Maximum price in dollars |
| `include_oos` | boolean | Include out-of-stock tires (hidden by default) |

Results are paginated. Pagination buttons expire after 10 minutes.

---

**`/find <query>`** — Full-text search across all scraped inventory (blems and regular).

| Option | Type | Description |
|---|---|---|
| `query` | string | Matches sku, brand, title, size, or source name |
| `size` | integer | Overall diameter filter |
| `rim` | integer | Exact rim diameter |
| `source` | string | Limit to one source |

Returns up to 10 results per source, grouped by source. Results are from the local database — they reflect the most recent scrape, not a live site fetch.

---

**`/sources`** — Lists all registered scrapers with active tire counts and last scrape time.

---

**`/history <sku>`** — Shows the price/qty change timeline for a specific SKU.

| Option | Type | Description |
|---|---|---|
| `sku` | string | The tire SKU (required) |
| `source` | string | Disambiguate if same SKU exists on multiple sources |

---

**`/stats`** — Bot-wide stats: tire counts per source, recent add/remove activity, last scrape times per source.

---

**`/ping`** — Health check. Confirms the bot is alive and responding.

---

### Subscriptions

**`/subscribe`** — Create a personal alert subscription. Two use cases:

**Broad subscription** — alert when any new blem matches your criteria:
```
/subscribe size_min:37 brand:bogger
/subscribe source:tiremart price_max:400
```

**Pinned watch** — alert on any event (including changes and removals) for a specific SKU:
```
/subscribe sku:XBOG-3712 track_changes:true track_removed:true
```

| Option | Type | Description |
|---|---|---|
| `sku` | string | Pin an exact SKU |
| `brand` | string | Brand substring match |
| `size` | string | Exact size string (e.g. `37x12.50R17LT`) |
| `size_min` | integer | Minimum tire diameter |
| `rim` | integer | Exact rim diameter |
| `price_max` | number | Maximum price |
| `source` | string | Limit to one source |
| `track_changes` | boolean | Alert on qty/price changes (requires a narrowing filter) |
| `track_removed` | boolean | Alert when a matching tire disappears (requires a narrowing filter) |
| `notify_dm` | boolean | DM alerts (default `true`). Set `false` to post to a channel instead |
| `channel` | channel | Channel for alerts when `notify_dm` is false (defaults to current channel) |

`track_changes` and `track_removed` require at least one of `sku`, `brand`, `size`, `size_min`, or `rim` — this prevents firehose subscriptions that would trigger on every tire change.

For DM delivery, your privacy settings must allow messages from server members.

---

**`/subscriptions`** — List your active subscriptions with their IDs and filter details.

**`/unsubscribe <id>`** — Remove a subscription by ID. IDs are shown in `/subscriptions` output.

---

### Admin (requires Manage Server permission)

**`/admin scrape [source]`** — Trigger an immediate scrape outside the normal schedule. Omit `source` to scrape all regular sources. Specifying `source:simpletire` runs the full nightly crawl — expect it to take several hours.

**`/admin sources`** — All registered scrapers with URL, active tire count, last run time, and last error (if any).

**`/admin runs [source] [limit]`** — Recent scrape run log. Default 10, max 25 entries. Shows timestamp, source, add/remove/change counts, duration, and any errors.

**`/admin errors`** — All scrape runs that ended with an error in the last 7 days.

---

## Alert model

Every scrape produces a diff: `added`, `reactivated`, `changed`, `removed`, `unchanged`. Two separate alert paths run after each diff:

**Public feed** (`DISCORD_ALERT_CHANNEL_ID`) — fires on `added` and `reactivated` only. Two filters apply:
1. **Diameter threshold** — tires with overall diameter below `PUBLIC_ALERT_MIN_DIAMETER` (default 35") are excluded.
2. **Availability** — tires with `stock_state=out_of_stock`, `quantity_n <= 0`, or unavailable quantity text ("out of stock", "sold out", "unavailable", "backorder", etc.) are excluded.

The full database retains all tires regardless of these filters. `/blems` and `/find` always show the complete inventory.

**Per-user subscriptions** — each subscription is tested against `added` + `reactivated` (and optionally `changed` + `removed` for watches). Subscription filters (brand, size_min, rim, price_max, sku, source) apply independently of the public feed filters. A user with a `size_min:30` subscription will receive alerts for 30" tires even if `PUBLIC_ALERT_MIN_DIAMETER=35`.

Per-user dedup: if multiple subscriptions match the same tire in one scrape run, the user gets one message, not one per subscription.

---

## Scrapers

All scrapers return a normalized tire object. Key fields:

| Field | Description |
|---|---|
| `sku` | Source-assigned identifier, unique per source |
| `brand` | Tire brand |
| `size` | Raw size string from the site (e.g. `37x12.50R17LT`) |
| `price_cents` | Price in US cents (integer) |
| `is_blem` | 1 if blemished, 0 if regular inventory |
| `stock_state` | `in_stock` \| `low_stock` \| `out_of_stock` \| `unknown` |
| `quantity_n` | Integer quantity when the site exposes a real count; null otherwise |
| `quantity_raw` | Verbatim quantity text from the site |
| `product_url` | Link to the product page |

`overall_diam` and `rim_diam` are derived from `size` on upsert and stored for filtering.

---

### interco

- **URL:** `https://www.intercotire.com/blem-list`
- **Method:** HTML scrape via cheerio
- **Schedule:** regular (Mon–Fri, every 30 min)
- **What it captures:** Every row from the blem list table. All records are `is_blem=1`. Fields: sku, title, brand, size, quantity (numeric), price. Stock state derived from quantity: > 4 = `in_stock`, 1–4 = `low_stock`, 0 = `out_of_stock`.
- **Gotchas:** Rows missing sku or size are skipped. No product image, no MSRP.

### treadwright

- **URL:** `https://www.treadwright.com/collections/filter`
- **Method:** Shopify JSON API (`/products.json?limit=250&page=N`)
- **Schedule:** regular (Mon–Fri, every 30 min)
- **What it captures:** All products of type `Tire`. Each product has multiple variants (wear tiers: Standard Wear, Premier Wear, Winter Kedge) — each variant becomes a separate row. Blem detection: `tags` array includes `"blemish"` → `is_blem=1`; otherwise `is_blem=0`. Fields: sku (from `variant.sku`), brand (always `TreadWright`), size, price_cents, msrp_cents, stock_state (`available` → `in_stock`; otherwise `out_of_stock`), weight_oz, load_range, ply, category (mud/all-terrain from tags), product_line (e.g. `CLAW II`), wear_tier in `extra`.
- **Gotchas:** Shopify does not expose exact inventory counts — `quantity_n` is always null. Stock is binary (available/unavailable). Size is parsed from the title with a regex; falls back to `extractSizeToken()` if the regex doesn't match. Both blemished and regular catalog tires are included in the same source.

### tiremart

- **URL:** `https://www.tiremart.com/blemished-tires/`
- **Method:** HTML scrape via cheerio (BigCommerce SSR)
- **Schedule:** regular (Mon–Fri, every 30 min)
- **What it captures:** All products on the blemished-tires page. All records are `is_blem=1`. Fields: sku (from `data-sku` attribute), brand, title, size (parsed from spec text), price_cents, msrp_cents, load_index, speed_rating, load_range, ply, category (mud/all-terrain/extreme-terrain from performance icon), stock (from `data-current-stock` attribute). Stock state: > 4 = `in_stock`, 1–4 = `low_stock`, 0 = `out_of_stock`; falls back to `.stock_level` text if the numeric attribute is missing.
- **Gotchas:** `robots.txt` specifies a 10-second crawl delay; the scraper uses a single request to the listing page (no multi-page crawl, no extra delay needed). Brand may be null for entries where TireMart uses "BLEM" as a generic placeholder. Rows missing sku or size are skipped.

### simpletire

- **URL:** `https://simpletire.com/categories/mud-terrain-tires` (and `all-terrain-tires`)
- **Method:** HTML scrape via cheerio (Next.js SSR) with per-page delays
- **Schedule:** nightly only — 2 AM Central via `runSimpleTireFull()`, excluded from regular 30-min loop
- **What it captures:** Off-road tire catalog across mud-terrain and all-terrain categories. All records are `is_blem=0` — SimpleTire does not sell blemished tires. Value is spec richness: full tire specs from JSON-LD on individual SKU pages. Scrapes category pages to collect product lines, then scrapes each SKU page individually (this is why it takes hours and runs nightly rather than every 30 min).
- **Circuit breaker:** After `SIMPLETIRE_MAX_FAILURES` (default 2) consecutive request failures or block-page detections ("access denied", "resolving issues", "please try again later"), the circuit opens and all requests are skipped for `SIMPLETIRE_COOLDOWN_MINS` (default 60) minutes. `/admin sources` will report the open circuit.
- **Gotchas:** Uses a browser-like User-Agent to avoid bot detection (unlike other scrapers which use `BlemBot/1.0`). Includes inter-request sleeps. `quantity_n` is not available from SimpleTire pages — `stock_state` is derived from availability signals on the page.

---

## Database

SQLite at `DB_PATH` (default `./blems.db`). Schema is applied automatically on startup via idempotent migrations in `src/db/client.js`. Key tables:

| Table | Purpose |
|---|---|
| `tires` | Current inventory — one row per (source, sku). Contains full tire fields plus `overall_diam`, `rim_diam`, `first_seen_at`, `last_seen_at`, `active`. |
| `tire_history` | Append-only event log: `added`, `returned`, `changed`, `removed` events with old/new values |
| `scrape_runs` | One row per scrape execution: source, start/finish time, tire counts, error |
| `subscriptions` | Per-user alert subscriptions |
| `users` | Discord user records (snowflake ID + username) |
| `email_log` | Sent email records |

Tires are never deleted from `tires` — when a tire disappears from a source it is marked `active=0` (`deactivated`). It reappears as `active=1` with a `returned` event if it shows up in a later scrape.

---

## Troubleshooting

**Bot not responding to commands** — check that the process is running (`pm2 status`). Check `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` in `.env`. Slash commands take up to 1 hour to propagate without `DISCORD_GUILD_ID` set.

**No alerts posting** — verify `ALERTS_ENABLED=true` and `DISCORD_ALERT_CHANNEL_ID` is set to a valid channel the bot has `Send Messages` permission in. Check that tires are actually being scraped (`/admin runs`).

**Alerts exist but skip certain tires** — check `PUBLIC_ALERT_MIN_DIAMETER`. Tires under the threshold are in the DB (visible in `/blems`) but suppressed from the public feed. Also check stock state — out-of-stock tires are always suppressed from the public feed regardless of diameter.

**SimpleTire returning 0 tires** — the circuit breaker may have tripped. Check `/admin sources` for the error state. Wait for the cooldown (default 60 min) or restart the process to reset the in-memory circuit state.

**DMs not arriving for subscriptions** — the user needs to allow messages from server members (Discord privacy settings → allow DMs from server members).

**`DATABASE_LOCKED` errors** — another process has the SQLite file open. Check for stale `node index.js` processes with `ps aux | grep node`.
