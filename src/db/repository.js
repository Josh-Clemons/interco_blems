const { getDb } = require('./client');
const { parseDiameter, parseRimDiam, parsePrice } = require('../utils/tires');

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Full-text search across sku, brand, title, and size fields.
 * Returns active tires from all sources (blem and non-blem) whose text fields
 * contain the query string. Results are sorted by source then sku.
 *
 * @param {string} query   - substring matched case-insensitively against sku/brand/title/size
 * @param {object} [filters]
 *   source             - limit to one source (optional)
 *   size               - exact overall diameter in inches (optional, post-filter)
 *   rim                - exact rim diameter in inches (optional, post-filter)
 *   includeOutOfStock  - if true, include out_of_stock tires (default false)
 * @returns {object[]}
 */
function searchTires(query, filters = {}) {
    const { source, size, rim, includeOutOfStock = false } = filters;

    const clauses = ['is_active = 1'];
    const params = [];

    if (source) { clauses.push('source = ?'); params.push(source); }
    if (!includeOutOfStock) { clauses.push("stock_state != 'out_of_stock'"); }

    const q = query; // instr() does substring match without wildcards
    clauses.push(`(
        instr(lower(sku),   lower(?)) > 0
        OR instr(lower(brand),  lower(?)) > 0
        OR instr(lower(title),  lower(?)) > 0
        OR instr(lower(size),   lower(?)) > 0
    )`);
    params.push(q, q, q, q);

    let rows = getDb()
        .prepare(`SELECT * FROM tires WHERE ${clauses.join(' AND ')} ORDER BY source, brand, sku`)
        .all(...params);

    if (size != null) {
        rows = rows.filter(r => {
            const d = r.overall_diam || parseDiameter(r.size);
            return d != null && Math.round(d) === size;
        });
    }
    if (rim != null) {
        rows = rows.filter(r => {
            const d = r.rim_diam || parseRimDiam(r.size);
            return d != null && Math.round(d) === rim;
        });
    }

    return rows;
}

// ---------------------------------------------------------------------------
// Tire queries
// ---------------------------------------------------------------------------

/**
 * Returns all tire rows for a given source.
 */
function getTiresBySource(source) {
    return getDb()
        .prepare('SELECT * FROM tires WHERE source = ?')
        .all(source);
}

/**
 * Returns active tires across all sources, optionally filtered.
 * @param {object} filters
 *   source             - exact source name match (optional)
 *   brand              - case-insensitive substring match (optional)
 *   sizeMin            - min overall diameter in inches (optional)
 *   sizeMax            - max overall diameter in inches (optional)
 *   rimMin             - min rim diameter in inches (optional)
 *   rimMax             - max rim diameter in inches (optional)
 *   priceMax           - max price in dollars (optional)
 *   isBlem             - true/false to filter by blem status (optional)
 *   category           - exact category match (optional)
 *   stockState         - exact stock_state match (optional)
 *   includeOutOfStock  - if true, include out_of_stock tires (default false)
 */
function getActiveTires(filters = {}) {
    const { source, brand, sizeMin, sizeMax, rimMin, rimMax, priceMax, isBlem, category, stockState, includeOutOfStock = false } = filters;

    const clauses = ['is_active = 1'];
    const params = [];

    if (source) { clauses.push('source = ?'); params.push(source); }
    if (isBlem === true) { clauses.push('is_blem = 1'); }
    if (isBlem === false) { clauses.push('is_blem = 0'); }
    if (category) { clauses.push('category = ?'); params.push(category); }
    if (stockState) { clauses.push('stock_state = ?'); params.push(stockState); }
    if (!includeOutOfStock) { clauses.push("stock_state != 'out_of_stock'"); }
    if (priceMax != null) { clauses.push('price_cents <= ?'); params.push(Math.round(priceMax * 100)); }

    let rows = getDb()
        .prepare(`SELECT * FROM tires WHERE ${clauses.join(' AND ')} ORDER BY source, sku`)
        .all(...params);

    if (brand) {
        const b = brand.toLowerCase();
        rows = rows.filter(r => (r.brand || '').toLowerCase().includes(b));
    }
    if (sizeMin != null) {
        rows = rows.filter(r => {
            const d = r.overall_diam || parseDiameter(r.size);
            return d != null && d >= sizeMin;
        });
    }
    if (sizeMax != null) {
        rows = rows.filter(r => {
            const d = r.overall_diam || parseDiameter(r.size);
            return d != null && d <= sizeMax;
        });
    }
    if (rimMin != null) {
        rows = rows.filter(r => {
            const d = r.rim_diam || parseRimDiam(r.size);
            return d != null && d >= rimMin;
        });
    }
    if (rimMax != null) {
        rows = rows.filter(r => {
            const d = r.rim_diam || parseRimDiam(r.size);
            return d != null && d <= rimMax;
        });
    }

    return rows;
}

/**
 * Returns per-source summary rows:
 *   { source, active_count, total_count, last_seen_at }
 */
