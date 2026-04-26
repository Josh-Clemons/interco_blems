# Blem Bot - Full Discord Bot Roadmap

**Goal:** Evolve the current scraper into a full-featured Discord bot that alerts on new
blem tires, lets users define targeted subscriptions (including pinned-SKU watches), and
supports cross-source tire discovery.

**Current state (implemented):**
- Discord.js bot is the long-running process + scheduler host
- Active scheduled scrapers: `interco`, `treadwright`, `tiremart` (every 30 min, Mon–Fri 6am–6pm Central)
- `simpletire` runs as a separate nightly full crawl at 2 AM Central via `runSimpleTireFull()` — intentionally excluded from the normal scraper registry since the crawl takes several hours
- SQLite v2 model in production: `tires`, `email_log`, `users`, `subscriptions`, `tire_history`, `scrape_runs`
- Public alert feed + per-user subscription fan-out both active
- Live slash commands: `/ping`, `/blems`, `/find`, `/sources`, `/subscribe`, `/subscriptions`, `/unsubscribe`, `/history`, `/stats`

**Architecture going forward:**
- Keep Discord client as the persistent process (PM2/supervisor required)
- Continue scheduled inventory ingestion + diff tracking in-process
- Keep the unified subscription model (broad filters + pinned watch behavior in one table)
- Keep `/find` as backend DB search (no live-site scraping in command handlers)
- Standardize rim filtering to exact rim size matching (not min/max ranges)
- Enforce alert eligibility so out-of-stock/unavailable tires do not trigger blem alerts
- Add admin control surface (`/admin` subcommands)
- Add documentation and NL-search phases (README + LLM-assisted search)
- Add additional protected scrapers only if proxy/bypass infra is approved

**Alert routing model (applies across all phases):**
- `DISCORD_ALERT_CHANNEL_ID` is the default public feed — always receives every
  new/reactivated tire alert. Think of it as a built-in, always-on "everyone"
  subscription that survives even after Phase 3 adds per-user subs.
- Starting in Phase 3, per-user subscriptions are layered *on top* of the public
  feed, not replacing it. Users opt in to filtered DMs/channel posts.
- Starting in Phase 4, the dispatcher also handles qty/price/removal events for
  watchlist users (subscriptions only care about new/reactivated).

**Runtime requirement (Phase 1 onward):**
Once the Discord bot is the entry point, this becomes a persistent service —
it must stay connected 24/7. discord.js handles WebSocket auto-reconnect, but
the Node process itself needs a supervisor so crashes restart cleanly. Minimum
viable: `pm2 start index.js --name blem-bot && pm2 save`. Document this in
Phase 1's README updates.

---

## Phase 1 — Discord Bot Foundation
*Replace the one-way webhook with a real discord.js bot that can receive and respond to commands.*

### What changes
- Add `discord.js` dependency
- Register slash commands with Discord's API on startup
- Replace `src/notifier/discord.js` (webhook) with a bot client that can post embeds AND receive commands
- Entry point restructured: bot client is the persistent process, scheduler lives inside it
- Keep email notifier untouched

### New files
```
src/
  bot/
    client.js        <- discord.js Client singleton, login, ready handler
    commands/
      index.js       <- command registry (loads all commands, registers with Discord API)
      ping.js        <- /ping — health check, confirms bot is alive
      blems.js       <- /blems — list / filter stored blem tires (Phase 2)
      find.js        <- /find — backend DB search across scraped inventory (Phase 7)
      sources.js     <- /sources — scraper registry + source-level counts
      subscribe.js   <- /subscribe (Phase 3/4 unified model)
      unsubscribe.js <- /unsubscribe (Phase 3)
      subscriptions.js <- /subscriptions (Phase 3)
      history.js     <- /history (Phase 8)
      stats.js       <- /stats (Phase 8)
      admin.js       <- /admin (planned, Phase 11)
    interactions.js  <- routes incoming interactions to the right command handler
    embeds.js        <- shared embed builder helpers (tire cards, paginated lists)
```

### .env additions
```
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DISCORD_GUILD_ID=your-server-id   # for fast dev command registration; omit for global
DISCORD_ALERT_CHANNEL_ID=channel-snowflake-for-automatic-alerts
```

### Discord application setup (one-time)
1. discord.com/developers -> New Application
2. Bot tab -> Add Bot -> copy token -> DISCORD_BOT_TOKEN
3. OAuth2 -> General -> copy Client ID -> DISCORD_CLIENT_ID
4. OAuth2 -> URL Generator:
   - Scopes:      `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Send Messages in Threads`,
                  `Embed Links`, `Use Slash Commands`, `Read Message History`
5. Use generated URL to invite bot to your server

### Schema additions (Phase 1 - none)
No schema changes needed yet. Bot posts alerts to a fixed channel.

### Key implementation note
discord.js requires a persistent WebSocket connection. The bot client starts first,
then the scheduler is initialized inside the `client.ready` event so the bot is
confirmed online before any scraping begins.

```js
// index.js (new structure)
client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
    runAll();              // first scrape immediately
    startScheduler(runAll); // then on schedule
});
client.login(process.env.DISCORD_BOT_TOKEN);
```

---

## Phase 2 — Interactive Browsing Commands
*Let users query the current blem list directly from Discord without waiting for an alert.*

### Commands

```
/blems [source] [size_min] [size_max] [brand] [price_max]
  Lists stored blem tires. All filters optional — no args shows everything.
  size_min / size_max are integers (diameter in inches, e.g. 37).
  Paginated if > 10 results (prev/next buttons via message components).

/sources
  Lists all registered scrapers, their URLs, last successful scrape time,
  and how many active tires they have.
```

Note: originally had a separate `/search` command, but consolidated into `/blems`
with optional filter args. `/find` remains a cross-source DB search against stored
inventory (by design — scheduled scrapes keep the dataset current).

### Embed design (shared in `src/bot/embeds.js`)
Each tire card shows:
- SKU + link to product page (if available)
- Brand | Size | Qty | Price
- Source badge (small footer text)
- first_seen_at timestamp

Paginated lists use discord.js ActionRows with Back/Next buttons.
Discord limits 25 fields per embed and 10 embeds per message — pagination handles overflow.

### Schema additions (Phase 2 - none)
No new tables. Queries run against existing `tires` table.

