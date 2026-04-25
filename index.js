require('dotenv').config();

const log                  = require('./src/logger');
const scrapers             = require('./src/scrapers');
const { diff, hasAlerts }  = require('./src/tracker');
const { filterForPublicAlert, hasPublicAlerts } = require('./src/alertFilter');
const { sendAlert }        = require('./src/notifier/email');
const { sendDiscordAlert } = require('./src/notifier/discord');
const { dispatchSubscriptionAlerts } = require('./src/subscriptions');
const subDispatch = require('./src/notifier/subscriptionDispatch');
const { startScheduler }   = require('./src/scheduler');
const { startNightly }     = require('./src/scheduler');
const repo = require('./src/db/repository');

const { getClient, login } = require('./src/bot/client');
const { registerCommands } = require('./src/bot/commands');
const { attachInteractionHandler } = require('./src/bot/interactions');

const ALERTS_ENABLED = (process.env.ALERTS_ENABLED ?? 'true').toLowerCase() !== 'false';

/**
 * Runs all scrapers, diffs against DB, persists changes, and sends alerts.
 * Guarded by a mutex so overlapping scheduler ticks are skipped.
 */
let running = false;
async function runAll() {
    if (running) {
        log.info('[run] Already running — skipping this tick');
        return;
    }
    running = true;
    try {
        await _runAll();
    } finally {
        running = false;
    }
}

async function _runAll() {
    for (const scraper of scrapers) {
        log.info(`[run] Scraping ${scraper.name} (${scraper.url})`);
        const runId = repo.startScrapeRun(scraper.name);
        let scraped;

        try {
            scraped = await scraper.scrape();
            log.info(`[run] ${scraper.name}: ${scraped.length} tires found`);
        } catch (err) {
            log.error(`[run] ${scraper.name} scrape failed:`, err.message);
            repo.finishScrapeRun(runId, { tires_found: 0, added: 0, reactivated: 0, removed: 0, changed: 0, error: err.message });
            continue;
        }

        const dbRows = repo.getTiresBySource(scraper.name);
        const result = diff(scraped, dbRows);

        log.info(
            `[run] ${scraper.name}: ` +
            `+${result.added.length} new, ` +
            `~${result.reactivated.length} reactivated, ` +
            `${result.changed.length} changed, ` +
            `-${result.removed.length} removed, ` +
            `${result.unchanged.length} unchanged`
        );

        for (const tire of result.added) {
            const row = repo.upsertActiveTire(scraper.name, tire);
            if (row?.id) repo.logTireEvent(row.id, 'added', {}, tire);
        }
        for (const tire of result.reactivated) {
            repo.upsertActiveTire(scraper.name, tire);
            repo.logTireEvent(tire.id, 'returned', { price_cents: tire.old_price_cents, quantity_n: tire.old_quantity_n, stock_state: tire.old_stock_state }, tire);
        }
        for (const tire of result.changed) {
            repo.updateChangedTire(tire);
            repo.logTireEvent(tire.id, 'changed', { price_cents: tire.old_price_cents, quantity_n: tire.old_quantity_n, stock_state: tire.old_stock_state }, tire);
        }
        for (const tire of result.unchanged) {
            repo.touchTire(tire.id);
        }
        if (result.removed.length > 0) {
            repo.deactivateTires(result.removed.map(t => t.id));
            for (const tire of result.removed) {
                repo.logTireEvent(tire.id, 'removed', tire, {});
            }
        }

        repo.finishScrapeRun(runId, { tires_found: scraped.length, added: result.added.length, reactivated: result.reactivated.length, removed: result.removed.length, changed: result.changed.length, error: null });

        if (!hasAlerts(result)) continue;

        if (!ALERTS_ENABLED) {
            log.info(`[run] ALERTS_ENABLED=false — skipping notifications (${result.added.length} new, ${result.reactivated.length} reactivated suppressed)`);
            continue;
        }

        // Enrich alert-eligible tires with the source name. Scrapers don't set
        // it on their own output, but downstream filters/matchers need it.
        const enrich = (t) => ({ ...t, source: scraper.name });
        const enrichedDiff = {
            added:       result.added.map(enrich),
            reactivated: result.reactivated.map(enrich),
            changed:     result.changed.map(enrich),
            removed:     result.removed.map(enrich),
            unchanged:   result.unchanged,
        };

        // --- Public feed (email + alert channel) ---
        const publicDiff = filterForPublicAlert(enrichedDiff);
        if (hasPublicAlerts(publicDiff)) {
            try {
                const emailData = await sendAlert(publicDiff, scraper.name);
                if (emailData) {
                    repo.logEmail(emailData);

                    const fresh = repo.getTiresBySource(scraper.name);
                    const alertedSkus = new Set([
                        ...publicDiff.added.map(t => t.sku),
                        ...publicDiff.reactivated.map(t => t.sku),
                    ]);
                    const notifyIds = fresh
                        .filter(r => alertedSkus.has(r.sku))
                        .map(r => r.id);
                    repo.markNotified(notifyIds);
                }
            } catch (err) {
                log.error('[run] Email send failed:', err.message);
            }

            try {
                await sendDiscordAlert(publicDiff);
            } catch (err) {
                log.error('[run] Discord alert failed:', err.message);
            }
        } else {
            log.info(`[run] No tires pass PUBLIC_ALERT_MIN_DIAMETER — skipping public feed`);
        }

        // --- Per-user subscription fan-out (always on the full diff) ---
        try {
            const stats = await dispatchSubscriptionAlerts(enrichedDiff, {
                getActiveSubscriptions: repo.getActiveSubscriptions,
                sendDm:                 subDispatch.sendDm,
                sendChannel:            subDispatch.sendChannel,
                buildEmbedsForUser:     subDispatch.buildEmbedsForUser,
            });
            if (stats.usersNotified || stats.dmFailures) {
                log.info(`[run] Subscriptions: ${stats.usersNotified} notified, ${stats.dmFailures} failures`);
            }
        } catch (err) {
            log.error('[run] Subscription dispatch failed:', err.message);
        }
    }
}

