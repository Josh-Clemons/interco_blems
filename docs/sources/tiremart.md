# TireMart.com Source Documentation

## Overview
- **Platform**: BigCommerce (images hosted on cdn11.bigcommerce.com, store ID `s-e8i94i2k1a`)
- **Blem count**: 65 active blem products (317 model categories, most empty)
- **Primary blem URL**: `https://www.tiremart.com/blemished-tires/` (deals page, 65 results)
- **Secondary blem URL**: `https://www.tiremart.com/blem-tires` (brand page, 317 model subcategories)

## robots.txt
- ClaudeBot explicitly **allowed** (`Allow: /`)
- Scrapy explicitly listed with `Crawl-delay: 10`
- Disallowed: `/search.php`, `/account.php`, `/cart.php`, `/checkout`, `/admin/`, `/brands`
- Product and category pages are **allowed**

## URL Structure

| Page Type | Pattern | Example |
|-----------|---------|---------|
| Blem deals listing | `/blemished-tires/` | `https://www.tiremart.com/blemished-tires/` |
| Blem brand hub | `/blem-tires` | `https://www.tiremart.com/blem-tires` |
| Blem model category | `/blem/{model-slug}-tires` | `https://www.tiremart.com/blem/sc011-tires` |
| Product detail (blem) | `/{brand}-{model}-{size}-{specs}-blem/` | `/venom-power-terra-hunter-x-t-lt-37x13-50r24-120q-e-10-ply-blem/` |
| Product detail (non-blem) | `/{brand}-{model}-{size}-{specs}/` | Same pattern without `-blem` suffix |

**Pagination**: The `/blemished-tires/` page shows all 65 results on a single page (no pagination observed). Category pages with products may paginate via `?page=N` (BigCommerce standard).

## Rendering Model
- **Server-side rendered HTML** (BigCommerce Stencil theme)
- Product cards and specs are in the initial HTML payload
- Some UI interactions (filters, "Show Tire Specifications" expand) use JavaScript
- No SPA/client-side rendering — standard SSR with JS enhancements
- Images lazy-loaded from BigCommerce CDN

## Page Structure

### Listing Page (`/blemished-tires/`)
- **Layout**: Product cards in a vertical list
- **Filters sidebar**: Season, Brand, Tire Model, Size, Load Range, Performance, Speed Rating, Stud Type, Rating, Price Range, Vehicle Type
- **Sort options**: Most Popular, Newest, Name A-Z/Z-A, Price Low-High/High-Low
- **Each card contains**:
  - "Blemished" badge/label
  - Product image (link)
  - Brand name (paragraph)
  - Model name (h4 heading, linked)
  - Size string (e.g., "37X13.50R24, 120Q")
  - Season icon + text (e.g., "All Season")
  - Performance/terrain type (e.g., "Mud Terrain", "Extreme Terrain")
  - Load/Speed rating text (e.g., "LOAD/SPEED: 120Q")
  - Load Range with icon (e.g., "Load Range: E (10 Ply)")
  - Price (sale price shown, sometimes with strikethrough retail price)
  - Per-tire and total price (e.g., "$307.99 Per Tire Total for 4 = $1,231.96")
  - Quantity selector (default qty varies: 1, 2, or 4)
  - Stock status (e.g., "In Stock (10+)")
  - Purchase constraint (e.g., "Must be purchased as set of 2", "Must buy as a single")
  - "Show Tire Specifications" expandable link
  - "ADD TO CART" button
  - Free shipping badge

