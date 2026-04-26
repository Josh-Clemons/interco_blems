'use strict';

// Mock the LLM client so tests never hit the network
jest.mock('../../src/llm/client', () => ({
    getLLMClient: jest.fn(),
}));

const { getLLMClient } = require('../../src/llm/client');
const { parseQuery }   = require('../../src/llm/parseQuery');

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
// Golden queries
// ---------------------------------------------------------------------------

const GOLDEN_QUERIES = [
    {
        input:    'show me 37s under $500 for 17-inch rims',
        expected: { keyword: null, sizeMin: 37, sizeMax: 37, rim: 17, priceMax: 500, isBlem: null, stockPref: null },
    },
    {
        input:    'bogger blems in stock',
        expected: { keyword: 'bogger', isBlem: true, stockPref: null, sizeMin: null },
    },
    {
        input:    'treadwright 35 or bigger',
        expected: { keyword: 'treadwright', sizeMin: 35, sizeMax: null },
    },
    {
        input:    'interco blems',
        expected: { keyword: null, source: 'interco', isBlem: true },
    },
    {
        input:    'claw under 300',
        expected: { keyword: 'claw', priceMax: 300 },
    },
    {
        input:    'all mud terrain tires including out of stock',
        expected: { stockPref: 'any' },
    },
];

describe('parseQuery — golden queries', () => {
    test.each(GOLDEN_QUERIES)('$input', async ({ input, expected }) => {
        mockLLMResponse({
            keyword: null, source: null, sizeMin: null, sizeMax: null,
            rim: null, priceMax: null, isBlem: null, stockPref: null,
            ...expected,
        });

        const result = await parseQuery(input);
        expect(result.fallback).toBe(false);
        expect(result.filters).not.toBeNull();
        for (const [key, val] of Object.entries(expected)) {
            expect(result.filters[key]).toBe(val);
        }
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
    test('returns all expected keys', async () => {
        const full = {
            keyword: 'bogger', source: 'interco', sizeMin: 37, sizeMax: 37,
            rim: 17, priceMax: 500, isBlem: true, stockPref: 'in_stock',
        };
        mockLLMResponse(full);

        const result = await parseQuery('bogger blems 37s under 500');
        expect(result.fallback).toBe(false);
        expect(result.filters).toEqual(full);
    });

    test('null values are preserved', async () => {
        const nulls = {
            keyword: null, source: null, sizeMin: null, sizeMax: null,
            rim: null, priceMax: null, isBlem: null, stockPref: null,
        };
        mockLLMResponse(nulls);

        const result = await parseQuery('show me tires');
        expect(result.fallback).toBe(false);
        expect(result.filters).toEqual(nulls);
    });
});
