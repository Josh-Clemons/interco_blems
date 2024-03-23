const {startConnection, endConnection} = require('./server/modules/sqlClient.js');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {getTimeUntilNextRun,updateTires} = require('./server/utils/utilShiznit.js');
const {sendUpdateEmail} = require('./server/service/emailService.js');

let runs = 0;
fetchTiresFromInterco().then(async r => {
    await startConnection();
    const databaseTires = await fetchTiresFromDatabase();
    let updatedTires = updateTires(r, databaseTires);
    const {tires} = await sendUpdateEmail(updatedTires);
    await saveTiresToDatabase(tires);
    await endConnection();

    console.log(`${new Date().toLocaleString()} - Run number: ${++runs}`);
    setTimeout(() => {
        fetchTiresFromInterco()
    }, getRandomInt(1000 * 60 * 30, 1000 * 60 * 60));
});


function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    const milliseconds = Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
    console.log(`Next run scheduled in ${milliseconds/1000/60} minutes`);

    return milliseconds;
}







