const {startConnection, endConnection} = require('./server/modules/sqlClient.js');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {updateTires} = require('./server/utils/utilShiznit.js');
const {sendUpdateEmail} = require('./server/service/emailService.js');

fetchTiresFromInterco().then(async r => {
    await startConnection();
    const databaseTires = await fetchTiresFromDatabase();
    let updatedTires = updateTires(r, databaseTires);
    const {tires} = await sendUpdateEmail(updatedTires);
    await saveTiresToDatabase(tires);
    await endConnection();

});










