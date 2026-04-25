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
const { tireField } = require('../bot/embeds');
const log = require('../logger');

// Discord's total embed character limit per message is 6000.
// We cap tires shown per embed and send each embed as its own message
// to stay well within limits regardless of batch size.
const MAX_TIRES_SHOWN = 20;

function tireFields(tires) {
    const fields = tires.slice(0, MAX_TIRES_SHOWN).map(tireField);
    if (tires.length > MAX_TIRES_SHOWN) {
        fields.push({
            name: `…and ${tires.length - MAX_TIRES_SHOWN} more`,
            value: 'Use `/blems` to see all.',
            inline: false,
        });
    }
    return fields;
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
        });
    }

    if (reactivated.length) {
        embeds.push({
            title: `🔄 ${reactivated.length} Tire${reactivated.length !== 1 ? 's' : ''} Back in Stock`,
            color: 0xFEE75C,
            fields: tireFields(reactivated),
            timestamp: ts,
        });
    }

    if (changed.length) {
        embeds.push({
            title: `🔁 ${changed.length} Tire${changed.length !== 1 ? 's' : ''} — Price/Qty Changed`,
            color: 0x5865F2,
            fields: tireFields(changed),
            timestamp: ts,
        });
    }

    return embeds;
}

/**
 * Posts a blem alert to the public feed channel.
 * Each embed is sent as its own message to avoid the 6000-char per-message limit.
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

    for (const embed of embeds) {
        await channel.send({ embeds: [embed] });
    }

    log.info(`[discord] Alert posted to #${channel.name || channelId}`);
}

module.exports = { sendDiscordAlert, buildEmbeds };
