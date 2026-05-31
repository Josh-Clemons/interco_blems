/**
 * 4WheelParts scraper — FlareSolverr proxy (Cloudflare bypass)
 *
 * Sends every request through FlareSolverr (http://localhost:8191) which
 * runs a patched undetected-chromedriver to pass Cloudflare Managed Challenge.
 * A persistent FlareSolverr session is used across all page requests so the
 * CF clearance cookie is reused without re-solving the challenge each time.
 *
 * Products are extracted from the __NEXT_DATA__ JSON blob embedded in each
 * listing page, with a DOM/cheerio fallback if the JSON path changes.
 *
 * Categories: Mud Terrain, All Terrain
 * is_blem is always 0 — 4WP does not label blems explicitly.
 */

const cheerio = require('cheerio');
const log = require('../logger');
const { extractSizeToken } = require('../utils/tires');

const NAME = '4wheelparts';
const URL = 'https://www.4wheelparts.com/t/tires/mud-terrain-tires';

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
const SESSION_ID = '4wheelparts';
const REQUEST_TIMEOUT = 90000; // ms — FlareSolverr maxTimeout
const PAGE_DELAY_MS = 3000;
const MAX_PAGES = 30;

const CATEGORIES = [
    { url: 'https://www.4wheelparts.com/t/tires/mud-terrain-tires', category: 'mud' },
    { url: 'https://www.4wheelparts.com/t/tires/all-terrain-tires', category: 'all-terrain' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── FlareSolverr helpers ────────────────────────────────────────── */

async function fsRequest(cmd, extra = {}) {
    const body = { cmd, maxTimeout: REQUEST_TIMEOUT, ...extra };
    const res = await fetch(FLARESOLVERR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT + 10000),
    });
    if (!res.ok) throw new Error(`FlareSolverr HTTP ${res.status}`);
    return res.json();
}

async function ensureSession() {
    const list = await fsRequest('sessions.list');
    if (!list.sessions.includes(SESSION_ID)) {
        await fsRequest('sessions.create', { session: SESSION_ID });
        log.info('[4wheelparts] FlareSolverr session created');
    }
}

async function destroySession() {
    try {
        await fsRequest('sessions.destroy', { session: SESSION_ID });
    } catch {}
}

/** Fetch a URL via FlareSolverr. Returns the response HTML string. */
async function fetchPage(url) {
    const result = await fsRequest('request.get', { url, session: SESSION_ID });
    if (result.status !== 'ok') {
        throw new Error(`FlareSolverr error: ${result.message}`);
    }
    const { status, response } = result.solution;
    if (status !== 200) throw new Error(`HTTP ${status} for ${url}`);
    return response;
}

/* ── Product extraction ──────────────────────────────────────────── */

/**
 * Recursively find the first array-of-objects that looks like a product list
 * inside the __NEXT_DATA__ tree.
 */
function findProductsInNextData(obj, depth = 0) {
    if (depth > 8 || !obj || typeof obj !== 'object') return [];

    if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object') {
            const keys = Object.keys(obj[0]).join(' ').toLowerCase();
            if ((keys.includes('name') || keys.includes('title')) &&
                (keys.includes('sku') || keys.includes('price') || keys.includes('id'))) {
                return obj;
            }
        }
        for (const item of obj) {
            const found = findProductsInNextData(item, depth + 1);
            if (found.length) return found;
        }
        return [];
    }

    const priority = ['products', 'items', 'results', 'hits', 'records', 'tires'];
    for (const key of priority) {
        if (obj[key]) {
            const found = findProductsInNextData(obj[key], depth + 1);
            if (found.length) return found;
        }
    }
    for (const [key, val] of Object.entries(obj)) {
        if (priority.includes(key)) continue;
        const found = findProductsInNextData(val, depth + 1);
        if (found.length) return found;
    }
    return [];
}

function parsePriceCents(val) {
    if (val == null) return null;
    const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : Math.round(n * 100);
}

