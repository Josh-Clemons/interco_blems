# 4WheelParts.com — Source Documentation

**Priority:** MEDIUM
**Category:** Off-road specialty retailer (owned by Polaris/Transamerican Auto Parts)
**Last reviewed:** 2026-04-19
**Status:** BLOCKED by Cloudflare — requires advanced bypass strategy

---

## Bot Protection

### Cloudflare Challenge (CONFIRMED)
- **Every page** (including robots.txt) returns Cloudflare "Performing security verification"
- Challenge type: Cloudflare Managed Challenge (JS challenge + possible Turnstile CAPTCHA)
- Ray ID rotates per request
- Standard headless browsers are immediately detected and blocked
- Even Wayback Machine has minimal/no archived pages for this domain
- **Residential proxies + advanced stealth mode required** for any scraping

### Bypass Requirements
- Browserbase with `BROWSERBASE_ADVANCED_STEALTH=true` and Scale plan (residential proxies)
- Alternatively: Playwright with stealth plugin + residential proxy rotation
- Or: Use their mobile app API (if discoverable) which may have weaker protection
- Cookie persistence / session reuse essential once challenge is solved
- Rate limiting likely in place on top of Cloudflare

---

## URL Structure (from known site architecture)

4WheelParts uses a category-based URL scheme:

```
Base: https://www.4wheelparts.com

Category listings:
/t/tires                              — All tires
/t/tires/mud-terrain-tires            — Mud terrain category
/t/tires/all-terrain-tires            — All terrain category
/t/tires/highway-terrain-tires        — Highway terrain
/t/tires/rock-crawling-tires          — Rock crawling specialty

Product detail pages:
/p/{brand}-{product-slug}/{sku}
Example: /p/interco-super-swamper-tsl-sx/J-12345

Search/filter:
/t/tires?brand=Interco&size=35x12.50R17
Query params for filtering: brand, size, type, priceRange, sort, page
```

### Pagination
- Query param based: `?page=2`, `?page=3`
- Likely 24-48 products per page

---

## Rendering Model

- **Server-Side Rendered (SSR)** with React/Next.js hydration (based on typical Polaris retail stack)
- Product data likely embedded in `__NEXT_DATA__` JSON blob in page source
- Some dynamic content loaded via XHR/fetch API calls
- Image lazy loading with placeholder swaps

---

## Listing Page Structure (Expected)

### Page Layout
- Header: Vehicle selector (Year/Make/Model), search bar, cart
- Breadcrumbs: Home > Tires > Mud Terrain Tires
- Left sidebar: Filters (Brand, Size, Price, Rating, Terrain Type)
- Main grid: Product cards in 3-4 column layout
- Pagination: Bottom of grid

### Listing Card Data Fields

| Field | Selector Hint | Example |
|-------|--------------|---------|
| Product Name | `.product-card h3` or similar | "Pro Comp Xtreme MT2 Tire" |
| Brand | Extracted from name or separate element | "Pro Comp" |
| Image URL | `img.product-image` | CDN hosted, usually 300-400px |
| Price | `.price` / `.sale-price` | "$249.99" |
| Original Price | `.was-price` / `.list-price` | "$299.99" (if on sale) |
| Rating | Stars widget / aria-label | "4.5 out of 5" |
| Review Count | Near rating | "(127)" |
| SKU/Part Number | May be in data attributes | "77012" |
| Size | Often in product name | "35x12.50R17" |
| In Stock | Badge or text | "In Stock" / "Ships Free" |
| Free Shipping Badge | Promotional flag | "FREE SHIPPING" |
| Fitment Note | Vehicle-specific | "Fits your 2020 Jeep Wrangler" |

---

## Product Detail Page Structure (Expected)

### Data Fields

| Field | Description | Example |
|-------|-------------|---------|
| Product Title | Full product name | "Interco Super Swamper TSL/SX 36x12.50-16.5" |
| Brand | Manufacturer | "Interco" |
| SKU / Part # | Store SKU | "SX2-24" |
| MPN | Manufacturer part number | "SX2-24" |
| Price | Current selling price | "$389.99" |
| MSRP / List Price | Original price | "$429.99" |
| Tire Size | Formatted size string | "36x12.50-16.5" |
| Tire Width | Numeric | "12.50" |
| Aspect Ratio | Numeric or N/A for flotation | — |
| Rim Diameter | Inches | "16.5" |
| Load Range | Letter code | "D" |
| Load Index | Numeric | "121" |
| Speed Rating | Letter | "Q" |
| Ply Rating | Numeric | "8" |
| Terrain Type | Category tag | "Mud Terrain" |
| Tread Depth | 32nds of inch | "22/32" |
| Overall Diameter | Inches | "36.0" |
| Section Width | Inches | "12.7" |
| Tread Width | Inches | "10.0" |
| Weight | Pounds | "62 lbs" |
| Max PSI | Pressure rating | "50 PSI" |
| Sidewall Style | Description | "Outlined White Letters" |
| UTQG | Treadwear/Traction/Temp | Not always present for off-road |
| Warranty | Mileage warranty | "No mileage warranty" (common for M/T) |
| Description | Marketing text | Long HTML paragraph |
| Features | Bullet list | ["Self-cleaning tread", "Aggressive sidewall"] |
| Images | Multiple angles | Array of CDN URLs |
| Reviews | User reviews section | Stars + text |
| Availability | Stock status | "In Stock" / "Available to Order" |
| Shipping | Free shipping flag | "FREE Standard Shipping" |
| Fitment Data | Vehicle compatibility | Year/Make/Model lookup |
| Related Products | Cross-sells | Array of similar tires |
| Installation Available | In-store install option | "Installation Available" |

