# Summit Racing (summitracing.com) - Source Documentation

## Overview
Summit Racing Equipment is a major online auto parts retailer carrying off-road tires from
brands like Interco, Mickey Thompson, Nitto, BFGoodrich, Toyo, Pro Comp, and others.
They occasionally list blemished/cosmetically imperfect tires at discount.

## Bot Protection
- **WAF**: Imperva Incapsula (aggressive)
- **Behavior**: First 1-2 requests may succeed, then IP is blocked with:
  `"Request unsuccessful. Incapsula incident ID: ..."`
- **Implication**: Standard headless browsing is unreliable. Requires residential proxies,
  browser fingerprint spoofing, or API-level access. Rate limiting alone is insufficient.
- **robots.txt**: Permissive for major crawlers (Googlebot, Bingbot, Slurp). Blocks
  dotbot, Amazonbot entirely. Disallows checkout/account/cart/compare/login paths.
  Sitemap at: `https://www.summitracing.com/searchenginesitemap/sitemapindexsrefull.xml`

## Rendering Model
- **Server-side rendered** HTML with client-side hydration (not a pure SPA)
- Initial page load includes product data in HTML; JavaScript enhances filtering/sorting
- Search and faceted navigation use a mix of URL path segments and query parameters

## URL Structure

### Search/Listing Pages
```
# Keyword search
https://www.summitracing.com/search?keyword=off-road+tires

# Part type browse (canonical category path)
https://www.summitracing.com/search/part-type/off-road-tires
https://www.summitracing.com/search/part-type/mud-terrain-tires

# Faceted search with filters (brand, size, etc.)
https://www.summitracing.com/search/part-type/off-road-tires/brand/interco-tire
https://www.summitracing.com/search/part-type/off-road-tires?SortBy=BestMatch&PageSize=25

# Department browse
https://www.summitracing.com/departments/tires-wheels-and-accessories/tires
```

### Product Detail Pages (PDP)
```
# Format: /parts/{brand-slug}-{part-number}
https://www.summitracing.com/parts/interco-tire-m16-37
https://www.summitracing.com/parts/mck-90000024261
https://www.summitracing.com/parts/ngk-4554

# Reviews tab
https://www.summitracing.com/parts/{sku}/reviews
```

## Page Structure

### Listing Page (SRP)
- **Header**: Global nav, search bar (keyword, make/model, make/engine search modes)
- **Breadcrumb**: Home > Category > Subcategory
- **Left sidebar**: Faceted filters as tree navigation (Departments, Brands, plus
  tire-specific filters like Size, Diameter, Width, Load Range, Speed Rating)
- **Results area**: Grid of product cards
- **Pagination**: Standard page numbers, configurable page size (25/50/100)
- **Sort options**: Best Match, Price Low-High, Price High-Low, Brand A-Z, etc.

### Product Card (Listing)
Fields visible per card:
- Product image (thumbnail)
- Product name/title (linked)
- Star rating (e.g., "4.75 out of 5 stars")
- Review count (linked to reviews)
- Part number / SKU
- Price (regular and sale price if applicable)
- "Free Shipping" badge
- "Add to Cart" or "Select Options" button
- Availability/stock status

### Product Detail Page (PDP)
Full fields on detail pages:
- **Title**: Brand + descriptive product name
- **Part Number**: Summit's SKU (e.g., "INT-M16-37")
- **Manufacturer Part Number**: OEM part number
- **Brand**: Linked to brand page
- **Images**: Multiple product photos, zoomable
- **Price**: Regular, sale, MAP pricing
- **Availability**: In Stock / Ships in X days / Backordered
- **Free Shipping** indicator
- **Description**: Marketing copy, often lengthy
- **Specifications** (structured key-value table):
  - Tire Diameter
  - Tire Width
  - Tire Aspect Ratio
  - Tire Size (e.g., "37X13.50-16LT")
  - Wheel Diameter
  - Load Range
  - Speed Rating
  - Ply Rating
  - Tread Depth
  - Max Load (lbs)
  - Max PSI
  - Sidewall Style
  - Tire Type (Mud-Terrain, All-Terrain, etc.)
  - DOT Approved (Yes/No)
  - Tire Construction (Bias/Radial)
  - Weight
  - UPC
  - Warranty
