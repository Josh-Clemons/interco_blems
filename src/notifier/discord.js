/**
 * Discord notifier - posts blem alerts to a Discord channel via webhook.
 *
 * Set DISCORD_WEBHOOK_URL in your .env to enable.
 * If the variable is absent the notifier is silently skipped.
 *
 * Discord embed color reference:
 *   0x57F287 = green  (new)
 *   0xFEE75C = yellow (reactivated)
 *   0x5865F2 = blurple (changed)
 */

function tireFields(tires) {
    return tires.map(t => ({
        name: `${t.sku} — ${t.size}`,
        value: `Brand: ${t.brand || 'N/A'}\nQty: ${t.quantity}  |  Price: ${t.price}`,
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
 * Posts a blem alert to Discord.
 * Discord limits 10 embeds per message, so we chunk if needed.
 */
async function sendDiscordAlert(diff) {
    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    if (!WEBHOOK_URL) {
        console.log('[discord] DISCORD_WEBHOOK_URL not set. Skipping.');
        return;
    }

    const embeds = buildEmbeds(diff);
    if (embeds.length === 0) return;

    // Discord allows max 10 embeds per message
    const chunks = [];
    for (let i = 0; i < embeds.length; i += 10) {
        chunks.push(embeds.slice(i, i + 10));
    }

    for (const chunk of chunks) {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: chunk }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Discord webhook failed ${res.status}: ${text}`);
        }
    }

    console.log('[discord] Alert posted to Discord channel.');
}

module.exports = { sendDiscordAlert };
