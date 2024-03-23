const { Client } = require('pg');

const sqlClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'blems',
    user: 'postgres',
    password: 'password'
});
async function startConnection()
{
    return sqlClient.connect()
        .then(() => {
            console.log('Connected to PostgreSQL database');
        })
        .catch((err) => {
            console.error('Error connecting to PostgreSQL database', err);
        });
}
async function endConnection ()
{
    return sqlClient.end()
        .then(() => {
            console.log('Connection to PostgreSQL closed');
        })
        .catch((err) => {
            console.error('Error closing connection', err);
        });
}

module.exports = {
    startConnection,
    endConnection,
    sqlClient
};
