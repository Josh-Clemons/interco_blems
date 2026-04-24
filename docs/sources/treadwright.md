# TreadWright.com — Source Documentation

## Overview
- **Platform**: Shopify (store ID 8809120)
- **Rendering**: Server-side rendered HTML + Shopify Liquid templates. No SPA/JS framework required.
- **Product type**: Remolded (retreaded) off-road tires, made in USA. MT and AT patterns.
- **Blem model**: Blems are mixed into the same catalog as regular tires — not a separate storefront.

## Key URLs

| Purpose | URL |
|---------|-----|
| robots.txt | `https://www.treadwright.com/robots.txt` |
| Sitemap | `https://www.treadwright.com/sitemap.xml` |
| Full tire catalog (filtered page) | `https://www.treadwright.com/collections/filter` |
| All products | `https://www.treadwright.com/collections/all` |
| Specials collection | `https://www.treadwright.com/collections/specials` |
| Clearance collection | `https://www.treadwright.com/collections/clearance` |
| Product JSON (single) | `https://www.treadwright.com/products/{handle}.json` |
| Collection JSON | `https://www.treadwright.com/collections/{slug}/products.json?limit=250` |
| Product page | `https://www.treadwright.com/products/{handle}` |

## JSON API (Shopify built-in)

The Shopify `.json` endpoints are **the best scraping approach**. No authentication required.

- `/collections/filter/products.json?limit=250` — returns ALL tires (124 products as of 2026-04-19, including 64 blems and 60 regular)
- `/collections/specials/products.json?limit=250` — specials/blems subset
- `/products/{handle}.json` — full single product detail
- Pagination: if >250 products, use `?limit=250&page=2`

## How to Distinguish Blems from Regular Inventory

Three reliable signals (use all for confidence):

1. **`tags` array contains `"blemish"`** — most reliable programmatic signal
2. **Title prefix**: blem titles start with `"BLEMISH "` (e.g., `"BLEMISH LT | MT CLAW II 37x12.5R20 10 PLY REMOLD USA"`)
3. **Handle prefix**: blem handles start with `"blemish-"` (e.g., `"blemish-lt-mt-claw-ii-37x12-5r20-10-ply-remold-usa"`)
4. **`compare_at_price`**: blems always have a compare_at_price showing the original (non-blem) price
5. **Body HTML**: contains `"THIS IS A COSMETICALLY BLEMISHED TIRE"` in the description

## Title Format / Parsing

Titles follow a consistent pattern:
```
[BLEMISH] LT | {terrain_type} {pattern_name} {size} {ply_count} PLY REMOLD USA
```

Examples:
- `BLEMISH LT | MT CLAW II 37x12.5R20 10 PLY REMOLD USA`
- `LT | AT AXIOM 35x12.5R17 8 PLY REMOLD USA`
- `LT | MT MUD LORD 315/70R17 10 PLY REMOLD USA`

Regex to parse:
```
^(BLEMISH\s+)?(?:LT\s*\|\s*)?([AM]T)\s+(.+?)\s+([\d.]+[xX/][\d.]+[Rr][\d.]+)\s+(\d+)\s*PLY\s+REMOLD\s+USA$
```

Size formats: both `35x12.5R20` (inch) and `315/70R17` (metric) are used.

## Data Fields (from JSON API)

### Product level
| Field | Example | Notes |
|-------|---------|-------|
| `title` | `"BLEMISH LT \| MT CLAW II 37x12.5R20 10 PLY REMOLD USA"` | Parseable, see above |
| `handle` | `"blemish-lt-mt-claw-ii-37x12-5r20-10-ply-remold-usa"` | URL slug |
| `product_type` | `"Tire"` | Always "Tire" for tires |
| `vendor` | `"37 12.5 20 E"` | Encodes: width aspect rim load_range |
| `tags` | `["12.5", "20", "37", "B2B", "blemish", "CLAW II", "loadE", "M/T", "mt", "spinimages=8", "warranty"]` | Rich metadata |
| `body_html` | HTML description | Contains blem disclaimer if applicable |
| `images` | Array of image objects | Multiple angles, spin images |

### Variant level (options: wear tier)
| Field | Example | Notes |
|-------|---------|-------|
| `title` | `"Standard Wear"` / `"Premier Wear"` / `"Winter Kedge"` | Wear tier = tread depth |
| `price` | `"224.99"` | String, in USD |
| `compare_at_price` | `"299.99"` | Original/MSRP price (string or null) |
| `sku` | `"DUP C3720E - B2B"` | SKU encodes pattern+size+load |
| `available` | `true`/`false` | Stock status |
| `weight` | `74.9991` | In pounds |
| `weight_unit` | `"lb"` | |
| `option1` | `"Standard Wear"` | Same as title |

