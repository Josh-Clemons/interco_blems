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
            reactivated.push({ ...tire, id: existing.id });
        } else if (existing.quantity !== tire.quantity || existing.price !== tire.price) {
            changed.push({ ...tire, id: existing.id });
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
