#!/usr/bin/env node
// Runs each scraper (or one named source) and validates output.
// Does NOT write to the DB. Exits non-zero if any non-circuit-open source fails.
//
// Usage:
//   node scripts/smoke-scrapers.js           # all sources
//   node scripts/smoke-scrapers.js interco   # one source

const scrapers = require('../src/scrapers/index');

const REQUIRED_FIELDS = ['sku', 'size', 'price_cents'];
const FILL_RATE_THRESHOLD = 0.80;

async function validate(scraper) {
    let tires;
    try {
        tires = await scraper.scrape();
    } catch (err) {
        if (err.circuitOpen) {
            const cooldownUntil = new Date(err.message.match(/until (.+?)\)/)?.[1]).toLocaleTimeString();
            return { status: 'warn', reason: `circuit open — cooldown until ${cooldownUntil || 'unknown'}` };
        }
        return { status: 'fail', reason: err.message };
    }

    if (!tires || tires.length === 0) {
        return { status: 'fail', reason: 'no results returned' };
    }

    const stats = {};
    for (const field of REQUIRED_FIELDS) {
        const filled = tires.filter(t => t[field] != null && t[field] !== '').length;
        stats[field] = filled / tires.length;
    }

    const lowFill = REQUIRED_FIELDS.filter(f => stats[f] < FILL_RATE_THRESHOLD);
    if (lowFill.length > 0) {
        return {
            status: 'fail',
            reason: `low fill rate: ${lowFill.map(f => `${f}=${pct(stats[f])}`).join(', ')}`,
            tires: tires.length,
            stats,
        };
    }

    const priced = tires.filter(t => t.price_cents != null);
    const badPrice = priced.filter(t => t.price_cents <= 0);
    if (badPrice.length > 0) {
        return { status: 'fail', reason: `${badPrice.length} tires with price_cents <= 0`, tires: tires.length, stats };
    }

    return { status: 'pass', tires: tires.length, stats };
}

function pct(n) {
    return `${Math.round(n * 100)}%`;
}

async function main() {
    const targetName = process.argv[2];
    const targets = targetName
        ? scrapers.filter(s => s.name === targetName)
        : scrapers;

    if (targetName && targets.length === 0) {
        console.error(`Unknown source: ${targetName}`);
        console.error(`Available: ${scrapers.map(s => s.name).join(', ')}`);
        process.exit(1);
    }

    let anyFailed = false;

    for (const scraper of targets) {
        const label = scraper.nightly ? `${scraper.name} (nightly)` : scraper.name;
        process.stdout.write(`[${label}] running...`);
        const result = await validate(scraper);

        if (result.status === 'pass') {
            const statStr = REQUIRED_FIELDS.map(f => `${f}: ${pct(result.stats[f])}`).join(' | ');
            console.log(`\r[${label}] ✅  ${result.tires} tires | ${statStr}`);
        } else if (result.status === 'warn') {
            console.log(`\r[${label}] ⚠️  ${result.reason}`);
        } else {
            const detail = result.tires ? ` (${result.tires} tires)` : '';
            console.log(`\r[${label}] ❌  ${result.reason}${detail}`);
            anyFailed = true;
        }
    }

    if (anyFailed) process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
