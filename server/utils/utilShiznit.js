function updateTires(searchTires, databaseTires)
{
    let updatedTires = [];

    // checks if tires from search results are not in the database, adds them to the list
    for(let tire of searchTires){
        tire.id = null;
        let match = databaseTires.find((dbTire) => {
            return dbTire.sku === tire.sku;
        });


        if(match){
            tire.id = match.id;
            tire.discontinued = false;
            match.discontinued ? tire.new = true : tire.new = false;
            // notify only if tire quantity or price has changed
            if(match.quantity === tire.quantity && match.price === tire.price && !match.notify){
                tire.notify = false;
            }
        }
        updatedTires.push(tire);
    }

    // checks if tire in database is not in the search results, discontinue it
    for(let tire of databaseTires){
        let match = updatedTires.find((searchTire) => {
            return searchTire.sku === tire.sku;
        });
        if(!match){
            tire.new = false;
            tire.notify = false;
            tire.discontinued = true;
            updatedTires.push(tire);
        }
    }

    return updatedTires
}


module.exports = {
    updateTires
}