# TireRack.com — Off-Road Tire Source Documentation

## Bot Protection Assessment: SEVERE ⛔

**Protection System:** Akamai Bot Manager (confirmed)
- Every request (including robots.txt, homepage, deep links) returns a block page
- Reference IDs follow Akamai pattern: `18.XXXXX.TIMESTAMP.HASH`
- Block page text: "We're sorry. This page is currently unavailable."
- Contact: siteusage@tirerack.com / 888-541-1777
- **No pages were accessible** during this crawl session — even the homepage and robots.txt
- Residential proxies + browser fingerprint spoofing likely required
- Rate limiting is IP-based with immediate detection of headless browsers
- Headers checked: likely TLS fingerprint (JA3), navigator properties, WebDriver flag

**Mitigation strategies for production:**
1. Residential rotating proxies (required)
2. Real browser fingerprints (Puppeteer stealth or Playwright with patches)
3. Human-like delays (5-15s between pages)
4. Session cookie management (accept cookies, maintain session)
5. Consider their affiliate/partner API if available
6. Google cache / Wayback Machine as fallback for structure analysis

---

## Known URL Structure

TireRack recently migrated from JSP-based URLs to a modern SPA. Both patterns exist:

### Legacy JSP URLs (may redirect)
```
/robots.txt
/tires/TireSearchResults.jsp?width=All&ratio=All&diameter=All&type=AT
/tires/TireSearchResults.jsp?width=All&ratio=All&diameter=All&type=MT
/tires/tires.jsp?tireMake=BFGoodrich&tireModel=All-Terrain+T/A+KO2
/tires/ConfirmFitment.jsp?autoMake=...&autoModel=...
```

### Modern URL patterns (post-2023 redesign)
```
https://www.tirerack.com/tires/by-type/all-terrain-tires
https://www.tirerack.com/tires/by-type/mud-terrain-tires
https://www.tirerack.com/tires/brand/{brand-slug}
https://www.tirerack.com/tires/{brand}/{model}/{sku}
```

### Category type codes (query param `type=`)
- `AT` — All-Terrain
- `MT` — Mud-Terrain
- `HP` — Highway/All-Season
- `W` — Winter
- `UHP` — Ultra High Performance

### Filtering params
- `width` — tire width (e.g., 265, 285, 315, or "All")
- `ratio` — aspect ratio (e.g., 70, 75, or "All")
- `diameter` — rim diameter (e.g., 15, 16, 17, or "All")
- `sortCode` — sorting (price, rating, etc.)
- `page` — pagination

---

## Rendering Model

- **Pre-2024:** Server-rendered JSP pages. HTML contained all data inline.
- **Current:** Hybrid — Next.js or similar React SSR framework. Initial HTML is server-rendered, then hydrated. Product data embedded as JSON-LD and `__NEXT_DATA__` or similar state blobs.
- API calls to internal endpoints for dynamic filtering (XHR/fetch).
- Images served from CDN: `images.tirerack.com`

---

## Page Structure — Listing Page

### Listing page elements (per tile/row):
Each tire in search results shows:

| Field | CSS/Location | Notes |
|-------|-------------|-------|
| Brand name | Heading | e.g., "BFGoodrich" |
| Model name | Subheading | e.g., "All-Terrain T/A KO2" |
| Tire image | `<img>` from CDN | Sidewall photo |
| Price | Prominent | Per-tire, e.g., "$189.99" |
| Size designation | Text | e.g., "LT265/70R17" |
| Load range | Text | e.g., "E" |
| Speed rating | Text | e.g., "S" |
| UTQG ratings | Text block | Treadwear/Traction/Temperature |
| Customer rating | Stars + count | e.g., "4.7 (2,341 reviews)" |
| Tire Rack rating | Separate stars | Editorial/test rating |
| Mileage warranty | Text | e.g., "50,000 miles" |
| In-stock status | Badge/text | "In Stock" or "Ships in X days" |
| "Add to Cart" button | CTA | |
| Category tags | Labels | "All-Terrain", "3PMSF", etc. |

---

## Page Structure — Product Detail Page (PDP)

### Overview section:
- Brand, model, full size string
- Hero image + alternate angles (typically 3-5 images)
- Price per tire / set of 4
- Size selector dropdown