function parseProductNode(product, defaultCategory) {
    const name = product.name || product.title || product.productName || product.displayName || '';
    const brand = (typeof product.brand === 'string' ? product.brand : product.brand?.name) ||
                  product.brandName || null;
    const sku = product.sku || product.partNumber || product.mpn ||
                (product.id ? String(product.id) : null);

    const priceRaw = product.price?.value ?? product.price?.current ??
                     product.salePrice ?? product.currentPrice ??
                     product.listingPrice ?? product.price ?? null;
    const priceCents = parsePriceCents(priceRaw);

    const msrpRaw = product.price?.msrp ?? product.price?.regular ??
                    product.msrp ?? product.regularPrice ?? product.listPrice ?? null;
    const msrpCents = parsePriceCents(msrpRaw);

    const inStock = product.inStock ?? product.available ??
                    (product.stockStatus === 'in_stock') ??
                    (product.availability === 'InStock') ?? null;
    const stockState = inStock === true ? 'in_stock' : inStock === false ? 'out_of_stock' : 'unknown';

    const size = extractSizeToken(name) || product.tireSize || product.size || null;

    let category = defaultCategory;
    if (!category) {
        const lower = name.toLowerCase();
        if (lower.includes('mud') || / m\/t\b/.test(lower) || /-mt\b/.test(lower)) category = 'mud';
        else if (lower.includes('all-terrain') || lower.includes('all terrain') || / a\/t\b/.test(lower)) category = 'all-terrain';
    }

    const productUrl = product.url
        ? (product.url.startsWith('http') ? product.url : `https://www.4wheelparts.com${product.url}`)
        : null;

    const imageUrl = product.images?.[0]?.url ?? product.images?.[0] ??
                     product.imageUrl ?? product.image?.url ?? product.thumbnailUrl ?? null;

    let productLine = name;
    if (brand) productLine = productLine.replace(new RegExp(brand, 'i'), '').trim();
    const sizeInName = extractSizeToken(productLine);
    if (sizeInName) productLine = productLine.replace(sizeInName, '').trim();

    return {
        sku: sku ? String(sku) : null,
        title: name || null,
        brand: brand || null,
        product_line: productLine || null,
        category,
        size,
        is_blem: 0,
        quantity_raw: inStock === true ? 'in stock' : inStock === false ? 'out of stock' : null,
        quantity_n: null,
        stock_state: stockState,
        price_cents: priceCents,
        msrp_cents: msrpCents,
        sale_price_cents: null,
        load_index: product.loadIndex ? parseInt(product.loadIndex, 10) : null,
        speed_rating: product.speedRating || null,
        load_range: product.loadRange || null,
        ply: product.plyRating ? parseInt(product.plyRating, 10) : null,
        tread_depth_32: product.treadDepth ? parseFloat(product.treadDepth) : null,
        overall_diam: product.overallDiameter ? parseFloat(product.overallDiameter) : null,
        section_width: product.sectionWidth ? parseFloat(product.sectionWidth) : null,
        product_url: productUrl,
        image_url: typeof imageUrl === 'string' ? imageUrl : null,
        extra: {
            rating: product.rating?.value ?? product.averageRating ?? null,
            review_count: product.rating?.count ?? product.reviewCount ?? null,
            free_shipping: product.freeShipping ?? null,
        },
    };
}

/**
 * Parse listing page HTML.
 * Returns { tires, totalPages }
 */