New repository functions needed:
```js
// src/db/repository.js additions
getActiveTires(filters)         // { source, brand, sizeMin, sizeMax, priceMax }
getTireSources()                // distinct sources + stats
```

---

## Phase 3 — User Alert Subscriptions
*Each user picks what they want to be alerted on instead of everyone getting a firehose.*

### Commands

```
/subscribe [size_min] [brand] [price_max] [source] [notify_dm] [channel]
  Creates a subscription for the calling user.
  All filters optional — no filters = "alert me on everything."
  notify_dm: true (default) = DM the user
  channel: when notify_dm is false, specify which channel receives alerts.
           Defaults to the channel where /subscribe was invoked.
  Returns confirmation with subscription ID.

/subscriptions
  Lists your active subscriptions with their IDs and filter criteria.

/unsubscribe <id>
  Removes a subscription by ID.
  "id" comes from /subscriptions output.
```

### How alert dispatch changes
After every scrape, the bot dispatches alerts in this order:
1. Post the full alert (all new + reactivated tires) to `DISCORD_ALERT_CHANNEL_ID`
   — this public feed continues to fire as in Phase 1, unfiltered.
2. Query all active per-user subscriptions
3. For each subscription, test whether any alert tires match its filters
4. Fan out — DM the subscriber or post to their chosen channel
5. De-dupe per user: if a user has 3 subscriptions and 2 match the same tire,
   they get one message (not three)
6. DM failures (user blocked bot / closed DMs) are logged and surfaced
   gracefully — subscription stays active, user is told once via the public
   channel if possible

The public feed guarantees the bot is always useful even before anyone subscribes.

### New schema
```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,   -- Discord user snowflake ID
    username    TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id),
    source      TEXT,           -- NULL = all sources
    brand       TEXT,           -- NULL = any brand (case-insensitive LIKE match)
    size_min    INTEGER,        -- minimum diameter in inches, NULL = no minimum
    price_max   REAL,           -- NULL = no maximum
    notify_dm   INTEGER DEFAULT 1,     -- 1 = DM user
    notify_channel TEXT,               -- Discord channel ID (used if notify_dm = 0)
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
);
```

### Subscription matching logic (pure function, fully testable)
```js
// src/subscriptions.js
function tireMatchesSubscription(tire, sub) {
    if (sub.source && tire.source !== sub.source) return false;
    if (sub.brand && !tire.brand.toLowerCase().includes(sub.brand.toLowerCase())) return false;
    if (sub.size_min && parseDiameter(tire.size) < sub.size_min) return false;
    if (sub.price_max && parsePrice(tire.price) > sub.price_max) return false;
    return true;
}
```

### Key UX note
When a user subscribes and the bot needs to DM them, they must have DMs open from
server members. The bot should catch the DM failure gracefully and tell them in-channel.

---

## Phase 4 — Pinned SKU Watches (merged into /subscribe) ✅

Rather than introduce a separate `/watch` command and `watchlist` table, Phase 4
extended the existing subscription model. A "watch" is just a subscription with
`sku` set and `track_changes` / `track_removed` enabled — same table, same
dispatcher, same command.

### Schema additions (columns on `subscriptions`)
- `sku`            — exact SKU pin (case-insensitive); null = any
- `size`           — exact size string match; null = any
- `notify_changed` — also alert on qty/price changes
- `notify_removed` — also alert when a matching tire disappears

Migrations run idempotently in `src/db/client.js` via PRAGMA-guarded ALTER TABLE.

### /subscribe extensions
New options: `sku`, `size`, `track_changes`, `track_removed`. Guard: if
`track_changes` or `track_removed` is set, at least one narrowing filter
(`sku`, `brand`, `size`, or `size_min`) is required to prevent firehose spam.

### Dispatcher changes
`buildUserHits` now walks `added` + `reactivated` for all subs, plus `changed`
for notify_changed subs, plus `removed` for notify_removed subs. Per-user dedup
keeps a single message even when broad + pinned subs both match the same tire;
the pinned flag wins for styling.

### Embed distinction
`src/notifier/subscriptionDispatch.js` groups hits by event (🟢 new, 🔄
reactivated, 🔁 changed, 🗑️ removed) and uses orange+🔔 for any entry with a
pinned SKU, blurple+🔔 otherwise.

### Commands

Phase 4 is implemented through `/subscribe` extensions (no separate `/watch` command
family). The legacy `/watch`, `/watchlist`, `/unwatch` command sketch below is retained
as historical context only and should not be implemented unless the unified model is
explicitly revisited.

```
/watch <sku> [source]
  Watch a specific tire SKU. Notified immediately on any change: reappears,
  qty changes, price changes (all events, not just new/reactivated).
  Optional source to disambiguate if same SKU exists on multiple sites.

/watch brand:<brand> size:<size>
  Watch for any tire matching a brand + size combo (great for "tell me when a
  37x12.5 Bogger appears as a blem").

/watchlist
  Shows your active watches with IDs.

/unwatch <id>
  Removes a watch entry.
```

### Implementation reality
- No separate `watchlist` table exists in the current codebase.
- Watch behavior is represented in `subscriptions` via `sku` + `notify_changed` + `notify_removed`.
- Dispatcher fan-out over `added/reactivated/changed/removed` is already implemented in `src/subscriptions.js`.
- Orange pinned styling for SKU-focused hits is implemented in `src/notifier/subscriptionDispatch.js`.

(Older watchlist-table design was superseded by this unified model.)

---

## Phase 5 — Data Model Discovery

*Before building more scrapers or the data-heavy features (cross-site search,
history, stats), survey what the candidate sources actually expose so the
unified tire model is grounded in reality, not assumed from interco alone.*

*The bot tracks **off-road tires broadly** — blems are a highlighted subset
(flagged via `is_blem`), not the only inventory. Users want to search, compare,
and get alerts across any off-road tire source.*

### Why this phase exists
The current `tires` schema was shaped entirely around intercotire.com/blem-list:
a single HTML table with sku, title, brand, size, quantity, price. That was
enough for one source and a firehose alert, but every downstream feature now
on the plan assumes a **unified model** across sources:

- Phase 3/4 filter subscriptions by brand, size, price, sku — fields must
  mean the same thing regardless of origin.
- Phase 7 keeps `/find` as backend DB search over scraped inventory for cross-source comparison.
- Phase 8 (`/history`, `/stats`) aggregates events by source and computes
  cross-source trends.
- Phase 10 (`/admin sources`) reports per-source health and coverage.

