// database connection
const {getSqlClient, startConnection, endConnection} = require('./server/clients/sqlClient.js');
// logger
const {logger} = require('./server/clients/logClient.js');
// repository
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
// services
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {sendUpdateEmail} = require('./server/service/emailService.js');
// utils
const {compareResults, getRandomInt, updateTires} = require('./server/utils/utilShiznit.js');

let runs = 0;
const run = () => fetchTiresFromInterco().then(async r => {
    const sqlClient = getSqlClient()
    await startConnection(sqlClient);
    const databaseTires = await fetchTiresFromDatabase(sqlClient);
    const updatedTires = updateTires(r, databaseTires);
    const savedTires = await saveTiresToDatabase(updatedTires, sqlClient);
    const {notifyTires} = await sendUpdateEmail(savedTires);
    // only save tires to database if they changed after sending an email
    compareResults(savedTires, notifyTires) || await saveTiresToDatabase(notifyTires, sqlClient);
    await endConnection(sqlClient);

    logger.info(`Run finished, number: ${++runs}`);
    setTimeout(() => {
        run();
    }, getRandomInt(1000 * 60 * 30, 1000 * 60 * 60)); // 30-60 minutes
});


run();








