#!/usr/bin/env node
/**
 * Standalone smoke test for the 4wheelparts scraper.
 *
 * Usage:
 *   node scripts/test-4wheelparts.js
 *
 * On first run with a Cloudflare challenge it will open a visible browser window
 * and wait up to 2 minutes for you to complete the verification.
 * Cookies are saved to .4wp-cookies.json and reused on subsequent runs.
 */

require('dotenv').config();
const scraper = require('../src/scrapers/4wheelparts');

(async () => {
    console.log(`Running scraper: ${scraper.name}`);
    console.log(`Entry URL: ${scraper.url}\n`);

    try {
        const tires = await scraper.scrape();
        console.log(`\n✓ Scraped ${tires.length} tires\n`);

        if (tires.length === 0) {
            console.warn('WARNING: 0 tires returned — check scraper logs above for clues');
            process.exit(1);
        }

        // Print first 3 as a sanity check
        const sample = tires.slice(0, 3);
        for (const t of sample) {
            console.log(JSON.stringify(t, null, 2));
            console.log('---');
        }

        // Quick stats
        const brands = [...new Set(tires.map(t => t.brand).filter(Boolean))];
        const cats = [...new Set(tires.map(t => t.category).filter(Boolean))];
        const withPrice = tires.filter(t => t.price_cents).length;
        const withSize = tires.filter(t => t.size).length;

        console.log('\n── Stats ──────────────────────');
        console.log(`Total tires:     ${tires.length}`);
        console.log(`With price:      ${withPrice}`);
        console.log(`With size:       ${withSize}`);
        console.log(`Brands (${brands.length}):   ${brands.slice(0, 10).join(', ')}`);
        console.log(`Categories:      ${cats.join(', ')}`);

    } catch (err) {
        console.error('Scraper threw an error:', err);
        process.exit(1);
    }
})();
