const { diff, hasAlerts } = require('../src/tracker');

describe('diff()', () => {

    const base = (overrides) => ({
        sku: 'X123',
        title: 'Some Tire 35x12.5R17',
        brand: 'BigMT',
        size: '35x12.5R17',
        quantity_n: 4,
        quantity_raw: '4',
        stock_state: 'in_stock',
        price_cents: 20000,
        ...overrides,
    });

    const dbRow = (overrides) => ({
        id: 1,
        source: 'interco',
        sku: 'X123',
        title: 'Some Tire 35x12.5R17',
        brand: 'BigMT',
        size: '35x12.5R17',
        quantity_n: 4,
        quantity_raw: '4',
        stock_state: 'in_stock',
        price_cents: 20000,
        is_active: 1,
        ...overrides,
    });

    test('detects a brand new tire', () => {
        const result = diff([base()], []);
        expect(result.added).toHaveLength(1);
        expect(result.added[0].sku).toBe('X123');
        expect(result.reactivated).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
    });

    test('detects no change when scrape matches DB', () => {
        const result = diff([base()], [dbRow()]);
        expect(result.unchanged).toHaveLength(1);
        expect(result.added).toHaveLength(0);
        expect(result.changed).toHaveLength(0);
    });

    test('detects price change', () => {
        const result = diff([base({ price_cents: 25000 })], [dbRow()]);
        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].price_cents).toBe(25000);
        expect(result.added).toHaveLength(0);
    });

    test('detects quantity change', () => {
        const result = diff([base({ quantity_n: 2, quantity_raw: '2' })], [dbRow()]);
        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].quantity_n).toBe(2);
    });

    test('detects removal when tire disappears from scrape', () => {
        const result = diff([], [dbRow()]);
        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].sku).toBe('X123');
        expect(result.added).toHaveLength(0);
    });

    test('does not flag already-inactive tires as removed again', () => {
        const result = diff([], [dbRow({ is_active: 0 })]);
        expect(result.removed).toHaveLength(0);
    });

    test('detects reactivation of a previously inactive tire', () => {
        const result = diff([base()], [dbRow({ is_active: 0 })]);
        expect(result.reactivated).toHaveLength(1);
        expect(result.reactivated[0].sku).toBe('X123');
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
    });

    test('handles multiple tires mixed', () => {
        const scraped = [
            base({ sku: 'NEW1', size: '37x12.5R17' }),     // new
            base({ sku: 'X123', quantity_n: 6, quantity_raw: '6' }),           // changed qty
            base({ sku: 'SAME', size: '40x13.5R17' }),      // unchanged
        ];
        const db = [
            dbRow({ id: 1, sku: 'X123' }),
            dbRow({ id: 2, sku: 'SAME', size: '40x13.5R17' }),
            dbRow({ id: 3, sku: 'GONE', size: '38x12.5R17' }),  // removed
        ];
        const result = diff(scraped, db);
        expect(result.added).toHaveLength(1);
        expect(result.added[0].sku).toBe('NEW1');
        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].sku).toBe('X123');
        expect(result.unchanged).toHaveLength(1);
        expect(result.unchanged[0].sku).toBe('SAME');
        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].sku).toBe('GONE');
    });
});

describe('hasAlerts()', () => {
    test('true when there are added tires', () => {
        expect(hasAlerts({ added: [{}], reactivated: [] })).toBe(true);
    });
    test('true when there are reactivated tires', () => {
        expect(hasAlerts({ added: [], reactivated: [{}] })).toBe(true);
    });
    test('false when only changes and removals', () => {
        expect(hasAlerts({ added: [], reactivated: [] })).toBe(false);
    });
});
