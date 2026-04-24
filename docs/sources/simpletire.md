# SimpleTire.com — Source Documentation

**Priority:** HIGH — richest spec data of all sources  
**Blems:** None. All `is_blem = false`  
**Last verified:** 2026-04-19  

---

## Robots.txt

```
User-Agent: *
Disallow: /error
Disallow: /catalog
Disallow: /checkout/*
Disallow: /cache_css/*
Disallow: /categories/summer-tires
Disallow: /tire-brands
Disallow: /privacy
Disallow: /api/*
Disallow: /api/product-detail*
Disallow: /api/users/session
Disallow: /api/menu
Disallow: /api/globals
Disallow: /api/home
Disallow: /api/users/me/history/search
Disallow: /_next/data/
Disallow: /.well-known/assetlinks.json
Disallow: *write-a-review*

User-Agent: Bingbot
Disallow: /search

Sitemap: https://simpletire.com/sitemap/sitemap-index.xml
```

**Key notes:**
- `/api/*` is disallowed — must scrape rendered HTML
- `/_next/data/` disallowed — no SSR JSON endpoint scraping
- `/categories/` pages are NOT disallowed (except summer-tires)
- Sitemap available at `/sitemap/sitemap-index.xml`

---

## Rendering Model

- **Framework:** Next.js (React SSR)
- **Hydration:** `#__next` root div; no `__NEXT_DATA__` script tag found on product pages (likely using app router / RSC)
- **Structured data:** JSON-LD (`application/ld+json`) with `ProductGroup` schema on product line pages, `BreadcrumbList`, `FAQPage`
- **Content delivery:** Pages render server-side. Specs table and product data are in the initial HTML.

---

## URL Structure

| Page Type | Pattern | Example |
|---|---|---|
| Category listing | `/categories/{category}-tires` | `/categories/mud-terrain-tires` |
| Brand + category | `/brands/{brand}-tires/categories/{category}` | `/brands/nitto-tires/categories/mud-terrain` |
| Product line (all sizes) | `/brands/{brand}-tires/{model-slug}` | `/brands/nitto-tires/mud-grappler` |
| Product SKU (specific size) | `/brands/{brand}-tires/{model-slug}/p/{product_id}` | `/brands/nitto-tires/mud-grappler/p/29197` |
| All brands | `/brands` | |
| All categories | `/categories` | |
| Vehicle type | `/types/{type}-tires` | `/types/light-truck-tires` |

---

## Page Structure

### Category Listing Page (`/categories/mud-terrain-tires`)

- Breadcrumbs: Home > Shop by tire category > Mud terrain tires
- H1: category name
- Description paragraph + "Read more" expander
- **Most popular brands** section with brand links + tire counts
- **Best selling** carousel with product cards

**Listing card fields:**
- SimpleScore (numeric, e.g. "8.5") + label ("Great")
- Model name + load/speed suffix (e.g. "Mud Grappler 127P")
- Starting price ("Start at $399.99/tire")
- Stock status ("In stock")
- Star rating + review count ("4.5 out of 5 (153)")
- Category ("Mud Terrain")
- Vehicle type ("Light Truck")
- Warranty ("No mileage warranty")

### Product Line Page (`/brands/{brand}-tires/{model-slug}`)

Shows all sizes for a product line. Default "Technical specs" tab shows specs for the default/first size. "Available sizes" tab lists all sizes with per-size fields:
- Size string, Price
- Width, Ratio, Inflation Pressure, Tread Depth, Width Range, Sidewall, Tread Width

### Product SKU Page (`/brands/{brand}-tires/{model-slug}/p/{id}`)

Full detail for a specific size. Includes all fields below.

---

## Complete Field Inventory

### Technical Specs Table (per SKU)

