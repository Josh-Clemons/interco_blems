/**
 * Subscription matching + alert dispatch.
 *
 * One unified model covers both broad "alert me on X-like tires" and the
 * pinned "watch THIS specific tire" pattern:
 *
 *   sub.sku            — exact SKU pin (case-insensitive); null = any
 *   sub.source         — exact source; null = any
 *   sub.brand          — case-insensitive substring; null = any
 *   sub.size           — exact size string match; null = any
 *   sub.size_min       — min diameter in inches; null = no minimum
 *   sub.price_max      — max price; null = no ceiling
 *   sub.notify_changed — also alert on qty/price changes to matching tires
 *   sub.notify_removed — also alert when a matching tire disappears
 *
 * When sku is set, the sub is effectively a "pinned watch" on that tire
 * (and track_changes/track_removed let the user get the full watchlist
 * experience). When sku is null it behaves like a broad subscription.
 */

const { parseDiameter } = require('./utils/tires');

/**
 * Returns true iff the given tire passes every filter on the subscription.
 * Missing filter values mean "no constraint on that dimension".
 */
function tireMatchesSubscription(tire, sub) {
    if (sub.source && tire.source !== sub.source) return false;

    if (sub.sku) {
        if (!tire.sku || tire.sku.toLowerCase() !== sub.sku.toLowerCase()) return false;
    }

    if (sub.brand) {
        const b = (tire.brand || '').toLowerCase();
        if (!b.includes(sub.brand.toLowerCase())) return false;
    }

    if (sub.size) {
        if ((tire.size || '').toLowerCase() !== sub.size.toLowerCase()) return false;
    }

    if (sub.size_min != null) {
        const d = parseDiameter(tire.size);
        if (d == null || d < sub.size_min) return false;
    }

    if (sub.price_max != null) {
        if (tire.price_cents == null || tire.price_cents > sub.price_max * 100) return false;
    }

    return true;
}

/**
 * Returns true if the subscription has at least one narrowing filter. Used to
 * guard track_changes / track_removed from firing on firehose subscriptions.
 */
function hasNarrowingFilter(sub) {
    return !!(sub.sku || sub.brand || sub.size || sub.size_min != null);
}

/**
 * Decides which diff event types a subscription cares about. Every sub gets
 * "added" and "reactivated"; notify_changed / notify_removed opt into more.
 */
function eventsForSub(sub) {
    const events = ['added', 'reactivated'];
    if (sub.notify_changed) events.push('changed');
    if (sub.notify_removed) events.push('removed');
    return events;
}

/**
 * Groups matched tires by user so each user gets at most one message even
 * when they have multiple subscriptions hitting the same tire.
 *
 * Output value shape:
 *   {
 *     user_id,
 *     subs:  Set<sub_id>,
 *     tires: Map<"source:sku", { tire, event, pinned }>,
 *     notify: { dm, channel },
 *     anyPinned: boolean,  // true if any matching sub has sku set
 *   }
 *
 * When the same tire matches a broad sub and a pinned sub, the pinned flag
 * wins — pinned styling is more urgent.
 */
function buildUserHits(diff, subs) {
    const byUser = new Map();

    const eventBuckets = {
        added:       diff.added || [],
        reactivated: diff.reactivated || [],
        changed:     diff.changed || [],
        removed:     diff.removed || [],
    };

    for (const sub of subs) {
        const events = eventsForSub(sub);

        for (const event of events) {
            for (const tire of eventBuckets[event]) {
                if (!tireMatchesSubscription(tire, sub)) continue;

                let entry = byUser.get(sub.user_id);
                if (!entry) {
                    entry = {
                        user_id: sub.user_id,
                        subs: new Set(),
                        tires: new Map(),
                        // First matching sub wins for routing — simple & predictable.
                        notify: { dm: !!sub.notify_dm, channel: sub.notify_channel },
                        anyPinned: false,
                    };
                    byUser.set(sub.user_id, entry);
                }
                entry.subs.add(sub.id);
                if (sub.sku) entry.anyPinned = true;

                const key = `${tire.source}:${tire.sku}`;
                const existing = entry.tires.get(key);
                if (!existing) {
                    entry.tires.set(key, { tire, event, pinned: !!sub.sku });
                } else if (sub.sku && !existing.pinned) {
                    // Upgrade to pinned styling if any matching sub was a pin.
                    existing.pinned = true;
                }
            }
        }
    }

    return byUser;
}

/**
 * Dispatches subscription alerts.
 *
 * deps:
 *   getActiveSubscriptions() -> array of sub rows
 *   sendDm(userId, payload)
 *   sendChannel(channelId, payload)
 *   buildEmbedsForUser(entry) -> { embeds, content? }
 *   logger (optional)
 */
async function dispatchSubscriptionAlerts(diff, deps) {
    const log = deps.logger || console;
    const subs = deps.getActiveSubscriptions();
    if (!subs.length) return { usersNotified: 0, dmFailures: 0 };

    const byUser = buildUserHits(diff, subs);
    let usersNotified = 0;
    let dmFailures = 0;

    for (const entry of byUser.values()) {
        const payload = deps.buildEmbedsForUser(entry);

        try {
            if (entry.notify.dm) {
                await deps.sendDm(entry.user_id, payload);
            } else if (entry.notify.channel) {
                await deps.sendChannel(entry.notify.channel, payload);
            } else {
                // notify_dm=0 but no channel — misconfigured, fall back to DM.
                await deps.sendDm(entry.user_id, payload);
            }
            usersNotified++;
        } catch (err) {
            dmFailures++;
            log.warn(`[subscriptions] Notify failed for user ${entry.user_id}: ${err.message}`);
        }
    }

    return { usersNotified, dmFailures };
}

module.exports = {
    tireMatchesSubscription,
    hasNarrowingFilter,
    eventsForSub,
    buildUserHits,
    dispatchSubscriptionAlerts,
};
