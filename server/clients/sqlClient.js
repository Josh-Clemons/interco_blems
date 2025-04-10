const { Client } = require('pg');
const {logger } = require('.//logClient.js');
function getBlemSqlClient() {
    return new Client({
        host: 'localhost',
        port: 5432,
        database: 'blems',
        user: 'postgres',
        password: 'password'
    });
}

function getEmailSqlClient() {
    return new Client({
        host: 'localhost',
        port: 5432,
        database: 'email_service',
        user: 'postgres',
        password: 'password'
    });
}

async function startConnection(sqlClient)
{
    return sqlClient.connect()
        .then(() => {
            logger.info('Connected to PostgreSQL database');
        })
        .catch((err) => {
            logger.error('Error connecting to PostgreSQL database', err);
        });
}
async function endConnection (sqlClient)
{
    return sqlClient.end()
        .then(() => {
            logger.info('Connection to PostgreSQL closed');
        })
        .catch((err) => {
            logger.error('Error closing connection', err);
        });
}

module.exports = {
    startConnection,
    endConnection,
    getBlemSqlClient,
    getEmailSqlClient
};
