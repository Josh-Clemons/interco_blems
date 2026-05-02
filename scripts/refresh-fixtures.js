#!/usr/bin/env node
// Fetches real pages from each scraper source and saves them as test fixtures.
// Run this periodically to keep fixtures in sync with live site structure.
// Committed fixtures are what unit tests run against.
//
// Usage:
//   node scripts/refresh-fixtures.js              # all sources
//   node scripts/refresh-fixtures.js tiremart     # one source

const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '../test/fixtures');

const SIMPLETIRE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
};

const SIMPLETIRE_CATEGORIES = [
    { url: 'https://simpletire.com/categories/mud-terrain-tires', slug: 'mud-terrain' },
    { url: 'https://simpletire.com/categories/all-terrain-tires', slug: 'all-terrain' },
];

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
    return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ── Interco ───────────────────────────────────────────────────────────────────

async function refreshInterco() {
    process.stdout.write('[interco] fetching blem-list... ');
    const res = await fetch('https://www.intercotire.com/blem-list');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    fs.writeFileSync(path.join(FIXTURES, 'interco.html'), html);
    console.log(`saved (${Math.round(html.length / 1024)}KB)`);
}

// ── TireMart ──────────────────────────────────────────────────────────────────

async function refreshTireMart() {
    process.stdout.write('[tiremart] fetching blem page... ');
    const res = await fetch('https://www.tiremart.com/blemished-tires/', {
        headers: { 'User-Agent': 'BlemBot/1.0 (+tire-tracking-bot)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    fs.writeFileSync(path.join(FIXTURES, 'tiremart.html'), html);
    console.log(`saved (${Math.round(html.length / 1024)}KB)`);
}

// ── TreadWright ───────────────────────────────────────────────────────────────

async function refreshTreadWright() {
    process.stdout.write('[treadwright] fetching products.json... ');
    const products = [];
    let page = 1;
    while (true) {
        const res = await fetch(`https://www.treadwright.com/collections/filter/products.json?limit=250&page=${page}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.products || data.products.length === 0) break;
        products.push(...data.products);
        if (data.products.length < 250) break;
        page++;
    }

    const tires = products.filter(p => p.product_type === 'Tire');
    const blems = tires.filter(p => p.tags.map(t => t.toLowerCase()).includes('blemish'));
    const nonBlems = tires.filter(p => !p.tags.map(t => t.toLowerCase()).includes('blemish'));

    const selected = [...pickN(blems, 5), ...pickN(nonBlems, 5)];
    fs.writeFileSync(path.join(FIXTURES, 'treadwright.json'), JSON.stringify(selected, null, 2));
    console.log(`saved ${selected.length} products (${Math.min(blems.length, 5)} blem, ${Math.min(nonBlems.length, 5)} non-blem) from ${tires.length} total`);
}

// ── SimpleTire ────────────────────────────────────────────────────────────────
// Navigation: category → brand+category page → product line page → SKU page
// SKU URLs live in JS/JSON data in the page source, not in href attributes.

// Category page → brand+category links like /brands/X/categories/mud-terrain
function extractBrandCategoryUrls(html) {
    const urls = new Set();
    for (const m of html.matchAll(/href="(\/brands\/[^"]+\/categories\/[^"]+)"/g)) {
        urls.add(`https://simpletire.com${m[1]}`);
    }
    return [...urls];
}

// Brand+category page → product line links like /brands/X/model-name (exactly 3 path segments)
function extractProductLineUrls(html) {
    const urls = new Set();
    for (const m of html.matchAll(/href="(\/brands\/[^"]+)"/g)) {
        const path = m[1];
        if (path.includes('/categories/')) continue;
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 3) urls.add(`https://simpletire.com${path}`);
    }
    return [...urls];
}

// Product line page → SKU page full URLs embedded in JS/JSON data
function extractSkuUrls(html) {
    const urls = new Set();
    for (const m of html.matchAll(/"(https:\/\/simpletire\.com\/[^"]+\/p\/\d+[^"]*)"/g)) {
        urls.add(m[1].split('?')[0]);
    }
    return [...urls];
}

async function refreshSimpleTire() {
    const cat = pick(SIMPLETIRE_CATEGORIES);
    process.stdout.write(`[simpletire] category:${cat.slug}... `);

    const catRes = await fetch(cat.url, { headers: SIMPLETIRE_HEADERS });
    if (!catRes.ok) throw new Error(`HTTP ${catRes.status} on category`);
    const catHtml = await catRes.text();

    const brandCatUrls = extractBrandCategoryUrls(catHtml);
    if (brandCatUrls.length === 0) throw new Error('no brand+category URLs on category page');
    const brandCatUrl = pick(brandCatUrls);
    process.stdout.write(`brand:${brandCatUrl.split('/brands/')[1].split('/')[0]}... `);

    await sleep(2000);
    const brandCatRes = await fetch(brandCatUrl, { headers: SIMPLETIRE_HEADERS });
    if (!brandCatRes.ok) throw new Error(`HTTP ${brandCatRes.status} on brand+category`);
    const brandCatHtml = await brandCatRes.text();

    const lineUrls = extractProductLineUrls(brandCatHtml);
    if (lineUrls.length === 0) throw new Error('no product line URLs on brand+category page');
    const lineUrl = pick(lineUrls);
    process.stdout.write(`line:${lineUrl.split('/').pop()}... `);

    await sleep(2000);
    const lineRes = await fetch(lineUrl, { headers: SIMPLETIRE_HEADERS });
    if (!lineRes.ok) throw new Error(`HTTP ${lineRes.status} on product line`);
    const lineHtml = await lineRes.text();

    const skuUrls = extractSkuUrls(lineHtml);
    if (skuUrls.length === 0) throw new Error('no SKU URLs found on product line page');
    const skuUrl = pick(skuUrls);
    process.stdout.write(`sku:${skuUrl.split('/p/')[1]}... `);

    await sleep(2000);
    const skuRes = await fetch(skuUrl, { headers: SIMPLETIRE_HEADERS });
    if (!skuRes.ok) throw new Error(`HTTP ${skuRes.status} on SKU page`);
    const skuHtml = await skuRes.text();

    fs.writeFileSync(path.join(FIXTURES, 'simpletire.html'), skuHtml);
    fs.writeFileSync(path.join(FIXTURES, 'simpletire.url'), skuUrl);
    console.log(`saved (${Math.round(skuHtml.length / 1024)}KB) — ${skuUrl}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SOURCES = {
    interco:     refreshInterco,
    tiremart:    refreshTireMart,
    treadwright: refreshTreadWright,
    simpletire:  refreshSimpleTire,
};

async function main() {
    const target = process.argv[2];
    const targets = target
        ? { [target]: SOURCES[target] }
        : SOURCES;

    if (target && !SOURCES[target]) {
        console.error(`Unknown source: ${target}. Available: ${Object.keys(SOURCES).join(', ')}`);
        process.exit(1);
    }

    let anyFailed = false;
    for (const [name, fn] of Object.entries(targets)) {
        try {
            await fn();
        } catch (err) {
            console.log(`\r[${name}] ❌  ${err.message}`);
            anyFailed = true;
        }
    }

    if (anyFailed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
