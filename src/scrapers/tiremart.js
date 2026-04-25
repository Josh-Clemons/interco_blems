/**
 * TireMart scraper — BigCommerce SSR
 *
 * Scrapes the /blemished-tires/ deals page which lists all active blem inventory.
 * All products from this page are blems. Uses cheerio for HTML parsing.
 *
 * Respects 10-second crawl delay from robots.txt.
 */

const cheerio = require('cheerio');

const NAME = 'tiremart';
const URL = 'https://www.tiremart.com/blemished-tires/';

// Matches standard tire size strings within a spec text like "305/70R16, 124/121Q, E (10 Ply)"
const SIZE_RE = /(\d+[Xx/][\d.]+[Rr]\d+)/;
// Matches load index + speed rating, e.g. ", 124/121Q" or ", 110V"
const LOAD_SPEED_RE = /,\s*(\d+)(?:\/\d+)?([A-Z])\b/;
// Matches load range + optional ply from spec text, e.g. "E (10 Ply)"
const LOAD_RANGE_RE = /([A-Z])\s*\((\d+)\s*Ply\)/;
const PRICE_RE = /\$?([\d,]+\.\d{2})/;

async function scrape() {
    const res = await fetch(URL, {
        headers: { 'User-Agent': 'BlemBot/1.0 (+tire-tracking-bot)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${URL}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    const tires = [];

    // BigCommerce listing: each product is a <li class="product"><article class="card" data-sku="...">
    $('li.product article.card[data-sku]').each((_, card) => {
        const $c = $(card);

        // SKU from BigCommerce data attribute — reliable, stable identifier
        const sku = $c.attr('data-sku');

        // Product URL — already absolute
        const productUrl = $c.find('h4.card-title a').attr('href') || null;

        // Brand from the labeled data attribute; TireMart stores "BLEM" for some
        // generic blem entries — treat those as unknown brand
        const brandRaw = $c.find('p[data-test-info-type="brandName"]').text().trim();
        const brand = (brandRaw && brandRaw !== 'BLEM') ? brandRaw : null;

        // Full model title — strip leading "BLEM " prefix TireMart sometimes adds
        const titleRaw = $c.find('h4.card-title a').text().trim();
        const title = titleRaw.replace(/^BLEM\s+/i, '').trim() || titleRaw;

        // Spec text: "305/70R16, 124/121Q, E (10 Ply)" from the misleadingly-named
        // span.product-sku (BigCommerce uses that class for the spec line, not the SKU)
        const specText = $c.find('span.product-sku').text().trim();

        const sizeMatch = SIZE_RE.exec(specText);
        const size = sizeMatch ? sizeMatch[1] : null;

        let loadIndex = null;
        let speedRating = null;
        const lsMatch = LOAD_SPEED_RE.exec(specText);
        if (lsMatch) {
            loadIndex = parseInt(lsMatch[1], 10);
            speedRating = lsMatch[2];
        }

        let loadRange = null;
        let ply = null;
        const lrMatch = LOAD_RANGE_RE.exec(specText);
        if (lrMatch) {
            loadRange = lrMatch[1];
            ply = parseInt(lrMatch[2], 10);
        }

        // Sale price (the actual purchase price)
        let priceCents = null;
        const priceText = $c.find('[data-product-price-without-tax]').text().trim();
        const priceMatch = PRICE_RE.exec(priceText);
        if (priceMatch) {
            priceCents = Math.round(parseFloat(priceMatch[1].replace(',', '')) * 100);
        }

        // MSRP / original price shown as strikethrough
        let msrpCents = null;
        const msrpText = $c.find('[data-product-rrp-price-without-tax]').text().trim();
        const msrpMatch = PRICE_RE.exec(msrpText);
        if (msrpMatch) {
            msrpCents = Math.round(parseFloat(msrpMatch[1].replace(',', '')) * 100);
        }

        // Stock: `.stock_level` shows human text; `data-current-stock` has the real count
        const stockText = $c.find('.stock_level').text().trim();
        const currentStockAttr = $c.find('[data-current-stock]').attr('data-current-stock');
        const currentStock = currentStockAttr != null ? parseInt(currentStockAttr, 10) : NaN;

        let stockState = 'unknown';
        let quantityRaw = null;
        let quantityN = null;

        if (!isNaN(currentStock)) {
            quantityN = currentStock;
            quantityRaw = String(currentStock);
            stockState = currentStock > 4 ? 'in_stock' : currentStock > 0 ? 'low_stock' : 'out_of_stock';
        } else if (/in\s*stock/i.test(stockText)) {
            quantityRaw = stockText;
            stockState = 'in_stock';
        } else if (/out of stock/i.test(stockText)) {
            quantityRaw = 'out of stock';
            stockState = 'out_of_stock';
        }

        // Category from performance icon alt text
        let category = null;
        const perfAlt = $c.find('.Performance-Result img').attr('alt')?.toLowerCase() || '';
        if (perfAlt.includes('mud terrain')) category = 'mud';
        else if (perfAlt.includes('all terrain')) category = 'all-terrain';
        else if (perfAlt.includes('extreme terrain')) category = 'extreme-terrain';

        if (!sku || !size) return;

        tires.push({
            sku,
            title,
            brand,
            category,
            size,
            is_blem: 1,
            quantity_raw: quantityRaw,
            quantity_n: quantityN,
            stock_state: stockState,
            price_cents: priceCents,
            msrp_cents: msrpCents,
            load_index: loadIndex,
            speed_rating: speedRating,
            load_range: loadRange,
            ply,
            product_url: productUrl,
        });
    });

    return tires;
}

module.exports = { name: NAME, url: URL, scrape };