### Product Detail Page
All listing fields plus:
- **Full title**: "{Brand} {Model} {Size} {LoadSpeed} {LoadRange} (BLEM)"
- **Multiple product images** (3+ typically)
- **Star rating** + review count
- **Blem disclaimer**: "Blemished - TIRE CONTAINS COSMETIC IMPERFECTIONS"
- **Member pricing** mention (login to see)
- **Retail price** (MSRP/strikethrough) + sale price + savings amount/percent
- **Financing**: "As low as $X/mo"
- **Tire Specifications table** with fields:
  - SKU (e.g., "BN1376203-99")
  - MPN (e.g., "B-TVPXT50")
  - Season
  - Sidewall (e.g., "BSW: Black Side Wall")
  - Car Type (e.g., "Light Truck")
  - Aspect Ratio
  - Size
  - Load Range
  - Brand
  - Load Index
  - Tread Depth
  - Performance
  - UTQG
  - Treadlife/Warranty
  - Section Width
  - Run Flat
  - Model
  - Speed Rating Description
  - Rim Diameter
  - Overall Diameter
- **Blem explanation section**: "COSMETIC Blemished TIRE" heading with details
- **Compatible Vehicles** section
- **Shipping Information**
- **Reviews** section

## Blem Identification Method
1. **URL**: Product URL ends with `-blem/` or contains `-blem-`
2. **Title**: Product title contains "(BLEM)" at end
3. **Badge**: "Blemished" text label rendered on listing card and detail page
4. **Brand field**: Listed under brand "BLEM" in site taxonomy (breadcrumb: Home > By Brand > BLEM)
5. **Category**: Products appear under `/blemished-tires/` deals category
6. **MPN prefix**: Blem MPNs appear to start with "B-" (e.g., "B-TVPXT50")
7. **Detail page disclaimer**: "Blemished - TIRE CONTAINS COSMETIC IMPERFECTIONS"

**Recommendation**: Use URL suffix `-blem` or title containing `(BLEM)` as primary blem flag. The `/blemished-tires/` category page is the canonical source for all active blem inventory.

## Bot Protection Level
- **Low**: No Cloudflare, no CAPTCHA, no rate limiting observed
- BigCommerce standard platform — no aggressive bot detection
- robots.txt explicitly allows Claude bots
- Crawl-delay of 10 seconds requested for AI bots (respect this)
- Norton Shopping Guarantee badge present (not a bot blocker)
- Live chat widget (Zendesk-style) present

## Format Quirks
1. **Size format inconsistency**: Mix of metric (255/65R18) and flotation (37X13.50R24) formats
2. **Many empty categories**: `/blem-tires` lists 317 models but most have "no products listed" — use `/blemished-tires/` instead
3. **Quantity constraints**: Some tires must be bought as singles, pairs, or sets of 4; default qty varies per product
4. **N/A fields**: Many spec fields (Aspect Ratio, Tread Depth, UTQG, Treadlife) show "N/A" for blem tires
5. **Brand vs actual brand**: The "brand" in site taxonomy is "BLEM" — the real manufacturer brand (e.g., "Venom Power", "Prinx") is shown separately
6. **Price display**: Some show retail + sale price with savings; others show only current price
7. **MPN format**: Blem MPNs use "B-" prefix (e.g., B-TVPXT50) vs regular tire MPNs

## Sample Parsed Rows (5 products)

