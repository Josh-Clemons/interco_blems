const { tireField } = require('../../src/bot/embeds');

describe('tireField()', () => {
    test('does not render literal null in field name when size is missing', () => {
        const field = tireField({
            sku: 'st-101507',
            size: null,
            is_blem: 0,
            brand: 'Westlake',
            quantity_raw: 'in stock',
            price_cents: null,
            source: 'simpletire',
            product_url: 'https://example.com/p/1',
        });

        expect(field.name).toBe('st-101507 — N/A');
        expect(field.name).not.toContain('null');
    });
});
