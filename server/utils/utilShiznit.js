function updateTires(searchTires, databaseTires)
{
    let updatedTires = [];
    console.log('Checking for new and updated tires.');

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

function getTimeUntilNextRun() {
    let now = new Date();
    let nextRunTime;

    // Check if it's a weekday
    if (now.getDay() >= 1 && now.getDay() <= 5) {
        // Check if it's between 6am and 6pm
        if (now.getHours() >= 6 && now.getHours() < 18) {
            // Calculate time until next half hour mark
            nextRunTime = new Date(now);
            nextRunTime.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
        } else if (now.getHours() < 6) {
            // Calculate time until 6am of the same day
            nextRunTime = new Date(now);
            nextRunTime.setHours(6, 0, 0, 0);
        } else {
            // Calculate time until 6am of the next day
            nextRunTime = new Date(now);
            nextRunTime.setDate(now.getDate() + 1);
            nextRunTime.setHours(6, 0, 0, 0);
        }
    } else {
        // Calculate time until next Monday at 6am
        nextRunTime = new Date(now);
        nextRunTime.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7));
        nextRunTime.setHours(6, 0, 0, 0);
    }

    console.log('Next run time: ', nextRunTime);

    // return the difference in milliseconds
    return nextRunTime - now;
}


module.exports = {
    updateTires,
    getTimeUntilNextRun
}