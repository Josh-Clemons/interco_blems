const { getLLMClient } = require('./client');
const log = require('../logger');

const MODEL = process.env.GITHUB_MODELS_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a tire search assistant for a Discord bot that tracks off-road tire inventory.

Extract search filters from the user's message and return ONLY a JSON object with this exact structure — no prose, no explanation:

{
  "keyword":   string | null,
  "source":    string | null,
  "sizeMin":   number | null,
  "sizeMax":   number | null,
  "rim":       number | null,
  "priceMax":  number | null,
  "isBlem":    true | false | null,
  "stockPref": "in_stock" | "any" | null
}

Field rules:
- keyword: brand or model name for text search (e.g. "bogger", "claw", "wrangler"). Null if purely numeric filters.
- source: one of "interco", "treadwright", "tiremart", "simpletire". Null if not specified.
- sizeMin / sizeMax: overall tire diameter in inches. If user says "37s" or "37 inch", set both to 37. If "37 or bigger", set sizeMin:37, sizeMax:null.
- rim: exact wheel/rim diameter in inches (e.g. 17 from "17-inch rims").
- priceMax: max price in dollars (e.g. 500 from "under $500").
- isBlem: true if user asks for "blems" or "blemished", false if explicitly "standard" or "non-blem", null if not mentioned.
- stockPref: "any" if user says "include out of stock" or "all". Default null (bot will exclude out-of-stock by default).

Return null for any filter the user did not mention.`;

/**
 * Parses a natural language query into structured tire search filters.
 *
 * Returns { filters, fallback } where:
 *   filters — the parsed JSON object, or null on failure
 *   fallback — true if LLM parsing failed (caller should use raw text search)
 */
async function parseQuery(text) {
    const client = getLLMClient();

    try {
        const response = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: text },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
        });

        const raw = response.choices[0]?.message?.content;
        if (!raw) throw new Error('Empty response from LLM');

        const parsed = JSON.parse(raw);

        const required = ['keyword', 'source', 'sizeMin', 'sizeMax', 'rim', 'priceMax', 'isBlem', 'stockPref'];
        for (const key of required) {
            if (!(key in parsed)) throw new Error(`Missing key in LLM response: ${key}`);
        }

        return { filters: parsed, fallback: false };
    } catch (err) {
        log.warn(`[llm] parseQuery failed (${err.message}) — falling back to keyword search`);
        return { filters: null, fallback: true };
    }
}

module.exports = { parseQuery };
