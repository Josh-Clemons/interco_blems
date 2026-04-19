const cheerio = require('cheerio');

const NAME = 'interco';
const URL = 'https://www.intercotire.com/blem-list';

// Minimum tire diameter in inches to include in results.
const MIN_DIAMETER_INCHES = 35;

/**
 * Returns true if the tire size string represents a tire >= MIN_DIAMETER_INCHES.
 *
 * Handles three common size formats found on this page:
 *   NNxMM.MMRdd   e.g. "35x12.50R18LT"  -> diameter is the leading number (35)
 *   NNXmm.mmRdd   e.g. "54x19.5/20LT"   -> diameter is the leading number (54)
 *   NN/MM-dd      e.g. "14/42-17"        -> diameter is the number after "/" (42)
 *   NNNxMMRdd     e.g. "235x85R16"       -> metric (mm width), not a diameter - excluded
 */
function meetsMinSize(size) {
    // Metric format: leading number > 100 means it's mm width, not diameter.
    // These are typically ~28-32" actual diameter, so exclude them.
    const leading = size.match(/^(\d+)[xX]/);
    if (leading) {
        const n = parseInt(leading[1], 10);
        if (n > 100) return false;      // metric, skip
        return n >= MIN_DIAMETER_INCHES;
    }

    // Bias/flotation format where diameter follows a slash: NN/MM-dd
    const afterSlash = size.match(/\/(\d+)/);
    if (afterSlash) {
        return parseInt(afterSlash[1], 10) >= MIN_DIAMETER_INCHES;
    }

    return false;
}

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

        if (!meetsMinSize(size)) return; // below minimum diameter

        tires.push({ sku, title, brand, size, quantity: qty, price });
    });

    return tires;
}

module.exports = { name: NAME, url: URL, scrape };
