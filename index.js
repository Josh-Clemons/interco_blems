// database connection
const {getSqlClient, startConnection, endConnection} = require('./server/modules/sqlClient.js');
// repository
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
// services
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {sendUpdateEmail} = require('./server/service/emailService.js');
// utils
const {getRandomInt,updateTires} = require('./server/utils/utilShiznit.js');

let runs = 0;
const run = () => fetchTiresFromInterco().then(async r => {
    const sqlClient = getSqlClient()
    await startConnection(sqlClient);
    const databaseTires = await fetchTiresFromDatabase(sqlClient);
    const updatedTires = updateTires(r, databaseTires);
    const savedTires = await saveTiresToDatabase(updatedTires, sqlClient);
    const tires = await sendUpdateEmail(savedTires);
    await saveTiresToDatabase(tires, sqlClient);
    await endConnection(sqlClient);

    console.log(`Run finished at: ${new Date().toLocaleString()} - Run number: ${++runs}`);
    setTimeout(() => {
        run();
    }, getRandomInt(1000 * 60 * 30, 1000 * 60 * 60));
});

run();








