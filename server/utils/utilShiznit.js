function updateTires(searchTires, databaseTires)
{
    let updatedTires = [];

    // checks if tires from search results are not in the database, adds them to the list
    for(let tire of searchTires){
        let match = databaseTires.find((dbTire) => {
            return dbTire.sku === tire.sku;
        });


        if(match){
            // notify if tire quantity or price has changed
            if(match.quantity !== tire.quantity || match.price !== tire.price){
                tire.notify = true;
            }
        }
        tire.discontinued = false;
        updatedTires.push(tire);
    }

    // checks if tire in database is not in the search results, discontinue it
    for(let tire of databaseTires){
        let match = updatedTires.find((searchTire) => {
            return searchTire.sku === tire.sku;
        });
        if(!match){
            tire.new = false;
            tire.discontinued = true;
            updatedTires.push(tire);
        }
    }

    return updatedTires
}


module.exports = {
    updateTires
}