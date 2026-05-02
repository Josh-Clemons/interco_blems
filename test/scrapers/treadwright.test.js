const { _parseProducts } = require('../../src/scrapers/treadwright');
const products = require('../fixtures/treadwright.json');

const VALID_STOCK_STATES = ['in_stock', 'low_stock', 'out_of_stock', 'unknown'];

describe('TreadWright product parser', () => {
    let tires;
    let tireProducts; // Tire-type products in the fixture (non-Tire filtered by parser)

    beforeAll(() => {
        tires = _parseProducts(products);
        tireProducts = products.filter(p => p.product_type === 'Tire');
    });

    test('returns at least one result', () => {
        expect(tires.length).toBeGreaterThan(0);
    });

    test('non-Tire products are filtered out', () => {
        const nonTireSkus = products
            .filter(p => p.product_type !== 'Tire')
            .flatMap(p => p.variants.map(v => v.sku));
        const resultSkus = new Set(tires.map(t => t.sku));
        for (const sku of nonTireSkus) {
            expect(resultSkus.has(sku)).toBe(false);
        }
    });

    test('variants are expanded: result count >= number of Tire products', () => {
        expect(tires.length).toBeGreaterThanOrEqual(tireProducts.length);
    });

    test('every result has brand TreadWright', () => {
        for (const t of tires) {
            expect(t.brand).toBe('TreadWright');
        }
    });

    test('every result has sku, size, and positive price_cents', () => {
        for (const t of tires) {
            expect(t.sku).toBeTruthy();
            expect(t.size).toBeTruthy();
            expect(t.price_cents).toBeGreaterThan(0);
        }
    });

    test('every result has a valid stock_state', () => {
        for (const t of tires) {
            expect(VALID_STOCK_STATES).toContain(t.stock_state);
        }
    });

    test('is_blem reflects blemish tag — both 0 and 1 present in fixture', () => {
        const blemSkus = tires.filter(t => t.is_blem === 1);
        const nonBlemSkus = tires.filter(t => t.is_blem === 0);
        // Fixture is built with a blem+non-blem mix by refresh-fixtures.js
        expect(blemSkus.length).toBeGreaterThan(0);
        expect(nonBlemSkus.length).toBeGreaterThan(0);
    });

    test('product_url points to treadwright.com/products/', () => {
        for (const t of tires) {
            expect(t.product_url).toMatch(/treadwright\.com\/products\//);
        }
    });

    test('no result title contains literal "Default Title"', () => {
        for (const t of tires) {
            expect(t.title).not.toContain('Default Title');
        }
    });
});
