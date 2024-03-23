const {getSqlClient, startConnection, endConnection} = require('./server/modules/sqlClient.js');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {getTimeUntilNextRun,updateTires} = require('./server/utils/utilShiznit.js');
const {sendUpdateEmail} = require('./server/service/emailService.js');

let runs = 0;
const run = () => fetchTiresFromInterco().then(async r => {
    const sqlClient = getSqlClient()
    await startConnection(sqlClient);
    const databaseTires = await fetchTiresFromDatabase(sqlClient);
    let updatedTires = updateTires(r, databaseTires);
    const {tires} = await sendUpdateEmail(updatedTires);
    await saveTiresToDatabase(tires, sqlClient);
    await endConnection(sqlClient);

    console.log(`Run finished at: ${new Date().toLocaleString()} - Run number: ${++runs}`);
    setTimeout(() => {
        run();
    }, getRandomInt(1000 * 60 * 3, 1000 * 60 * 10));
});

run();


function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    const milliseconds = Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
    console.log(`Next run scheduled in ${milliseconds/1000/60} minutes`);

    return milliseconds;
}