- **Fitment**: Vehicle compatibility via make/model/year
- **Reviews**: Star breakdown, individual reviews with date/rating/text
- **Related Parts / Frequently Bought Together**
- **Q&A section**

## Blemished Tire Identification

### How Blems Appear on Summit
- **Blem tires are NOT a permanent category** — they appear intermittently as separate SKUs
- Look for keywords in the product title: "Blem", "Blemished", "Cosmetic Blem"
- Sometimes listed as separate part numbers with a "-B" or "BLEM" suffix
- May appear in search results for `keyword=blem+tires` or `keyword=blemished+tires`
- Price is typically 15-30% below the non-blem equivalent
- Product description usually includes disclaimer about cosmetic imperfections
- **No dedicated blem category/filter exists** — must search by keyword or monitor new listings

### Detection Strategy
1. Periodic keyword search: `blem`, `blemished`, `cosmetic blem` within tire categories
2. Monitor specific brands known for blems (Interco/Super Swamper, Mickey Thompson)
3. Compare part numbers — blem variants often share base part number with suffix
4. Check sitemap XML for new tire product URLs

## Sample Parsed Row JSON
```json
{
  "source": "summit_racing",
  "url": "https://www.summitracing.com/parts/interco-tire-m16-37",
  "sku": "INT-M16-37",
  "manufacturer_pn": "M16-37",
  "brand": "Interco Tire",
  "title": "Interco Super Swamper TSL/Bogger Tires",
  "tire_size": "37X13.00-16LT",
  "tire_diameter": 37.0,
  "tire_width": 13.0,
  "wheel_diameter": 16,
  "construction": "Bias",
  "tire_type": "Mud-Terrain",
  "load_range": "D",
  "ply_rating": 8,
  "speed_rating": null,
  "dot_approved": true,
  "price_regular": 489.97,
  "price_sale": null,
  "is_blem": false,
  "blem_indicators": [],
  "availability": "In Stock",
  "free_shipping": true,
  "rating": 4.75,
  "review_count": 41,
  "image_url": "https://www.summitracing.com/globalassets/images/...",
  "scraped_at": "2026-04-19T19:48:00Z"
}
```

## Format Quirks
1. **Tire size strings are inconsistent**: Some use "X" separator (37X13.50-16LT), others
   use "/" format (285/75R16). Must parse both formats.
2. **Price may be MAP-restricted**: Some items show "Add to Cart to See Price" — actual
   price only visible after adding to cart or via API call.
3. **SKU format**: Summit assigns their own SKUs (`INT-M16-37`) distinct from manufacturer
   part numbers (`M16-37`). Both are useful for matching.
4. **Pagination**: Default 25 results per page. Must paginate to get full catalog.
5. **Availability text varies**: "In Stock", "Ships in 1-2 Business Days",
   "Backordered - ETA [date]", "Out of Stock", "Discontinued".
6. **Duplicate listings**: Same physical tire may appear under multiple part numbers
   (e.g., kit vs. individual, blem vs. standard).
7. **Search path segments are slugified**: Part type "Off-Road Tires" → `off-road-tires`.
   Brand "Interco Tire" → `interco-tire`.

## Recommended Scraping Approach
Given Incapsula protection:
1. **Sitemap-first**: Parse `sitemapindexsrefull.xml` to discover all tire product URLs
   without triggering search-based bot detection.
2. **Residential proxies required**: Datacenter IPs are blocked after 1-2 requests.
3. **Rate limit**: Max 1 request per 3-5 seconds with randomized delays.
4. **Browser fingerprinting**: Use undetected-chromedriver or Playwright with stealth plugin.
5. **Alternative**: Summit Racing has a presence on Google Shopping / affiliate feeds that
   may provide structured product data without direct scraping.
6. **API endpoints**: Check for XHR calls to internal APIs during page load —
   `/typeaheadsearchresult` exists (blocked in robots.txt) and other JSON endpoints
   may be discoverable via network inspection.
