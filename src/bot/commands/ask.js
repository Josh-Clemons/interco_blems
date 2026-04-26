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
const { getActiveTires, searchTires } = require('../../db/repository');
const { tireField, EMBED_COLOR } = require('../embeds');
const log = require('../../logger');

const MAX_RESULTS = 15;

const STOCK_ORDER = { in_stock: 0, low_stock: 1, unknown: 2, out_of_stock: 3 };

function rankTires(tires) {
    return [...tires].sort((a, b) => {
        // Blems first
        if (b.is_blem !== a.is_blem) return b.is_blem - a.is_blem;
        // Better stock state first
        const sa = STOCK_ORDER[a.stock_state] ?? 2;
        const sb = STOCK_ORDER[b.stock_state] ?? 2;
        if (sa !== sb) return sa - sb;
        // Cheaper first
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
 * Runs the full NL query pipeline: parse → DB fetch → keyword filter → rank.
 * Exported so chatChannel.js can reuse it.
 */
async function executeQuery(queryText) {
    const { filters, fallback } = await parseQuery(queryText);

    let results;
    if (fallback || !filters) {
        results = searchTires(queryText, { includeOutOfStock: false });
    } else {
        results = getActiveTires({
            source:            filters.source    ?? undefined,
            isBlem:            filters.isBlem    ?? undefined,
            sizeMin:           filters.sizeMin   ?? undefined,
            sizeMax:           filters.sizeMax   ?? undefined,
            rim:               filters.rim       ?? undefined,
            priceMax:          filters.priceMax  ?? undefined,
            includeOutOfStock: filters.stockPref === 'any',
        });
        results = applyKeyword(results, filters.keyword);
    }

    return { results: rankTires(results), fallback };
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
            const { results, fallback } = await executeQuery(queryText);
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
};