// --- Bootstrap ---
// The Discord bot is the long-running process. It connects first, registers
// its slash commands, attaches the interaction handler, and only then does
// the scheduler begin running scrapes.

/**
 * Nightly full crawl of SimpleTire — scrapes every SKU page regardless of cache.
 */
async function runSimpleTireFull() {
    if (running) {
        log.info('[nightly] runAll in progress — waiting for it to finish');
        // Poll every 30s until the regular run completes
        while (running) await new Promise(r => setTimeout(r, 30_000));
    }
    running = true;
    const simpletire = require('./src/scrapers/simpletire');
    const runId = repo.startScrapeRun(simpletire.name);
    try {
        log.info(`[nightly] Starting SimpleTire full crawl`);
        const scraped = await simpletire.scrape({ full: true });
        log.info(`[nightly] SimpleTire full crawl: ${scraped.length} tires`);

        const dbRows = repo.getTiresBySource(simpletire.name);
        const result = diff(scraped, dbRows);
        log.info(
            `[nightly] simpletire: ` +
            `+${result.added.length} new, ` +
            `~${result.reactivated.length} reactivated, ` +
            `${result.changed.length} changed, ` +
            `-${result.removed.length} removed, ` +
            `${result.unchanged.length} unchanged`
        );

        for (const tire of result.added) {
            const info = repo.upsertActiveTire(simpletire.name, tire);
            const tireId = info.lastInsertRowid || repo.getTireBySourceSku(simpletire.name, tire.sku)?.id;
            if (tireId) repo.logTireEvent(tireId, 'added', {}, tire);
        }
        for (const tire of result.reactivated) {
            repo.upsertActiveTire(simpletire.name, tire);
            repo.logTireEvent(tire.id, 'returned', { price_cents: tire.old_price_cents, quantity_n: tire.old_quantity_n, stock_state: tire.old_stock_state }, tire);
        }
        for (const tire of result.changed) {
            repo.updateChangedTire(tire);
            repo.logTireEvent(tire.id, 'changed', { price_cents: tire.old_price_cents, quantity_n: tire.old_quantity_n, stock_state: tire.old_stock_state }, tire);
        }
        for (const tire of result.unchanged) {
            repo.touchTire(tire.id);
        }
        if (result.removed.length > 0) {
            repo.deactivateTires(result.removed.map(t => t.id));
            for (const tire of result.removed) {
                repo.logTireEvent(tire.id, 'removed', tire, {});
            }
        }

        repo.finishScrapeRun(runId, { tires_found: scraped.length, added: result.added.length, reactivated: result.reactivated.length, removed: result.removed.length, changed: result.changed.length, error: null });

        if (hasAlerts(result) && ALERTS_ENABLED) {
            const enrich = (t) => ({ ...t, source: simpletire.name });
            const enrichedDiff = {
                added:       result.added.map(enrich),
                reactivated: result.reactivated.map(enrich),
                changed:     result.changed.map(enrich),
                removed:     result.removed.map(enrich),
                unchanged:   result.unchanged,
            };

            const publicDiff = filterForPublicAlert(enrichedDiff);
            if (hasPublicAlerts(publicDiff)) {
                try { await sendDiscordAlert(publicDiff); } catch (err) {
                    log.error('[nightly] Discord alert failed:', err.message);
                }
            }

            try {
                await dispatchSubscriptionAlerts(enrichedDiff, {
                    getActiveSubscriptions: repo.getActiveSubscriptions,
                    sendDm:                 subDispatch.sendDm,
                    sendChannel:            subDispatch.sendChannel,
                    buildEmbedsForUser:     subDispatch.buildEmbedsForUser,
                });
            } catch (err) {
                log.error('[nightly] Subscription dispatch failed:', err.message);
            }
        }
    } catch (err) {
        log.error('[nightly] SimpleTire full crawl failed:', err.message);
        repo.finishScrapeRun(runId, { tires_found: 0, added: 0, reactivated: 0, removed: 0, changed: 0, error: err.message });
    } finally {
        running = false;
    }
}

async function main() {
    log.info('[blem-tracker] Starting up...');
    log.info(`[blem-tracker] ALERTS_ENABLED=${ALERTS_ENABLED}`);
    log.info(`[blem-tracker] PUBLIC_ALERT_MIN_DIAMETER=${process.env.PUBLIC_ALERT_MIN_DIAMETER ?? '35'}`);

    const client = getClient();

    // Attach handlers BEFORE login so we don't miss any early events
    attachInteractionHandler(client);

    client.once('clientReady', async () => {
        log.info(`[bot] Logged in as ${client.user.tag}`);

        try {
            await registerCommands();
        } catch (err) {
            log.error('[bot] Failed to register commands:', err.message);
        }

        // First scrape immediately, then on schedule
        runAll();
        startScheduler(runAll);
        startNightly(runSimpleTireFull);
    });

    client.on('error',       (err) => log.error('[bot] Client error:', err));
    client.on('shardError',  (err) => log.error('[bot] Shard error:', err));

    try {
        await login();
    } catch (err) {
        log.error('[bot] Login failed:', err.message);
        process.exit(1);
    }
}

if (process.argv.includes('--simple-tire')) {
    runSimpleTireFull().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
    main();
}
