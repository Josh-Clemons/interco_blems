'use strict';

// Mock the LLM client so tests never hit the network
jest.mock('../../src/llm/client', () => ({
    getLLMClient: jest.fn(),
}));

const { getLLMClient } = require('../../src/llm/client');
const { parseQuery }   = require('../../src/llm/parseQuery');

const NULL_FILTERS = {
    intent: 'search', reply: null,
    keyword: null, source: null, sizeMin: null, sizeMax: null,
    rim: null, priceMax: null, isBlem: null, stockPref: null,
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
            intent: 'chat', reply: 'Hi! What size are you shopping for?',
            keyword: null, source: null, sizeMin: null, sizeMax: null,
            rim: null, priceMax: null, isBlem: null, stockPref: null,
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
            intent: 'search', reply: null,
            keyword: 'bogger', source: 'interco', sizeMin: 37, sizeMax: 37,
            rim: 17, priceMax: 500, isBlem: true, stockPref: 'in_stock',
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
