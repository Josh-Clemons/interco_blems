# Tire Source Registry

This is the canonical list of tire sources the bot may scrape. The bot
tracks **off-road tires broadly** — blems are a highlighted subset, not
the only inventory we care about. Users want to search, compare, and get
alerts across multiple sources for any off-road tire purchase.

Each entry records what we know about the site, what data fields it
exposes, and its current scraper status. New sources are added here first,
evaluated during Phase 5, then promoted to active scrapers in Phase 6+.

---

## Source Types

| Type         | Description                                             | Examples                    |
|--------------|---------------------------------------------------------|-----------------------------|
| manufacturer | Makes tires; may sell blems direct from factory         | Interco, TreadWright        |
| reseller     | Buys from manufacturers; dedicated off-road inventory   | TireMart, JEGS, 4WheelParts|
| marketplace  | Platform hosting multiple sellers                       | eBay                        |
| aggregator   | Large multi-brand tire retailer with rich spec data     | SimpleTire, TireRack        |

---

## Active Sources (have a scraper today)

### interco — Interco Tire (manufacturer)
- **URL:** https://www.intercotire.com/blem-list
- **Type:** manufacturer
- **Has blems:** Yes — dedicated Blem List page
- **Brands:** Interco only (Super Swamper, IROK, Bogger, TSL, etc.)
- **Scraper status:** ✅ Phase 1 — in production
- **Known fields:** name, size, price, quantity, image
- **Notes:** The original source. Blem-only inventory, small catalog
  (typically 20-60 SKUs), turns over quickly.

---

## Evaluated Sources (researched, not yet scraped)

### tiremart — TireMart.com (reseller)
- **URL:** https://www.tiremart.com/blem-tires (blems), full catalog TBD
- **Type:** reseller
- **Has blems:** Yes — dedicated /blem-tires section, 317+ models
- **Brands:** Multi-brand (Aethon, AMP, All Country, and many more)
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** HIGH — largest dedicated blem reseller; likely has broader
  off-road catalog too
- **Known fields:** TBD (need product-page inspection)
- **Bot protection:** Unknown
- **Notes:** Biggest blem-specific inventory found. Check if they have a
  broader off-road/mud-terrain category beyond just blems.

### simpletire — SimpleTire.com (aggregator)
- **URL:** https://www.simpletire.com
- **Type:** aggregator
- **Has blems:** No
- **Brands:** All major brands
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** HIGH — richest spec data of any site researched
- **Known fields:** brand, model, price, stock status, rating/reviews,
  SimpleScore, category (Mud Terrain / All Terrain), vehicle type,
  mileage warranty, load index (with lbs), speed rating (with MPH),
  load range / ply, sidewall type, tread depth, inflation pressure,
  part number, tread design, tire weight, section width, overall
  diameter, 3PMS rating. **No UTQG.**
- **Bot protection:** Light (was scrapeable during research)
- **Notes:** Best field coverage for enriching the unified model. Off-road
  categories are well-structured. No blems, but excellent for /find
  cross-site comparison and as a spec reference source.

### tireract — TireRack.com (aggregator)
- **URL:** https://www.tirerack.com
- **Type:** aggregator
- **Has blems:** No
- **Brands:** All major brands
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** HIGH — most comprehensive specs including UTQG + test data
- **Known fields:** brand, model, size, price, images (multiple angles),
  reviews/ratings, speed rating, load index, load range, tread depth,
  tire weight, UTQG (treadwear/traction/temp), rim width range,
  section width, overall diameter, warranty, survey results
- **Bot protection:** Heavy (blocked during research)
- **Notes:** Gold standard for tire specs. Bot protection is the main
  obstacle. May need to explore their API or affiliate program.

### 4wheelparts — 4 Wheel Parts (reseller)
- **URL:** https://www.4wheelparts.com
- **Type:** reseller
- **Has blems:** No (closeouts only)
- **Brands:** BFGoodrich, Nitto, Mickey Thompson, Toyo, Pro Comp
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** MEDIUM — strong off-road focus, good brand mix
- **Known fields:** brand, model, size, price, images, stock/availability,
  part number, SKU, load range, speed rating, load index, tire weight,
  ply rating, vehicle fitment, reviews
- **Bot protection:** Cloudflare
- **Notes:** Major off-road parts retailer. Cloudflare complicates scraping.
  Strong off-road catalog even without blems.

### treadwright — TreadWright Tires (manufacturer)
- **URL:** https://www.treadwright.com
- **Type:** manufacturer
- **Has blems:** Yes — listed on Specials page ("BLEMISH LT | MT GUARD DOG")
- **Brands:** TreadWright only (Guard Dog, Axiom, Warden, Claw)
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** MEDIUM — small catalog, manufacturer-direct, has blems
- **Known fields:** name, price (confirmed $179.99 example)
- **Bot protection:** Likely light (Shopify-based)
- **Notes:** Remold/retread manufacturer, USA-made. Full off-road catalog
  plus blems mixed with clearance on Specials page.

