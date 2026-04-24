/**
 * Discord notifier - posts blem alerts via the bot client.
 *
 * Posts to DISCORD_ALERT_CHANNEL_ID (the public feed). This channel always
 * receives every alert, regardless of any per-user subscriptions added in
 * later phases.
 *
 * Embed color reference:
 *   0x57F287 = green  (new)
 *   0xFEE75C = yellow (reactivated)
 *   0x5865F2 = blurple (changed)
 */

const { getClient } = require('../bot/client');
const log = require('../logger');

function tireFields(tires) {
    return tires.map(t => ({
        name: `${t.sku} — ${t.size}`,
        value: `Brand: ${t.brand || 'N/A'}\nQty: ${t.quantity_raw ?? '?'}  |  Price: ${t.price_cents != null ? '$' + (t.price_cents / 100).toFixed(2) : 'N/A'}`,
        inline: false,
    }));
}

function buildEmbeds({ added, reactivated, changed }) {
    const embeds = [];
    const ts = new Date().toISOString();

    if (added.length) {
        embeds.push({
            title: `🟢 ${added.length} New Blem Tire${added.length !== 1 ? 's' : ''} Found!`,
            color: 0x57F287,
            fields: tireFields(added),
            timestamp: ts,
            footer: { text: 'intercotire.com/blem-list' },
        });
    }

    if (reactivated.length) {
        embeds.push({
            title: `🔄 ${reactivated.length} Tire${reactivated.length !== 1 ? 's' : ''} Back in Stock`,
            color: 0xFEE75C,
            fields: tireFields(reactivated),
            timestamp: ts,
            footer: { text: 'intercotire.com/blem-list' },
        });
    }

    if (changed.length) {
        embeds.push({
            title: `🔁 ${changed.length} Tire${changed.length !== 1 ? 's' : ''} — Price/Qty Changed`,
            color: 0x5865F2,
            fields: tireFields(changed),
            timestamp: ts,
            footer: { text: 'intercotire.com/blem-list' },
        });
    }

    return embeds;
}

/**
 * Posts a blem alert to the public feed channel.
 * Discord limits 10 embeds per message, so we chunk if needed.
 */
async function sendDiscordAlert(diff) {
    const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
    if (!channelId) {
        log.info('[discord] DISCORD_ALERT_CHANNEL_ID not set. Skipping.');
        return;
    }

    const embeds = buildEmbeds(diff);
    if (embeds.length === 0) return;

    const client = getClient();
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        log.error(`[discord] Could not fetch channel ${channelId} (bot not in guild or missing permissions?)`);
        return;
    }

    // Discord allows max 10 embeds per message
    for (let i = 0; i < embeds.length; i += 10) {
        await channel.send({ embeds: embeds.slice(i, i + 10) });
    }

    log.info(`[discord] Alert posted to #${channel.name || channelId}`);
}

module.exports = { sendDiscordAlert, buildEmbeds };
