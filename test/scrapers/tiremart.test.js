const fs = require('fs');
const path = require('path');
const { _parseHtml } = require('../../src/scrapers/tiremart');

const VALID_STOCK_STATES = ['in_stock', 'low_stock', 'out_of_stock', 'unknown'];
const FIXTURE = fs.readFileSync(path.join(__dirname, '../fixtures/tiremart.html'), 'utf8');

describe('TireMart HTML parser', () => {
    let tires;

    beforeAll(() => {
        tires = _parseHtml(FIXTURE);
    });

    test('returns at least one result', () => {
        expect(tires.length).toBeGreaterThan(0);
    });

    test('every result has sku and size', () => {
        for (const t of tires) {
            expect(t.sku).toBeTruthy();
            expect(t.size).toBeTruthy();
        }
    });

    test('every result is flagged as a blem', () => {
        for (const t of tires) {
            expect(t.is_blem).toBe(1);
        }
    });

    test('every result has a valid stock_state', () => {
        for (const t of tires) {
            expect(VALID_STOCK_STATES).toContain(t.stock_state);
        }
    });

    test('at least 80% of results have a positive price_cents', () => {
        const priced = tires.filter(t => t.price_cents != null && t.price_cents > 0);
        expect(priced.length / tires.length).toBeGreaterThanOrEqual(0.8);
    });

    test('price_cents is always a positive integer when present', () => {
        for (const t of tires.filter(t => t.price_cents != null)) {
            expect(Number.isInteger(t.price_cents)).toBe(true);
            expect(t.price_cents).toBeGreaterThan(0);
        }
    });

    test('at least one result has load_range and ply from spec text', () => {
        const withSpec = tires.filter(t => t.load_range != null && t.ply != null);
        expect(withSpec.length).toBeGreaterThan(0);
    });

    test('size strings look like tire sizes', () => {
        const TIRE_SIZE_RE = /\d+[xX/][\d.]+[Rr]\d+/;
        for (const t of tires) {
            expect(TIRE_SIZE_RE.test(t.size)).toBe(true);
        }
    });
});
