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

// Size patterns: "37X13.50R24" or "255/65R18" possibly followed by ", 120Q" etc.
const SIZE_RE = /(\d+[Xx/][\d.]+[Rr]\d+)/;
const LOAD_SPEED_RE = /(\d+)([A-Z])/; // e.g. "120Q" → load_index=120, speed_rating=Q
const LOAD_RANGE_RE = /Load Range:\s*([A-Z]+)\s*(?:\((\d+)\s*Ply\))?/i;
const PRICE_RE = /\$?([\d,]+\.?\d*)/;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse listing page cards for basic info,
 * then optionally fetch detail pages for full specs.
 */
async function scrape() {
    const res = await fetch(URL, {
        headers: { 'User-Agent': 'blem-tracker/1.0 (+tire-tracking-bot)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${URL}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    const tires = [];

    // BigCommerce product cards — look for product listing items
    const cards = $('.product, .productCard, [data-product-id], .listItem, article.product');

    // If no structured cards found, try a broader approach
    const productElements = cards.length > 0 ? cards : $('[class*="product"]').filter((_, el) => {
        return $(el).find('a[href*="/"]').length > 0 && $(el).find('[class*="price"]').length > 0;
    });

    productElements.each((_, card) => {
        const $card = $(card);

        // Brand
        const brand = $card.find('p').first().text().trim() ||
                       $card.find('[class*="brand"]').text().trim() || null;

        // Model/title — usually in an h4 or heading link
        const titleEl = $card.find('h4 a, h3 a, [class*="title"] a, [class*="name"] a').first();
        const title = titleEl.text().trim() || $card.find('h4, h3').first().text().trim();

        // Product URL
        const href = titleEl.attr('href') || $card.find('a[href]').first().attr('href');
        const productUrl = href ? (href.startsWith('http') ? href : `https://www.tiremart.com${href}`) : null;

        // Size string
        const sizeText = $card.text();
        const sizeMatch = SIZE_RE.exec(sizeText);
        const size = sizeMatch ? sizeMatch[1] : null;

        // Load/Speed from size line (e.g. "37X13.50R24, 120Q")
        let loadIndex = null;
        let speedRating = null;
        const lsText = $card.find('[class*="size"], [class*="spec"]').text() || sizeText;
        const lsMatch = lsText.match(/,\s*(\d+)([A-Z])\b/);
        if (lsMatch) {
            loadIndex = parseInt(lsMatch[1], 10);
            speedRating = lsMatch[2];
        }

        // Load range / ply
        let loadRange = null;
        let ply = null;
        const lrMatch = LOAD_RANGE_RE.exec(sizeText);
        if (lrMatch) {
            loadRange = lrMatch[1];
            ply = lrMatch[2] ? parseInt(lrMatch[2], 10) : null;
        }

        // Price
        let priceCents = null;
        let price = null;
        const priceEl = $card.find('[class*="price"]:not([class*="retail"]):not([class*="was"])').first();
        const priceText = priceEl.text() || '';
        const priceMatch = PRICE_RE.exec(priceText);
        if (priceMatch) {
            const dollars = parseFloat(priceMatch[1].replace(',', ''));
            priceCents = Math.round(dollars * 100);
            price = `$${dollars.toFixed(2)}`;
        }

        // MSRP / retail price
        let msrpCents = null;
        const retailEl = $card.find('[class*="retail"], [class*="was"], [class*="rrp"], s, del').first();
        const retailMatch = PRICE_RE.exec(retailEl.text() || '');
        if (retailMatch) {
            msrpCents = Math.round(parseFloat(retailMatch[1].replace(',', '')) * 100);
        }

        // Stock
        const stockText = $card.text();
        let stockState = 'unknown';
        let quantityRaw = null;
        const stockMatch = stockText.match(/In Stock\s*\((\d+\+?)\)/i);
        if (stockMatch) {
            quantityRaw = stockMatch[1];
            stockState = 'in_stock';
        } else if (/in\s*stock/i.test(stockText)) {
            quantityRaw = 'in stock';
            stockState = 'in_stock';
        } else if (/out of stock/i.test(stockText)) {
            quantityRaw = 'out of stock';
            stockState = 'out_of_stock';
        }

        // Category from performance text
        let category = null;
        const perfText = sizeText.toLowerCase();
        if (perfText.includes('mud terrain')) category = 'mud';
        else if (perfText.includes('all terrain')) category = 'all-terrain';
        else if (perfText.includes('extreme terrain')) category = 'extreme-terrain';

        // SKU from URL slug (best we can do from listing page)
        // Use the URL path as a stable identifier
        const sku = href ? href.replace(/^\/|\/$/g, '') : null;

        if (!sku || !title) return;

        tires.push({
            sku,
            title: `${brand ? brand + ' ' : ''}${title}${title.includes('BLEM') ? '' : ' (BLEM)'}`,
            brand: brand || null,
            category,
            size,
            is_blem: 1, // All products from /blemished-tires/ are blems
            quantity_raw: quantityRaw,
            quantity_n: quantityRaw && /^\d+$/.test(quantityRaw) ? parseInt(quantityRaw, 10) : null,
            stock_state: stockState,
            price,
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
