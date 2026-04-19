require('dotenv').config();
const cron = require('node-cron');

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

    console.log(`[scheduler] Schedule: "${schedule}" (Mon-Fri, 6am-6pm, every 30 min)`);

    cron.schedule(schedule, async () => {
        console.log(`[scheduler] Tick at ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
        try {
            await job();
        } catch (err) {
            console.error('[scheduler] Job error:', err);
        }
    }, {
        timezone: 'America/Chicago'
    });
}

module.exports = { startScheduler };
