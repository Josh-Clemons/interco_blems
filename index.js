const {getBlemSqlClient, startConnection, endConnection} = require('./server/clients/sqlClient.js');
const {logger} = require('./server/clients/logClient.js');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {saveUpdateEmail} = require('./server/service/emailService.js');
const {compareResults, updateTires} = require('./server/utils/utilShiznit.js');

const run = () => fetchTiresFromInterco().then(async results => {
    const sqlClient = getBlemSqlClient()
    await startConnection(sqlClient);
    const databaseTires = await fetchTiresFromDatabase(sqlClient);
    const updatedTires = updateTires(results, databaseTires);
    const savedTires = await saveTiresToDatabase(updatedTires, sqlClient);
    const {notifyTires} = await saveUpdateEmail(savedTires);
    compareResults(savedTires, notifyTires) || await saveTiresToDatabase(notifyTires, sqlClient);
    await endConnection(sqlClient);

    logger.info(`Run completed successfully`);
}).catch(e => {
    logger.error(`Error in run\n`, e);
});

run();








