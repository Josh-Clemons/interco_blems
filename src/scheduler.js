require('dotenv').config();
const cron = require('node-cron');
const log = require('./logger');

// Every 30 minutes during business hours, Mon-Fri.
// node-cron uses 6-field format: second minute hour day month weekday
const DEFAULT_SCHEDULE = '0 */30 6-18 * * 1-5';

/**
 * Starts the cron scheduler.
 * @param {Function} job - async function to call on each tick
 */
function startScheduler(job) {
    const schedule = process.env.CRON_SCHEDULE || DEFAULT_SCHEDULE;

    if (!cron.validate(schedule)) {
        throw new Error(`Invalid CRON_SCHEDULE: "${schedule}"`);
    }

    log.info(`[scheduler] Schedule: "${schedule}" (Mon-Fri, 6am-6pm, every 30 min)`);

    cron.schedule(schedule, async () => {
        log.info(`[scheduler] Tick at ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
        try {
            await job();
        } catch (err) {
            log.error('[scheduler] Job error:', err);
        }
    }, {
        timezone: 'America/Chicago'
    });
}

// TODO Move schedule to .env with other schedule
// Nightly full crawl — 12 AM Central, every day
const DEFAULT_NIGHTLY = '0 0 0 * * *';

function startNightly(job) {
    const schedule = process.env.NIGHTLY_SCHEDULE || DEFAULT_NIGHTLY;

    if (!cron.validate(schedule)) {
        throw new Error(`Invalid NIGHTLY_SCHEDULE: "${schedule}"`);
    }

    log.info(`[scheduler] Nightly schedule: "${schedule}" (default: 2 AM Central daily)`);

    cron.schedule(schedule, async () => {
        log.info(`[scheduler] Nightly tick at ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
        try {
            await job();
        } catch (err) {
            log.error('[scheduler] Nightly job error:', err);
        }
    }, {
        timezone: 'America/Chicago'
    });
}

module.exports = { startScheduler, startNightly };
