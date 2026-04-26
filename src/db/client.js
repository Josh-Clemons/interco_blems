require('dotenv').config();
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './blems.db';

let _db = null;

function getDb() {
    if (_db) return _db;

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL'); // better concurrent read performance

    // Auto-apply schema on first run
    const schema = fs.readFileSync(path.join(__dirname, '../../database.sql'), 'utf8');
    _db.exec(schema);

    // Idempotent column migrations for tables that predate new features.
    // SQLite lacks ADD COLUMN IF NOT EXISTS so we check pragma first.
    applyColumnMigrations(_db, 'tires', [
        { name: 'rim_diam', ddl: "ADD COLUMN rim_diam REAL" },
    ]);
    applyColumnMigrations(_db, 'subscriptions', [
        { name: 'sku',             ddl: "ADD COLUMN sku TEXT" },
        { name: 'size',            ddl: "ADD COLUMN size TEXT" },
        { name: 'notify_changed',  ddl: "ADD COLUMN notify_changed INTEGER NOT NULL DEFAULT 0" },
        { name: 'notify_removed',  ddl: "ADD COLUMN notify_removed INTEGER NOT NULL DEFAULT 0" },
        { name: 'rim',             ddl: "ADD COLUMN rim INTEGER" },
    ]);


    // Phase 8: tire_history + scrape_runs tables
    _db.exec(`
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
    `);

    // v2 indexes (safe to run repeatedly)
    _db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tires_source      ON tires(source);
        CREATE INDEX IF NOT EXISTS idx_tires_brand       ON tires(brand);
        CREATE INDEX IF NOT EXISTS idx_tires_size        ON tires(size);
        CREATE INDEX IF NOT EXISTS idx_tires_blem        ON tires(is_blem);
        CREATE INDEX IF NOT EXISTS idx_tires_active      ON tires(is_active);
        CREATE INDEX IF NOT EXISTS idx_tires_category    ON tires(category);
        CREATE INDEX IF NOT EXISTS idx_tires_price       ON tires(price_cents);
        CREATE INDEX IF NOT EXISTS idx_tires_overall_diam ON tires(overall_diam);
        CREATE INDEX IF NOT EXISTS idx_tires_rim_diam     ON tires(rim_diam);
    `);

    return _db;
}

function applyColumnMigrations(db, table, migrations) {
    const existing = new Set(
        db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name)
    );
    for (const m of migrations) {
        if (existing.has(m.name)) continue;
        db.exec(`ALTER TABLE ${table} ${m.ddl}`);
    }
}

module.exports = { getDb };
