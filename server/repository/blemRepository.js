const {sqlClient} = require("../modules/sqlClient");
async function fetchTiresFromDatabase ()
{
    console.log('Fetching tires from database');

    const query = `SELECT * FROM "blems";`;
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
        INSERT INTO "blems" ("id", "sku", "brand", "size", "quantity", "price", "discontinued", "notify", "new")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE
            SET sku = excluded.sku, brand = excluded.brand, size = excluded.size, quantity = excluded.quantity,
                price = excluded.price, discontinued = excluded.discontinued,
                notify = excluded.notify, new = excluded.new, updated_at = now();
    `;
    for(let tire of tires){
        const values = [tire.id, tire.sku, tire.brand, tire.size,
            tire.quantity, tire.price, tire.discontinued, tire.notify, tire.new];
        await sqlClient.query(query, values).then((result) => {
            console.log('Tire saved to database, id: ', tire.id);
        }).catch((error) => {
            console.log('Error saving tire to database, id: ', tire.id, '\n', error);
        });
    }
}

module.exports = {
    fetchTiresFromDatabase,
    saveTiresToDatabase
};