| Field | Example Value | Notes |
|---|---|---|
| Category | Mud Terrain | Links to category page |
| Vehicle | Light Truck | Links to vehicle type page |
| Mileage Warranty | N/A | or "60,000 miles" etc. |
| Load Index | 3858 lbs/3527 lbs (127/124) | Dual values for LT; includes lbs + numeric index |
| Max Speed | 94 MPH (P) | MPH value + speed rating letter |
| Load Range | E (10 Ply) | Letter + ply count |
| Sidewall | Blackwall | |
| Tread Depth | 20.7/32nds | In 32nds of an inch |
| Inflation Pressure | 65 PSI | |
| Part Number | 201050 | Manufacturer part number |
| Tread Design | Symmetrical | or Asymmetrical, Directional |
| Tire Weight | 80.74 lbs | Decimal pounds |
| Section Width | 12.87" | In inches with quotes |
| Rim Range | 8.00-10.50" | Min-max rim width |
| Overall Diameter | 34.96" | In inches |
| Three-Peak Mountain Snowflake (3PMS) | No | Yes/No |

### Product-Level Fields (from page chrome)

| Field | Example | Notes |
|---|---|---|
| Brand | Nitto | From heading, breadcrumb, JSON-LD |
| Model | Mud Grappler | |
| Tire Size | LT315/75R16 127/124P E | Full size string in breadcrumb |
| Price | $446.92/tire | Per-tire price (sale price) |
| Original Price | (shown as strikethrough) | When on sale |
| Discount | 11% off | Percentage |
| Stock Status | In stock | |
| Shipping | Free 2-4 day shipping | |
| SimpleScore™ | 8.5 | Proprietary 1-10 score |
| SimpleScore Label | Great | Excellent/Great/Good/etc |
| Score Breakdown: Long lasting | 8.8 | Sub-score |
| Score Breakdown: Handling | 8.3 | Sub-score (on line page) |
| Score Breakdown: Durability | 8.4 | Sub-score (on SKU page) |
| Score Breakdown: Traction | 8.4 | Sub-score |
| Star Rating | 4.6 | out of 5 |
| Review Count | 150 | Total (SimpleTire + Google Shopping) |
| SimpleTire Reviews | 47 | |
| Google Shopping Reviews | 103 | |
| Review Scorecard: Dry | 4.8 | Per-attribute rating |
| Review Scorecard: Wet | 4.5 | |
| Review Scorecard: Winter | 4.4 | |
| Review Scorecard: Comfort | 4.5 | |
| Review Scorecard: Noise | 3.6 | |
| Review Scorecard: Treadwear | 4.4 | |
| Buy Again % | 89% | |
| Description | (long text) | HTML with features list |
| Features & Benefits | (bullet list) | |
| Image URLs | Multiple angles + 360° | |
| Video | Yes/No | Some products have video |
| Product Group ID | nitto-1925 | From JSON-LD `productGroupID` |
| Product ID | 29197 | Numeric, in URL path |

### Additional Fields from Available Sizes Tab (per size)

| Field | Example | Notes |
|---|---|---|
| Width | LT315 | Prefix + numeric |
| Ratio | 75R | Aspect ratio + construction |
| Tread Width | NA | Often NA |
| Width Range | NA | Often NA (same as Rim Range?) |

### Fields NOT present (confirmed absent)

- UTQG ratings (Treadwear/Traction/Temperature grades) — not shown
- DOT code
- Country of origin (only in FAQ text, not structured)
- Rim diameter (derivable from size string)
- Revolutions per mile

---

## Format Quirks

