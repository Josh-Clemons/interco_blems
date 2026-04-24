# Phase 5 — Go / No-Go Per Source

Decision matrix based on the 8 deep-dives completed 2026-04-19.

## Scoring

- **Data value**: richness of fields, catalog size, blem presence
- **Scrapeability**: bot protection difficulty, legal risk
- **Effort**: estimated dev time for a working scraper

---

## GO ✅

### 1. TreadWright — GO (easiest win)
- **Why:** Open Shopify JSON API, no auth, 124 products (64 blems + 60 regular)
- **Effort:** ~2 hours. Single fetch to `/collections/filter/products.json?limit=250`
- **Data:** Title, price, compare_at_price, images, tags (blem detection), variants
- **Gaps:** No load_index/speed_rating/tread_depth in API. Ply from title parsing.
- **Risk:** Tiny catalog. Low maintenance burden.
- **Build in:** Phase 6, first scraper after Interco

### 2. TireMart — GO (highest value blem source)
- **Why:** 65 active blems, BigCommerce SSR, ClaudeBot explicitly allowed
- **Effort:** ~4 hours. Standard HTML scraping with cheerio.
- **Data:** Rich — brand, model, size, specs (load/speed/ply/tread_depth/UTQG), price, stock, images
- **Gaps:** Many spec fields show "N/A" for blems specifically
- **Risk:** Low bot protection. BigCommerce is stable.
- **Build in:** Phase 6, second scraper

### 3. SimpleTire — GO (spec enrichment powerhouse)
- **Why:** Richest field coverage of any source. No bot protection observed.
- **Effort:** ~6 hours. Next.js SSR, cheerio + JSON-LD extraction.
- **Data:** 25+ fields including SimpleScore, reviews, tread_depth, weight, 3PMS, full specs
- **Gaps:** No blems. No UTQG. `/api/*` disallowed in robots.txt.
- **Risk:** Largest catalog — need to scope to off-road categories only to avoid overwhelming DB.
- **Build in:** Phase 6, after TireMart

---

## CONDITIONAL GO ⚠️

### 4. JEGS — Conditional (Cloudflare bypass needed)
- **Why:** Dedicated blem category, Interco brand carried (brand ID 895)
- **Effort:** ~8 hours (includes Cloudflare Turnstile bypass)
- **Data:** Expected: standard e-commerce fields. Unverified — no live pages accessed.
- **Gaps:** All page structure is inferred from platform (IBM WebSphere). Sitemaps are accessible.
- **Risk:** Cloudflare Turnstile. May need FlareSolverr or residential proxies.
- **Condition:** Only build if FlareSolverr or proxy infra is set up for another source first.
- **Build in:** Phase 6, after we solve CF bypass for any other source

### 5. Summit Racing — Conditional (Imperva bypass needed)
- **Why:** Major retailer, good off-road selection, blems occasionally available
- **Effort:** ~8-10 hours (Imperva Incapsula is aggressive)
- **Data:** Expected: rich specs, load/speed/weight/reviews. Partially observed.
- **Gaps:** Blem inventory is intermittent — may have zero blems at any time.
- **Risk:** Imperva blocks after 1-2 requests. Residential proxies mandatory.
- **Condition:** Only build if we invest in proxy infrastructure. Pair with JEGS work.
- **Build in:** Phase 6, late — after proxy infra proves reliable

### 6. 4WheelParts — Conditional (Cloudflare bypass needed)
- **Why:** Strong off-road specialist, good brand mix
- **Effort:** ~8 hours (Cloudflare Managed Challenge)
- **Data:** Inferred from platform — expected rich product cards + vehicle fitment
- **Gaps:** No blems. All page structure is inferred. No live data accessed.
- **Risk:** Owned by Polaris — may actively oppose scraping.
- **Condition:** Same as JEGS — needs CF bypass infra.
- **Build in:** Phase 6, only after CF bypass proven on JEGS

---

## NO-GO ❌ (for now)

### 7. TireRack — NO-GO (Akamai blocks everything)
- **Why not:** Akamai Bot Manager blocks ALL requests including robots.txt and homepage.
  Most aggressive protection of any source. Even residential proxies may not suffice.
- **Value if accessible:** Gold-standard specs including UTQG + independent test data.
- **Revisit when:** Akamai bypass tech improves, or they offer an affiliate API.
  Their spec data could also be used as a one-time enrichment via manual export.

### 8. eBay — NO-GO (complexity vs value)
- **Why not:** Multi-seller marketplace. Listings are inconsistent, normalization is
  painful, eBay API requires approval + rate limits, heavy bot protection for scraping.
- **Value if accessible:** Deal-hunting across many sellers. Blem keyword searchable.
- **Revisit when:** User demand is clear + eBay API approved.

---

## Recommended Build Order for Phase 6

```
1. TreadWright   (~2h)  — JSON API, instant win, validates multi-source pipeline
2. TireMart      (~4h)  — highest-value blem source, proves cheerio SSR path
3. SimpleTire    (~6h)  — spec enrichment, largest catalog, proves Next.js SSR path
   --- proxy infra investment decision point ---
4. JEGS          (~8h)  — only if CF bypass works
5. Summit        (~8h)  — only if Imperva bypass works
6. 4WheelParts   (~8h)  — only if CF bypass proven on JEGS
```

Total for first 3 (no proxy needed): ~12 hours
Total for all 6 (with proxy infra):  ~36+ hours including infra setup

---

## Field Coverage After First 3 Sources

With Interco + TreadWright + TireMart + SimpleTire:

| Field          | Coverage | Notes                              |
|----------------|----------|------------------------------------|
| sku            | 4/4      | All provide                        |
| title          | 4/4      |                                    |
| brand          | 4/4      | Interco/TreadWright implicit       |
| size           | 4/4      | Need normalization across formats  |
| price_cents    | 4/4      |                                    |
| is_blem        | 3/4      | SimpleTire = always false          |
| category       | 3/4      | Interco missing                    |
| image_url      | 4/4      |                                    |
| product_url    | 4/4      |                                    |
| load_index     | 2/4      | TireMart + SimpleTire              |
| speed_rating   | 2/4      | TireMart + SimpleTire              |
| ply            | 3/4      | Interco missing                    |
| weight_oz      | 1/4      | SimpleTire only                    |
| tread_depth_32 | 2/4      | TireMart + SimpleTire              |
| utqg           | 1/4      | TireMart only (often N/A)          |

Good enough to ship /find, /history, and subscriptions with meaningful
cross-source comparison.
