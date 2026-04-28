const { _parseHtml } = require('../../src/scrapers/interco');

const VALID_STOCK_STATES = ['in_stock', 'low_stock', 'out_of_stock', 'unknown'];

function makeRow(sku, size, price = '$200.00', qty = '8') {
    return `
    <tr>
      <td headers="view-views-conditional-field-1-table-column"></td>
      <td headers="view-views-conditional-field-table-column"><a href="/blem/${sku}">${sku}</a></td>
      <td headers="view-title-table-column">${sku} ${size}</td>
      <td headers="view-field-brand-table-column">TestBrand</td>
      <td headers="view-field-size-table-column">${size}</td>
      <td headers="view-field-stock-table-column"><span>${qty}</span></td>
      <td headers="view-price-number-table-column">${price}</td>
    </tr>`;
}

function wrap(rows) {
    return `<table><tbody>${rows}</tbody></table>`;
}

describe('Interco HTML parser', () => {
    test('parses a table row correctly', () => {
        const html = wrap(makeRow('XBOG-5420', '54x19.5/20LT', '$888.00', '8'));
        const tires = _parseHtml(html);
        expect(tires).toHaveLength(1);
        const t = tires[0];
        expect(t.sku).toBe('XBOG-5420');
        expect(t.size).toBe('54x19.5/20LT');
        expect(t.price_cents).toBe(88800);
        expect(t.quantity_n).toBe(8);
        expect(t.brand).toBe('TestBrand');
        expect(t.is_blem).toBe(1);
        expect(t.product_url).toBe('https://www.intercotire.com/blem/XBOG-5420');
    });

    test('parses multiple rows', () => {
        const html = wrap(makeRow('X001', '37x12.5R17') + makeRow('X002', '40x13.5R17'));
        expect(_parseHtml(html)).toHaveLength(2);
    });

    test('v2 contract: required fields non-null and stock_state valid', () => {
        const html = wrap(
            makeRow('A001', '35x12.5R17', '$299.00', '10') +
            makeRow('A002', '37x13.5R18', '$349.00', '2') +
            makeRow('A003', '40x13.5R17', '$399.00', '0')
        );
        const tires = _parseHtml(html);
        expect(tires).toHaveLength(3);
        for (const t of tires) {
            expect(t.sku).toBeTruthy();
            expect(t.size).toBeTruthy();
            expect(t.price_cents).toBeGreaterThan(0);
            expect(VALID_STOCK_STATES).toContain(t.stock_state);
        }
    });

    test('stock_state derived correctly from quantity', () => {
        const html = wrap(
            makeRow('S001', '35x12.5R17', '$200.00', '10') +  // in_stock (> 4)
            makeRow('S002', '35x12.5R17', '$200.00', '2') +   // low_stock (1-4)
            makeRow('S003', '35x12.5R17', '$200.00', '0')     // out_of_stock
        );
        const tires = _parseHtml(html);
        expect(tires[0].stock_state).toBe('in_stock');
        expect(tires[1].stock_state).toBe('low_stock');
        expect(tires[2].stock_state).toBe('out_of_stock');
    });

    test('missing price yields null price_cents', () => {
        const html = wrap(makeRow('P001', '37x12.5R17', '', '5'));
        const tires = _parseHtml(html);
        expect(tires[0].price_cents).toBeNull();
    });

    test('non-numeric quantity yields unknown stock_state', () => {
        const html = wrap(makeRow('Q001', '35x12.5R17', '$200.00', 'Call'));
        const tires = _parseHtml(html);
        expect(tires[0].quantity_n).toBeNull();
        expect(tires[0].stock_state).toBe('unknown');
    });

    test('skips rows with missing sku or size', () => {
        const noSku = `<tr>
            <td headers="view-views-conditional-field-table-column"></td>
            <td headers="view-field-size-table-column">35x12.5R17</td>
        </tr>`;
        const html = wrap(noSku);
        expect(_parseHtml(html)).toHaveLength(0);
    });

    test('includes small tires — scraper no longer filters by size', () => {
        const html = wrap(makeRow('X001', '28x10R14') + makeRow('X002', '235x85R16'));
        expect(_parseHtml(html)).toHaveLength(2);
    });
});
