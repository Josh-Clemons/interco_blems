/**
 * Scraper registry.
 * To add a new site, create src/scrapers/mysite.js and register it here.
 *
 * Each scraper must export:
 *   name    {string}  - unique identifier stored in DB as `source`
 *   url     {string}  - page being scraped (informational)
 *   scrape  {async () => Tire[]}
 *
 * Tire shape:
 *   { sku, title, brand, size, quantity, price }
 */

const interco = require('./interco');

const scrapers = [interco];

module.exports = scrapers;