---

## Sample Parsed Row JSON

```json
{
  "source": "4wheelparts",
  "url": "https://www.4wheelparts.com/p/interco-super-swamper-tsl-sx/SX2-24",
  "scraped_at": "2026-04-19T19:45:00Z",
  "brand": "Interco",
  "product_name": "Super Swamper TSL/SX",
  "full_title": "Interco Super Swamper TSL/SX 36x12.50-16.5",
  "sku": "SX2-24",
  "mpn": "SX2-24",
  "price": 389.99,
  "msrp": 429.99,
  "currency": "USD",
  "in_stock": true,
  "free_shipping": true,
  "tire_size": "36x12.50-16.5",
  "tire_size_parsed": {
    "width_in": 12.50,
    "diameter_overall": 36.0,
    "rim_diameter": 16.5,
    "format": "flotation"
  },
  "terrain_type": "Mud Terrain",
  "load_range": "D",
  "ply_rating": 8,
  "speed_rating": "Q",
  "tread_depth_32nds": 22,
  "weight_lbs": 62.0,
  "sidewall": "Outlined White Letters",
  "rating_avg": 4.7,
  "rating_count": 43,
  "image_urls": [
    "https://cdn.4wheelparts.com/images/product/SX2-24_1.jpg",
    "https://cdn.4wheelparts.com/images/product/SX2-24_2.jpg"
  ],
  "description": "The Interco Super Swamper TSL/SX features...",
  "features": [
    "Three-stage lug design",
    "Self-cleaning tread pattern",
    "TSL-type tread with SX compound"
  ],
  "category_path": "Tires > Mud Terrain Tires",
  "installation_available": true
}
```

---

## Format Quirks

1. **Tire size formats vary:** Mix of metric (LT285/70R17) and flotation (35x12.50R17) in same listings
2. **Price may require vehicle selection:** Some prices only display after Year/Make/Model is selected
3. **SKU vs MPN confusion:** 4WheelParts uses internal SKUs that may differ from manufacturer part numbers
4. **Multiple sizes per product page:** Some products show a size selector dropdown — each size is effectively a different product
5. **Sale pricing:** Frequent sales with "MAP" (Minimum Advertised Price) enforcement — real price may only show in cart
6. **"Call for Price" items:** Some products hide pricing; these cannot be scraped for price data
7. **Store inventory vs online:** "In Stock" may refer to online warehouse, not specific store locations
8. **Image CDN:** Images served from CDN with transformations (size params in URL)
9. **React hydration:** If scraping HTML, data in `__NEXT_DATA__` or `window.__PRELOADED_STATE__` is more reliable than DOM parsing

---

## Scraping Strategy Recommendations

### Approach 1: Browser Automation (Preferred)
- Use Playwright + stealth plugin with residential proxies
- Solve Cloudflare challenge once, persist cookies
- Navigate category pages, extract `__NEXT_DATA__` JSON
- Rate limit: 1 request per 3-5 seconds minimum

### Approach 2: API Discovery
- Monitor network requests for XHR/fetch calls to internal API
- Common patterns: `/api/products`, `/api/search`, GraphQL endpoint
- API responses typically contain all structured product data
- May require auth token extracted from page load

### Approach 3: Google Shopping Feed
- 4WheelParts likely submits product feeds to Google Shopping
- Can be accessed via Google Shopping search as a secondary validation source

### Priority Targets for Interco Blems Project
- Search/filter for brand "Interco" specifically
- Categories: Mud Terrain, Rock Crawling
- Key product lines: Super Swamper TSL, Bogger, IROK, Cobalt M/T

---

## robots.txt (Unable to Access)

Cloudflare blocks even robots.txt. Typical expected content based on similar retail sites:

```
User-agent: *
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /api/
Crawl-delay: 10
Sitemap: https://www.4wheelparts.com/sitemap.xml
```

Actual content **unverified** — must be confirmed once Cloudflare bypass is achieved.

---

## Integration Notes

- **Data freshness:** Prices change frequently; daily scraping recommended for active monitoring
- **Deduplication:** Use MPN (manufacturer part number) as canonical key, not 4WP internal SKU
- **Cross-reference:** Match against Interco's own product catalog by MPN for blem identification
- **Legal:** Respect robots.txt once accessible; 4WP ToS likely prohibits scraping — use for personal/research only
