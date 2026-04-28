/**
 * /ask — natural language tire search.
 *
 * Parses the user's query via the LLM, executes structured filters against the DB,
 * and returns ranked results. Falls back to keyword search if LLM parsing fails.
 *
 * Usage:
 *   /ask query:bogger 37s under $500
 *   /ask query:show me in-stock blems for 17-inch rims
 */

const { SlashCommandBuilder } = require('discord.js');
const { parseQuery } = require('../../llm/parseQuery');
const { getActiveTires, getActiveSources, getDistinctBrands, getDistinctCategories, getBotStats, searchTires } = require('../../db/repository');
const { tireField, EMBED_COLOR } = require('../embeds');
const log = require('../../logger');

const MAX_RESULTS = 15;

const STOCK_ORDER = { in_stock: 0, low_stock: 1, unknown: 2, out_of_stock: 3 };

function rankTires(tires, sortBy = null) {
    const sorted = [...tires];
    if (sortBy === 'price_asc') {
        return sorted.sort((a, b) => (a.price_cents ?? Infinity) - (b.price_cents ?? Infinity));
    }
    if (sortBy === 'price_desc') {
        return sorted.sort((a, b) => (b.price_cents ?? -Infinity) - (a.price_cents ?? -Infinity));
    }
    if (sortBy === 'qty_desc') {
        return sorted.sort((a, b) => (b.quantity_n ?? -1) - (a.quantity_n ?? -1));
    }
    if (sortBy === 'qty_asc') {
        return sorted.sort((a, b) => (a.quantity_n ?? Infinity) - (b.quantity_n ?? Infinity));
    }
    if (sortBy === 'newest') {
        return sorted.sort((a, b) => (b.first_seen_at ?? '').localeCompare(a.first_seen_at ?? ''));
    }
    // Default: blems first, then stock state, then price ascending
    return sorted.sort((a, b) => {
        if (b.is_blem !== a.is_blem) return b.is_blem - a.is_blem;
        const sa = STOCK_ORDER[a.stock_state] ?? 2;
        const sb = STOCK_ORDER[b.stock_state] ?? 2;
        if (sa !== sb) return sa - sb;
        return (a.price_cents ?? Infinity) - (b.price_cents ?? Infinity);
    });
}

function applyKeyword(tires, keyword) {
    if (!keyword) return tires;
    const kw = keyword.toLowerCase();
    return tires.filter(t =>
        (t.brand        || '').toLowerCase().includes(kw) ||
        (t.title        || '').toLowerCase().includes(kw) ||
        (t.sku          || '').toLowerCase().includes(kw) ||
        (t.product_line || '').toLowerCase().includes(kw)
    );
}

/**
 * Builds a plain-text response for info-intent queries.
 * Exported so chatChannel.js can reuse it.
 */
function buildInfoContent(filters) {
    const { infoType, isBlem, source } = filters;
    const qualifier      = isBlem === true ? 'blem ' : isBlem === false ? 'standard ' : '';
    const sourceQualifier = source ? ` from ${source}` : '';

    if (infoType === 'sources') {
        const rows = getActiveSources({ isBlem, source });
        if (!rows.length) return `No ${qualifier}tire sources found${sourceQualifier}.`;
        const list = rows.map(r => `**${r.source}** (${r.count})`).join(', ');
        return `${qualifier || 'Tire '}sources${sourceQualifier}: ${list}. Use \`/sources\` for the full breakdown.`;
    }
    if (infoType === 'brands') {
        const brands = getDistinctBrands({ isBlem, source });
        if (!brands.length) return `No ${qualifier}brands found${sourceQualifier}.`;
        return `${qualifier || 'Tire '}brands${sourceQualifier}: ${brands.join(', ')}.`;
    }
    if (infoType === 'categories') {
        const cats = getDistinctCategories({ isBlem, source });
        if (!cats.length) return `No ${qualifier}categories found${sourceQualifier}.`;
        return `${qualifier || 'Tire '}categories${sourceQualifier}: ${cats.join(', ')}.`;
    }
    if (infoType === 'stats') {
        const { totalBySource } = getBotStats();
        const total   = totalBySource.reduce((s, r) => s + r.active, 0);
        const bySource = totalBySource.map(r => `${r.source}: ${r.active}`).join(', ');
        return `${total} active tires across ${totalBySource.length} source${totalBySource.length !== 1 ? 's' : ''} (${bySource}). Use \`/stats\` for more detail.`;
    }
    return "Not sure what you're asking for. Try \`/sources\`, \`/stats\`, or just ask for tires.";
}