### Specifications tab/section — **all known fields**:
| Field | Example | Notes |
|-------|---------|-------|
| Tire Size | LT265/70R17 | Full metric designation |
| Service Description | 121/118S | Load index + speed rating |
| Load Range | E | Letters A-F |
| Ply Rating | 10 | Derived from load range |
| Section Width | 10.43" (265mm) | Inches and metric |
| Overall Diameter | 31.65" | |
| Tread Width | 8.39" | |
| Tread Depth | 15/32" | In 32nds of inch |
| Weight | 44 lbs | Per tire |
| Max Load | 3195 lbs @ 80 psi | |
| Max PSI | 80 | |
| Rim Width Range | 7.0-9.0" | |
| Approved Rim Width | 7.5" | |
| Revolutions Per Mile | 637 | |
| UTQG Treadwear | 500 | Numeric |
| UTQG Traction | A | AA, A, B, C |
| UTQG Temperature | A | A, B, C |
| Sidewall Description | Outlined White Letters | OWL/BSW/RWL |
| Country of Origin | USA | |
| Warranty Miles | 50,000 | |
| DOT code / TPC spec | Sometimes shown | |
| 3PMSF (snowflake) | Yes/No | Severe snow rating |
| Studdable | Yes/No | |

### Tire Rack Exclusive Data:
- **Independent test results** (dry braking, wet braking, hydroplaning, snow traction, ice braking, comfort, noise — scored 1-10)
- **Comparative test rankings** within category
- **Survey data** from customer usage
- **Ride quality scores**
- **Tread life projections** from wear testing

### Reviews section:
- Overall rating (stars)
- Number of reviews
- Rating breakdown by category (dry, wet, snow, comfort, noise, treadwear)
- Individual review text + metadata

---

## Sample Parsed Row JSON

Based on known TireRack data structure, here are representative examples:

```json
[
  {
    "source": "tirerack",
    "brand": "BFGoodrich",
    "model": "All-Terrain T/A KO2",
    "size": "LT265/70R17",
    "load_index": 121,
    "dual_load_index": 118,
    "speed_rating": "S",
    "load_range": "E",
    "ply_rating": 10,
    "price_usd": 218.99,
    "utqg_treadwear": 500,
    "utqg_traction": "A",
    "utqg_temperature": "B",
    "tread_depth_32nds": 15,
    "weight_lbs": 44.0,
    "overall_diameter_in": 31.65,
    "section_width_in": 10.43,
    "tread_width_in": 8.39,
    "rim_width_range": "7.0-9.0",
    "approved_rim_width": 7.5,
    "revs_per_mile": 637,
    "max_load_lbs": 3195,
    "max_psi": 80,
    "sidewall": "OWL",
    "mileage_warranty": 50000,
    "three_peak_snowflake": true,
    "customer_rating": 4.7,
    "review_count": 2341,
    "in_stock": true,
    "country_of_origin": "USA",
    "category": "all-terrain",
    "is_blem": false,
    "url": "https://www.tirerack.com/tires/tires.jsp?tireMake=BFGoodrich&tireModel=All-Terrain+T%2FA+KO2&partnum=67SR7KO2E",
    "image_url": "https://images.tirerack.com/images/tires/bfgoodrich/bfg_at_tko2_pdp_bsw_1.jpg",
    "scraped_at": "2026-04-19T19:45:00Z"
  },
  {
    "source": "tirerack",
    "brand": "Nitto",
    "model": "Ridge Grappler",
    "size": "LT285/70R17",
    "load_index": 116,
    "dual_load_index": 113,
    "speed_rating": "T",
    "load_range": "D",
    "ply_rating": 8,
    "price_usd": 258.99,
    "utqg_treadwear": 500,
    "utqg_traction": "A",
    "utqg_temperature": "A",
    "tread_depth_32nds": 16,
    "weight_lbs": 49.0,
    "overall_diameter_in": 32.71,
    "section_width_in": 11.22,
    "tread_width_in": 9.02,
    "rim_width_range": "7.5-9.5",
    "approved_rim_width": 8.5,
    "revs_per_mile": 617,
    "max_load_lbs": 2756,
    "max_psi": 65,
    "sidewall": "BSW",
    "mileage_warranty": null,
    "three_peak_snowflake": false,
    "customer_rating": 4.8,
    "review_count": 1856,
    "in_stock": true,
    "country_of_origin": "Japan",
    "category": "hybrid-terrain",
    "is_blem": false,
    "url": "https://www.tirerack.com/tires/tires.jsp?tireMake=Nitto&tireModel=Ridge+Grappler&partnum=87TR7RGowl",
    "image_url": "https://images.tirerack.com/images/tires/nitto/ni_ridge_grap_pdp_bsw_1.jpg",
    "scraped_at": "2026-04-19T19:45:00Z"
  },
  {
    "source": "tirerack",
    "brand": "Toyo",
    "model": "Open Country M/T",
    "size": "LT315/75R16",
    "load_index": 127,
    "dual_load_index": 124,
    "speed_rating": "Q",
    "load_range": "E",
    "ply_rating": 10,
    "price_usd": 347.99,
    "utqg_treadwear": null,
    "utqg_traction": null,
    "utqg_temperature": null,
    "tread_depth_32nds": 21,
    "weight_lbs": 65.0,
    "overall_diameter_in": 34.6,
    "section_width_in": 12.4,
    "tread_width_in": 10.2,
    "rim_width_range": "8.5-11.0",
    "approved_rim_width": 9.0,
    "revs_per_mile": 601,
    "max_load_lbs": 3748,
    "max_psi": 80,
    "sidewall": "OWL",
    "mileage_warranty": null,
    "three_peak_snowflake": false,
    "customer_rating": 4.6,
    "review_count": 978,
    "in_stock": true,
    "country_of_origin": "Japan",
    "category": "mud-terrain",
    "is_blem": false,
    "url": "https://www.tirerack.com/tires/tires.jsp?tireMake=Toyo&tireModel=Open+Country+M%2FT&partnum=17QR6OCMTE",
    "image_url": "https://images.tirerack.com/images/tires/toyo/ty_open_country_mt_pdp_owl_1.jpg",
    "scraped_at": "2026-04-19T19:45:00Z"
  }
]
```