```json
[
  {
    "source": "tiremart",
    "url": "/venom-power-terra-hunter-x-t-lt-37x13-50r24-120q-e-10-ply-blem/",
    "is_blem": true,
    "brand": "Venom Power",
    "model": "Terra Hunter X/T",
    "size": "37X13.50R24",
    "load_index": 120,
    "speed_rating": "Q",
    "load_range": "E",
    "ply": 10,
    "season": "All Season",
    "performance": "Extreme Terrain",
    "car_type": "Light Truck",
    "sidewall": "BSW",
    "price": 307.99,
    "retail_price": 410.75,
    "sku": "BN1376203-99",
    "mpn": "B-TVPXT50",
    "in_stock": true,
    "min_qty": 4,
    "rim_diameter": 24,
    "overall_diameter": 37,
    "section_width": 13.50,
    "aspect_ratio": null,
    "tread_depth": null,
    "utqg": null,
    "run_flat": false
  },
  {
    "source": "tiremart",
    "url": "/prinx-hicountry-m-t-hm1-lt-33x12-50r18-118q-e-10-ply-blem/",
    "is_blem": true,
    "brand": "Prinx",
    "model": "HiCountry M/T HM1",
    "size": "33X12.50R18",
    "load_index": 118,
    "speed_rating": "Q",
    "load_range": "E",
    "ply": 10,
    "season": "All Season",
    "performance": "Mud Terrain",
    "car_type": "Light Truck",
    "sidewall": null,
    "price": 186.99,
    "retail_price": null,
    "sku": null,
    "mpn": null,
    "in_stock": true,
    "min_qty": 4,
    "rim_diameter": 18,
    "overall_diameter": 33,
    "section_width": 12.50,
    "aspect_ratio": null,
    "tread_depth": null,
    "utqg": null,
    "run_flat": null
  },
  {
    "source": "tiremart",
    "url": "/gripmax-maxgrip-classic-g-t-3-ply-sidewall-225-75r15-102h-blem/",
    "is_blem": true,
    "brand": "Gripmax",
    "model": "MaxGrip Classic G/T",
    "size": "225/75R15",
    "load_index": 102,
    "speed_rating": "H",
    "load_range": "SL",
    "ply": null,
    "season": "All Season",
    "performance": "Touring",
    "car_type": null,
    "sidewall": null,
    "price": 57.71,
    "retail_price": null,
    "sku": null,
    "mpn": null,
    "in_stock": true,
    "min_qty": 1,
    "rim_diameter": 15,
    "overall_diameter": null,
    "section_width": 225,
    "aspect_ratio": 75,
    "tread_depth": null,
    "utqg": null,
    "run_flat": null
  },
  {
    "source": "tiremart",
    "url": "/mrf-wanderer-a-t-a3-255-65r18-111t-blem/",
    "is_blem": true,
    "brand": "MRF",
    "model": "Wanderer A/T A3",
    "size": "255/65R18",
    "load_index": 111,
    "speed_rating": "T",
    "load_range": "SL",
    "ply": null,
    "season": "All Season",
    "performance": "All Terrain",
    "car_type": null,
    "sidewall": null,
    "price": 53.71,
    "retail_price": null,
    "sku": null,
    "mpn": null,
    "in_stock": true,
    "min_qty": 1,
    "rim_diameter": 18,
    "overall_diameter": null,
    "section_width": 255,
    "aspect_ratio": 65,
    "tread_depth": null,
    "utqg": null,
    "run_flat": null
  },
  {
    "source": "tiremart",
    "url": "/roadone-uhp-275-45r20-110w-blem-tire",
    "is_blem": true,
    "brand": "Roadone",
    "model": "UHP",
    "size": "275/45R20",
    "load_index": 110,
    "speed_rating": "W",
    "load_range": "SL",
    "ply": null,
    "season": "Summer",
    "performance": "High Performance",
    "car_type": null,
    "sidewall": null,
    "price": 86.71,
    "retail_price": 115.75,
    "sku": null,
    "mpn": null,
    "in_stock": true,
    "min_qty": 2,
    "rim_diameter": 20,
    "overall_diameter": null,
    "section_width": 275,
    "aspect_ratio": 45,
    "tread_depth": null,
    "utqg": null,
    "run_flat": null
  }
]
```

## Scraping Strategy Recommendations
1. **Primary target**: Scrape `/blemished-tires/` — single page with all 65 active blems
2. **Detail pages**: Hit each product detail URL for full specs (SKU, MPN, sidewall, diameters, etc.)
3. **Rate limit**: Respect 10-second crawl delay
4. **Blem flag**: Set `is_blem=true` for all products from this source; detect via URL `-blem` suffix
5. **Real brand extraction**: Parse brand from the `<p>` tag above model heading (not from "BLEM" taxonomy)
6. **Size parsing**: Handle both metric (255/65R18) and flotation (37X13.50R24) formats
7. **BigCommerce API**: Site may expose `/api/storefront/` endpoints for structured JSON — worth investigating as alternative to HTML scraping
