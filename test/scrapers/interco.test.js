const cheerio = require('cheerio');

// Minimal HTML fixture that mimics the Interco blem-list table structure.
function makeRow(sku, size, price = '$200.00', qty = '4') {
    return `
    <tr>
      <td headers="view-views-conditional-field-1-table-column"></td>
      <td headers="view-views-conditional-field-table-column"><a href="/blem/x">${sku}</a></td>
      <td headers="view-title-table-column">${sku} ${size}</td>
      <td headers="view-field-brand-table-column">TestBrand</td>
      <td headers="view-field-size-table-column">${size}</td>
      <td headers="view-field-stock-table-column"><span>${qty}</span></td>
      <td headers="view-price-number-table-column">${price}</td>
    </tr>`;
}

// Inline the parsing logic from interco.js so we can test it without a real fetch.
function parseRows(html) {
    const $ = cheerio.load(html);
    const tires = [];

    $('tbody tr').each((_, row) => {
        const $row = $(row);
        const sku   = $row.find('td[headers="view-views-conditional-field-table-column"] a').text().trim();
        const title = $row.find('td[headers="view-title-table-column"]').text().trim();
        const brand = $row.find('td[headers="view-field-brand-table-column"]').text().trim();
        const size  = $row.find('td[headers="view-field-size-table-column"]').text().trim();
        const qty   = $row.find('td[headers="view-field-stock-table-column"] span').text().trim();
        const price = $row.find('td[headers="view-price-number-table-column"]').text().trim();
        if (sku && size) tires.push({ sku, title, brand, size, quantity: qty, price });
    });
    return tires;
}

describe('Interco HTML parser', () => {
    test('parses a table row correctly', () => {
        const html = `<table><tbody>${makeRow('XBOG-5420', '54x19.5/20LT', '$888.00', '4')}</tbody></table>`;
        const tires = parseRows(html);
        expect(tires).toHaveLength(1);
        expect(tires[0].sku).toBe('XBOG-5420');
        expect(tires[0].size).toBe('54x19.5/20LT');
        expect(tires[0].price).toBe('$888.00');
        expect(tires[0].quantity).toBe('4');
        expect(tires[0].brand).toBe('TestBrand');
    });

    test('parses multiple rows', () => {
        const html = `<table><tbody>
            ${makeRow('X001', '37x12.5R17')}
            ${makeRow('X002', '40x13.5R17')}
        </tbody></table>`;
        const tires = parseRows(html);
        expect(tires).toHaveLength(2);
    });

    test('includes small tires — scraper no longer filters by size', () => {
        const html = `<table><tbody>
            ${makeRow('X001', '28x10R14')}
            ${makeRow('X002', '235x85R16')}
        </tbody></table>`;
        const tires = parseRows(html);
        expect(tires).toHaveLength(2);
    });

    test('skips rows with missing sku', () => {
        const html = `<table><tbody>
            <tr>
              <td headers="view-views-conditional-field-table-column"></td>
              <td headers="view-field-size-table-column">35x12.5R17</td>
            </tr>
        </tbody></table>`;
        const tires = parseRows(html);
        expect(tires).toHaveLength(0);
    });
});
