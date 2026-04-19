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
