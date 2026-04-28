'use strict';

// Mock the LLM client so tests never hit the network
jest.mock('../../src/llm/client', () => ({
    getLLMClient: jest.fn(),
}));

const { getLLMClient } = require('../../src/llm/client');
const { parseQuery }   = require('../../src/llm/parseQuery');

const NULL_FILTERS = {
    intent: 'search', reply: null, infoType: null,
    keyword: null, source: null, sizeMin: null, sizeMax: null,
    rim: null, priceMin: null, priceMax: null, isBlem: null, stockPref: null,
    minQty: null, maxQty: null, ply: null, loadRange: null, category: null,
    threePms: null, sortBy: null, limit: null,
};

function mockLLMResponse(jsonObj) {
    getLLMClient.mockReturnValue({
        chat: {
            completions: {
                create: jest.fn().mockResolvedValue({
                    choices: [{ message: { content: JSON.stringify(jsonObj) } }],
                }),
            },
        },
    });
}

function mockLLMFailure(err) {
    getLLMClient.mockReturnValue({
        chat: {
            completions: {
                create: jest.fn().mockRejectedValue(err),
            },
        },
    });
}

// ---------------------------------------------------------------------------
// Golden search queries
// ---------------------------------------------------------------------------

const GOLDEN_QUERIES = [
    {
        input:    'show me 37s under $500 for 17-inch rims',
        expected: { intent: 'search', keyword: null, sizeMin: 37, sizeMax: 37, rim: 17, priceMax: 500, isBlem: null, stockPref: null },
    },
    {
        input:    'bogger blems in stock',
        expected: { intent: 'search', keyword: 'bogger', isBlem: true, stockPref: null, sizeMin: null },
    },
    {
        input:    'treadwright 35 or bigger',
        expected: { intent: 'search', keyword: 'treadwright', sizeMin: 35, sizeMax: null },
    },
    {
        input:    'interco blems',
        expected: { intent: 'search', keyword: null, source: 'interco', isBlem: true },
    },
    {
        input:    'claw under 300',
        expected: { intent: 'search', keyword: 'claw', priceMax: 300 },
    },
    {
        input:    'all mud terrain tires including out of stock',
        expected: { intent: 'search', stockPref: 'any' },
    },
    {
        input:    'bogger blems with at least 4 in stock',
        expected: { intent: 'search', keyword: 'bogger', isBlem: true, minQty: 4 },
    },
    {
        input:    'show me blems with qty 2 or more',
        expected: { intent: 'search', isBlem: true, minQty: 2 },
    },
    {
        input:    'the cheapest blem tire available',
        expected: { intent: 'search', isBlem: true, limit: 1 },
    },
    {
        input:    'show me the top 3 cheapest 37s',
        expected: { intent: 'search', sizeMin: 37, sizeMax: 37, limit: 3 },
    },
    // maxQty / exact qty
    {
        input:    'show all blems with only 1 quantity',
        expected: { intent: 'search', isBlem: true, minQty: 1, maxQty: 1 },
    },
    {
        input:    'blems with less than 3 quantity',
        expected: { intent: 'search', isBlem: true, maxQty: 2 },
    },
    // priceMin / price range
    {
        input:    'tires over $200',
        expected: { intent: 'search', priceMin: 200 },
    },
    {
        input:    'blems between $150 and $400',
        expected: { intent: 'search', isBlem: true, priceMin: 150, priceMax: 400 },
    },
    // ply
    {
        input:    '10 ply blems',
        expected: { intent: 'search', isBlem: true, ply: 10 },
    },
    // loadRange
    {
        input:    'load range E tires',
        expected: { intent: 'search', loadRange: 'E' },
    },
    // category
    {
        input:    'mud terrain blems',
        expected: { intent: 'search', isBlem: true, category: 'mud' },
    },
    {
        input:    'all terrain tires under $300',
        expected: { intent: 'search', category: 'all-terrain', priceMax: 300 },
    },
    // threePms
    {
        input:    '3-peak rated tires',
        expected: { intent: 'search', threePms: true },
    },
    // sortBy — should NOT set limit
    {
        input:    'show blem tires 37 and bigger, ordered by cheapest',
        expected: { intent: 'search', isBlem: true, sizeMin: 37, sortBy: 'price_asc', limit: null },
    },
    {
        input:    'blems sorted by most expensive',
        expected: { intent: 'search', isBlem: true, sortBy: 'price_desc', limit: null },
    },
    {
        input:    'show all 37s by quantity',
        expected: { intent: 'search', sizeMin: 37, sizeMax: 37, sortBy: 'qty_desc', limit: null },
    },
    {
        input:    'newest blems',
        expected: { intent: 'search', isBlem: true, sortBy: 'newest', limit: null },
    },
];

describe('parseQuery — golden search queries', () => {
    test.each(GOLDEN_QUERIES)('$input', async ({ input, expected }) => {
        mockLLMResponse({ ...NULL_FILTERS, ...expected });

        const result = await parseQuery(input);
        expect(result.fallback).toBe(false);
        expect(result.filters).not.toBeNull();
        for (const [key, val] of Object.entries(expected)) {
            expect(result.filters[key]).toBe(val);
        }
    });
});

