const {startConnection, endConnection} = require('./server/modules/sqlClient.js');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('./server/repository/blemRepository.js');
const {fetchTiresFromInterco} = require('./server/service/intercoService.js');
const {updateTires} = require('./server/utils/utilShiznit.js');
const {sendUpdateEmail} = require('./server/service/emailService.js');

fetchTiresFromInterco().then(async r => {
    await startConnection();
    const databaseTires = await fetchTiresFromDatabase();
    const updatedTires = updateTires(r, databaseTires);
    await saveTiresToDatabase(updatedTires);
    await sendUpdateEmail();
    await endConnection();

});