/**
 * Runs the full NL query pipeline: parse → DB fetch → keyword filter → rank.
 * Accepts an optional pre-parsed { filters, fallback } to avoid a second LLM call.
 * Exported so chatChannel.js can reuse it.
 */
async function executeQuery(queryText, parsed = null) {
    const { filters, fallback } = parsed ?? await parseQuery(queryText);

    let results;
    if (fallback || !filters) {
        results = searchTires(queryText, { includeOutOfStock: false });
    } else {
        results = getActiveTires({
            source:            filters.source     ?? undefined,
            isBlem:            filters.isBlem     ?? undefined,
            sizeMin:           filters.sizeMin    ?? undefined,
            sizeMax:           filters.sizeMax    ?? undefined,
            rim:               filters.rim        ?? undefined,
            priceMin:          filters.priceMin   ?? undefined,
            priceMax:          filters.priceMax   ?? undefined,
            minQty:            filters.minQty     ?? undefined,
            maxQty:            filters.maxQty     ?? undefined,
            ply:               filters.ply        ?? undefined,
            loadRange:         filters.loadRange  ?? undefined,
            category:          filters.category   ?? undefined,
            threePms:          filters.threePms   ?? undefined,
            includeOutOfStock: filters.stockPref === 'any',
        });
        results = applyKeyword(results, filters.keyword);
    }

    const ranked = rankTires(results, filters?.sortBy ?? null);
    const limited = filters?.limit ? ranked.slice(0, filters.limit) : ranked;
    return { results: limited, fallback };
}

/**
 * Builds Discord embeds for a query result set.
 * Exported so chatChannel.js can reuse it.
 */
function buildResultEmbeds(results, queryText, fallback) {
    if (results.length === 0) {
        return [{
            title:       `No results for "${queryText}"`,
            description: 'Try a brand name, size (e.g. 37), rim size, or price limit.',
            color:       0x2B2D31,
        }];
    }

    const shown   = results.slice(0, MAX_RESULTS);
    const blemCnt = shown.filter(t => t.is_blem).length;

    let subtitle = '';
    if (blemCnt > 0 && blemCnt < shown.length) subtitle = ` · ${blemCnt} blem, ${shown.length - blemCnt} standard`;
    else if (blemCnt === shown.length)          subtitle = ' · all blem';
    else                                         subtitle = ' · all standard';

    const overflow = results.length > MAX_RESULTS
        ? `\nShowing ${MAX_RESULTS} of ${results.length}. Narrow with a brand name, size, or price.`
        : '';

    const note = fallback ? ' *(keyword search)*' : '';

    return [{
        title:       `Results for "${queryText}"${note}`,
        description: `${results.length} tire${results.length !== 1 ? 's' : ''}${subtitle}${overflow}`,
        color:       EMBED_COLOR,
        fields:      shown.map(tireField),
        footer:      { text: 'Data from last scheduled scrape' },
        timestamp:   new Date().toISOString(),
    }];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Search tires in plain language — "37s under $500 for 17-inch rims"')
        .addStringOption(o =>
            o.setName('query')
                .setDescription('What you\'re looking for')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const queryText = interaction.options.getString('query');

        try {
            const parsed = await parseQuery(queryText);
            if (!parsed.fallback && parsed.filters.intent === 'info') {
                await interaction.editReply({ content: buildInfoContent(parsed.filters) });
                return;
            }
            const { results, fallback } = await executeQuery(queryText, parsed);
            const embeds = buildResultEmbeds(results, queryText, fallback);
            await interaction.editReply({ embeds });
        } catch (err) {
            log.error('[ask] Error:', err.message);
            await interaction.editReply({ content: 'Something went wrong. Try `/find` for a keyword search.' });
        }
    },

    // Exported for chatChannel.js
    executeQuery,
    buildResultEmbeds,
    buildInfoContent,
};