// ---------------------------------------------------------------------------
// Info intent
// ---------------------------------------------------------------------------

describe('parseQuery — info intent', () => {
    test('sources query returns intent:info with infoType:sources', async () => {
        mockLLMResponse({ ...NULL_FILTERS, intent: 'info', infoType: 'sources' });

        const result = await parseQuery('what sources do you have?');
        expect(result.fallback).toBe(false);
        expect(result.filters.intent).toBe('info');
        expect(result.filters.infoType).toBe('sources');
    });

    test('blem sources query sets isBlem:true', async () => {
        mockLLMResponse({ ...NULL_FILTERS, intent: 'info', infoType: 'sources', isBlem: true });

        const result = await parseQuery('what sources have blem tires?');
        expect(result.filters.infoType).toBe('sources');
        expect(result.filters.isBlem).toBe(true);
    });

    test('brands query returns infoType:brands', async () => {
        mockLLMResponse({ ...NULL_FILTERS, intent: 'info', infoType: 'brands' });

        const result = await parseQuery('what brands do you carry?');
        expect(result.filters.infoType).toBe('brands');
    });

    test('categories query returns infoType:categories', async () => {
        mockLLMResponse({ ...NULL_FILTERS, intent: 'info', infoType: 'categories' });

        const result = await parseQuery('what tire categories are available?');
        expect(result.filters.infoType).toBe('categories');
    });

    test('stats query returns infoType:stats', async () => {
        mockLLMResponse({ ...NULL_FILTERS, intent: 'info', infoType: 'stats' });

        const result = await parseQuery('how many tires do you have?');
        expect(result.filters.infoType).toBe('stats');
    });
});

// ---------------------------------------------------------------------------
// Chat intent
// ---------------------------------------------------------------------------

describe('parseQuery — chat intent', () => {
    test('returns intent:chat and a reply for a greeting', async () => {
        mockLLMResponse({
            ...NULL_FILTERS,
            intent: 'chat',
            reply: 'Hey! What kind of tires are you looking for?',
        });

        const result = await parseQuery('hi there');
        expect(result.fallback).toBe(false);
        expect(result.filters.intent).toBe('chat');
        expect(typeof result.filters.reply).toBe('string');
        expect(result.filters.reply.length).toBeGreaterThan(0);
    });

    test('chat intent has null filter fields', async () => {
        mockLLMResponse({
            ...NULL_FILTERS,
            intent: 'chat', reply: 'Hi! What size are you shopping for?',
        });

        const result = await parseQuery('hey');
        expect(result.filters.keyword).toBeNull();
        expect(result.filters.sizeMin).toBeNull();
    });

    test('returns fallback:true on invalid intent value', async () => {
        mockLLMResponse({ ...NULL_FILTERS, intent: 'unknown' });

        const result = await parseQuery('hi');
        expect(result.fallback).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Fallback behaviour
// ---------------------------------------------------------------------------

describe('parseQuery — fallback', () => {
    test('returns fallback:true on malformed JSON', async () => {
        getLLMClient.mockReturnValue({
            chat: {
                completions: {
                    create: jest.fn().mockResolvedValue({
                        choices: [{ message: { content: 'not json at all' } }],
                    }),
                },
            },
        });

        const result = await parseQuery('bogger 37s');
        expect(result.fallback).toBe(true);
        expect(result.filters).toBeNull();
    });

    test('returns fallback:true on missing required keys', async () => {
        mockLLMResponse({ keyword: 'bogger' }); // missing most required keys

        const result = await parseQuery('bogger');
        expect(result.fallback).toBe(true);
    });

    test('returns fallback:true when LLM call throws', async () => {
        mockLLMFailure(new Error('network error'));

        const result = await parseQuery('anything');
        expect(result.fallback).toBe(true);
        expect(result.filters).toBeNull();
    });

    test('returns fallback:true on empty response', async () => {
        getLLMClient.mockReturnValue({
            chat: {
                completions: {
                    create: jest.fn().mockResolvedValue({ choices: [] }),
                },
            },
        });

        const result = await parseQuery('bogger');
        expect(result.fallback).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Valid parse shape
// ---------------------------------------------------------------------------

describe('parseQuery — valid response shape', () => {
    test('search response contains all expected keys', async () => {
        const full = {
            intent: 'search', reply: null, infoType: null,
            keyword: 'bogger', source: 'interco', sizeMin: 37, sizeMax: 37,
            rim: 17, priceMin: 100, priceMax: 500, isBlem: true, stockPref: 'in_stock',
            minQty: 2, maxQty: 4, ply: 10, loadRange: 'E', category: 'mud',
            threePms: false, sortBy: 'price_asc', limit: 1,
        };
        mockLLMResponse(full);

        const result = await parseQuery('bogger blems 37s under 500');
        expect(result.fallback).toBe(false);
        expect(result.filters).toEqual(full);
    });

    test('null filter values are preserved', async () => {
        mockLLMResponse(NULL_FILTERS);

        const result = await parseQuery('show me tires');
        expect(result.fallback).toBe(false);
        expect(result.filters).toEqual(NULL_FILTERS);
    });
});
