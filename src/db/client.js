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
    applyColumnMigrations(_db, 'subscriptions', [
        { name: 'sku',             ddl: "ADD COLUMN sku TEXT" },
        { name: 'size',            ddl: "ADD COLUMN size TEXT" },
        { name: 'notify_changed',  ddl: "ADD COLUMN notify_changed INTEGER NOT NULL DEFAULT 0" },
        { name: 'notify_removed',  ddl: "ADD COLUMN notify_removed INTEGER NOT NULL DEFAULT 0" },
    ]);

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