function getTireSources() {
    return getDb().prepare(`
        SELECT
            source,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
            COUNT(*) AS total_count,
            MAX(last_seen_at) AS last_seen_at
        FROM tires
        GROUP BY source
        ORDER BY source
    `).all();
}

// ---------------------------------------------------------------------------
// v2 column list for INSERT/UPSERT
// ---------------------------------------------------------------------------
const TIRE_COLS = [
    'source', 'sku', 'title', 'brand', 'product_line', 'category', 'size',
    'is_blem', 'quantity_raw', 'quantity_n', 'stock_state',
    'price_cents', 'msrp_cents', 'sale_price_cents',
    'load_index', 'speed_rating', 'load_range', 'ply',
    'weight_oz', 'tread_depth_32', 'overall_diam', 'rim_diam', 'section_width',
    'utqg_wear', 'utqg_traction', 'utqg_temp', 'three_pms',
    'product_url', 'image_url', 'extra',
];

// Build the upsert statement once
const UPSERT_SQL = `
    INSERT INTO tires (${TIRE_COLS.join(', ')}, is_active, notified_at)
    VALUES (${TIRE_COLS.map(c => '@' + c).join(', ')}, 1, NULL)
    ON CONFLICT(source, sku) DO UPDATE SET
        ${TIRE_COLS.filter(c => c !== 'source' && c !== 'sku')
            .map(c => `${c} = excluded.${c}`)
            .join(',\n        ')},
        is_active    = 1,
        last_seen_at = datetime('now'),
        notified_at  = NULL
    RETURNING id
`;

/**
 * Upserts a newly-scraped tire (added or reactivated).
 * Sets is_active=1, updates last_seen_at, and clears notified_at so it alerts again.
 * Accepts a tire object with any v2 fields; missing fields default to null.
 */
function upsertActiveTire(source, tire) {
    const row = { source };
    for (const col of TIRE_COLS) {
        if (col === 'source') continue;
        row[col] = tire[col] ?? null;
    }
    // Derive overall_diam and rim_diam from the size string if the scraper didn't provide them
    if (row.overall_diam == null && row.size) {
        row.overall_diam = parseDiameter(row.size) ?? null;
    }
    if (row.rim_diam == null && row.size) {
        row.rim_diam = parseRimDiam(row.size) ?? null;
    }
    // Serialize extra to JSON if it's an object
    if (row.extra && typeof row.extra === 'object') {
        row.extra = JSON.stringify(row.extra);
    }
    return getDb().prepare(UPSERT_SQL).get(row);
}

/**
 * Updates qty/price for a changed tire and clears notified_at if you want change alerts.
 */
function updateChangedTire(tire) {
    return getDb().prepare(`
        UPDATE tires
        SET quantity_raw = @quantity_raw,
            quantity_n   = @quantity_n,
            stock_state  = @stock_state,
            price_cents  = @price_cents,
            last_seen_at = datetime('now')
        WHERE id = @id
    `).run(tire);
}

/**
 * Touches last_seen_at for tires that are unchanged - so we know they're still active.
 */
function touchTire(id) {
    return getDb().prepare(`
        UPDATE tires SET last_seen_at = datetime('now') WHERE id = ?
    `).run(id);
}

/**
 * Marks tires as inactive (no longer listed on the site).
 */
function deactivateTires(ids) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    return getDb().prepare(`
        UPDATE tires SET is_active = 0, last_seen_at = datetime('now')
        WHERE id IN (${placeholders})
    `).run(...ids);
}

/**
 * Marks notified_at for a list of tire ids after an email is sent.
 */
function markNotified(ids) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    return getDb().prepare(`
        UPDATE tires SET notified_at = datetime('now')
        WHERE id IN (${placeholders})
    `).run(...ids);
}

// ---------------------------------------------------------------------------
// Email log queries
// ---------------------------------------------------------------------------

function logEmail(emailData) {
    return getDb().prepare(`
        INSERT INTO email_log (recipients, subject, body)
        VALUES (@recipients, @subject, @body)
    `).run(emailData);
}

// ---------------------------------------------------------------------------
// Users + subscriptions (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Inserts a user row if missing, otherwise refreshes the cached username.
 */
function upsertUser(id, username) {
    return getDb().prepare(`
        INSERT INTO users (id, username) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET username = excluded.username
    `).run(id, username || null);
}

/**
 * Creates a new subscription. Caller is responsible for having upserted the
 * user first. Returns the inserted row (including its new id).
 */
