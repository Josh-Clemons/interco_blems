const { getDb } = require('./client');
const { parseDiameter, parsePrice } = require('../utils/tires');

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
 *   source    - exact source name match (optional)
 *   brand     - case-insensitive substring match (optional)
 *   sizeMin   - min overall diameter in inches (optional)
 *   sizeMax   - max overall diameter in inches (optional)
 *   priceMax  - max price in dollars (optional)
 */
function getActiveTires(filters = {}) {
    const { source, brand, sizeMin, sizeMax, priceMax } = filters;

    let rows = source
        ? getDb().prepare('SELECT * FROM tires WHERE is_active = 1 AND source = ? ORDER BY source, sku').all(source)
        : getDb().prepare('SELECT * FROM tires WHERE is_active = 1 ORDER BY source, sku').all();

    if (brand) {
        const b = brand.toLowerCase();
        rows = rows.filter(r => (r.brand || '').toLowerCase().includes(b));
    }
    if (sizeMin != null) {
        rows = rows.filter(r => {
            const d = parseDiameter(r.size);
            return d != null && d >= sizeMin;
        });
    }
    if (sizeMax != null) {
        rows = rows.filter(r => {
            const d = parseDiameter(r.size);
            return d != null && d <= sizeMax;
        });
    }
    if (priceMax != null) {
        rows = rows.filter(r => {
            const p = parsePrice(r.price);
            return p != null && p <= priceMax;
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

/**
 * Upserts a newly-scraped tire (added or reactivated).
 * Sets is_active=1, updates last_seen_at, and clears notified_at so it alerts again.
 */
function upsertActiveTire(source, tire) {
    return getDb().prepare(`
        INSERT INTO tires (source, sku, title, brand, size, quantity, price, is_active, notified_at)
        VALUES (@source, @sku, @title, @brand, @size, @quantity, @price, 1, NULL)
        ON CONFLICT(source, sku) DO UPDATE SET
            title        = excluded.title,
            brand        = excluded.brand,
            size         = excluded.size,
            quantity     = excluded.quantity,
            price        = excluded.price,
            is_active    = 1,
            last_seen_at = datetime('now'),
            notified_at  = NULL
    `).run({ source, ...tire });
}

/**
 * Updates qty/price for a changed tire and clears notified_at if you want change alerts.
 * (Currently we update silently - change emails are informational only, not re-alerting.)
 */
function updateChangedTire(tire) {
    return getDb().prepare(`
        UPDATE tires
        SET quantity     = @quantity,
            price        = @price,
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
            (user_id, source, sku, brand, size, size_min, price_max,
             notify_dm, notify_channel, notify_changed, notify_removed)
        VALUES
            (@user_id, @source, @sku, @brand, @size, @size_min, @price_max,
             @notify_dm, @notify_channel, @notify_changed, @notify_removed)
    `).run({
        user_id: sub.user_id,
        source: sub.source ?? null,
        sku: sub.sku ?? null,
        brand: sub.brand ?? null,
        size: sub.size ?? null,
        size_min: sub.size_min ?? null,
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

module.exports = {
    getTiresBySource,
    getActiveTires,
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
};