### Tags decode
| Tag | Meaning |
|-----|---------|
| `blemish` | Cosmetic blem |
| `sale` | On sale |
| `M/T` or `mt` | Mud terrain |
| `A/T` or `at` | All terrain |
| `loadE`, `loadD`, etc. | Load range |
| `B2B` | Business-to-business eligible |
| `commercial` | Commercial use |
| `Fleet` | Fleet eligible |
| `warranty` | Warranty available |
| `Studdable` | Can accept studs |
| `spinimages=8` | Number of 360° spin images |
| Numeric tags (`"37"`, `"12.5"`, `"20"`) | Width, aspect, rim size |
| `CLAW II`, etc. | Tread pattern name |
| `delayed shipping` | Not shipping immediately |

## Vendor Field Trick

The `vendor` field encodes tire specs as space-separated values:
`"37 12.5 20 E"` → width=37, aspect=12.5, rim=20, load_range=E

This is a **reliable structured parse** for size data without regex on the title.

## Sample Parsed Row JSON

```json
{
  "source": "treadwright",
  "is_blem": true,
  "title": "BLEMISH LT | MT CLAW II 37x12.5R20 10 PLY REMOLD USA",
  "handle": "blemish-lt-mt-claw-ii-37x12-5r20-10-ply-remold-usa",
  "url": "https://www.treadwright.com/products/blemish-lt-mt-claw-ii-37x12-5r20-10-ply-remold-usa",
  "terrain_type": "MT",
  "pattern": "CLAW II",
  "size": "37x12.5R20",
  "ply": 10,
  "load_range": "E",
  "product_type": "remold",
  "variants": [
    {
      "wear_tier": "Standard Wear",
      "price": 224.99,
      "compare_at_price": 299.99,
      "sku": "DUP C3720E - B2B",
      "available": false,
      "weight_lbs": 75.0
    },
    {
      "wear_tier": "Premier Wear",
      "price": 500.00,
      "compare_at_price": 234.99,
      "sku": "DUP C3720E - B2B - PW",
      "available": false,
      "weight_lbs": 75.0
    },
    {
      "wear_tier": "Winter Kedge",
      "price": 234.99,
      "compare_at_price": 244.99,
      "sku": "DUP C3720E - B2B - KG",
      "available": false,
      "weight_lbs": 75.0
    }
  ],
  "tags": ["12.5", "20", "37", "B2B", "blemish", "CLAW II", "commercial", "loadE", "M/T", "mt", "spinimages=8", "warranty"]
}
```

## Format Quirks

1. **Variant pricing anomalies**: Some "Premier Wear" variants have obviously wrong prices (e.g., $500 with compare_at of $234.99) — likely used to disable purchase. Check `available` field.
2. **Dual size formats**: Mix of inch (`35x12.5R20`) and metric (`315/70R17`) in same catalog.
3. **Tags are inconsistent case**: Both `"M/T"` and `"mt"` may appear; both `"A/T"` and `"at"`. Normalize to uppercase.
4. **SKU prefix `DUP`**: Appears on blem SKUs, likely "duplicate" — the blem version of a regular product.
5. **`/collections/all`** includes non-tire products (warranty, fuel surcharge, stickers, gift cards). Filter by `product_type == "Tire"`.
6. **Vendor field** is abused to store tire specs — not an actual vendor name.
7. **`compare_at_price`** exists on both blems AND sale items — not blem-exclusive. Use `tags.includes("blemish")` as the authoritative blem flag.
8. **All tires are remolds** (retreads on used casings). "REMOLD USA" is in every title.

## Bot Protection

- **Minimal**: Standard Shopify robots.txt. No Cloudflare, no captcha observed.
- **Shopify JSON API** is open — no API key needed for product reads.
- **Rate limiting**: Standard Shopify rate limits apply (~2 req/sec sustained is safe).
- **robots.txt**: Disallows `/search`, sort/filter URL params, checkout paths. Product and collection pages are fully allowed.
- **Nutch** is fully blocked. AhrefsBot and MJ12bot get `Crawl-delay: 10`.
- **No anti-bot JS** (no Kasada, DataDome, PerimeterX, etc.) detected.

## Recommended Scraping Strategy

1. Hit `/collections/filter/products.json?limit=250` (paginate if needed)
2. Filter to `product_type == "Tire"`
3. For each product, check `tags.includes("blemish")` to flag blems
4. Parse `vendor` field for structured size/load data
5. Use variant `available` field for stock status
6. Single-endpoint, no browser rendering needed — pure JSON fetch
