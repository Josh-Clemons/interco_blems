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

    return _db;
}

module.exports = { getDb };
