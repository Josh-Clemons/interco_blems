const {endConnection, getEmailSqlClient, startConnection} = require ("../clients/sqlClient");
const {logger} = require('../clients/logClient.js');

async function saveEmail(emailData) {
    const sqlClient = getEmailSqlClient();
    await startConnection(sqlClient);
    const query = `
        INSERT INTO "email" ("email_to", "subject", "body")
        VALUES ($1, $2, $3)
        RETURNING id;
    `;
    const values = [emailData.to.join(','), emailData.subject, emailData.body];
    return sqlClient.query(query, values).then((result) => {
        logger.info('Email saved, id: ', result.rows[0].id);
        return result.rows[0].id;
    }).catch((error) => {
        logger.error('Error saving email', error);
    }).finally(() => {
        endConnection(sqlClient);
    });
}

module.exports = {
    saveEmail
}