function createSubscription(sub) {
    const info = getDb().prepare(`
        INSERT INTO subscriptions
            (user_id, source, sku, brand, size, size_min, rim_min, price_max,
             notify_dm, notify_channel, notify_changed, notify_removed)
        VALUES
            (@user_id, @source, @sku, @brand, @size, @size_min, @rim_min, @price_max,
             @notify_dm, @notify_channel, @notify_changed, @notify_removed)
    `).run({
        user_id: sub.user_id,
        source: sub.source ?? null,
        sku: sub.sku ?? null,
        brand: sub.brand ?? null,
        size: sub.size ?? null,
        size_min: sub.size_min ?? null,
        rim_min: sub.rim_min ?? null,
        price_max: sub.price_max ?? null,
        notify_dm: sub.notify_dm ? 1 : 0,
        notify_channel: sub.notify_channel ?? null,
        notify_changed: sub.notify_changed ? 1 : 0,
        notify_removed: sub.notify_removed ? 1 : 0,
    });
    return getSubscriptionById(info.lastInsertRowid);
}

function getSubscriptionById(id) {
    return getDb().prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
}

/**
 * Returns active subscriptions for a specific user, newest first.
 */
function listSubscriptionsForUser(userId) {
    return getDb().prepare(`
        SELECT * FROM subscriptions
        WHERE user_id = ? AND active = 1
        ORDER BY id DESC
    `).all(userId);
}

/**
 * Returns every active subscription across all users. Used by the dispatcher
 * after each scrape.
 */
function getActiveSubscriptions() {
    return getDb().prepare(`
        SELECT * FROM subscriptions WHERE active = 1
    `).all();
}

/**
 * Soft-deletes a subscription (sets active=0). Returns true if a row was
 * updated AND it belonged to the given user — prevents one user from
 * unsubscribing another.
 */
function deactivateSubscription(id, userId) {
    const info = getDb().prepare(`
        UPDATE subscriptions SET active = 0
        WHERE id = ? AND user_id = ? AND active = 1
    `).run(id, userId);
    return info.changes > 0;
}

// ---------------------------------------------------------------------------
// Tire history + scrape runs (Phase 8)
// ---------------------------------------------------------------------------

function getTireBySourceSku(source, sku) {
    return getDb().prepare('SELECT * FROM tires WHERE source = ? AND sku = ?').get(source, sku);
}

function logTireEvent(tireId, event, oldValues, newValues) {
    return getDb().prepare(`
        INSERT INTO tire_history (tire_id, event, old_price_cents, new_price_cents, old_quantity_n, new_quantity_n, old_stock_state, new_stock_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tireId, event, oldValues.price_cents ?? null, newValues.price_cents ?? null, oldValues.quantity_n ?? null, newValues.quantity_n ?? null, oldValues.stock_state ?? null, newValues.stock_state ?? null);
}

function getTireHistory(sku, source) {
    return getDb().prepare(`
        SELECT h.*, t.sku, t.title, t.source
        FROM tire_history h
        JOIN tires t ON t.id = h.tire_id
        WHERE t.sku = ? AND (? IS NULL OR t.source = ?)
        ORDER BY h.recorded_at DESC
        LIMIT 50
    `).all(sku, source ?? null, source ?? null);
}

function startScrapeRun(source) {
    return getDb().prepare(`
        INSERT INTO scrape_runs (source, started_at) VALUES (?, datetime('now'))
    `).run(source).lastInsertRowid;
}

function finishScrapeRun(runId, stats) {
    return getDb().prepare(`
        UPDATE scrape_runs SET
            finished_at = datetime('now'),
            tires_found = @tires_found,
            added = @added,
            reactivated = @reactivated,
            removed = @removed,
            changed = @changed,
            error = @error
        WHERE id = @id
    `).run({ id: runId, ...stats });
}

function getRecentRuns(limit = 20) {
    return getDb().prepare(`
        SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT ?
    `).all(limit);
}

function getBotStats() {
    const db = getDb();
    const totalBySource = db.prepare(`
        SELECT source,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
            COUNT(*) AS total
        FROM tires GROUP BY source
    `).all();

    const last7d = db.prepare(`
        SELECT event, COUNT(*) as cnt
        FROM tire_history
        WHERE recorded_at >= datetime('now', '-7 days')
        GROUP BY event
    `).all();

    const last30d = db.prepare(`
        SELECT event, COUNT(*) as cnt
        FROM tire_history
        WHERE recorded_at >= datetime('now', '-30 days')
        GROUP BY event
    `).all();

    const lastRun = db.prepare(`
        SELECT source, MAX(finished_at) as last_run
        FROM scrape_runs
        WHERE finished_at IS NOT NULL
        GROUP BY source
    `).all();

    return { totalBySource, last7d, last30d, lastRun };
}

module.exports = {
    getTiresBySource,
    getActiveTires,
    searchTires,
    getTireSources,
    upsertActiveTire,
    updateChangedTire,
    touchTire,
    deactivateTires,
    markNotified,
    logEmail,
    upsertUser,
    createSubscription,
    getSubscriptionById,
    listSubscriptionsForUser,
    getActiveSubscriptions,
    deactivateSubscription,
    getTireBySourceSku,
    logTireEvent,
    getTireHistory,
    startScrapeRun,
    finishScrapeRun,
    getRecentRuns,
    getBotStats,
};