### jegs — JEGS (reseller)
- **URL:** https://www.jegs.com/c/Tires_Blemished-Tires/10215/10002/-1
- **Type:** reseller
- **Has blems:** Yes — dedicated "Blemished Tires" category
- **Brands:** Multi-brand (performance/off-road)
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** MEDIUM — dedicated blem category + broader tire catalog
- **Known fields:** TBD
- **Bot protection:** Cloudflare (blocked during research)
- **Notes:** Major performance parts retailer. Check broader off-road
  tire categories beyond the blem section.

### summit — Summit Racing (reseller)
- **URL:** https://www.summitracing.com
- **Type:** reseller
- **Has blems:** Historically yes; 0 results at time of check
- **Brands:** Multi-brand (Nitto, Mickey Thompson, etc.)
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** MEDIUM — good off-road selection, blems intermittent
- **Known fields:** TBD
- **Bot protection:** Unknown
- **Notes:** Major auto parts reseller. Broader off-road tire catalog
  worth scraping even when blems are empty.

### ebay — eBay (marketplace)
- **URL:** https://www.ebay.com
- **Type:** marketplace
- **Has blems:** Yes — searchable by keyword
- **Brands:** Multi-brand, multi-seller
- **Scraper status:** 🔍 Needs Phase 5 deep-dive
- **Priority:** LOW — noisy, multi-seller, inconsistent listings
- **Known fields:** title, price, seller, condition, shipping
- **Bot protection:** Heavy
- **Notes:** eBay API exists but has rate limits and approval process.
  Best for deal-hunting but normalization is painful.

---

## Deferred / Dead Sources

Kept here so we don't re-research them.

| Site              | Type     | Why deferred                                    |
|-------------------|----------|-------------------------------------------------|
| Morris4x4Center   | reseller | Site returning 503s; possibly defunct            |
| NorthridgeNation  | reseller | Domain expired — site is dead as of April 2026  |
| NTS Tire Supply   | reseller | Farm/off-road supply; needs further research     |
| NTW Online        | reseller | Off-road specialist; needs further research      |
| Pit Bull Tires    | mfr      | Manufacturer, sells direct; no blem page found   |

---

## How to Add a New Source

1. Add an entry to "Evaluated Sources" above with all known fields
2. Set scraper status to 🔍
3. During Phase 5 deep-dive, document:
   - Product page URL structure
   - Available data fields (map to unified model)
   - robots.txt / ToS restrictions
   - Bot protection level (none / light / Cloudflare / heavy)
   - Update frequency (how often does inventory change?)
   - Listing volume (how many off-road tire SKUs?)
   - Does it have a blem/closeout section? (for the `is_blem` flag)
4. Decide priority (HIGH / MEDIUM / LOW) based on:
   - Volume and quality of off-road tire listings
   - Data quality / field richness
   - Scrapeability (bot protection, legal)
   - Blem inventory is a bonus, not a requirement
5. When ready to build, move to Phase 6 and implement scraper

---

## Field Coverage Matrix (to be filled during Phase 5 deep-dives)

Fields we want in the unified model vs what each source provides.

| Field          | interco | tiremart | simpletire | tirerack | 4wp  | treadwright | jegs | summit |
|----------------|---------|----------|------------|----------|------|-------------|------|--------|
| sku            | ✅       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| name           | ✅       | ?        | ✅          | ✅        | ✅    | ✅           | ?    | ?      |
| brand          | ✅*      | ?        | ✅          | ✅        | ✅    | ✅*          | ?    | ?      |
| size           | ✅       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| price          | ✅       | ?        | ✅          | ✅        | ✅    | ✅           | ?    | ?      |
| msrp           | ❌       | ?        | ?          | ?        | ?    | ?           | ?    | ?      |
| is_blem        | ✅†      | ✅        | ❌          | ❌        | ❌    | ✅           | ✅    | ?      |
| quantity_raw   | ✅       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| stock_state    | derived | ?        | derived    | derived  | ?    | ?           | ?    | ?      |
| image_url      | ✅       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| product_url    | ✅       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| load_index     | ❌       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| speed_rating   | ❌       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| ply            | ❌       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| weight         | ❌       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |
| utqg           | ❌       | ?        | ❌          | ✅        | ?    | ?           | ?    | ?      |
| tread_depth    | ❌       | ?        | ✅          | ✅        | ?    | ?           | ?    | ?      |
| product_line   | ✅       | ?        | ✅          | ✅        | ?    | ?           | ?    | ?      |
| category       | ❌       | ?        | ✅          | ✅        | ?    | ?           | ?    | ?      |
| reviews/rating | ❌       | ?        | ✅          | ✅        | ✅    | ?           | ?    | ?      |

*Brand is implicit (always the manufacturer's own brand).
†All Interco listings are blems by definition (blem-list page).
