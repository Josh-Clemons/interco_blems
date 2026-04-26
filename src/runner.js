/**
 * Runtime scrape trigger registry.
 *
 * index.js calls register() once at startup to hand off its scrape functions.
 * Command handlers (e.g. /admin scrape) call triggerAll / triggerOne without
 * needing to import from index.js.
 */

let _runAll = null;
let _runOne  = null;

function register(runAll, runOne) {
    _runAll = runAll;
    _runOne  = runOne;
}

function call(fn, ...args) {
    if (!fn) throw new Error('Runner not registered');
    return fn(...args);
}

const triggerAll  = ()     => call(_runAll);
const triggerOne  = (name) => call(_runOne, name);

module.exports = { register, triggerAll, triggerOne };
