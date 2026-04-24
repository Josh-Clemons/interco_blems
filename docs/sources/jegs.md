# JEGS.com - Source Documentation

## Overview

JEGS High Performance is a major automotive parts retailer with a dedicated
**Blemished Tires** category. They carry Interco and other off-road tire brands.

- **Base URL**: `https://www.jegs.com`
- **Blem Category**: `/c/Tires_Blemished-Tires/10215/10002/-1`
- **Broader Tire Catalog**: `/c/Tires/10215/10002/-1` (parent category)

## Bot Protection

**Cloudflare Turnstile** — aggressive. All browsing pages trigger a JS challenge.

- Challenge type: Cloudflare Turnstile (auto-solving widget, sometimes interactive)
- Ray IDs returned on block pages
- robots.txt blocks many international bots by user-agent
- Filter/facet URLs with `?fq=` params are disallowed (except single category/brand)
- Sitemap available at `https://www.jegs.com/sitemap_index.xml`

**Implications for scraping:**
- Headless browsers will be blocked without Cloudflare bypass
- Options: residential proxies + browser fingerprint spoofing, or use sitemap-based approach
- Sitemap index contains ~36+ gzipped product sitemaps (`product_sitemap1.xml.gz` through `product_sitemap36.xml.gz+`)
- Sitemaps are NOT behind Cloudflare (XML served directly)
- **Recommended approach**: Parse sitemaps for blem tire product URLs, then fetch with cf-bypass

## URL Structure

### Category Pages
```
/c/{Category_Subcategory}/{categoryId}/{storeId}/{langId}
```
- Example: `/c/Tires_Blemished-Tires/10215/10002/-1`
- `10002` = store ID (JEGS main store)
- `-1` = language ID (English)
- Pagination: likely `?pageNum=N` or `?No=N` query params
- Filtering: `?fq=category:{id}&fq=BrandId:{id}` pattern

### Product Detail Pages (PDP)
```
/i/{BrandName}/{brandId}/{partNumber}/{storeId}/{langId}
```
- Example: `/i/Interco/895/M16-39-6/10002/-1`
- `895` = Interco's brand ID on JEGS
- Part numbers use manufacturer SKUs with hyphens

### Brand Pages
```
/b/{BrandName}/{brandId}/{storeId}/{langId}
```

## Rendering Model

- **Server-side rendered** (SSR) HTML with IBM WebSphere Commerce backend
  (`webapp/wcs/stores/servlet/` paths visible in robots.txt disallows)
- Product data likely embedded in page HTML + JSON-LD structured data
- Some dynamic content loaded via AJAX for pricing/availability
- Uses WCS (WebSphere Commerce Suite) URL patterns

## Expected Page Structure (Category Listing)

Based on JEGS' known IBM WCS platform:

### Listing Page Fields
- Product thumbnail image
- Product name/title (includes brand, model, size)
- JEGS Part Number
- Manufacturer Part Number
- Price (sale/regular)
- Star rating / review count
- "Add to Cart" / "View Details" button
- Availability/stock status
- "Blemished" or "Blem" designation in title or badge

### Product Detail Page Fields
- Full product title
- Brand name
- JEGS part number
- Manufacturer part number
- UPC/EAN (possibly)
- Price (regular, sale, savings)
- Product images (multiple)
- Description / features list
- Specifications table:
  - Tire size
  - Overall diameter
  - Tread width
  - Rim width range
  - Load rating
  - Speed rating
  - Ply rating
  - Tire type (bias/radial)
  - Sidewall style
  - DOT approved (yes/no)
  - Weight
- Fitment / vehicle compatibility
- Reviews (BazaarVoice integration likely)
- Related products
- Q&A section

## Blemish Identification Method

JEGS uses a **dedicated category** for blemished tires:
- Category path: `Tires > Blemished Tires`
- Category ID: `10215` (for the blem subcategory)
- Blem products likely have "Blemished" or "Blem" in the product title
- May also use a "Condition: Blemished" attribute
- Same manufacturer part number as the non-blem version (possibly with a suffix)
- Pricing shows discount vs. regular (non-blem) price

**Detection strategy:**
1. Scrape the `/c/Tires_Blemished-Tires/10215/10002/-1` category
2. Cross-reference with title containing "Blem" or "Blemished"
3. Category membership alone is sufficient for blem identification

## Sample Parsed Row JSON

```json
{
  "source": "jegs",
  "url": "https://www.jegs.com/i/Interco/895/M16-39-6B/10002/-1",
  "brand": "Interco",
  "model": "Super Swamper TSL/Bogger",
  "title": "Interco Super Swamper TSL/Bogger Blemished Tire 39.5x13.50-16",
  "jegs_part_number": "895-M16-39-6B",
  "mfr_part_number": "M16-39-6B",
  "tire_size": "39.5x13.50-16",
  "overall_diameter": 39.5,
  "tread_width": 13.5,
  "rim_diameter": 16,
  "price": 389.99,
  "regular_price": 489.99,
  "in_stock": true,
  "is_blem": true,
  "blem_source": "category",
  "condition": "Blemished",
  "image_url": "https://www.jegs.com/images/product/895/895-M16-39-6B.jpg",
  "scraped_at": "2026-04-19T19:47:00Z"
}
```

## Format Quirks

1. **IBM WebSphere Commerce** backend — URLs contain storeId/langId params
2. **Numeric category IDs** don't map intuitively; must discover via navigation
3. **Part number encoding**: hyphens in part numbers are preserved in URLs
4. **Brand ID mapping**: Interco = 895 on JEGS
5. **Cloudflare**: Sitemaps bypass CF but all HTML pages are challenged
6. **Price visibility**: May require session/cookie to see actual pricing
7. **Pagination**: WCS typically uses `beginIndex` parameter for pagination
   (e.g., `?beginIndex=24` for page 2 with 24 items per page)
8. **robots.txt** explicitly disallows multi-facet filtered URLs but allows
   single category filter — respect this for polite scraping

## Sitemap Strategy

Since Cloudflare blocks direct browsing, the recommended scraping approach:

1. Download `sitemap_index.xml` (not CF-protected)
2. Download each `product_sitemap{N}.xml.gz` 
3. Filter URLs matching `/i/Interco/` or blem-related patterns
4. Use a CF-bypass solution (e.g., cloudscraper, FlareSolverr) for product pages
5. Parse HTML for structured data (JSON-LD, meta tags, spec tables)

## robots.txt Summary

- Sitemap: `https://www.jegs.com/sitemap_index.xml`
- Disallowed: `*/webapp/wcs/stores/servlet/*` (internal WCS paths)
- Disallowed: Multi-facet `?fq=` URLs (3+ filters)
- Allowed: Single `?fq=category*` filter
- Allowed: Category + Brand dual filter
- Disallowed: `?bvstate=*` (BazaarVoice review pagination)
- Disallowed: `?N=*` (faceted nav)
- Disallowed: `*Specials?*`, `*AllInstantRebates?*`
- Many international bots fully blocked (Yandex, Baidu ecosystem, etc.)
- No explicit crawl-delay for default user-agent

## Status

- **Cloudflare blocks headless browsing** — could not inspect live pages
- URL structure and platform confirmed from robots.txt analysis
- Sitemap accessible and contains 36+ product sitemap files
- Need CF-bypass tooling for actual data extraction
- Dedicated blem category confirmed at `/c/Tires_Blemished-Tires/10215/10002/-1`