If source B uses load-rating terms interco doesn't, or source C lists prices
in a range, or source D only exposes partial SKUs, the existing schema will
silently lose information or force awkward string packing. Discovering that
mid-Phase-7 is expensive. Discover it now.

### Deliverables

0. **Source registry** at `docs/sources/source-registry.md` (✅ created):
   - Canonical list of all known tire sources with type (manufacturer /
     reseller / marketplace / retailer), URL, blem status, priority
   - "How to add a new source" checklist so more can be added later
   - Field coverage matrix mapping unified model fields to each source
   - Excluded sources with reasons (so we don't re-research them)

1. **One discovery note per candidate source**, saved under `docs/sources/`:

   **Manufacturers (sell blems direct):**
   - `interco.md` (retroactive — document the source we already have)
   - `treadwright.md` — TreadWright Tires (remold/retread mfr, Shopify)

   **Resellers (dedicated blem inventory):**
   - `tiremart.md` — TireMart.com (317+ blem SKUs, **highest priority**)
   - `jegs.md` — JEGS (dedicated blem category, Cloudflare-protected)
   - `summit.md` — Summit Racing (historically carries blems, intermittent)

   **Marketplace (deferred, noisy):**
   - `ebay.md` — eBay (multi-seller, inconsistent, heavy bot protection)

   _Note: Most off-road tire sources are resellers, not manufacturers.
   Only Interco and TreadWright were confirmed selling blems direct.
   Major retailers (SimpleTire, TireRack, 4WheelParts) do NOT carry
   blem-specific inventory — they are tracked in the excluded list._

   Each note captures:
   - Source URL(s) and rendering model (server-rendered HTML vs JS-required)
   - robots.txt + ToS status (per Phase 6 etiquette rules)
   - Blem page structure (table? cards? pagination? infinite scroll?)
   - Catalog / search page structure (for the future `/find` feature)
   - **Raw field inventory** — every data point surfaced on a listing,
     verbatim from the site (e.g. "Load Index", "Tread Depth", "Weight",
     "UTQG", "Sidewall Ply", "MSRP vs. Sale vs. Clearance")
   - Sample parsed row in JSON — what a scraper could realistically emit
   - Format quirks (price ranges, "Call for price", empty qty, MOQ, bundle
     SKUs, size strings not matching the current regexes)
   - At least 5 sample rows saved verbatim as an HTML fixture under
     `test/fixtures/<source>.html` so we can write parser tests later
     without hitting the network.

2. **Unified tire model v2 proposal** at `docs/sources/unified-model.md`:
   - Core fields every scraper MUST provide (sku, source, size, price)
   - `is_blem` boolean flag — true for blemished tires, false for standard
     inventory. Sources like Interco are all-blem; sources like SimpleTire
     are all-standard; sources like TireMart/JEGS have both.
   - Common optional fields observed on ≥2 sources (brand, quantity,
     product_url, image_url, load_index, speed_rating, ply, weight, utqg,
     product_line, msrp, sale_price, on_sale_from)
   - Source-specific extras → kept in a JSON `extra` column rather than
     new first-class columns, so schema evolution slows down
   - Normalization rules (price → number in cents? size → canonical format?
     brand casing? "Out of Stock" vs quantity=0?)
   - **Stock quantity normalization** (feeds Phase 7 directly):
     sites vary wildly — "4", "In Stock", "Low Stock", "Out of Stock",
     "Call", blank, "1-3 available", bucketed labels, or nothing at all.
     Propose a two-field model: `quantity_raw` (verbatim from site, for
     display + audit) and `stock_state` (enum: `in_stock` | `low_stock` |
     `out_of_stock` | `unknown`) plus optional `quantity_n` (integer when
     the site exposes a real count). Downstream filters and cross-site
     comparisons use `stock_state`; the raw string is preserved for the UI.
   - Which v2 fields power which downstream features (table mapping model
     fields to Phase 3/6/7 features)

3. **Schema impact summary** — any migrations/new tables needed before
   Phase 6+ makes sense. Most changes will be additive columns on `tires`
   plus a JSON `extra` field; some may warrant a separate `tire_details`
   sideload table if the data is large or rarely read.

4. **Go / no-go per source** — which sources we plan to add in Phase 6
   (renamed from "Phase 5 — Additional Scrapers"), which are blocked on
   robots.txt/ToS, and which need JS rendering (informs puppeteer decision).

### Process for each candidate
```
1. curl -sA "BlemBot/1.0 (+repo)" <url> > /tmp/<source>.html
   — does the page contain the tire data? Yes → server-rendered. No → JS-required.

2. If JS-required, note it. Rendering is an implementation detail for Phase 6,
   not a blocker for discovery — screenshot + devtools Network tab is enough
   to catalog fields.

3. Inspect the raw HTML / JSON endpoints. List every field present per listing.

4. Save a 5+ row fixture at test/fixtures/<source>.html (or .json).

5. Fill in the discovery note from the template.

6. Propose which fields map to existing columns, which are new common fields,
   and which belong in the extra blob.
```

### Template for discovery notes
Create `docs/sources/_template.md` with this structure so every note is
comparable at a glance:

```
# <Source name>

- URL(s):
- Rendering:           server | js-required | mixed
- robots.txt status:   allowed | disallowed | not-checked
- ToS status:          ok | restrictive | needs review
- Requires login:      yes | no

## Blem / closeout page
- Layout:              table | card grid | list | infinite scroll
- Pagination:          none | numbered | load-more | infinite
- Fields per listing:
  - <field>: <example value> [maps to: tires.<col> | extra.<key> | drop]

## Catalog / search page (for /find)
- Layout:
- Query mechanism:     URL param | POST | JS client-side
- Fields per result:

## Format quirks / gotchas

## Sample parsed JSON row
\`\`\`json
{}
\`\`\`

## Go / no-go
```

### Scope boundary
This phase writes docs and fixtures — **no scraper code, no schema changes.**
Output of this phase is what unlocks safe decisions in all later phases.
The existing interco scraper keeps running exactly as-is throughout.

---

## Phase 6 — Additional Scrapers ✅ (no-proxy sources done)
*Add more blem/closeout sources. Each one is just a new file in `src/scrapers/`.*

### Scraper contract (unchanged from current)
```js
module.exports = {
    name: 'sitename',     // stored as source in DB, must be unique
    url:  'https://...',  // informational
    scrape: async () => [ // returns Tire[]
        { sku, title, brand, size, quantity, price }
    ]
};
```
Register in `src/scrapers/index.js`. That's the entire integration.

### Status

| Source      | Status                                    | Notes                                           |
|-------------|-------------------------------------------|-------------------------------------------------|
| TreadWright | ✅ Done                                   | Shopify JSON API, blems + regular catalog        |
| TireMart    | ✅ Done                                   | BigCommerce SSR, highest-value blem source       |
| SimpleTire  | ✅ Live (stable)                          | Nightly full crawl at 2 AM Central via `runSimpleTireFull()` — excluded from normal scraper registry (takes several hours) |
| JEGS        | Blocked — Cloudflare Turnstile            | Dedicated blem category; needs CF bypass infra  |
| 4WheelParts | Blocked — Cloudflare Managed Challenge    | No blems; needs CF bypass infra                 |
| Summit      | Blocked — Imperva Incapsula               | Blems intermittent; needs proxy infra           |
| TireRack    | NO-GO — Akamai blocks everything          | Spec enrichment value; revisit if API available |
| eBay        | NO-GO — complexity vs value               | Multi-seller; revisit if user demand is clear   |

The remaining buildable scrapers (JEGS, 4WheelParts, Summit) are blocked on bot
protection infrastructure (Cloudflare/Imperva bypass + residential proxies), not
code. They're a separate infrastructure investment decision — see
`docs/sources/go-no-go.md` for the full analysis. Build order if proxy infra
is set up: JEGS → 4WheelParts → Summit.

### Scraping etiquette (required for every new scraper)
Before adding any scraper, verify it won't get us IP-banned or violate ToS:

1. **robots.txt check (mandatory):**
   Fetch `https://<site>/robots.txt` and check if the target path is disallowed
   for the default User-Agent. If it IS disallowed:
   - Log a **clear, loud warning** at scraper load time:
     `console.warn('[scraper:<name>] robots.txt DISALLOWS <path> — scraper NOT registered')`
   - Do not register the scraper in `src/scrapers/index.js`
   - Add a comment in the scraper file explaining why it's unregistered
   - Leave the code in place so a human can revisit if the policy changes

2. **Identify the bot:**
   Every scraper sets a custom User-Agent header:
   ```
   User-Agent: BlemBot/1.0 (+https://github.com/<you>/blem-bot)
   ```
   Gives site owners a way to contact us if we become a problem.

3. **Rate limit ourselves:**
   - Scheduled scrapers run every 30 min at most (current behavior — don't lower this)
   - If a scraper paginates, sleep 2-3 seconds between page requests
   - Never concurrent-request the same origin

4. **Handle throttle responses:**
   - 429 (Too Many Requests) or 503 (Service Unavailable): exponential backoff,
     max 3 retries. After that, log the error and mark the run failed.
   - Never hammer a site that's telling us to back off.

5. **ToS review:**
   Quick read of the site's Terms of Service. If it explicitly prohibits scraping,
   same treatment as robots.txt disallow — log loudly and don't register.

### JS-rendered pages
If a site requires JS, the scraper should use puppeteer (headless Chrome) scoped
to just that one scraper file. The rest of the app never sees it. Puppeteer can be
added as an optional dependency and only loaded by scrapers that need it.

---

## Rim Size Filtering ✅ DONE
*Users can now filter by exact wheel/rim diameter where needed; rim range filtering is deprecated.*

### Why
Wheel diameter is a hard constraint — a 16" rim can't use a 17" tire. Searching
by overall diameter (`size_min`) is useful, but users with a specific wheel size
need to narrow by rim diameter too. Currently there's no way to express "show me
all 35" tires that fit a 17" rim."

### What changes

**Data layer**

1. Add `rim_diam` column (`REAL`) to `tires` table via idempotent migration in
   `src/db/client.js`. Add `idx_tires_rim_diam` index.

2. Add `parseRimDiam(sizeStr)` to `src/utils/tires.js`. Handles all formats:
   ```
   35x12.50R18LT  → 18
   245/55R19      → 19
   14/42-17       → 17  (number after the dash)
   17.5/50-24     → 24
   265/75R16      → 16
   ```

3. `upsertActiveTire` in `src/db/repository.js` derives and stores `rim_diam`
   from the size string if the scraper doesn't provide it — same pattern as
   `overall_diam` derivation added in the sizing bugfix.

4. Use exact rim filtering semantics across the app:
   - `searchTires(query, { rim })` uses rounded exact match (`Math.round(d) === rim`)
   - `getActiveTires(filters)` uses `rim` exact match (no range variants)

**Commands**

5. `/find` supports `rim` (exact integer rim diameter).

6. `/blems` supports a single `rim` option (exact), with no `rim_min`/`rim_max`.

7. `/subscribe` supports a single `rim` option (exact), with no `rim_min`.

**Subscriptions**

8. Subscription matching uses exact rim (`sub.rim`) against
   `tire.rim_diam ?? parseRimDiam(tire.size)`, with rounded comparison.

9. `hasNarrowingFilter` treats exact `rim` as a narrowing filter.

### Schema additions
```sql
-- tires table (migration, not new table)
ALTER TABLE tires ADD COLUMN rim_diam REAL;
CREATE INDEX idx_tires_rim_diam ON tires(rim_diam);

-- subscriptions table (exact rim)
ALTER TABLE subscriptions ADD COLUMN rim INTEGER;
```

### No new commands — all changes extend existing ones.

---

## Phase 7 — Cross-Site Inventory Search (backend DB search)
*Use the regularly scraped/stored dataset for cross-source search; no live-site fetches in `/find`.*

### New concept: full inventory scrapers
Current scrapers only hit the blem/closeout page. For cross-site search, we need
scrapers that can hit the main catalog too.

Two scraper types:
- `blem` scrapers (current) — scheduled, stored in DB, diff-tracked
- `search` scrapers (new) — on-demand only, not stored, returns live results

### Command
```
/find <query> [size] [rim] [source]
  "query" is freetext: brand name, model name, part number
  "size" is an overall diameter filter (integer)
  "rim" is exact rim diameter (integer)
  "source" limits to one site

  Uses backend DB search over regularly scraped data.
  Returns up to 10 results per source as embeds, grouped by source.
  Clearly marks which results are blem vs regular inventory.
```

### Architecture
`/find` uses `searchTires()` against the local SQLite store that is refreshed by
scheduled scrapes. This keeps command latency low, avoids live-site fragility, and
fits the operational model for this bot.

Implementation emphasis for this phase:
- improve ranking/relevance over DB-backed results
- maintain source grouping and blem/non-blem labeling in embeds
- support exact rim filtering (`rim`) consistently
- keep include/exclude out-of-stock behavior explicit and test-covered

---

## Phase 8 — Price History & Trends ✅
*Implemented: history/stat visibility over tracked change events and scrape runs.*

### Commands
```
/history <sku> [source]
  Shows timeline of price and qty changes for a specific SKU.
  Formatted as a table embed: date | qty | price | event (added/changed/removed/returned).

/stats
  Overall bot statistics:
  - Total tires tracked per source
  - Tires added/removed in last 7/30 days
  - Your subscription hit rate
  - Last scrape time per source
```

### Schema additions (implemented)
```sql
-- Explicit change log (supplement to last_seen_at / updated fields)
CREATE TABLE tire_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tire_id     INTEGER NOT NULL REFERENCES tires(id),
    event       TEXT NOT NULL,   -- added | removed | returned | changed
    old_price_cents INTEGER,
    new_price_cents INTEGER,
    old_quantity_n  INTEGER,
    new_quantity_n  INTEGER,
    old_stock_state TEXT,
    new_stock_state TEXT,
    recorded_at TEXT DEFAULT (datetime('now'))
);

-- Scrape run log for /stats
CREATE TABLE scrape_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    tires_found INTEGER,
    added       INTEGER DEFAULT 0,
    reactivated INTEGER DEFAULT 0,
    removed     INTEGER DEFAULT 0,
    changed     INTEGER DEFAULT 0,
    error       TEXT    -- NULL if successful
);
```

The `tracker.js` diff result already contains everything needed to populate `tire_history`
and `scrape_runs` on each run.

---

## Cross-cutting requirement — Alert Eligibility Hardening (out-of-stock suppression) ✅ DONE
*Unavailable/out-of-stock tires are now suppressed from public blem alerts.*

### Implemented behavior
Public alerts now suppress tires when availability signals indicate they are not buyable:
- `stock_state === out_of_stock`
- numeric quantity (`quantity_n`) is `<= 0`
- quantity text contains unavailable markers (e.g. "out of stock", "unavailable", "sold out", "not available", "backorder")
- quantity text parses as zero

### Scope
- Suppression is applied at alert-filter layer (`src/alertFilter.js`) so DB completeness
  remains intact for `/blems`, `/find`, `/history`, and analytics.
- Existing per-user subscription/watch routing remains unchanged.

### Implementation notes
- Stock suppression composes with size threshold filtering (`PUBLIC_ALERT_MIN_DIAMETER`).
- Behavior is covered by `test/alertFilter.test.js`, including:
  - added/reactivated with `out_of_stock` => suppressed
  - added/reactivated with qty `0` / unavailable text => suppressed
  - added/reactivated with `in_stock` / `low_stock` => allowed

---

## Phase 9 — Scraper & Command Bug Fixes (immediate)
*Fix known data-quality and command-behavior issues identified in live usage.*

### Scope
This phase covers two classes of work:
1. **Scraper data quality** — review all active scrapers (interco, treadwright, tiremart,
   simpletire) and fix any fields that produce null/N/A where a value exists on the page.
   Known issue: SimpleTire price. Others may surface on inspection.
2. **Command behavior** — fix `/find` bugs identified in live use.

### Bug 1 — SimpleTire price missing in alerts
Price shows on the SimpleTire product page but appears as N/A in Discord messages.
The current scraper extracts price via `[class*="price"]` CSS selector + JSON-LD
fallback (`jsonLd.offers.price`). One or both paths fail to produce `price_cents`
for some SKUs.

**Files:**
- `src/scrapers/simpletire.js` — price extraction logic (lines ~236–244, 329)
- `test/scrapers/` — add/extend SimpleTire price test if coverage is absent

**Fix approach:**
1. Inspect a live SimpleTire tire page to confirm which DOM element contains the
   rendered price (CSS class name may have changed or be dynamic).
2. Check whether `jsonLd.offers.price` is populated for those SKUs (vs
   `jsonLd.offers.lowPrice` or an offers array).
3. Add fallback extraction path covering whatever the page actually exposes.
4. Verify `price_cents` is non-null for a sample of scraped tires.

### Bug 2 — /find query does not match source names
`/find query:interco` returns no results because `searchTires` only matches the
query string against `sku`, `brand`, `title`, and `size` columns — `source` is not
included in the text-search clause. The `source` filter option works, but the free-
text `query` arg ignores source.

**Files:**
- `src/db/repository.js` — `searchTires()` instr clauses (lines ~31–36)
- `test/db/searchTires.test.js` — add test for source-name substring match

**Fix approach:**
Add `OR instr(lower(source), lower(?)) > 0` to the existing instr block and pass
the corresponding query param. That makes `/find query:interco` behave like the
implicit `source:interco` filter.

### Bug 3 — /find overflow hint incorrectly suggests /blems
When `/find` returns more than MAX_PER_SOURCE results it shows:
> Showing 10 of N. Use `/blems source:X` to browse all.

This is wrong — `/blems` is blem-only; `/find` covers all inventory. The hint
should suggest narrowing within `/find` instead.

**Files:**
- `src/bot/commands/find.js` — `buildSourceEmbed()` overflow string (line ~36)

**Fix approach:**
Replace overflow hint with:
> Showing 10 of N. Add `size:`, `rim:`, or `source:` filters to narrow results.

Also remove the `/blems` prompt from the no-results hints block (line ~92) — users
who already used `/find` don't need to be redirected to a more limited command.

---

## Phase 10 — README & Operator Docs
*Write a production-ready README for setup, operations, and troubleshooting.*

### Deliverables
- `README.md` with:
  - project purpose and architecture overview
  - prerequisites and install (`npm install`, env vars, Discord app setup)
  - run modes (normal scheduler vs `--simple-tire`), cron behavior, PM2 supervisor
  - commands reference (`/ping`, `/blems`, `/find`, `/sources`, `/subscribe`, `/subscriptions`, `/unsubscribe`, `/history`, `/stats`)
  - alert model and filters (`PUBLIC_ALERT_MIN_DIAMETER`, out-of-stock suppression behavior)
  - scraper/source status matrix (active, deferred, blocked)
  - troubleshooting section (Discord token, DB path, blocked sources, embed limits)
  - testing instructions (`npm test`)

### Notes
- Keep README aligned with current implementation, not aspirational phases.
- Include a short “Roadmap status” section linking this file.

---

## Phase 11 — Admin Commands (open)
*Server admin controls — force scrapes, manage sources, and inspect run health.*

### Commands (guild-admin role required)
```
/admin scrape [source]
  Triggers an immediate scrape outside the normal schedule.
  Optional source = scrape one site, omit = scrape all.
  Posts result summary in-channel.

/admin sources
  Lists all registered scrapers: name, url, last run, last error, status.

/admin runs [source] [limit]
  Shows recent scrape run log with timestamps, tire counts, and any errors.

/admin errors
  Shows any scrapes that ended with an error in the last 7 days.
```

### Permission model
Uses Discord's built-in permission system — commands with `defaultMemberPermissions`
set to `MANAGE_GUILD` are only usable by server admins. No custom role table needed.

```js
// src/bot/commands/admin.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        // ... subcommands
};
```

---

## Phase 14 — Scraper Health & Regression Testing
*Catch site redesigns early and verify scrapers are producing good data.*

### Problem this solves
Sites silently change their HTML structure, CSS class names, or JSON-LD schemas. When that happens
the scraper keeps running — it just returns empty arrays or tires with all-null fields. The only
current signal is a human noticing "hm, no new alerts in a while." This phase adds two complementary
safety nets:

1. **Fixture regression tests** (fast, offline, runs in CI): parse saved HTML snapshots through each
   scraper's parser and assert that key fields are extracted. Fail immediately when a code or
   structure change breaks extraction.

2. **Live smoke script** (slow, hits real sites, run manually or on a schedule): actually scrapes
   each source and validates the output contract — checks for minimum result counts, required field
   population rates, and value sanity (price > 0, size parses to a valid diameter, etc.).

These two layers complement each other: fixture tests catch code regressions without touching
the network; the live smoke script catches site-side redesigns that no fixture can anticipate.

### Part A — Fixture regression tests (in-suite)

Extend `test/scrapers/` with one test file per scraper, on the same pattern as the existing
`interco.test.js`:

- `test/scrapers/treadwright.test.js`
- `test/scrapers/tiremart.test.js`
- `test/scrapers/simpletire.test.js`

Each test file:
1. Saves a representative HTML/JSON snippet as a literal string (or loads from
   `test/fixtures/<source>.html`) — enough rows to cover the common cases.
2. Imports and calls the scraper's parser function directly (not `scrape()`, which would
   hit the network).
3. Asserts the v2 Tire shape contract:
   - At least 1 result
   - `sku`, `size`, `price_cents` are non-null and non-empty
   - `price_cents` is a positive integer
   - `stock_state` is one of `in_stock | low_stock | out_of_stock | unknown`
   - `overall_diam` and `rim_diam` parse to reasonable numbers (10–60 in)
4. Covers edge cases unique to each source (e.g. TireMart's "Call for Price",
   TreadWright's Shopify JSON variant structure, SimpleTire's JSON-LD Product vs ProductGroup).

**Key constraint:** parser functions must be exportable (or extracted) so tests can import them
without triggering a network fetch. Scrapers that currently inline their parser inside `scrape()`
need a small refactor to expose it — e.g. `module.exports = { name, url, scrape, _parse }`.
The `_parse` prefix signals it's test-only.

### Part B — Live smoke script

New file: `scripts/smoke-scrapers.js`

```
node scripts/smoke-scrapers.js [source]
  Runs each scraper (or one named source) and validates output.
  Does NOT write to the DB — read-only diagnostic.
  Exits non-zero if any source fails validation.
```

Validation checks per source:
1. **Minimum result count** — at least 1 tire returned. (A real site should always have inventory.)
2. **Required field fill rate** — for each required field (`sku`, `size`, `price_cents`),
   at least 80% of results must be non-null. A sudden drop to 0% signals a parser break.
3. **Price sanity** — `price_cents > 0` for tires where price is populated.
4. **Size parses** — `parseOverallDiam(size)` returns a number in [10, 120] for ≥ 80% of results.
5. **No circuit-breaker trip** (SimpleTire only) — if the circuit opens during the smoke run,
   report it explicitly rather than silently returning 0 results.

Output format: one line per source with pass/fail and key metrics:
```
[interco]     ✅  48 tires | sku: 100% | price: 100% | size: 100%
[treadwright] ✅  12 tires | sku: 100% | price: 100% | size: 92%
[tiremart]    ✅  318 tires | sku: 100% | price: 87% | size: 100%
[simpletire]  ⚠️  circuit open — skipping (cooldown until 14:30)
```

**The smoke script is intentionally NOT part of `npm test`** — it hits live sites
and takes minutes. Run it:
- Manually when alerts seem stale or a source goes quiet
- Via `/admin scrape` followup (can call externally from a cron or after a scrape run)
- Optionally on a weekly schedule via the blem-bot schedule system (Phase 12)

### Part C — Field-population tracking in scrape_runs (optional, stretch)

Add `null_rate_json` column to `scrape_runs` (TEXT, JSON blob): records the null rate for
each required field in that run's output. `/admin runs` can surface a warning when a source's
fill rate degrades across consecutive runs — a leading indicator of a parser breakage before
the alert volume drops to zero.

This is a stretch goal for the phase; skip if the fixture tests + smoke script provide
sufficient coverage.

### Deliverables summary
| Artifact | Location | Runs in |
|---|---|---|
| Fixture tests (treadwright, tiremart, simpletire) | `test/scrapers/` | `npm test` |
| Smoke script | `scripts/smoke-scrapers.js` | Manual / scheduled |
| Parser exports (`_parse`) | Each scraper file | (enables tests) |
| HTML fixtures | `test/fixtures/<source>.html` | Test suite |

### Scope boundary
- No changes to scraper behavior or scheduling.
- No new DB schema unless the optional Part C is implemented.
- The smoke script does not write to the DB.

---

## Phase 15 — Full Catalog Scraping for Interco and TreadWright
*Expand interco and treadwright to capture their complete non-blem inventory, matching the coverage model simpletire already provides.*

### Why
SimpleTire's value is its spec richness across the full off-road catalog — `/find` can surface any simpletire SKU whether or not it's a blem. Interco and TreadWright also sell their full tire lines direct (not just blems), but their scrapers today only hit the blem page/tag. Expanding them means `/find` becomes a genuinely cross-source product search, not just a blem list with simpletire appended.

This also improves subscription utility: a user watching for a specific TreadWright model can subscribe by SKU or brand+size and get notified if that tire ever appears as a blem, even if it first enters the DB as regular inventory.

### What each scraper needs to do

**Interco** (`src/scrapers/interco.js`)
- Currently hits only `/blem-list`. Interco also exposes a full product catalog.
- Discover the catalog URL/structure — likely a category or product listing page.
- Scrape catalog products with `is_blem=0`; the existing blem page scrape stays in place with `is_blem=1`.
- Options: run blem-only on the regular schedule and full catalog as a separate nightly pass (same pattern as simpletire), or combine into one scrape if the catalog is small enough to run every 30 min.

**TreadWright** (`src/scrapers/treadwright.js`)
- Already hits the full Shopify catalog via `products.json` and sets `is_blem` based on the `blemish` tag — this is nearly done.
- Current filter: `product.product_type !== 'Tire'` skips non-tire products, which is correct.
- Gap: the scraper is already capturing non-blems with `is_blem=0`, but verify that all regular catalog variants are making it through and that the `/find` query surface is correct. May just need a smoke check rather than new scraper code.

### Alert behavior (no change needed)
The public feed filter (`alertFilter.js`) already suppresses `is_blem=0` tires — only blems trigger the public alert channel. Non-blem inventory expansion is purely additive to the DB and does not change alert behavior.

Per-user subscriptions already support non-blem hits: `tireMatchesSubscription` does not filter on `is_blem`. A user watching a TreadWright model will get a DM whether it shows up as a blem or regular stock.

### Deliverables
- Updated `src/scrapers/interco.js` to fetch full catalog alongside blem list
- Confirmed or updated `src/scrapers/treadwright.js` covering full catalog
- Smoke-test results showing non-blem tires present per source in DB
- If interco catalog is large: add a nightly schedule entry (same as simpletire) rather than running it every 30 min

### Scope boundary
- No schema changes — `is_blem` column already exists
- No alert behavior changes
- No new commands — `/find` and `/blems` already handle `is_blem` filtering correctly

---

## Phase 12 — Natural Language Search (LLM-assisted)
*Add natural-language query support on top of the backend tire index, with a dedicated chat channel for threaded conversation.*

### Goal
Allow users to ask in plain language (e.g. "show me 37s under $500 for 17-inch rims,
prefer in-stock blems") and map that query to structured filters + ranked results.
Support multi-turn conversation in a dedicated Discord channel as the primary UX; `/ask`
as the fallback for users in other channels.

### Interaction model

**Dedicated chat channel (primary)**
The bot watches a designated channel (`DISCORD_CHAT_CHANNEL_ID` env var). When a user
sends a message there, the bot opens a thread off that message so each conversation is
isolated and visible to other server members. Follow-up messages inside the thread
continue the conversation (multi-turn, up to a reasonable depth).

This mode is always-on — no slash command required. The bot should reply in the thread
rather than the channel itself to keep the channel readable.

**`/ask` command (fallback)**
Available in any channel. Single-turn: user asks a question, bot replies ephemerally or
in-channel with structured results. Does not open a thread. This is the entry point for
users in channels where the dedicated chat channel isn't accessible or convenient.

`/find` is **not affected** — it remains a pure keyword/filter command with no LLM involvement.

### LLM provider
Use **GitHub Models** (`models.inference.ai.azure.com`) — an OpenAI-compatible endpoint
available through a GitHub Copilot subscription. Auth is a GitHub Personal Access Token
(Settings → Developer settings → Personal access tokens → Fine-grained tokens, no special
scopes needed). Configure via env:

```
GITHUB_MODELS_API_KEY=<github-pat>
GITHUB_MODELS_API_BASE=https://models.inference.ai.azure.com   # default, override if needed
GITHUB_MODELS_MODEL=gpt-4o-mini                                 # cheap, fast, effective for structured extraction + conversation
```

The LLM client uses the OpenAI SDK pointed at the GitHub Models base URL. If the endpoint
or model name changes, only env vars need updating — no code changes.

Model choice rationale: gpt-4o-mini is sufficient for structured JSON extraction from short
queries and general conversational replies. No need for a frontier model here.

### NL → structured filters

The LLM receives the user's message and returns a JSON object that maps directly to
`getActiveTires()` filter arguments. Use `getActiveTires()` as the primary DB call.
If a new repo method is needed (e.g. to combine keyword text search with structured
filters more cleanly), introduce it then — do not over-engineer upfront.

**LLM output schema:**
```json
{
  "keyword":   "bogger",       // brand/model substring for text match; null if purely numeric
  "source":    null,           // exact source name or null
  "sizeMin":   37,             // overall diameter lower bound (inches) or null
  "sizeMax":   37,             // overall diameter upper bound (inches) or null
  "rim":       17,             // exact rim diameter (inches) or null
  "priceMax":  500,            // max price in dollars or null
  "isBlem":    null,           // true = blems only, false = standard only, null = both
  "stockPref": "in_stock"      // "in_stock" | "any" | null  ("in_stock" → excludes out_of_stock)
}
```

Prompt must instruct the model to return only this JSON with no surrounding prose.
On parse failure (malformed JSON, missing required keys), fall back to a lexical
`searchTires()` call using the raw query string. Log failures for prompt iteration.

### Result ranking

After DB query, sort results deterministically:
1. Blem before standard (`is_blem` desc)
2. In-stock before low-stock (`stock_state` — in_stock > low_stock > unknown)
3. Price ascending (`price_cents` asc)

### Discord interaction requirements

**`/ask` command:** call `interaction.deferReply()` immediately (before the LLM call)
to satisfy Discord's 3-second response deadline. Use `interaction.editReply()` with
the final embed. `/find` is unaffected — it remains synchronous.

**Chat channel thread mode:** normal message replies are not subject to the 3-second
slash-command deadline, but the bot should still respond promptly. Typing indicator
(`channel.sendTyping()`) while the LLM call is in flight gives users feedback.

### Caching
Not implemented initially. Monitor token usage in production and add an in-memory LRU
cache on the query string if cost becomes a concern.

### New env vars
```
DISCORD_CHAT_CHANNEL_ID=    # channel the bot watches for NL chat; omit to disable chat-channel mode
GITHUB_MODELS_API_KEY=      # GitHub PAT (fine-grained, no special scopes needed)
GITHUB_MODELS_API_BASE=     # defaults to https://models.inference.ai.azure.com
GITHUB_MODELS_MODEL=        # defaults to gpt-4o-mini
```

### New files
```
src/
  llm/
    client.js       — OpenAI SDK instance pointed at Copilot endpoint
    parseQuery.js   — NL string → structured filter JSON (prompt + parse + fallback)
  bot/
    commands/
      ask.js        — /ask slash command
    chatChannel.js  — message listener for the dedicated chat channel + thread logic
```

### Validation
- Golden-query fixture set (10–20 NL prompts) with expected parsed filter objects.
- Unit tests for `parseQuery.js` using mocked LLM responses (valid JSON, malformed, missing keys).
- Regression tests around ambiguous rim/size phrases and stock-preference wording.

---

## Phase 13 — Plan Polish
*Catchall phase for tasks that don't fit cleanly into earlier phases, or that
were deferred due to external blockers. Pull items into earlier phases whenever
they become relevant.*

### Backlog

#### Discord message / alert styling review
The current alert embeds are functional but rough — they were built to ship, not
to look good. Review once there's real usage to judge against:
- **Alert embed layout** — the public feed messages show sku+size as field name and
  brand/qty/price as field value. Worth revisiting: should source be shown? should
  blems vs. standard inventory be visually distinct? is the truncation UX ("...and
  X more, use /blems") the right call?
- Unified color + emoji vocabulary across all commands
- Product images in embeds when `image_url` is available
- Clickable product links via `product_url`
- Shared "tire card" component so /blems, /find, subscription hits, and /history
  look consistent
- Ephemeral vs. public defaults reviewed per command
- Mobile-friendly check (long embeds truncate badly on phones)

#### Proxy-protected scrapers (if infra investment made)
JEGS, 4WheelParts, and Summit are all buildable but require Cloudflare/Imperva bypass
infrastructure. See `docs/sources/go-no-go.md` for the full analysis and estimated
effort per source.

---

## Build Order & Dependencies

```
Phase 1   (Bot Foundation)         ✅ Done
Phase 2   (Browse/Search)          ✅ Done
Phase 3   (Subscriptions)          ✅ Done
Phase 4   (Pinned watches)         ✅ Done — merged into /subscribe
Phase 5   (Data discovery)         ✅ Done — all source docs + unified model written
Phase 6   (More scrapers)          ✅ Done (no-proxy sources) — Interco + TreadWright + TireMart (normal run) + SimpleTire (nightly)
Rim filtering                      ✅ Done — exact rim matching only (`rim`); no `rim_min`/`rim_max`
Public alert stock suppression     ✅ Done — out-of-stock/unavailable tires suppressed in `alertFilter` + tests
Phase 7   (Backend search)         ✅ In place — `/find` stays DB-backed (no live site search)
Phase 8   (History/Stats)          ✅ Done — schema + /history + /stats commands
Phase 9   (Bug fixes)              ✅ Done — SimpleTire price + size extraction, TreadWright size regex, /find source search, /find overflow hint
Phase 10  (README/docs)            ⏳ Open — author full README + operations docs
Phase 11  (Admin)                  ✅ Done — /admin scrape|sources|runs|errors + MANAGE_GUILD gate
Phase 12  (NL search)              ⏳ Design locked — chat channel + /ask, GitHub Models endpoint, gpt-4o-mini, getActiveTires()
Phase 13  (Plan polish)            ⏳ Ongoing catchall
Phase 14  (Scraper health)         ⏳ Open — fixture regression tests + live smoke script
Phase 15  (Full catalog scraping)  ⏳ Open — expand interco + treadwright to non-blem inventory
```

Immediate next step: Phase 12 (NL search). After that: Phase 14 (scraper health tests), Phase 15 (full catalog expansion).

---

## Final File Structure (current + planned)

```
index.js
database.sql
.env.example
package.json
src/
  bot/
    client.js
    interactions.js
    embeds.js
    commands/
      index.js
      ping.js
      blems.js
      find.js
      sources.js
      subscribe.js
      unsubscribe.js
      subscriptions.js
      history.js
      stats.js
      admin.js
      ask.js           (Phase 12 — /ask slash command)
  llm/
    client.js          (Phase 12 — OpenAI SDK → GitHub Copilot endpoint)
    parseQuery.js      (Phase 12 — NL string → structured filter JSON)
  bot/
    chatChannel.js     (Phase 12 — dedicated chat channel listener + thread logic)
  scrapers/
    index.js
    interco.js
    treadwright.js
    tiremart.js
    simpletire.js        (nightly: true — excluded from runAll, included in /sources)
    # proxy-blocked candidates remain roadmap/docs only for now:
    # jegs.js, fourwheelparts.js, summit.js
  db/
    client.js
    repository.js
  notifier/
    discord.js
    email.js
    subscriptionDispatch.js
  tracker.js
  subscriptions.js
  scheduler.js
  alertFilter.js
scripts/
  smoke-scrapers.js     (planned — Phase 14)
test/
  tracker.test.js
  subscriptions.test.js
  llm/parseQuery.test.js  (Phase 12 — golden-query fixtures, parse failure fallback)
  db/searchTires.test.js
  notifier/discord.test.js
  scrapers/interco.test.js
  scrapers/treadwright.test.js  (planned — Phase 14)
  scrapers/tiremart.test.js     (planned — Phase 14)
  scrapers/simpletire.test.js   (planned — Phase 14)
  utils/tires.test.js
  fixtures/
    interco.html        (planned — Phase 14)
    treadwright.html    (planned — Phase 14)
    tiremart.html       (planned — Phase 14)
    simpletire.html     (planned — Phase 14)
docs/
  plans/
    blem-bot-roadmap.md
  sources/
    source-registry.md
    unified-model.md
    schema-impact.md
    go-no-go.md
    ...
```

---

## Notes on What NOT to build

- No web dashboard — Discord is the UI
- No user accounts / login — Discord identity is sufficient
- No message queue / worker threads — SQLite + single process is fine at this scale
- No Docker / deployment config — out of scope for now, add later if needed
- No rate limiting logic beyond what discord.js handles automatically
