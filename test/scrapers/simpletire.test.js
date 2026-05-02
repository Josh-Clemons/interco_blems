const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { _parseSkuPage } = require('../../src/scrapers/simpletire');

const VALID_STOCK_STATES = ['in_stock', 'low_stock', 'out_of_stock', 'unknown'];
const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, '../fixtures/simpletire.html'), 'utf8');

// The refresh script writes the URL it fetched alongside the HTML so the test
// can pass the correct URL to the parser (needed for SKU fallback via /p/<id>).
const URL_FILE = path.join(__dirname, '../fixtures/simpletire.url');
const FIXTURE_URL = fs.existsSync(URL_FILE)
    ? fs.readFileSync(URL_FILE, 'utf8').trim()
    : 'https://simpletire.com/p/00000';

const TIRE_SIZE_RE = /\d+(?:[x\/][\d.]+[Rr]\d+|\/\d+R\d+)/i;

describe('SimpleTire SKU page parser', () => {
    let tire;

    beforeAll(() => {
        const $ = cheerio.load(FIXTURE_HTML);
        tire = _parseSkuPage($, FIXTURE_URL);
    });

    test('returns a result (sku non-null)', () => {
        expect(tire.sku).toBeTruthy();
    });

    test('size is present and looks like a tire size', () => {
        expect(tire.size).toBeTruthy();
        expect(TIRE_SIZE_RE.test(tire.size)).toBe(true);
    });

    test('price_cents is a positive integer', () => {
        expect(Number.isInteger(tire.price_cents)).toBe(true);
        expect(tire.price_cents).toBeGreaterThan(0);
    });

    test('stock_state is a valid enum value', () => {
        expect(VALID_STOCK_STATES).toContain(tire.stock_state);
    });

    test('is_blem is 0 (SimpleTire carries no blems)', () => {
        expect(tire.is_blem).toBe(0);
    });

    test('product_url matches the URL passed to the parser', () => {
        expect(tire.product_url).toBe(FIXTURE_URL);
    });

    test('brand is present', () => {
        expect(tire.brand).toBeTruthy();
    });
});
