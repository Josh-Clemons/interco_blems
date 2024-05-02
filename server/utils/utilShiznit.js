const {logger} = require('../clients/logClient.js');

function updateTires(searchTires, databaseTires)
{
    let updatedTires = [];
    logger.info('Comparing data sets, checking for new and updated tires.');

    // checks if tires from search results are not in the database, adds them to the list
    for(let tire of searchTires){
        tire.id = null;
        let match = databaseTires.find((dbTire) => {
            return dbTire.sku === tire.sku;
        });


        if(match){
            tire.id = match.id;
            tire.discontinued = false;
            // if the database version is discontinued, but it is now in the search results, mark it as new
            match.discontinued ? tire.new = true : tire.new = false;
            // notify only if tire quantity or price has changed, if notify is currently true it should
            // stay that way as the emailService will reset it after sending an email
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
        if(!match && !tire.discontinued) {
            tire.new = false;
            tire.notify = false;
            tire.discontinued = true;
            tire.quantity = 0;
            updatedTires.push(tire);
        }
    }

    return updatedTires
}

function getTimeUntilNextRun() {
    let now = new Date();
    let nowPlusOneMinute = new Date(now);
    let nextRunTime;

    // Use 1 minute past now for calculations to avoid re-running immediately
    let delayUntilNextMinute = 60 - nowPlusOneMinute.getSeconds();
    nowPlusOneMinute.setSeconds(nowPlusOneMinute.getSeconds() + delayUntilNextMinute);

    // Check if it's a weekday
    if (nowPlusOneMinute.getDay() >= 1 && nowPlusOneMinute.getDay() <= 5) {
        // Check if it's between 6am and 6pm
        if (nowPlusOneMinute.getHours() >= 6 && nowPlusOneMinute.getHours() < 18) {
            // Calculate time until next half hour mark
            nextRunTime = new Date(nowPlusOneMinute);
            nextRunTime.setMinutes(Math.ceil(nowPlusOneMinute.getMinutes() / 30) * 30, 0, 0);
        } else if (nowPlusOneMinute.getHours() < 6) {
            // Calculate time until 6am of the same day
            nextRunTime = new Date(nowPlusOneMinute);
            nextRunTime.setHours(6, 0, 0, 0);
        } else if (nowPlusOneMinute.getDay() === 5) {
            // For Friday after hours calculate time until 6am of the next Monday
            nextRunTime = new Date(nowPlusOneMinute);
            nextRunTime.setDate(nowPlusOneMinute.getDate() + ((1 + 7 - nowPlusOneMinute.getDay()) % 7));
            nextRunTime.setHours(6, 0, 0, 0);
        } else {
            // Calculate time until 6am of the next day
            nextRunTime = new Date(nowPlusOneMinute);
            nextRunTime.setDate(nowPlusOneMinute.getDate() + 1);
            nextRunTime.setHours(6, 0, 0, 0);
        }
    } else {
        // Calculate time until next Monday at 6am
        nextRunTime = new Date(nowPlusOneMinute);
        nextRunTime.setDate(nowPlusOneMinute.getDate() + ((1 + 7 - nowPlusOneMinute.getDay()) % 7));
        nextRunTime.setHours(6, 0, 0, 0);
    }

    logger.info('Next run time: ',
        nextRunTime.toLocaleString('en-US', {timeZone: 'America/Chicago'}));

    // return the difference in milliseconds
    return nextRunTime - now;
}

const compareResults = (first, second) => {
    first.sort((a, b) => (a.id > b.id) ? 1 : -1);
    second.sort((a, b) => (a.id > b.id) ? 1 : -1);
    return JSON.stringify(first) === JSON.stringify(second);
}

module.exports = {
    updateTires,
    getTimeUntilNextRun,
    compareResults
}