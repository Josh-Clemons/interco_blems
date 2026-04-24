/**
 * Lightweight logger that prefixes every message with a timestamp and PID.
 *
 * Usage:
 *   const log = require('./logger');
 *   log.info('[run] Starting...');   // 2026-04-20T12:30:45.123Z [PID:1234] [run] Starting...
 *   log.error('[run] Failed:', err); // same prefix, goes to stderr
 *   log.warn('[simpletire] ...');    // same prefix, goes to stderr
 */

const PID = process.pid;

function ts() {
    return new Date().toISOString();
}

function info(...args) {
    console.log(`${ts()} [${PID}]`, ...args);
}

function warn(...args) {
    console.warn(`${ts()} [${PID}]`, ...args);
}

function error(...args) {
    console.error(`${ts()} [${PID}]`, ...args);
}

module.exports = { info, warn, error };
