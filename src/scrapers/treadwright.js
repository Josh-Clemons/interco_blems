/**
 * TreadWright scraper — Shopify JSON API
 *
 * Fetches tires from three collections: filter (blems), mud-terrain, and all-terrain.
 * Products are deduplicated by ID before parsing so overlap is handled cleanly.
 * Each variant (Standard Wear, Premier Wear, Winter Kedge) becomes its own row.
 * Blem detection via tags array containing "blemish".
 */

const { extractSizeToken } = require('../utils/tires');

const NAME = 'treadwright';
const URL = 'https://www.treadwright.com/collections/filter';
const COLLECTIONS = [
    'filter',
    'mud-terrain-tires',
    'all-terrain-tires',
];

// Title regex: [BLEMISH] [LT] | {AT/MT} {pattern} {size} {ply} PLY REMOLD USA
// /i for case-insensitive "Remold"; prefix group handles BLEMISH|, LT|, or BLEMISH LT|
const TITLE_RE = /^(?:(?:BLEMISH\s+)?(?:LT\s*)?\|\s*)?([AM]T)\s+(.+?)\s+([\d.]+[xX/][\d.]+[Rr][\d.]+)\s+(\d+)\s*PLY\s+REMOLD\s+USA/i;

/**
 * Fetch all pages of products from a single Shopify collection.
 */
async function fetchCollection(slug) {
    const products = [];
    let page = 1;

    while (true) {
        const url = `https://www.treadwright.com/collections/${slug}/products.json?limit=250&page=${page}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

        const data = await res.json();
        if (!data.products || data.products.length === 0) break;

        products.push(...data.products);
        if (data.products.length < 250) break;
        page++;
    }

    return products;
}

/**
 * Fetch all products across all configured collections, deduplicating by product ID.
 */
async function fetchAllProducts() {
    const seen = new Set();
    const products = [];

    for (const slug of COLLECTIONS) {
        const batch = await fetchCollection(slug);
        for (const p of batch) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                products.push(p);
            }
        }
    }

    return products;
}

/**
 * Parse the vendor field for structured size data.
 * Format: "37 12.5 20 E" → { width, aspect, rim, load_range }
 */
function parseVendor(vendor) {
    if (!vendor) return {};
    const parts = vendor.trim().split(/\s+/);
    if (parts.length < 3) return {};
    return {
        width: parts[0],
        aspect: parts[1],
        rim: parts[2],
        load_range: parts[3] || null,
    };
}

/**
 * Extract category from tags (MT/AT).
 */
function getCategory(tags) {
    const lower = tags.map(t => t.toLowerCase());
    if (lower.includes('m/t') || lower.includes('mt')) return 'mud';
    if (lower.includes('a/t') || lower.includes('at')) return 'all-terrain';
    return null;
}

/**
 * Extract load range from tags.
 */
function getLoadRange(tags) {
    for (const t of tags) {
        const m = t.match(/^load([A-Z])$/i);
        if (m) return m[1].toUpperCase();
    }
    return null;
}

function parseProducts(products) {
    const tires = [];

    for (const product of products) {
        // Filter to actual tires
        if (product.product_type !== 'Tire') continue;

        const tags = product.tags || [];
        const isBlem = tags.map(t => t.toLowerCase()).includes('blemish');
        const titleMatch = TITLE_RE.exec(product.title);

        const vendorData = parseVendor(product.vendor);
        const category = getCategory(tags);
        const loadRange = getLoadRange(tags) || vendorData.load_range || null;

        const size = titleMatch ? titleMatch[3] : extractSizeToken(product.title);
        const ply = titleMatch ? parseInt(titleMatch[4], 10) : null;
        const productLine = titleMatch ? titleMatch[2] : null; // e.g. "CLAW II"

        const productUrl = `https://www.treadwright.com/products/${product.handle}`;
        const imageUrl = product.images?.[0]?.src || null;

        for (const variant of product.variants || []) {
            const priceDollars = parseFloat(variant.price);
            const priceCents = !isNaN(priceDollars) ? Math.round(priceDollars * 100) : null;

            const msrp = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
            const msrpCents = msrp != null && !isNaN(msrp) ? Math.round(msrp * 100) : null;

            // Weight: Shopify gives pounds, we store ounces
            const weightOz = variant.weight && variant.weight_unit === 'lb'
                ? Math.round(variant.weight * 16)
                : variant.weight && variant.weight_unit === 'oz'
                    ? Math.round(variant.weight)
                    : null;

            const stockState = variant.available ? 'in_stock' : 'out_of_stock';

            tires.push({
                sku: variant.sku || `${product.handle}-${variant.id}`,
                title: product.title + (variant.title !== 'Default Title' ? ` (${variant.title})` : ''),
                brand: 'TreadWright',
                product_line: productLine,
                category,
                size,
                is_blem: isBlem ? 1 : 0,
                quantity_raw: variant.available ? 'available' : 'unavailable',
                quantity_n: null, // Shopify doesn't expose exact counts
                stock_state: stockState,
                price: `$${priceDollars.toFixed(2)}`,
                price_cents: priceCents,
                msrp_cents: msrpCents,
                load_range: loadRange,
                ply,
                weight_oz: weightOz,
                product_url: productUrl,
                image_url: imageUrl,
                extra: {
                    wear_tier: variant.title,
                    tags,
                    handle: product.handle,
                    variant_id: variant.id,
                },
            });
        }
    }

    return tires;
}

async function scrape() {
    const products = await fetchAllProducts();
    return parseProducts(products);
}

module.exports = { name: NAME, url: URL, scrape, _parseProducts: parseProducts };