1. **Load Index format:** Dual LT tires show `"3858 lbs/3527 lbs (127/124)"` — need to parse both single and dual load index formats
2. **Speed Rating:** Embedded in Max Speed as `"94 MPH (P)"` — letter in parentheses
3. **Load Range:** Combined format `"E (10 Ply)"` — letter + ply in parens
4. **Tread Depth:** Always in `/32nds` format, e.g. `"20.7/32nds"`
5. **Measurements with quotes:** Section Width and Overall Diameter use `"` suffix: `12.87"`
6. **Price format:** `$446.92/tire` — includes dollar sign and `/tire` suffix
7. **SimpleScore:** Decimal (e.g. 8.5), range appears to be 1-10
8. **Tire size in breadcrumb** includes full designation: `LT315/75R16 127/124P`
9. **Warranty "N/A"** vs actual values — must handle both
10. **3PMS is Yes/No** string, not boolean
11. **Product IDs** are numeric integers in URL path segment after `/p/`
12. **Available sizes tab** has per-size mini-specs that differ slightly from main specs (uses different field names like "Ratio" vs no equivalent in main table)

---

## Bot Protection

- **Stealth warning:** "Running WITHOUT residential proxies. Bot detection may be more aggressive."
- No CAPTCHA encountered during testing
- No Cloudflare challenge page observed
- Pages loaded successfully with standard browser automation
- `/api/*` endpoints are robots.txt-disallowed (likely rate-limited or auth-gated)
- **Recommendation:** Use residential proxies for production scraping. Rate-limit requests. Rotate user agents.

---

## Sample Parsed Rows (5 rows)

