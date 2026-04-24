const { buildEmbeds } = require('../../src/notifier/discord');

// buildEmbeds is a pure function we can test directly without mocking discord.js.

const baseTire = (sku, size) => ({
    sku,
    title: `${sku} ${size}`,
    brand: 'TestBrand',
    size,
    quantity_n: 4,
    quantity_raw: '4',
    stock_state: 'in_stock',
    price_cents: 30000,
});

describe('buildEmbeds()', () => {
    test('returns empty array when no alerts', () => {
        expect(buildEmbeds({ added: [], reactivated: [], changed: [] })).toHaveLength(0);
    });

    test('builds green embed for added tires', () => {
        const embeds = buildEmbeds({ added: [baseTire('X1', '37x12.5R17')], reactivated: [], changed: [] });
        expect(embeds).toHaveLength(1);
        expect(embeds[0].color).toBe(0x57F287);
        expect(embeds[0].title).toContain('New Blem Tire');
        expect(embeds[0].fields[0].name).toContain('X1');
    });

    test('builds yellow embed for reactivated tires', () => {
        const embeds = buildEmbeds({ added: [], reactivated: [baseTire('X2', '40x13.5R17')], changed: [] });
        expect(embeds).toHaveLength(1);
        expect(embeds[0].color).toBe(0xFEE75C);
        expect(embeds[0].title).toContain('Back in Stock');
    });

    test('builds blurple embed for changed tires', () => {
        const embeds = buildEmbeds({ added: [], reactivated: [], changed: [baseTire('X3', '42x14R17')] });
        expect(embeds).toHaveLength(1);
        expect(embeds[0].color).toBe(0x5865F2);
    });

    test('builds all three when all categories present', () => {
        const embeds = buildEmbeds({
            added:       [baseTire('X1', '37x12.5R17')],
            reactivated: [baseTire('X2', '40x13.5R17')],
            changed:     [baseTire('X3', '42x14R17')],
        });
        expect(embeds).toHaveLength(3);
    });

    test('embed fields include price and quantity', () => {
        const embeds = buildEmbeds({ added: [baseTire('X1', '37x12.5R17')], reactivated: [], changed: [] });
        expect(embeds[0].fields[0].value).toContain('$300.00');
        expect(embeds[0].fields[0].value).toContain('Qty: 4');
    });
});
