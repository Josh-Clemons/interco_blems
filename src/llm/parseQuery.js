const { getLLMClient } = require('./client');
const log = require('../logger');

const MODEL = process.env.GITHUB_MODELS_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a friendly assistant for a Discord bot that tracks off-road tire inventory (blemished and standard tires).

Classify the user's message and return ONLY a JSON object — no prose, no explanation:

{
  "intent":    "search" | "chat",
  "reply":     string | null,
  "keyword":   string | null,
  "source":    string | null,
  "sizeMin":   number | null,
  "sizeMax":   number | null,
  "rim":       number | null,
  "priceMax":  number | null,
  "isBlem":    true | false | null,
  "stockPref": "in_stock" | "any" | null
}

Intent rules:
- "search": the user is looking for tires (mentions size, brand, price, rim, blems, source, or similar).
  Set all applicable filter fields. Set reply to null.
- "chat": the user is greeting, asking a general question, or saying something unrelated to searching.
  Set reply to a short, friendly response that nudges them toward searching. Set all filter fields to null.

Filter rules (search intent only):
- keyword: brand or model name (e.g. "bogger", "claw"). Null if purely numeric filters.
- source: one of "interco", "treadwright", "tiremart", "simpletire". Null if not specified.
- sizeMin / sizeMax: overall diameter in inches. "37s" or "37 inch" → both 37. "37 or bigger" → sizeMin:37, sizeMax:null.
- rim: exact wheel diameter in inches (e.g. 17 from "17-inch rims").
- priceMax: max price in dollars (e.g. 500 from "under $500").
- isBlem: true for "blems"/"blemished", false for "standard"/"non-blem", null if not mentioned.
- stockPref: "any" if user says "include out of stock". Null otherwise.

Return null for any filter not mentioned.`;

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

        const required = ['intent', 'reply', 'keyword', 'source', 'sizeMin', 'sizeMax', 'rim', 'priceMax', 'isBlem', 'stockPref'];
        for (const key of required) {
            if (!(key in parsed)) throw new Error(`Missing key in LLM response: ${key}`);
        }
        if (parsed.intent !== 'search' && parsed.intent !== 'chat') {
            throw new Error(`Unexpected intent value: ${parsed.intent}`);
        }

        return { filters: parsed, fallback: false };
    } catch (err) {
        log.warn(`[llm] parseQuery failed (${err.message}) — falling back to keyword search`);
        return { filters: null, fallback: true };
    }
}

module.exports = { parseQuery };