```json
[
  {
    "source": "simpletire",
    "product_id": 29197,
    "brand": "Nitto",
    "model": "Mud Grappler",
    "tire_size": "LT315/75R16",
    "load_index": "127/124",
    "load_index_lbs": "3858/3527",
    "speed_rating": "P",
    "max_speed_mph": 94,
    "load_range": "E",
    "ply_rating": 10,
    "category": "Mud Terrain",
    "vehicle_type": "Light Truck",
    "price": 446.92,
    "in_stock": true,
    "warranty_miles": null,
    "simple_score": 8.5,
    "simple_score_label": "Great",
    "star_rating": 4.6,
    "review_count": 150,
    "sidewall": "Blackwall",
    "tread_depth_32nds": 20.7,
    "inflation_pressure_psi": 65,
    "part_number": "201050",
    "tread_design": "Symmetrical",
    "weight_lbs": 80.74,
    "section_width_in": 12.87,
    "overall_diameter_in": 34.96,
    "rim_range": "8.00-10.50",
    "three_peak_mountain_snowflake": false,
    "is_blem": false,
    "url": "https://simpletire.com/brands/nitto-tires/mud-grappler/p/29197"
  },
  {
    "source": "simpletire",
    "product_id": 186066,
    "brand": "Nitto",
    "model": "Mud Grappler",
    "tire_size": "LT385/70R16",
    "load_index": "130",
    "load_index_lbs": null,
    "speed_rating": "Q",
    "max_speed_mph": 99,
    "load_range": null,
    "ply_rating": null,
    "category": "Mud Terrain",
    "vehicle_type": "Light Truck",
    "price": 572.99,
    "in_stock": true,
    "warranty_miles": null,
    "simple_score": 8.5,
    "simple_score_label": "Great",
    "star_rating": 4.6,
    "review_count": 150,
    "sidewall": "Blackwall",
    "tread_depth_32nds": 21.0,
    "inflation_pressure_psi": 50,
    "part_number": null,
    "tread_design": "Symmetrical",
    "weight_lbs": null,
    "section_width_in": null,
    "overall_diameter_in": null,
    "rim_range": null,
    "three_peak_mountain_snowflake": false,
    "is_blem": false,
    "url": "https://simpletire.com/brands/nitto-tires/mud-grappler/p/186066"
  },
  {
    "source": "simpletire",
    "product_id": 186070,
    "brand": "Nitto",
    "model": "Mud Grappler",
    "tire_size": "33x12.50R17LT",
    "load_index": "120",
    "load_index_lbs": null,
    "speed_rating": "Q",
    "max_speed_mph": 99,
    "load_range": null,
    "ply_rating": null,
    "category": "Mud Terrain",
    "vehicle_type": "Light Truck",
    "price": 405.00,
    "in_stock": true,
    "warranty_miles": null,
    "simple_score": 8.5,
    "simple_score_label": "Great",
    "star_rating": 4.6,
    "review_count": 150,
    "sidewall": "Blackwall",
    "tread_depth_32nds": 21.0,
    "inflation_pressure_psi": 65,
    "part_number": null,
    "tread_design": "Symmetrical",
    "weight_lbs": null,
    "section_width_in": null,
    "overall_diameter_in": null,
    "rim_range": null,
    "three_peak_mountain_snowflake": false,
    "is_blem": false,
    "url": "https://simpletire.com/brands/nitto-tires/mud-grappler/p/186070"
  },
  {
    "source": "simpletire",
    "product_id": 0,
    "brand": "Toyo",
    "model": "Open Country M/T",
    "tire_size": null,
    "load_index": "127",
    "load_index_lbs": null,
    "speed_rating": "Q",
    "max_speed_mph": null,
    "load_range": null,
    "ply_rating": null,
    "category": "Mud Terrain",
    "vehicle_type": "Light Truck",
    "price": 479.27,
    "in_stock": true,
    "warranty_miles": null,
    "simple_score": 9.1,
    "simple_score_label": "Excellent",
    "star_rating": 4.6,
    "review_count": 125,
    "sidewall": null,
    "tread_depth_32nds": null,
    "inflation_pressure_psi": null,
    "part_number": null,
    "tread_design": null,
    "weight_lbs": null,
    "section_width_in": null,
    "overall_diameter_in": null,
    "rim_range": null,
    "three_peak_mountain_snowflake": null,
    "is_blem": false,
    "url": "https://simpletire.com/brands/toyo-tires/open-country-m-t"
  },
  {
    "source": "simpletire",
    "product_id": 0,
    "brand": "Gladiator",
    "model": "QR900-MT",
    "tire_size": null,
    "load_index": "109",
    "load_index_lbs": null,
    "speed_rating": "Q",
    "max_speed_mph": null,
    "load_range": null,
    "ply_rating": null,
    "category": "Mud Terrain",
    "vehicle_type": "Light Truck",
    "price": 176.96,
    "in_stock": true,
    "warranty_miles": null,
    "simple_score": 8.2,
    "simple_score_label": "Great",
    "star_rating": 4.5,
    "review_count": 120,
    "sidewall": null,
    "tread_depth_32nds": null,
    "inflation_pressure_psi": null,
    "part_number": null,
    "tread_design": null,
    "weight_lbs": null,
    "section_width_in": null,
    "overall_diameter_in": null,
    "rim_range": null,
    "three_peak_mountain_snowflake": null,
    "is_blem": false,
    "url": "https://simpletire.com/brands/gladiator-tires/qr900-mt"
  }
]
```

**Notes on sample data:**
- Rows 1-3: From SKU-level pages (full specs available)
- Rows 4-5: From category listing cards (only summary fields; must visit product/SKU page for full specs)
- `product_id: 0` means we only have the product line URL, not a specific SKU
- Full specs require visiting each `/p/{id}` SKU page

---

## Scraping Strategy Recommendations

1. **Entry points:** Start from `/categories/mud-terrain-tires` and `/categories/all-terrain-tires`
2. **Crawl path:** Category → Product line → Individual SKU pages (for full specs)
3. **Sitemap:** Use `https://simpletire.com/sitemap/sitemap-index.xml` to discover all product URLs
4. **Data extraction:** Parse the Technical Specs HTML table on each SKU page. All 16 spec fields are in a single `<table>` element.
5. **JSON-LD:** Extract `ProductGroup` structured data for brand, model, description, variant URLs
6. **Rate limiting:** Respect robots.txt, add delays between requests
7. **Per-size data:** The "Available sizes" tab on product line pages has a compact table with size, price, and key specs — could be used for bulk extraction without visiting every SKU page
