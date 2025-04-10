const {getBlemSqlClient, startConnection, endConnection} = require('./server/clients/sqlClient.js');
const {logger} = require('./server/clients/logClient.js');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {saveUpdateEmail} = require('./server/service/emailService.js');
const {compareResults, updateTires, getTimeUntilNextRun} = require('./server/utils/utilShiznit.js');

let runs = 0;
let successfulRuns = 0;
let errorRuns = 0;
const run = () => fetchTiresFromInterco().then(async results => {
    const sqlClient = getBlemSqlClient()
    await startConnection(sqlClient);
    const databaseTires = await fetchTiresFromDatabase(sqlClient);
    const updatedTires = updateTires(results, databaseTires);
    const savedTires = await saveTiresToDatabase(updatedTires, sqlClient);
    const {notifyTires} = await saveUpdateEmail(savedTires);
    // only save tires to database if they changed after sending an email
    compareResults(savedTires, notifyTires) || await saveTiresToDatabase(notifyTires, sqlClient);
    await endConnection(sqlClient);

    logger.info(`${++successfulRuns} successful runs (${++runs} total) in this cycle.`);
}).catch(e => {
    logger.error(`${++errorRuns} failed runs (${++runs} total) in this cycle.\n`, e);
}).finally(() => {
    scheduleNextRun();
});

function scheduleNextRun() {
    setTimeout(() => {
        run();
    }, getTimeUntilNextRun());
}
run();








