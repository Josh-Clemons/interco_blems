/**
 * /blems — list stored blem tires with optional filters and pagination.
 *
 * Usage:
 *   /blems
 *   /blems source:interco
 *   /blems size_min:37 price_max:500
 *   /blems brand:bogger
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getActiveTires } = require('../../db/repository');
const { buildTireListEmbed, buildPaginationRow, PAGE_SIZE } = require('../embeds');

// In-memory cache of filter queries so pagination buttons can re-run the exact
// same filter without having to encode it in a custom_id (100-char limit).
// Entries auto-expire after 10 minutes to prevent unbounded growth.
const CACHE_TTL_MS = 10 * 60 * 1000;
const filterCache = new Map();

function cacheFilters(filters) {
    const key = Math.random().toString(36).slice(2, 10); // 8-char random id
    filterCache.set(key, { filters, expires: Date.now() + CACHE_TTL_MS });
    return key;
}

function getCachedFilters(key) {
    const entry = filterCache.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
        filterCache.delete(key);
        return null;
    }
    return entry.filters;
}

// Periodic cleanup
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of filterCache.entries()) {
        if (v.expires < now) filterCache.delete(k);
    }
}, 60_000).unref();

/**
 * Renders one page of results based on filters.
 */
function renderPage(filters, filterKey, page) {
    const allTires = getActiveTires(filters);
    const total = allTires.length;

    if (total === 0) {
        return {
            embeds: [{
                title: 'Blem Tires',
                description: 'No tires match your filters.',
                color: 0x2B2D31,
            }],
            components: [],
        };
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
    const start = clampedPage * PAGE_SIZE;
    const slice = allTires.slice(start, start + PAGE_SIZE);

    const filterDescription = describeFilters(filters);
    const embed = buildTireListEmbed({
        tires: slice,
        page: clampedPage,
        totalPages,
        total,
        description: `${total} tire${total !== 1 ? 's' : ''} found${filterDescription ? ` • ${filterDescription}` : ''}`,
    });

    const components = totalPages > 1
        ? [buildPaginationRow(filterKey, clampedPage, totalPages)]
        : [];

    return { embeds: [embed], components };
}

function describeFilters(f) {
    const parts = [];
    if (f.source)             parts.push(`source:${f.source}`);
    if (f.brand)              parts.push(`brand:${f.brand}`);
    if (f.sizeMin != null)    parts.push(`≥${f.sizeMin}"`);
    if (f.sizeMax != null)    parts.push(`≤${f.sizeMax}"`);
    if (f.rim != null)        parts.push(`rim:${f.rim}"`);
    if (f.priceMax != null)   parts.push(`≤$${f.priceMax}`);
    if (f.includeOutOfStock)  parts.push('incl. out-of-stock');
    return parts.join(', ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blems')
        .setDescription('List currently-available blemish tires (filterable).')
        .addStringOption(o => o.setName('source').setDescription('Filter by source (e.g. interco)'))
        .addStringOption(o => o.setName('brand').setDescription('Filter by brand (case-insensitive)'))
        .addIntegerOption(o => o.setName('size_min').setDescription('Minimum tire diameter in inches'))
        .addIntegerOption(o => o.setName('size_max').setDescription('Maximum tire diameter in inches'))
        .addIntegerOption(o => o.setName('rim').setDescription('Exact rim diameter in inches (e.g. 17)'))
        .addNumberOption(o => o.setName('price_max').setDescription('Maximum price in dollars'))
        .addBooleanOption(o => o.setName('include_oos').setDescription('Include out-of-stock tires (hidden by default)')),

    async execute(interaction) {
        const filters = {
            source:            interaction.options.getString('source')      || undefined,
            brand:             interaction.options.getString('brand')       || undefined,
            sizeMin:           interaction.options.getInteger('size_min')   ?? undefined,
            sizeMax:           interaction.options.getInteger('size_max')   ?? undefined,
            rim:               interaction.options.getInteger('rim')         ?? undefined,
            priceMax:          interaction.options.getNumber('price_max')   ?? undefined,
            includeOutOfStock: interaction.options.getBoolean('include_oos') ?? false,
            isBlem:            true,
        };

        const filterKey = cacheFilters(filters);
        const payload = renderPage(filters, filterKey, 0);
        await interaction.reply(payload);
    },

    // Button handler — invoked by interactions.js when a button with
    // customId starting "blems_page_" is clicked.
    async handleButton(interaction, customId) {
        // Format: blems_page_<pageIndex>_<filterKey>
        const m = customId.match(/^blems_page_(\d+)_(.+)$/);
        if (!m) return;
        const page = parseInt(m[1], 10);
        const filterKey = m[2];

        const filters = getCachedFilters(filterKey);
        if (!filters) {
            await interaction.reply({
                content: 'This listing has expired. Please run `/blems` again.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const payload = renderPage(filters, filterKey, page);
        await interaction.update(payload);
    },
};
