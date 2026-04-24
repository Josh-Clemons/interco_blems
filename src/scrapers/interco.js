const cheerio = require('cheerio');
const { parsePrice } = require('../utils/tires');

const NAME = 'interco';
const URL = 'https://www.intercotire.com/blem-list';

// Note: this scraper returns EVERY tire on the page. Diameter/price filtering
// happens later — the public-feed Discord alert applies PUBLIC_ALERT_MIN_DIAMETER
// (default 35"), and per-user subscriptions apply their own filters.

async function scrape() {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${URL}`);

    const html = await res.text();
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

        if (!sku || !size) return; // skip malformed rows

        // Parse v2 fields
        const priceDollars = parsePrice(price);
        const priceCents = priceDollars != null ? Math.round(priceDollars * 100) : null;
        const quantityN = /^\d+$/.test(qty) ? parseInt(qty, 10) : null;
        let stockState = 'unknown';
        if (quantityN != null) {
            stockState = quantityN > 4 ? 'in_stock' : quantityN > 0 ? 'low_stock' : 'out_of_stock';
        }

        const href = $row.find('td[headers="view-views-conditional-field-table-column"] a').attr('href');
        const productUrl = href ? `https://www.intercotire.com${href}` : null;

        tires.push({
            sku,
            title,
            brand,
            size,
            is_blem: 1,
            quantity_raw: qty,
            quantity_n: quantityN,
            stock_state: stockState,
            price_cents: priceCents,
            product_url: productUrl,
        });
    });

    return tires;
}

module.exports = { name: NAME, url: URL, scrape };
