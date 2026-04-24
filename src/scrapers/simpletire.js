/**
 * SimpleTire scraper — Next.js SSR
 *
 * Crawls off-road tire categories, extracts product line pages,
 * then scrapes individual SKU pages for full specs.
 *
 * All SimpleTire products are is_blem=0 (no blems sold here).
 * Value: richest spec data of all sources.
 */

const cheerio = require('cheerio');
const repo = require('../db/repository');
const log = require('../logger');

const NAME = 'simpletire';
const URL = 'https://simpletire.com/categories/mud-terrain-tires';

const CATEGORIES = [
    'https://simpletire.com/categories/mud-terrain-tires',
    'https://simpletire.com/categories/all-terrain-tires',
];

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ── Circuit Breaker ──────────────────────────────────────────────── */
const MAX_CONSECUTIVE_FAILURES = parseInt(process.env.SIMPLETIRE_MAX_FAILURES || '5', 10);
const COOLDOWN_MS = parseInt(process.env.SIMPLETIRE_COOLDOWN_MINS || '60', 10) * 60_000;
const BLOCK_SIGNATURES = ['resolving issues', 'access denied', 'please try again later'];

const circuit = {
    consecutiveFailures: 0,
    trippedAt: null,
    lastError: null,
};

function isCircuitOpen() {
    if (!circuit.trippedAt) return false;
    if (Date.now() - circuit.trippedAt >= COOLDOWN_MS) {
        log.info('[simpletire] Circuit cooldown expired — will probe on next request');
        return false; // allow a probe
    }
    return true;
}

function recordSuccess() {
    if (circuit.consecutiveFailures > 0) {
        log.info(`[simpletire] Request succeeded — resetting circuit (was at ${circuit.consecutiveFailures} failures)`);
    }
    circuit.consecutiveFailures = 0;
    circuit.trippedAt = null;
    circuit.lastError = null;
}

function recordFailure(err) {
    circuit.consecutiveFailures++;
    circuit.lastError = err;
    if (circuit.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !circuit.trippedAt) {
        circuit.trippedAt = Date.now();
        log.error(`[simpletire] Circuit TRIPPED after ${circuit.consecutiveFailures} consecutive failures — cooling off for ${COOLDOWN_MS / 60_000}m. Last error: ${err}`);
    }
}

function isBlockPage(html) {
    const lower = html.slice(0, 2000).toLowerCase();
    return BLOCK_SIGNATURES.some(sig => lower.includes(sig));
}

/**
 * Fetch a page with retries, delay, and circuit breaker.
 * Retries on 429/500/502/503 with exponential backoff.
 * Detects soft-block pages by body content.
 * Throws with .circuitOpen = true when circuit is tripped.
 */
async function fetchPage(url, delayMs = 2000, maxRetries = 3) {
    if (isCircuitOpen()) {
        const err = new Error(`Circuit open — skipping fetch (cooldown until ${new Date(circuit.trippedAt + COOLDOWN_MS).toISOString()}). Last error: ${circuit.lastError}`);
        err.circuitOpen = true;
        throw err;
    }

    await sleep(delayMs);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let res;
        try {
            res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
        } catch (fetchErr) {
            // Network error or timeout
            if (attempt === maxRetries) {
                const msg = `${fetchErr.name}: ${fetchErr.message} fetching ${url} (attempt ${attempt}/${maxRetries})`;
                recordFailure(msg);
                throw new Error(msg);
            }
            const backoff = delayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
            log.warn(`[simpletire] ${fetchErr.name} on ${url} — retry ${attempt}/${maxRetries} in ${Math.round(backoff / 1000)}s`);
            await sleep(backoff);
            continue;
        }

        if (res.ok) {
            const html = await res.text();
            if (isBlockPage(html)) {
                const msg = `Soft-blocked by SimpleTire (${url})`;
                recordFailure(msg);
                throw new Error(msg);
            }
            recordSuccess();
            return html;
        }

        const retryable = [429, 500, 502, 503].includes(res.status);
        if (!retryable || attempt === maxRetries) {
            const msg = `HTTP ${res.status} fetching ${url} (attempt ${attempt}/${maxRetries})`;
            recordFailure(msg);
            throw new Error(msg);
        }

        const backoff = delayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
        log.warn(`[simpletire] HTTP ${res.status} on ${url} — retry ${attempt}/${maxRetries} in ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
    }
}

/**
 * Extract product line URLs from a category page.
 * Returns array of { brand, model, url }
 */
function extractProductLines($) {
    const lines = [];
    // Product cards link to /brands/{brand}-tires/{model-slug}
    $('a[href*="/brands/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || href.includes('/p/')) return; // skip SKU links here
        const fullUrl = href.startsWith('http') ? href : `https://simpletire.com${href}`;
        if (!lines.some(l => l.url === fullUrl)) {
            lines.push({ url: fullUrl });
        }
    });
    return lines;
}

