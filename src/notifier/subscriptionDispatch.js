/**
 * Discord DM / channel notifier for per-user subscription hits.
 *
 * Kept separate from notifier/discord.js (the public feed) so the two
 * concerns don't entangle. The embed palette distinguishes:
 *   • Pinned watches  (any matching sub has sku set) → orange + 🔔
 *   • Broad filters                                 → blurple + 🔔
 *
 * Inside the embed, tires are grouped by event (new / reactivated / changed
 * / removed) so users immediately see what actually changed.
 */

const { getClient } = require('../bot/client');

const COLOR_PINNED = 0xE67E22; // orange
const COLOR_BROAD  = 0x5865F2; // blurple

const EVENT_LABELS = {
    added:       '🟢 New',
    reactivated: '🔄 Back in stock',
    changed:     '🔁 Price/Qty changed',
    removed:     '🗑️ Removed',
};

/**
 * Groups { tire, event, pinned } entries by event for display.
 */
function groupByEvent(hits) {
    const groups = { added: [], reactivated: [], changed: [], removed: [] };
    for (const hit of hits) groups[hit.event].push(hit.tire);
    return groups;
}

function tireFields(tires) {
    return tires.map(t => ({
        name: `${t.sku} — ${t.size}`,
        value: `**${t.brand || 'N/A'}**\nQty: ${t.quantity}  |  Price: ${t.price}  |  \`${t.source}\``,
        inline: false,
    }));
}

/**
 * entry shape from subscriptions.buildUserHits():
 *   { user_id, subs: Set<id>, tires: Map<key, {tire,event,pinned}>, notify, anyPinned }
 */
function buildEmbedsForUser(entry) {
    const hits = [...entry.tires.values()];
    const groups = groupByEvent(hits);
    const subIds = [...entry.subs].map(id => `#${id}`).join(', ');
    const color = entry.anyPinned ? COLOR_PINNED : COLOR_BROAD;

    // One embed per event type that has content. Discord caps at 10 embeds
    // per message and 25 fields per embed — plenty of headroom.
    const embeds = [];
    let totalFields = 0;
    let first = true;

    for (const event of ['added', 'reactivated', 'changed', 'removed']) {
        const tires = groups[event];
        if (tires.length === 0) continue;

        const slice = tires.slice(0, 25);
        totalFields += slice.length;

        const embed = {
            title: `${EVENT_LABELS[event]} — ${tires.length} tire${tires.length !== 1 ? 's' : ''}`,
            color,
            fields: tireFields(slice),
        };

        if (first) {
            embed.description = `🔔 Matched on subscription${entry.subs.size !== 1 ? 's' : ''}: ${subIds}` +
                (entry.anyPinned ? '\n📌 _includes pinned SKU watch_' : '');
            embed.timestamp = new Date().toISOString();
            first = false;
        }

        if (tires.length > 25) {
            embed.footer = { text: `Showing 25 of ${tires.length}. Use /blems for the full list.` };
        }

        embeds.push(embed);
    }

    return { embeds };
}

async function sendDm(userId, payload) {
    const client = getClient();
    const user = await client.users.fetch(userId);
    const dm = await user.createDM();
    await dm.send(payload);
}

async function sendChannel(channelId, payload) {
    const client = getClient();
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    await channel.send(payload);
}

module.exports = { buildEmbedsForUser, sendDm, sendChannel, groupByEvent };
