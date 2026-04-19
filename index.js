require('dotenv').config();

const scrapers    = require('./src/scrapers');
const { diff, hasAlerts } = require('./src/tracker');
const { sendAlert }           = require('./src/notifier/email');
const { sendDiscordAlert }    = require('./src/notifier/discord');
const { startScheduler }  = require('./src/scheduler');
const repo = require('./src/db/repository');

/**
 * Runs all scrapers, diffs against DB, persists changes, and sends alerts.
 */
async function runAll() {
    for (const scraper of scrapers) {
        console.log(`[run] Scraping ${scraper.name} (${scraper.url})`);
        let scraped;

        try {
            scraped = await scraper.scrape();
            console.log(`[run] ${scraper.name}: ${scraped.length} tires found >= 35"`);
        } catch (err) {
            console.error(`[run] ${scraper.name} scrape failed:`, err.message);
            continue; // skip this source, try others
        }

        const dbRows = repo.getTiresBySource(scraper.name);
        const result = diff(scraped, dbRows);

        console.log(
            `[run] ${scraper.name}: ` +
            `+${result.added.length} new, ` +
            `~${result.reactivated.length} reactivated, ` +
            `${result.changed.length} changed, ` +
            `-${result.removed.length} removed, ` +
            `${result.unchanged.length} unchanged`
        );

        // Persist all changes
        for (const tire of [...result.added, ...result.reactivated]) {
            repo.upsertActiveTire(scraper.name, tire);
        }
        for (const tire of result.changed) {
            repo.updateChangedTire(tire);
        }
        for (const tire of result.unchanged) {
            repo.touchTire(tire.id);
        }
        if (result.removed.length > 0) {
            repo.deactivateTires(result.removed.map(t => t.id));
        }

        // Send alerts if anything alertable happened
        if (hasAlerts(result)) {
            try {
                const emailData = await sendAlert(result, scraper.name);
                if (emailData) {
                    repo.logEmail(emailData);

                    // Mark newly inserted tires as notified
                    const fresh = repo.getTiresBySource(scraper.name);
                    const alertedSkus = new Set([
                        ...result.added.map(t => t.sku),
                        ...result.reactivated.map(t => t.sku),
                    ]);
                    const notifyIds = fresh
                        .filter(r => alertedSkus.has(r.sku))
                        .map(r => r.id);
                    repo.markNotified(notifyIds);
                }
            } catch (err) {
                console.error('[run] Email send failed:', err.message);
            }

            try {
                await sendDiscordAlert(result);
            } catch (err) {
                console.error('[run] Discord alert failed:', err.message);
            }
        }
    }
}

// Run once immediately on startup, then on schedule
console.log('[blem-tracker] Starting up...');
runAll();
startScheduler(runAll);
