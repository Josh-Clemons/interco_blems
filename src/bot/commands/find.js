/**
 * /find — search stored tire inventory by brand, model, size, or SKU.
 *
 * Queries the database (kept fresh by scheduled scrapes) across all sources.
 * Unlike /blems which is blem-only, /find searches all stored inventory —
 * blems and standard catalog tires alike.
 *
 * Usage:
 *   /find query:bogger
 *   /find query:claw size:37
 *   /find query:37x12.50R17 source:interco
 */

const { SlashCommandBuilder } = require('discord.js');
const scrapers = require('../../scrapers');
const { searchTires } = require('../../db/repository');
const { EMBED_COLOR } = require('../embeds');

const MAX_PER_SOURCE = 10;

// Build choices from the live scraper registry so the dropdown stays in sync
// as scrapers are added.
const SOURCE_CHOICES = scrapers.map(s => ({ name: s.name, value: s.name }));

/**
 * Formats one tire as an embed field, including a blem badge and product link
 * when available. Designed for /find results where blems and standard tires
 * can appear together.
 */
function findTireField(tire) {
    const blem    = tire.is_blem ? ' **[blem]**' : '';
    const price   = tire.price_cents != null ? `$${(tire.price_cents / 100).toFixed(2)}` : 'N/A';
    const qty     = tire.quantity_raw ?? '?';
    const link    = tire.product_url ? ` · [view](${tire.product_url})` : '';

    return {
        name: `${tire.sku} — ${tire.size}${blem}`,
        value: `**${tire.brand || 'N/A'}**\nQty: ${qty}  |  Price: ${price}${link}`,
        inline: false,
    };
}

function buildSourceEmbed(source, tires, query) {
    const total = tires.length;
    const shown = tires.slice(0, MAX_PER_SOURCE);
    const blemCount = tires.filter(t => t.is_blem).length;

    let subtitle = '';
    if (blemCount > 0 && blemCount < total) subtitle = `${blemCount} blem, ${total - blemCount} standard`;
    else if (blemCount === total)           subtitle = 'all blem';
    else                                    subtitle = 'all standard';

    const overflow = total > MAX_PER_SOURCE
        ? `\nShowing ${MAX_PER_SOURCE} of ${total}. Use \`/blems source:${source}\` to browse all.`
        : '';

    return {
        title: `${source} — ${total} result${total !== 1 ? 's' : ''} (${subtitle})`,
        description: overflow || null,
        color: EMBED_COLOR,
        fields: shown.map(findTireField),
        footer: { text: 'Data from last scheduled scrape' },
        timestamp: new Date().toISOString(),
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('find')
        .setDescription('Search all stored tires by brand, model, size, or SKU.')
        .addStringOption(o =>
            o.setName('query')
                .setDescription('What to search for — brand (bogger), model (claw), size (37x12.50R17), or SKU')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('size')
                .setDescription('Narrow to a specific overall diameter in inches (e.g. 37)')
                .setMinValue(10)
                .setMaxValue(60)
        )
        .addStringOption(o =>
            o.setName('source')
                .setDescription('Limit to one data source')
                .addChoices(...SOURCE_CHOICES)
        ),

    async execute(interaction) {
        const query  = interaction.options.getString('query');
        const size   = interaction.options.getInteger('size') ?? undefined;
        const source = interaction.options.getString('source') || undefined;

        const allResults = searchTires(query, { source, size });

        if (allResults.length === 0) {
            const hints = [
                `Try a shorter term — \`/find query:claw\` instead of a full size string.`,
                `Use \`/blems\` to browse all available blem inventory without filtering.`,
                size ? `The size filter requires an exact diameter match — try without \`size:${size}\` to broaden results.` : null,
                source ? `Try without \`source:${source}\` to search all sites.` : null,
            ].filter(Boolean);

            await interaction.reply({
                embeds: [{
                    title: `No results for "${query}"${size ? ` (${size}")` : ''}${source ? ` in ${source}` : ''}`,
                    description: hints.join('\n'),
                    color: 0x2B2D31,
                }],
                ephemeral: true,
            });
            return;
        }

        // Group by source, preserving DB sort order (source, brand, sku)
        const bySource = new Map();
        for (const tire of allResults) {
            if (!bySource.has(tire.source)) bySource.set(tire.source, []);
            bySource.get(tire.source).push(tire);
        }

        const embeds = [];
        for (const [src, tires] of bySource) {
            embeds.push(buildSourceEmbed(src, tires, query));
        }

        // Discord allows max 10 embeds per message
        await interaction.reply({ embeds: embeds.slice(0, 10) });
    },
};