function parseListingHtml(html, defaultCategory) {
    const $ = cheerio.load(html);

    // ── __NEXT_DATA__ path ────────────────────────────────────────
    const nextDataEl = $('#__NEXT_DATA__').html();
    if (nextDataEl) {
        try {
            const nextData = JSON.parse(nextDataEl);
            const products = findProductsInNextData(nextData.props ?? nextData);

            if (products.length > 0) {
                log.info(`[4wheelparts] __NEXT_DATA__: ${products.length} products`);
                const tires = products
                    .map(p => parseProductNode(p, defaultCategory))
                    .filter(t => t.sku || t.title);

                const pageProps = nextData.props?.pageProps;
                let totalPages = null;
                if (pageProps) {
                    const total = pageProps.totalCount || pageProps.totalProducts ||
                                  pageProps.pagination?.totalCount;
                    const perPage = pageProps.pageSize || pageProps.productsPerPage || 24;
                    if (total) totalPages = Math.ceil(Number(total) / Number(perPage));
                }

                return { tires, totalPages };
            }

            // Log keys to help diagnose structure
            const keys = Object.keys(nextData.props?.pageProps || nextData.props || nextData);
            log.warn(`[4wheelparts] __NEXT_DATA__ present but no products found. Top keys: ${keys.join(', ')}`);
        } catch (err) {
            log.warn(`[4wheelparts] Failed to parse __NEXT_DATA__: ${err.message}`);
        }
    }

    // ── DOM cheerio fallback ──────────────────────────────────────
    log.info('[4wheelparts] Falling back to DOM extraction');
    const tires = [];

    $('[data-productid], [data-product-id], [data-sku], .product-card, .product-item, [class*="ProductCard"]').each((_, card) => {
        const $c = $(card);
        const sku = $c.attr('data-productid') || $c.attr('data-product-id') || $c.attr('data-sku') || null;
        const name = $c.find('h2,h3,h4,[class*="title"],[class*="name"]').first().text().trim();
        if (!name) return;

        const priceText = $c.find('[class*="price"]:not([class*="was"]):not([class*="old"])').first().text().trim();
        const inStock = $c.text().toLowerCase().includes('in stock');
        const url = $c.find('a').first().attr('href') || null;
        const imageUrl = $c.find('img').first().attr('src') || $c.find('img').first().attr('data-src') || null;

        tires.push(parseProductNode({ sku, name, price: priceText, inStock, url, imageUrl }, defaultCategory));
    });

    if (tires.length === 0) log.warn('[4wheelparts] DOM extraction also found 0 products');
    else log.info(`[4wheelparts] DOM: ${tires.length} products`);

    return { tires, totalPages: null };
}

function hasNextPageInHtml(html, currentPage) {
    const $ = cheerio.load(html);
    // Check for a page N+1 link or a non-disabled "next" button
    const nextPage = currentPage + 1;
    const hasLink = $(`a[href*="page=${nextPage}"]`).length > 0;
    const hasBtn = $('[aria-label="Next page"]:not([disabled]), [class*="next"]:not([class*="disabled"])').length > 0;
    return hasLink || hasBtn;
}

/* ── Main scrape ─────────────────────────────────────────────────── */

async function scrape() {
    log.info('[4wheelparts] Starting scrape via FlareSolverr');

    await ensureSession();
    const allTires = [];

    try {
        for (const { url: catUrl, category } of CATEGORIES) {
            log.info(`[4wheelparts] Category: ${catUrl}`);
            let pageNum = 1;
            let knownTotalPages = null;

            while (pageNum <= MAX_PAGES) {
                const pageUrl = pageNum === 1 ? catUrl : `${catUrl}?page=${pageNum}`;
                log.info(`[4wheelparts] Fetching page ${pageNum}: ${pageUrl}`);

                let html;
                try {
                    html = await fetchPage(pageUrl);
                } catch (err) {
                    log.error(`[4wheelparts] Failed to fetch ${pageUrl}: ${err.message}`);
                    break;
                }

                const { tires, totalPages } = parseListingHtml(html, category);
                log.info(`[4wheelparts] Page ${pageNum}: ${tires.length} tires`);

                if (tires.length === 0) {
                    log.info('[4wheelparts] Empty page — stopping pagination');
                    break;
                }

                allTires.push(...tires);

                if (knownTotalPages === null && totalPages) knownTotalPages = totalPages;

                const more = knownTotalPages
                    ? pageNum < knownTotalPages
                    : hasNextPageInHtml(html, pageNum);

                if (!more) break;

                pageNum++;
                await sleep(PAGE_DELAY_MS + Math.random() * 2000);
            }
        }
    } finally {
        await destroySession();
    }

    log.info(`[4wheelparts] Done — ${allTires.length} total tires`);
    return allTires;
}

module.exports = { name: NAME, url: URL, scrape, nightly: true };
