# Blem Bot - Full Discord Bot Roadmap

**Goal:** Evolve the current background scraper into a full-featured Discord bot that
alerts on new blemish tires, lets users customize their own subscriptions and watchlists,
and searches inventory across multiple manufacturer sites.

**Current state:**
- Node.js background process, cron-scheduled
- Scrapes intercotire.com/blem-list (35"+ tires)
- SQLite DB: `tires`, `email_log` tables
- Notifies via email (nodemailer) and Discord webhook (one-way)
- Scraper plugin pattern ready for additional sites

**Architecture going forward:**
- The Discord.js client becomes the long-running process
- Cron job runs inside the bot process (same as today, just owned by the bot)
- Slash commands give users real-time access to data
- Per-user subscriptions and watchlists stored in SQLite
- Each new scraper = one new file in `src/scrapers/`

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
      find.js        <- /find — live cross-site catalog search (Phase 6)
      subscribe.js   <- /subscribe (Phase 3)
      unsubscribe.js <- /unsubscribe (Phase 3)
      subscriptions.js <- /subscriptions (Phase 3)
      watch.js       <- /watch (Phase 4)
      unwatch.js     <- /unwatch (Phase 4)
      watchlist.js   <- /watchlist (Phase 4)
      admin.js       <- /admin (Phase 8)
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
client.once('ready', () => {
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
with optional filter args. Live cross-site catalog search gets its own distinct
command `/find` in Phase 6.

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

## Phase 4 — Watchlist
*Pin specific tires. Get an elevated alert the moment they appear, reappear, or change.*

### Commands

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

### How watchlist differs from subscriptions
- Subscriptions: filter on new/reactivated tires at alert time
- Watchlist: monitors specific SKUs for ANY change (qty, price, removal, return)
  - Think of subscriptions as a broadcast filter, watchlist as individual tracking

### Dispatcher changes required (not just data layer)
The Phase 3 dispatcher only considers `added` + `reactivated` tires. Phase 4 must
extend it to also walk the `changed` and `removed` sets from the tracker diff and
check each one against every active watchlist entry. Order of operations per scrape:

1. Public feed post (Phase 1 behavior, unchanged)
2. Subscription fan-out over added + reactivated (Phase 3 behavior, unchanged)
3. **NEW: Watchlist fan-out** over added + reactivated + changed + removed —
   watchers get notified of every event affecting their tracked SKU / brand+size,
   including when it goes away.
4. Per-user de-dupe across subscription and watchlist hits (one message per tire per user)

### New schema
```sql
CREATE TABLE watchlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id),
    source      TEXT,    -- NULL = any source
    sku         TEXT,    -- specific SKU; NULL if watching by brand+size
    brand       TEXT,    -- used when sku is NULL
    size        TEXT,    -- used when sku is NULL (exact or partial match)
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
);
```

### Alert content for watchlist hits
Watchlist alerts get a different embed style (e.g. orange border, bell emoji prefix)
to visually distinguish "you asked to be notified about THIS tire specifically" from
a general subscription alert.

---

## Phase 5 — Additional Scrapers
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

### Candidate sites to research and add
Each needs a research spike before building — check if the page is server-rendered
(curl | grep for tire data) or requires JS rendering.

| Site | Section | Notes |
|------|---------|-------|
| Mickey Thompson | mtbrap.com or mickeythompsontires.com — check for closeout/blem page | Popular offroad brand |
| Pro Comp | procompusa.com — check for clearance/blem section | Another major brand |
| Maxxis | maxxis.com — check for blem program | Widely used |
| BFGoodrich | bfgoodrichtires.com | Check for direct blem sales |
| discount/aggregator | extremeterrain.com or rockauto clearance | May have multi-brand blems |

### Research process for each candidate
1. `curl -s <url> | grep -i "blem\|closeout\|clearance"` — check for relevant section
2. If section exists, `curl -s <blem-url> | grep -c "sku\|part"` — confirm data is in HTML
3. If JS-rendered, note it — scraper needs puppeteer instead of cheerio
4. Check if login/account is required
5. See the "Scraping etiquette" section below — do this before writing any scraper

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

These rules live in a helper module so each scraper gets them for free:
```js
// src/scrapers/utils.js
async function checkRobotsTxt(baseUrl, path) { ... }
async function politeFetch(url, opts) { ... }  // injects UA, handles 429/503
```

### JS-rendered pages
If a site requires JS, the scraper should use puppeteer (headless Chrome) scoped
to just that one scraper file. The rest of the app never sees it. Puppeteer can be
added as an optional dependency and only loaded by scrapers that need it.

---

## Phase 6 — Cross-Site Inventory Search
*Search for a tire model or size across every source simultaneously, not just blems.*

### New concept: full inventory scrapers
Current scrapers only hit the blem/closeout page. For cross-site search, we need
scrapers that can hit the main catalog too.

Two scraper types:
- `blem` scrapers (current) — scheduled, stored in DB, diff-tracked
- `search` scrapers (new) — on-demand only, not stored, returns live results

### Command
```
/find <query> [size] [source]
  "query" is freetext: brand name, model name, part number
  "size" is a diameter filter (integer)
  "source" limits to one site

  Triggers live scrape of search results pages across all sources.
  Returns up to 10 results per source as embeds, grouped by source.
  Clearly marks which results are blem vs regular inventory.
```

### Architecture
```js
// src/scrapers/interco.js gets a second export:
module.exports = {
    name: 'interco',
    url: '...',
    scrape: async () => [...],           // blem page scraper (existing)
    search: async (query, filters) => [] // catalog search scraper (new, optional)
};
```
The `/find` command calls `scraper.search()` if it exists, skips if not.
Results are never stored — they're live and displayed inline.

### Discord interaction timing (critical)
Discord requires an interaction response within **3 seconds**. Live multi-site
scrapes will easily exceed that. The `/find` command handler must:

1. Call `interaction.deferReply()` immediately on receipt — this gives us up to
   15 minutes to follow up.
2. Scrape sites in parallel via `Promise.allSettled` with a per-site timeout
   (e.g. 10 seconds) so one slow site doesn't stall the whole response.
3. Use `interaction.editReply()` to post results once all scrapers settle
   (or time out). Sites that timed out are shown as "timeout" in the response
   grouping, not silently dropped.
4. Log per-site latency for debugging.

```js
// sketch
await interaction.deferReply();
const results = await Promise.allSettled(
    scrapers.filter(s => s.search).map(s =>
        withTimeout(s.search(query, filters), 10_000).then(r => ({ source: s.name, r }))
    )
);
await interaction.editReply({ embeds: buildFindEmbeds(results) });
```

---

## Phase 7 — Price History & Trends
*Surface the change history the DB is already accumulating.*

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

### Schema additions (Phase 7)
```sql
-- Explicit change log (supplement to last_seen_at / updated fields)
CREATE TABLE tire_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tire_id     INTEGER NOT NULL REFERENCES tires(id),
    event       TEXT NOT NULL,   -- 'added' | 'removed' | 'returned' | 'price_change' | 'qty_change'
    old_qty     TEXT,
    new_qty     TEXT,
    old_price   TEXT,
    new_price   TEXT,
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
    removed     INTEGER DEFAULT 0,
    changed     INTEGER DEFAULT 0,
    error       TEXT    -- NULL if successful
);
```

The `tracker.js` diff result already contains everything needed to populate `tire_history`
and `scrape_runs` on each run.

---

## Phase 8 — Admin Commands
*Server admin controls — force scrapes, manage sources, view run logs.*

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

## Build Order & Dependencies

```
Phase 1  (Bot Foundation)    ← prerequisite for everything
Phase 2  (Browse/Search)     ← depends on Phase 1; no schema changes
Phase 3  (Subscriptions)     ← depends on Phase 1; adds users + subscriptions tables
Phase 4  (Watchlist)         ← depends on Phase 3 (reuses users table)
Phase 5  (More Scrapers)     ← independent; can be done any time after Phase 1
Phase 6  (Cross-site search) ← depends on Phase 5 (needs multiple scrapers to be useful)
Phase 7  (History/Stats)     ← depends on Phase 1; adds tire_history + scrape_runs tables
Phase 8  (Admin)             ← depends on Phase 7 (scrape_runs needed for /admin runs)
```

Recommended order: 1 → 2 → 3 → 4 → 7 → 8 → 5 → 6

---

## Final File Structure (all phases complete)

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
      subscribe.js
      unsubscribe.js
      subscriptions.js
      watch.js
      unwatch.js
      watchlist.js
      history.js
      stats.js
      admin.js
  scrapers/
    index.js
    utils.js            (robots.txt check, politeFetch helper)
    interco.js
    mickeythompson.js   (Phase 5)
    procomp.js          (Phase 5)
    ...
  db/
    client.js
    repository.js
  notifier/
    discord.js          (repurposed as alert dispatcher, not just webhook)
    email.js
  tracker.js
  subscriptions.js      (Phase 3 — matching logic)
  scheduler.js
test/
  tracker.test.js
  subscriptions.test.js (Phase 3)
  scrapers/
    interco.test.js
    ...
  notifier/
    discord.test.js
docs/
  plans/
    blem-bot-roadmap.md  (this file)
    phase-1-bot-foundation.md
    phase-2-browse-commands.md
    ...
```

---

## Notes on What NOT to build

- No web dashboard — Discord is the UI
- No user accounts / login — Discord identity is sufficient
- No message queue / worker threads — SQLite + single process is fine at this scale
- No Docker / deployment config — out of scope for now, add later if needed
- No rate limiting logic beyond what discord.js handles automatically
