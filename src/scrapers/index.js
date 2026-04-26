/**
 * Scraper registry.
 * To add a new site, create src/scrapers/mysite.js and register it here.
 *
 * Each scraper must export:
 *   name    {string}  - unique identifier stored in DB as `source`
 *   url     {string}  - page being scraped (informational)
 *   scrape  {async () => Tire[]}
 *
 * Tire shape (v2):
 *   { sku, title, brand, product_line, category, size, is_blem,
 *     quantity, quantity_raw, quantity_n, stock_state,
 *     price, price_cents, msrp_cents, sale_price_cents,
 *     load_index, speed_rating, load_range, ply,
 *     weight_oz, tread_depth_32, overall_diam, section_width,
 *     utqg_wear, utqg_traction, utqg_temp, three_pms,
 *     product_url, image_url, extra }
 *
 * All fields except sku are optional — missing fields default to null.
 */

const interco    = require('./interco');
const treadwright = require('./treadwright');
const tiremart   = require('./tiremart');
const simpletire = require('./simpletire');

// scrapers flagged nightly:true are excluded from the regular runAll schedule
// but included here so /sources and /admin sources can display them
const scrapers = [interco, treadwright, tiremart, simpletire];

module.exports = scrapers;
