-- Tire Tracker v2 Schema
-- Run once manually, or let db.js auto-apply on startup.

-- Tracks all off-road tires found across scraped sources.
-- 'source' identifies which site the tire came from.
CREATE TABLE IF NOT EXISTS tires (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source          TEXT    NOT NULL,
    sku             TEXT    NOT NULL,
    title           TEXT,
    brand           TEXT,
    product_line    TEXT,
    category        TEXT,                       -- 'mud', 'all-terrain', etc.
    size            TEXT,
    is_blem         INTEGER NOT NULL DEFAULT 0,
    quantity_raw    TEXT,                       -- verbatim stock text from source
    quantity_n      INTEGER,                    -- parsed numeric quantity
    stock_state     TEXT    DEFAULT 'unknown',  -- in_stock, low_stock, out_of_stock, unknown
    price_cents     INTEGER,
    msrp_cents      INTEGER,
    sale_price_cents INTEGER,
    load_index      INTEGER,
    speed_rating    TEXT,
    load_range      TEXT,
    ply             INTEGER,
    weight_oz       INTEGER,
    tread_depth_32  INTEGER,
    overall_diam    REAL,
    section_width   REAL,
    utqg_wear       INTEGER,
    utqg_traction   TEXT,
    utqg_temp       TEXT,
    three_pms       INTEGER,                    -- 3-peak mountain snowflake
    product_url     TEXT,
    image_url       TEXT,
    extra           TEXT,                       -- JSON blob for source-specific data
    is_active       INTEGER NOT NULL DEFAULT 1,
    first_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
    notified_at     TEXT,
    UNIQUE(source, sku)
);

CREATE INDEX IF NOT EXISTS idx_tires_source   ON tires(source);
CREATE INDEX IF NOT EXISTS idx_tires_brand    ON tires(brand);
CREATE INDEX IF NOT EXISTS idx_tires_size     ON tires(size);
CREATE INDEX IF NOT EXISTS idx_tires_blem     ON tires(is_blem);
CREATE INDEX IF NOT EXISTS idx_tires_active   ON tires(is_active);
CREATE INDEX IF NOT EXISTS idx_tires_category ON tires(category);
CREATE INDEX IF NOT EXISTS idx_tires_price    ON tires(price_cents);

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

-- Phase 8: Tire history / audit trail
CREATE TABLE IF NOT EXISTS tire_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tire_id     INTEGER NOT NULL REFERENCES tires(id),
    event       TEXT NOT NULL,
    old_price_cents INTEGER,
    new_price_cents INTEGER,
    old_quantity_n  INTEGER,
    new_quantity_n  INTEGER,
    old_stock_state TEXT,
    new_stock_state TEXT,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_tire ON tire_history(tire_id);
CREATE INDEX IF NOT EXISTS idx_history_event ON tire_history(event);

-- Phase 8: Scrape run tracking
CREATE TABLE IF NOT EXISTS scrape_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    tires_found INTEGER,
    added       INTEGER DEFAULT 0,
    reactivated INTEGER DEFAULT 0,
    removed     INTEGER DEFAULT 0,
    changed     INTEGER DEFAULT 0,
    error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_source ON scrape_runs(source);
