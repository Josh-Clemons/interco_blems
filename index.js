require('dotenv').config();

const scrapers             = require('./src/scrapers');
const { diff, hasAlerts }  = require('./src/tracker');
const { sendAlert }        = require('./src/notifier/email');
const { sendDiscordAlert } = require('./src/notifier/discord');
const { startScheduler }   = require('./src/scheduler');
const repo = require('./src/db/repository');

const { getClient, login } = require('./src/bot/client');
const { registerCommands } = require('./src/bot/commands');
const { attachInteractionHandler } = require('./src/bot/interactions');

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
            continue;
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

        if (hasAlerts(result)) {
            // Email
            try {
                const emailData = await sendAlert(result, scraper.name);
                if (emailData) {
                    repo.logEmail(emailData);

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

            // Discord public feed (always fires regardless of subscriptions)
            try {
                await sendDiscordAlert(result);
            } catch (err) {
                console.error('[run] Discord alert failed:', err.message);
            }
        }
    }
}

// --- Bootstrap ---
// The Discord bot is the long-running process. It connects first, registers
// its slash commands, attaches the interaction handler, and only then does
// the scheduler begin running scrapes.

async function main() {
    console.log('[blem-tracker] Starting up...');

    const client = getClient();

    // Attach handlers BEFORE login so we don't miss any early events
    attachInteractionHandler(client);

    client.once('ready', async () => {
        console.log(`[bot] Logged in as ${client.user.tag}`);

        try {
            await registerCommands();
        } catch (err) {
            console.error('[bot] Failed to register commands:', err.message);
        }

        // First scrape immediately, then on schedule
        runAll();
        startScheduler(runAll);
    });

    client.on('error',       (err) => console.error('[bot] Client error:', err));
    client.on('shardError',  (err) => console.error('[bot] Shard error:', err));

    try {
        await login();
    } catch (err) {
        console.error('[bot] Login failed:', err.message);
        process.exit(1);
    }
}

main();
