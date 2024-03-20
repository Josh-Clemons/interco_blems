const {sqlClient} = require("../modules/sqlClient");
async function fetchTiresFromDatabase ()
{
    console.log('Fetching tires from database');

    const query = `SELECT * FROM "blems" WHERE discontinued=false;`;
    return sqlClient.query(query).then((result) => {
        return result.rows;
    }).catch((error) => {
        console.log('Error fetching tires from database', error);
    });
}

async function saveTiresToDatabase (tires)
{
    console.log('Saving tires to database');
    const query = `
        INSERT INTO "blems" ("sku", "brand", "size", "quantity", "price", "discontinued")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (sku, discontinued) DO UPDATE
            SET brand = excluded.brand, size = excluded.size, quantity = excluded.quantity, 
                price = excluded.price, discontinued = excluded.discontinued, updated_at = now();
    `;
    for(let tire of tires){
        const values = [tire.sku, tire.brand, tire.size, tire.quantity, tire.price, tire.discontinued];
        await sqlClient.query(query, values).then((result) => {
            console.log('Tire saved to database, sku: ', tire.sku);
        }).catch((error) => {
            console.log('Error saving tire to database, sku: ', tire.sku, '\n', error);
        });
    }
}

module.exports = {
    fetchTiresFromDatabase,
    saveTiresToDatabase
};