/**
 * Extract SKU page URLs from a product line page.
 * Also extracts JSON-LD ProductGroup data.
 */
function extractSkuUrls($) {
    const skuUrls = [];

    // Look for links to /p/{id} pages
    $('a[href*="/p/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const fullUrl = href.startsWith('http') ? href : `https://simpletire.com${href}`;
        if (!skuUrls.includes(fullUrl)) {
            skuUrls.push(fullUrl);
        }
    });

    // Also check JSON-LD for variant URLs
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).html());
            if (data['@type'] === 'ProductGroup' && data.hasVariant) {
                for (const v of data.hasVariant) {
                    if (v.url && !skuUrls.includes(v.url)) {
                        skuUrls.push(v.url);
                    }
                }
            }
        } catch {}
    });

    return skuUrls;
}

/**
 * Parse specs from a SKU detail page.
 */
function parseSkuPage($, url) {
    // Extract JSON-LD
    let jsonLd = null;
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).html());
            if (data['@type'] === 'Product' || data['@type'] === 'ProductGroup') {
                jsonLd = data;
            }
        } catch {}
    });

    // Brand and model from heading/breadcrumbs
    const brand = jsonLd?.brand?.name ||
        $('[class*="brand"]').first().text().trim() ||
        $('h1').first().text().split(' ')[0] || null;

    const model = jsonLd?.name?.replace(brand, '').trim() ||
        $('h1').first().text().replace(brand || '', '').trim() || null;

    // Specs table
    const specs = {};
    $('table tr, [class*="spec"] [class*="row"]').each((_, row) => {
        const cells = $(row).find('td, th, [class*="label"], [class*="value"]');
        if (cells.length >= 2) {
            const key = $(cells[0]).text().trim().toLowerCase();
            const val = $(cells[1]).text().trim();
            specs[key] = val;
        }
    });

    // Also try dt/dd or key-value patterns
    $('dt').each((i, el) => {
        const key = $(el).text().trim().toLowerCase();
        const val = $(el).next('dd').text().trim();
        if (key && val) specs[key] = val;
    });

    // Parse size from breadcrumb or page content
    const breadcrumb = $('[class*="breadcrumb"]').text();
    const sizeMatch = breadcrumb.match(/((?:LT)?\d+[xX/][\d.]+[Rr]\d+(?:LT)?)/);
    const size = sizeMatch ? sizeMatch[1] : specs['tire size'] || specs['size'] || null;

    // Price
    let priceCents = null;
    const priceText = $('[class*="price"]').first().text();
    const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
    if (priceMatch) {
        priceCents = Math.round(parseFloat(priceMatch[1].replace(',', '')) * 100);
    }
    // Fallback to JSON-LD
    if (!priceCents && jsonLd?.offers?.price) {
        priceCents = Math.round(parseFloat(jsonLd.offers.price) * 100);
    }

    // Load index — "3858 lbs/3527 lbs (127/124)" or "127"
    let loadIndex = null;
    const liText = specs['load index'] || '';
    const liMatch = liText.match(/\((\d+)/);
    if (liMatch) loadIndex = parseInt(liMatch[1], 10);
    else if (/^\d+$/.test(liText)) loadIndex = parseInt(liText, 10);

    // Speed rating — "94 MPH (P)" → "P"
    let speedRating = null;
    const srText = specs['max speed'] || specs['speed rating'] || '';
    const srMatch = srText.match(/\(([A-Z])\)/);
    if (srMatch) speedRating = srMatch[1];

    // Load range — "E (10 Ply)"
    let loadRange = null;
    let ply = null;
    const lrText = specs['load range'] || '';
    const lrMatch = lrText.match(/^([A-Z]+)\s*(?:\((\d+)\s*Ply\))?/i);
    if (lrMatch) {
        loadRange = lrMatch[1];
        ply = lrMatch[2] ? parseInt(lrMatch[2], 10) : null;
    }

    // Tread depth — "20.7/32nds"
    let treadDepth32 = null;
    const tdText = specs['tread depth'] || '';
    const tdMatch = tdText.match(/([\d.]+)\s*\/\s*32/);
    if (tdMatch) treadDepth32 = Math.round(parseFloat(tdMatch[1]));

    // Weight — "80.74 lbs"
    let weightOz = null;
    const wText = specs['tire weight'] || specs['weight'] || '';
    const wMatch = wText.match(/([\d.]+)\s*lbs?/i);
    if (wMatch) weightOz = Math.round(parseFloat(wMatch[1]) * 16);

    // Section width — "12.87""
    let sectionWidth = null;
    const swText = specs['section width'] || '';
    const swMatch = swText.match(/([\d.]+)/);
    if (swMatch) sectionWidth = parseFloat(swMatch[1]);

    // Overall diameter — "34.96""
    let overallDiam = null;
    const odText = specs['overall diameter'] || '';
    const odMatch = odText.match(/([\d.]+)/);
    if (odMatch) overallDiam = parseFloat(odMatch[1]);

    // 3PMS
    const threePms = (specs['three-peak mountain snowflake (3pms)'] || specs['3pms'] || '').toLowerCase() === 'yes' ? 1 : 0;

    // Category
    let category = null;
    const catText = (specs['category'] || '').toLowerCase();
    if (catText.includes('mud')) category = 'mud';
    else if (catText.includes('all-terrain') || catText.includes('all terrain')) category = 'all-terrain';

    // Part number as SKU
    const partNumber = specs['part number'] || null;
    // Product ID from URL
    const pidMatch = url.match(/\/p\/(\d+)/);
    const productId = pidMatch ? pidMatch[1] : null;
    const sku = partNumber || (productId ? `st-${productId}` : null);

    // Stock
    const pageText = $('body').text().toLowerCase();
    const inStock = pageText.includes('in stock');
    const stockState = inStock ? 'in_stock' : 'out_of_stock';

    // Image
    const imageUrl = jsonLd?.image?.[0] || $('img[src*="tire"]').first().attr('src') || null;

    return {
        sku,
        title: `${brand || ''} ${model || ''} ${size || ''}`.trim(),
        brand,
        product_line: model,
        category,
        size,
        is_blem: 0,
        quantity_raw: inStock ? 'in stock' : 'out of stock',
        stock_state: stockState,

        price_cents: priceCents,
        load_index: loadIndex,
        speed_rating: speedRating,
        load_range: loadRange,
        ply,
        weight_oz: weightOz,
        tread_depth_32: treadDepth32,
        overall_diam: overallDiam,
        section_width: sectionWidth,
        three_pms: threePms,
        product_url: url,
        image_url: imageUrl,
        extra: {
            part_number: partNumber,
            product_id: productId,
            sidewall: specs['sidewall'] || null,
            tread_design: specs['tread design'] || null,
            vehicle_type: specs['vehicle'] || specs['vehicle type'] || null,
        },
    };
}

