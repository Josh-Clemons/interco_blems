/**
 * Alert-layer filtering.
 *
 * The scraper captures EVERY tire on the page; filtering is pushed to the
 * notification layer so that the DB always has a complete picture for
 * /blems, /find, and per-user subscriptions.
 *
 * This module applies the PUBLIC FEED filter — what's interesting enough
 * to broadcast automatically to DISCORD_ALERT_CHANNEL_ID and the email list.
 * Per-user subscriptions/watchlists (Phase 3+) apply their own filters
 * separately.
 */

const { parseDiameter } = require('./utils/tires');

/**
 * Returns a new diff object with only tires that qualify for the public feed.
 * Public-feed criteria:
 *   1) minimum diameter (default 35")
 *   2) tire must be available (not out_of_stock / unavailable / qty 0)
 * Set PUBLIC_ALERT_MIN_DIAMETER=0 in .env to disable.
 */
function filterForPublicAlert(diff) {
    // Read env on every call so tests can override at runtime.
    const min = parseFloat(process.env.PUBLIC_ALERT_MIN_DIAMETER ?? '35');
    if (!min || Number.isNaN(min) || min <= 0) return diff; // no filtering

    const isUnavailable = (tire) => {
        const state = String(tire.stock_state || '').toLowerCase();
        if (state === 'out_of_stock') return true;

        if (typeof tire.quantity_n === 'number' && tire.quantity_n <= 0) {
            return true;
        }

        const raw = String(tire.quantity_raw ?? tire.quantity ?? '').trim().toLowerCase();
        if (raw) {
            if (
                raw.includes('out of stock') ||
                raw.includes('unavailable') ||
                raw.includes('sold out') ||
                raw.includes('not available') ||
                raw.includes('backorder') ||
                raw.includes('back order')
            ) {
                return true;
            }

            if (/^0+$/.test(raw)) return true;
            const m = raw.match(/\d+/);
            if (m && parseInt(m[0], 10) <= 0) return true;
        }

        if (state === 'in_stock' || state === 'low_stock') return false;
        return false;
    };

    const passes = (tire) => {
        const d = tire.overall_diam || parseDiameter(tire.size);
        return d != null && d >= min && !isUnavailable(tire);
    };

    return {
        added:       diff.added.filter(passes),
        reactivated: diff.reactivated.filter(passes),
        changed:     diff.changed.filter(passes),
        removed:     diff.removed.filter(passes),
        unchanged:   diff.unchanged,
    };
}

/**
 * Returns true if the given filtered diff has any tires worth alerting on.
 */
function hasPublicAlerts(diff) {
    return diff.added.length > 0 || diff.reactivated.length > 0;
}

module.exports = { filterForPublicAlert, hasPublicAlerts };
