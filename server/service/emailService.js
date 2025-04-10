const {logger} = require('../clients/logClient');
const {getEmailSqlClient, startConnection, endConnection} = require('../clients/sqlClient');

const NOTIFY_LIST = ['mrjoshc@gmail.com']
async function saveUpdateEmail(tires) {
    let newTires = tires.filter(tire => tire.new === true && tire.discontinued === false);
    let changedTires = tires.filter(tire => tire.new === false && tire.notify === true && tire.discontinued === false);
    let notifyTires = JSON.parse(JSON.stringify(tires)); // create a deep copy of the tires array so original is not modified

    if(newTires.length === 0) {
        logger.info('Not sending email, no new tires.');
        return {notifyTires};
    }
    logger.warn('New tires found:', newTires.length);

    for(let tire of notifyTires) {
        tire.notify = false;
        tire.new = false;
    }

    let htmlBody = '<h2>New Tires</h2>' +
        `<p>${new Date().toLocaleString()}</p>`;

    newTires.forEach(tire => {
        htmlBody += `
            <p>
                SKU: ${tire.sku}<br>
                SIZE: ${tire.size}<br>
                Brand: ${tire.brand}<br>
                Price: ${tire.price}<br>
                Quantity: ${tire.quantity}<br>
            </p>
        `;
    });

    changedTires.length > 0 ? htmlBody += '<br><h2>Changed Tires</h2>' : "";
    changedTires.forEach(tire => {
        htmlBody += `
            <p>
                SKU: ${tire.sku}<br>
                SIZE: ${tire.size}<br>
                Brand: ${tire.brand}<br>
                Price: ${tire.price}<br>
                Quantity: ${tire.quantity}<br>
            </p>
        `;
    });

    // TODO (Josh) move this to a repository
    const sqlClient = getEmailSqlClient();
    await startConnection(sqlClient);
    let query = `
        INSERT INTO "email" ("email_to", "subject", "body")
        VALUES ($1, $2, $3)
        RETURNING id;
    `;
    let values = [NOTIFY_LIST.join(','), 'Interco Blem Alert!', htmlBody];
    await sqlClient.query(query, values).then((result) => {
        logger.info('Email saved, id: ', result.rows[0].id);
        endConnection(sqlClient);
        return notifyTires;
    }).catch((error) => {
        logger.error('Error saving email', error);
        endConnection(sqlClient);
    });
}

module.exports = {
    saveUpdateEmail
}