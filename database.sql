-- Blem Tracker v2 Schema
-- Run once manually, or let db.js auto-apply on startup.

-- Tracks all blemish tires found across all scraped sources.
-- 'source' allows future scrapers (e.g. 'discounttire') to share the same table.
CREATE TABLE IF NOT EXISTS tires (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT    NOT NULL,               -- which site this came from e.g. 'interco'
    sku         TEXT    NOT NULL,
    title       TEXT,
    brand       TEXT,
    size        TEXT,
    quantity    TEXT,
    price       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,     -- 1 = currently listed, 0 = no longer on site
    first_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
    notified_at    TEXT,                        -- NULL until an alert email is sent
    UNIQUE(source, sku)
);

-- Audit log of every email sent.
CREATE TABLE IF NOT EXISTS email_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
    recipients TEXT NOT NULL,
    subject    TEXT NOT NULL,
    body       TEXT NOT NULL
);

-- Phase 3: Discord users known to the bot (one row per user who has ever
-- interacted with a subscription/watchlist command).
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,              -- Discord user snowflake ID
    username    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase 3/4: Per-user alert subscriptions. When a scrape finds new or
-- reactivated tires (and, for watch-style subs, changed or removed), each
-- active subscription is tested against each tire; matches get DM'd or
-- posted to notify_channel.
CREATE TABLE IF NOT EXISTS subscriptions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        TEXT    NOT NULL REFERENCES users(id),
    source         TEXT,                        -- NULL = all sources
    sku            TEXT,                        -- NULL = any SKU; set for "pinned" watches
    brand          TEXT,                        -- NULL = any brand (case-insensitive substring)
    size           TEXT,                        -- NULL = any size; set for exact-size watches
    size_min       REAL,                        -- NULL = no minimum diameter (inches)
    price_max      REAL,                        -- NULL = no maximum price
    notify_dm      INTEGER NOT NULL DEFAULT 1,  -- 1 = DM, 0 = post to notify_channel
    notify_channel TEXT,                        -- channel ID used when notify_dm = 0
    notify_changed INTEGER NOT NULL DEFAULT 0,  -- also alert on qty/price changes
    notify_removed INTEGER NOT NULL DEFAULT 0,  -- also alert when tire disappears
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