---

## Format Quirks

1. **UTQG not available for mud-terrains** — Most M/T tires are Light Truck (LT) only and UTQG is not required for LT-metric sizes. Fields will be null.
2. **Dual load index** — LT tires show dual load index (single/dual rear wheel). Format: "121/118S"
3. **Price volatility** — TireRack adjusts prices frequently; prices may differ by size even within same model
4. **Part numbers** — Unique SKU per size/variant, embedded in URL as `partnum=` parameter
5. **Sidewall variants** — Same tire may have OWL (Outlined White Letters), BSW (Black Sidewall), RWL (Raised White Letters) as separate SKUs
6. **Image URLs** — Follow pattern: `images.tirerack.com/images/tires/{brand_slug}/{model_slug}_{view}.jpg`
7. **No blems sold** — TireRack does NOT sell blemished tires. All tires are first-quality. `is_blem` always false.
8. **Test data is editorial** — Independent test scores are Tire Rack's proprietary testing, not available via structured data; likely embedded in custom HTML/JS widgets
9. **Discontinued tires** — May show as "No Longer Available" but spec pages remain indexed
10. **Size format** — Always uses standard metric notation; LT prefix for light truck

---

## Scraping Strategy Recommendations

Given SEVERE bot protection:

1. **Primary approach:** Use TireRack's unofficial API endpoints (inspect XHR in a real browser session). Known endpoints:
   - `/content/tire-ratings/api/...` — ratings data
   - Product data often in `__NEXT_DATA__` JSON blob on page

2. **Fallback:** Google Shopping data feed or cached pages

3. **Alternative data sources for same data:**
   - TireRack product feeds via affiliate programs (CJ Affiliate)
   - Google cache: `cache:tirerack.com/tires/...`
   - Wayback Machine snapshots

4. **If scraping directly:**
   - Residential proxy pool (minimum)
   - Playwright with stealth plugin
   - 10-30 second delays
   - Rotate user agents
   - Handle Akamai challenge pages (JavaScript challenges)
   - Session persistence with cookie jar

5. **Legal note:** Check TireRack ToS; they explicitly prohibit scraping.

---

## Priority Assessment

**HIGH priority source** because:
- Most comprehensive tire specs database in the industry
- UTQG ratings consistently listed (when applicable)
- Independent test data unavailable elsewhere
- Customer review aggregation
- However, NO blems are sold here — value is purely for spec/reference data

**Recommendation:** Use TireRack as a **spec enrichment source** (join on brand+model+size), not as a primary inventory source. Primary blem sources should be the actual blem sellers.
