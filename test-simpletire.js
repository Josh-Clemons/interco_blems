const scraper = require('./src/scrapers/simpletire');

scraper.scrape().then(tires => {
    console.log('Done. Total tires:', tires.length);
}).catch(err => {
    console.error('FAILED:', err.message);
    console.error(err.stack);
});