async function scrape({ full = false } = {}) {
    const allProductLineUrls = new Set();
    const tires = [];

    // Step 1: Discover product lines from category pages
    for (const catUrl of CATEGORIES) {
        if (isCircuitOpen()) {
            log.warn('[simpletire] Circuit open — aborting category discovery');
            break;
        }
        log.info(`[simpletire] Fetching category: ${catUrl}`);
        try {
            const html = await fetchPage(catUrl);
            const $ = cheerio.load(html);
            const lines = extractProductLines($);
            lines.forEach(l => allProductLineUrls.add(l.url));
            log.info(`[simpletire] Found ${lines.length} product lines`);
        } catch (err) {
            log.error(`[simpletire] Category fetch failed: ${err.message}`);
        }
    }

    // Step 2: For each product line, discover SKU pages
    const allSkuUrls = new Set();
    let lineCount = 0;
    for (const lineUrl of allProductLineUrls) {
        if (isCircuitOpen()) {
            log.warn('[simpletire] Circuit open — aborting product line crawl');
            break;
        }
        try {
            const html = await fetchPage(lineUrl, 3000);
            const $ = cheerio.load(html);
            const skuUrls = extractSkuUrls($);
            skuUrls.forEach(u => allSkuUrls.add(u));
        } catch (err) {
            log.error(`[simpletire] Product line fetch failed (${lineUrl}): ${err.message}`);
        }
        lineCount++;
        if (lineCount % 20 === 0) {
            log.info(`[simpletire] Crawled ${lineCount}/${allProductLineUrls.size} product lines (${allSkuUrls.size} SKUs found)`);
        }
    }

    log.info(`[simpletire] Found ${allSkuUrls.size} SKU pages to scrape`);

    // Build a set of product URLs seen in the last 24h so we can skip them.
    // We'll return their existing DB data so the diff doesn't mark them removed.
    const FRESHNESS_HOURS = 24;
    const recentByUrl = new Map();
    if (!full) {
        const dbRows = repo.getTiresBySource(NAME);
        const now = Date.now();
        for (const row of dbRows) {
            if (!row.product_url || !row.is_active) continue;
            const seenMs = new Date(row.last_seen_at + 'Z').getTime();
            if (now - seenMs < FRESHNESS_HOURS * 3600_000) {
                recentByUrl.set(row.product_url, row);
            }
        }
    }
    if (full) {
        log.info(`[simpletire] Full crawl mode — scraping all ${allSkuUrls.size} SKU pages`);
    }

    // Step 3: Scrape individual SKU pages (skip recently-seen ones)
    let count = 0;
    let skipped = 0;
    for (const skuUrl of allSkuUrls) {
        const cached = recentByUrl.get(skuUrl);
        if (cached) {
            // Return the DB row as-is so diff sees it as unchanged
            tires.push(cached);
            skipped++;
            continue;
        }

        if (isCircuitOpen()) {
            log.warn(`[simpletire] Circuit open — aborting SKU crawl (${count} scraped, ${skipped} cached)`);
            break;
        }

        try {
            const html = await fetchPage(skuUrl, 3000);
            const $ = cheerio.load(html);
            const tire = parseSkuPage($, skuUrl);
            if (tire.sku) {
                tires.push(tire);
                count++;
            }
        } catch (err) {
            log.error(`[simpletire] SKU page failed (${skuUrl}): ${err.message}`);
        }

        // Progress log every 20 tires
        if (count % 20 === 0 && count > 0) {
            log.info(`[simpletire] Scraped ${count} tires so far...`);
        }
    }

    if (skipped > 0) {
        log.info(`[simpletire] Skipped ${skipped} SKU pages (seen within ${FRESHNESS_HOURS}h)`);
    }

    log.info(`[simpletire] Total: ${tires.length} tires scraped`);
    return tires;
}

module.exports = { name: NAME, url: URL, scrape };
