/**
 * Shared embed builder helpers.
 *
 * Produces Discord embeds for tire listings and the pagination controls
 * used by /blems.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAGE_SIZE = 10;
const EMBED_COLOR = 0x2B2D31; // neutral dark-gray

/**
 * Formats one tire as an embed field.
 * Shows a [blem] badge, product link when available, and N/A for any missing values.
 */
function tireField(tire) {
    const blem  = tire.is_blem ? ' **[blem]**' : '';
    const qty   = tire.quantity_raw ?? 'N/A';
    const price = tire.price_cents != null ? `$${(tire.price_cents / 100).toFixed(2)}` : 'N/A';
    const link  = tire.product_url ? ` · [view](${tire.product_url})` : '';

    const source = tire.source ? `  |  Source: \`${tire.source}\`` : '';

    return {
        name: `${tire.sku} — ${tire.size}${blem}`,
        value: `**${tire.brand || 'N/A'}**\nQty: ${qty}  |  Price: ${price}${source}${link}`,
        inline: false,
    };
}

/**
 * Builds the embed for one page of a tire listing.
 */
function buildTireListEmbed({ tires, page, totalPages, total, title, description }) {
    return {
        title: title || 'Blem Tires',
        description: description || `${total} tire${total !== 1 ? 's' : ''} matching your query.`,
        color: EMBED_COLOR,
        fields: tires.map(tireField),
        footer: {
            text: `Page ${page + 1} of ${totalPages}`,
        },
        timestamp: new Date().toISOString(),
    };
}

/**
 * Builds the Prev/Next action row. Button custom IDs encode the
 * target page number so the handler is stateless:
 *   blems_page_<pageIndex>_<filterKey>
 *
 * filterKey is an opaque identifier stored in an in-memory Map keyed to
 * filterKey, letting us re-run the exact same query on button click without
 * having to cram all filters into the custom_id (which has a 100-char limit).
 */
function buildPaginationRow(filterKey, page, totalPages) {
    const row = new ActionRowBuilder();

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`blems_page_${page - 1}_${filterKey}`)
            .setLabel('◀ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),
        new ButtonBuilder()
            .setCustomId(`blems_page_${page + 1}_${filterKey}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
    );

    return row;
}

module.exports = {
    PAGE_SIZE,
    EMBED_COLOR,
    tireField,
    buildTireListEmbed,
    buildPaginationRow,
};
