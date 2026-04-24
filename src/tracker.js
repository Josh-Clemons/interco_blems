/**
 * tracker.js
 *
 * Pure diff logic - no DB or network calls here, easy to unit test.
 *
 * Given a list of freshly-scraped tires and the existing DB rows for the
 * same source, returns a categorized diff:
 *
 *   added        - SKUs not in DB at all (brand new tires)
 *   reactivated  - SKUs that were marked inactive but are now listed again
 *   changed      - SKUs still active but qty or price has changed
 *   removed      - SKUs that were active but are no longer in the scrape
 *   unchanged    - everything else (no action needed)
 *
 * The "alertable" set (triggers an email) is: added + reactivated.
 * The "changed" set is informational and included in emails if non-empty.
 */

function hasChanged(scraped, existing) {
    if (scraped.price_cents !== existing.price_cents) return true;
    if (scraped.quantity_n !== existing.quantity_n) return true;

    if (scraped.stock_state && existing.stock_state &&
        scraped.stock_state !== existing.stock_state) return true;

    return false;
}

function diff(scraped, dbRows) {
    const bySkuDb = new Map(dbRows.map(r => [r.sku, r]));
    const bySkuScraped = new Map(scraped.map(t => [t.sku, t]));

    const added       = [];
    const reactivated = [];
    const changed     = [];
    const removed     = [];
    const unchanged   = [];

    // Walk scraped results
    for (const tire of scraped) {
        const existing = bySkuDb.get(tire.sku);

        if (!existing) {
            added.push(tire);
        } else if (!existing.is_active) {
            reactivated.push({ ...tire, id: existing.id, old_price_cents: existing.price_cents, old_quantity_n: existing.quantity_n, old_stock_state: existing.stock_state });
        } else if (hasChanged(tire, existing)) {
            changed.push({ ...tire, id: existing.id, old_price_cents: existing.price_cents, old_quantity_n: existing.quantity_n, old_stock_state: existing.stock_state });
        } else {
            unchanged.push({ ...tire, id: existing.id });
        }
    }

    // Walk DB rows to find removals
    for (const row of dbRows) {
        if (row.is_active && !bySkuScraped.has(row.sku)) {
            removed.push(row);
        }
    }

    return { added, reactivated, changed, removed, unchanged };
}

/**
 * Returns true if the diff contains anything that should trigger an email alert.
 */
function hasAlerts({ added, reactivated }) {
    return added.length > 0 || reactivated.length > 0;
}

module.exports = { diff, hasAlerts };
