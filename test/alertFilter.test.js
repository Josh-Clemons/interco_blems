const { filterForPublicAlert, hasPublicAlerts } = require('../src/alertFilter');

const tire = (sku, size, over = {}) => ({
    sku,
    size,
    brand: 'B',
    quantity: '4',
    quantity_n: 4,
    stock_state: 'in_stock',
    price: '$100',
    ...over,
});

afterEach(() => {
    delete process.env.PUBLIC_ALERT_MIN_DIAMETER;
});

describe('filterForPublicAlert()', () => {
    test('default 35" floor: keeps big, drops small', () => {
        const d = {
            added:       [tire('A', '37x12.5R17'), tire('B', '28x10R14')],
            reactivated: [tire('C', '40x13.5R17')],
            changed:     [tire('D', '33X12.50R20')],
            removed:     [tire('E', '14/42-17')],
            unchanged:   [],
        };
        const r = filterForPublicAlert(d);
        expect(r.added.map(t => t.sku)).toEqual(['A']);
        expect(r.reactivated.map(t => t.sku)).toEqual(['C']);
        expect(r.changed.map(t => t.sku)).toEqual([]);
        expect(r.removed.map(t => t.sku)).toEqual(['E']);
    });

    test('metric tires (e.g. 235x85R16) are excluded', () => {
        const d = {
            added: [tire('A', '235x85R16'), tire('B', '40x13.5R17')],
            reactivated: [], changed: [], removed: [], unchanged: [],
        };
        const r = filterForPublicAlert(d);
        expect(r.added.map(t => t.sku)).toEqual(['B']);
    });

    test('PUBLIC_ALERT_MIN_DIAMETER=0 disables filter', () => {
        process.env.PUBLIC_ALERT_MIN_DIAMETER = '0';
        const d = {
            added: [tire('A', '28x10R14'), tire('B', '40x13.5R17')],
            reactivated: [], changed: [], removed: [], unchanged: [],
        };
        const r = filterForPublicAlert(d);
        expect(r.added).toHaveLength(2);
    });

    test('custom floor e.g. 40', () => {
        process.env.PUBLIC_ALERT_MIN_DIAMETER = '40';
        const d = {
            added: [tire('A', '37x12.5R17'), tire('B', '42x14R17')],
            reactivated: [], changed: [], removed: [], unchanged: [],
        };
        const r = filterForPublicAlert(d);
        expect(r.added.map(t => t.sku)).toEqual(['B']);
    });

    test('suppresses unavailable/out-of-stock tires from public alerts', () => {
        const d = {
            added: [
                tire('A', '37x12.5R17', { stock_state: 'out_of_stock' }),
                tire('B', '37x12.5R17', { quantity_n: 0 }),
                tire('C', '37x12.5R17', { quantity_raw: 'Unavailable' }),
                tire('D', '37x12.5R17', { quantity: 'Out of Stock' }),
                tire('E', '37x12.5R17', { stock_state: 'low_stock' }),
            ],
            reactivated: [
                tire('F', '40x13.5R17', { stock_state: 'out_of_stock' }),
                tire('G', '40x13.5R17', { stock_state: 'in_stock' }),
            ],
            changed: [],
            removed: [],
            unchanged: [],
        };

        const r = filterForPublicAlert(d);
        expect(r.added.map(t => t.sku)).toEqual(['E']);
        expect(r.reactivated.map(t => t.sku)).toEqual(['G']);
    });
});

describe('hasPublicAlerts()', () => {
    test('true when added only', () => {
        expect(hasPublicAlerts({ added: [{}], reactivated: [], changed: [], removed: [] })).toBe(true);
    });
    test('true when reactivated only', () => {
        expect(hasPublicAlerts({ added: [], reactivated: [{}], changed: [], removed: [] })).toBe(true);
    });
    test('false when only changes/removals', () => {
        expect(hasPublicAlerts({ added: [], reactivated: [], changed: [{}], removed: [{}] })).toBe(false);
    });
});
