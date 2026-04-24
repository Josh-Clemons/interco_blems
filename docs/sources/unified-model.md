# Unified Tire Model v2

This document proposes the v2 data model for tires, grounded in the
field inventories from 8 source deep-dives. The bot tracks **all off-road
tires** across sources; blemished tires are flagged, not separated.

---

## Design Principles

1. **Core fields are mandatory** — every scraper MUST provide these
2. **Common fields are nullable** — scrapers provide what the source has
3. **Source-specific oddities go in `extra`** — a JSON column for fields
   that only one source exposes (SimpleScore, vendor-encoded sizing, etc.)
4. **Normalization happens at ingest** — price in cents, size canonical,
   stock_state derived from raw strings
5. **`is_blem` is a first-class flag** — not inferred, set by the scraper

---

## Field Definitions

### Core (required — scraper must provide or skip the row)

| Field       | Type    | Description                                  |
|-------------|---------|----------------------------------------------|
| source      | TEXT    | Source key (e.g. 'interco', 'simpletire')    |
| sku         | TEXT    | Source-specific unique identifier             |
| title       | TEXT    | Full product name as shown on the source     |
| size        | TEXT    | Tire size string, normalized (see below)     |
| price_cents | INTEGER | Current price in US cents (avoids floats)    |

Composite unique key: `(source, sku)`

### Identity & Classification

| Field        | Type    | Description                                  |
|--------------|---------|----------------------------------------------|
| brand        | TEXT    | Brand name, title-cased (e.g. 'Nitto')      |
| product_line | TEXT    | Model name (e.g. 'Mud Grappler', 'IROK')    |
| category     | TEXT    | Terrain type: 'mud', 'all-terrain', 'rock-crawling', 'highway', or NULL |
| is_blem      | INTEGER | 1 = blemished, 0 = standard inventory        |

### Pricing

| Field          | Type    | Description                               |
|----------------|---------|-------------------------------------------|
| price_cents    | INTEGER | Current listed price in cents              |
| msrp_cents     | INTEGER | Manufacturer suggested retail (when available) |
| sale_price_cents | INTEGER | Sale/clearance price if different from price_cents |

### Stock

| Field         | Type    | Description                                |
|---------------|---------|------------------------------------------- |
| quantity_raw  | TEXT    | Verbatim stock string from source          |
| quantity_n    | INTEGER | Parsed integer count (NULL if unparseable)  |
| stock_state   | TEXT    | Enum: 'in_stock', 'low_stock', 'out_of_stock', 'unknown' |

**Normalization rules for stock_state:**
- Numeric > 4 → 'in_stock'
- Numeric 1-4 → 'low_stock'
- Numeric 0 → 'out_of_stock'
- "In Stock" / "Available" → 'in_stock'
- "Low Stock" / "Limited" / "1-3 available" → 'low_stock'
- "Out of Stock" / "Sold Out" / quantity=0 → 'out_of_stock'
- "Call" / blank / missing → 'unknown'
- Scraper can override with source-specific logic

### Specs (nullable — filled when source provides them)

| Field         | Type    | Description                                |
|---------------|---------|--------------------------------------------|
| load_index    | INTEGER | Load index number (e.g. 121)               |
| speed_rating  | TEXT    | Speed rating letter (e.g. 'Q', 'S', 'T')  |
| load_range    | TEXT    | Load range letter (e.g. 'E', 'C', 'D')    |
| ply           | INTEGER | Ply count (e.g. 10, 8, 6)                 |
| weight_oz     | INTEGER | Tire weight in ounces (avoids floats)      |
| tread_depth_32| INTEGER | Tread depth in 32nds of an inch            |
| overall_diam  | REAL    | Overall diameter in inches                 |
| section_width | REAL    | Section width in inches                    |
| utqg_wear     | INTEGER | UTQG treadwear rating (e.g. 500)          |
| utqg_traction | TEXT    | UTQG traction grade (e.g. 'A', 'AA')      |
| utqg_temp     | TEXT    | UTQG temperature grade (e.g. 'B')         |
| three_pms     | INTEGER | Three-Peak Mountain Snowflake (1/0/NULL)   |

### URLs & Media

| Field        | Type | Description                                   |
|--------------|------|-----------------------------------------------|
| product_url  | TEXT | Full URL to the product page on source        |
| image_url    | TEXT | Primary product image URL                     |

### Metadata

| Field          | Type | Description                                  |
|----------------|------|----------------------------------------------|
| is_active      | INTEGER | 1 = currently listed, 0 = gone from site  |
| first_seen_at  | TEXT | ISO timestamp when first scraped              |
| last_seen_at   | TEXT | ISO timestamp of most recent scrape           |
| notified_at    | TEXT | When alert was sent (NULL = not yet)          |

### Overflow

| Field | Type | Description                                        |
|-------|------|----------------------------------------------------|
| extra | TEXT | JSON blob for source-specific fields not in schema |

**What goes in `extra`:**
- SimpleTire: SimpleScore, sub-scores, rim_range, inflation_pressure, tread_design, sidewall_type
- TreadWright: variant_tier (Standard/Premier/Kedge), vendor_encoded_size
- TireRack: survey_results, test_data
- Any new field from a single source that hasn't proven useful across sources

---

## Size Normalization

Tire sizes come in multiple formats across sources. Normalize to a
canonical string for matching:

| Raw format          | Canonical          | Notes                    |
|--------------------|--------------------|--------------------------|
| 35x12.50R17LT     | 35x12.50R17        | Strip suffix LT          |
| 35X12.50R17        | 35x12.50R17        | Lowercase X              |
| LT285/75R16        | 285/75R16          | Strip prefix LT          |
| 37X13.50R24        | 37x13.50R24        | Lowercase X              |
| 315/70R17          | 315/70R17          | Already canonical        |

Store both `size` (canonical) and keep raw in title. Subscription
matching uses canonical `size`.

---

## Source Field Coverage (confirmed from deep-dives)

| Field          | interco | tiremart | simpletire | tirerack | 4wp | treadwright | jegs | summit |
|----------------|---------|----------|------------|----------|-----|-------------|------|--------|
| sku            | ✅       | ✅        | ✅          | ✅        | ✅   | ✅           | ✅    | ✅      |
| title          | ✅       | ✅        | ✅          | ✅        | ✅   | ✅           | ✅    | ✅      |
| brand          | ✅*      | ✅        | ✅          | ✅        | ✅   | ✅*          | ✅    | ✅      |
| product_line   | ✅       | ✅        | ✅          | ✅        | ?   | ✅           | ?    | ✅      |
| size           | ✅       | ✅        | ✅          | ✅        | ✅   | ✅†          | ✅    | ✅      |
| price_cents    | ✅       | ✅        | ✅          | ✅        | ✅   | ✅           | ✅    | ✅      |
| msrp_cents     | ❌       | ✅        | ?          | ✅        | ?   | ✅           | ?    | ?      |
| is_blem        | ✅‡      | ✅        | ❌          | ❌        | ❌   | ✅           | ✅    | ?      |
| category       | ❌       | ✅        | ✅          | ✅        | ✅   | ✅           | ?    | ✅      |
| quantity_raw   | ✅       | ✅        | ✅          | ✅        | ✅   | ✅           | ?    | ?      |
| image_url      | ✅       | ✅        | ✅          | ✅        | ✅   | ✅           | ✅    | ✅      |
| product_url    | ✅       | ✅        | ✅          | ✅        | ✅   | ✅           | ✅    | ✅      |
| load_index     | ❌       | ✅        | ✅          | ✅        | ✅   | ❌           | ?    | ✅      |
| speed_rating   | ❌       | ✅        | ✅          | ✅        | ✅   | ❌           | ?    | ✅      |
| load_range     | ❌       | ✅        | ✅          | ✅        | ✅   | ❌           | ?    | ✅      |
| ply            | ❌       | ✅        | ✅          | ✅        | ✅   | ✅           | ?    | ?      |
| weight_oz      | ❌       | ❌        | ✅          | ✅        | ✅   | ❌           | ?    | ✅      |
| tread_depth_32 | ❌       | ✅        | ✅          | ✅        | ?   | ❌           | ?    | ?      |
| utqg_wear      | ❌       | ✅        | ❌          | ✅        | ?   | ❌           | ?    | ?      |
| utqg_traction  | ❌       | ✅        | ❌          | ✅        | ?   | ❌           | ?    | ?      |
| utqg_temp      | ❌       | ✅        | ❌          | ✅        | ?   | ❌           | ?    | ?      |
| three_pms      | ❌       | ❌        | ✅          | ✅        | ?   | ❌           | ?    | ?      |

*Brand implicit (single-brand manufacturer)
†TreadWright encodes size in vendor field + title; needs parsing
‡All Interco listings are blems by definition

---

## Feature Mapping

Which v2 fields power which downstream features:

| Feature                          | Fields used                                         |
|----------------------------------|-----------------------------------------------------|
| Phase 1 — feed alerts            | title, brand, size, price_cents, quantity_raw, is_blem |
| Phase 2 — /blems browse          | all core + is_blem + stock_state + image_url        |
| Phase 3 — subscriptions filter   | brand, size, price_cents, source, sku, is_blem, category |
| Phase 7 — /find cross-site       | all core + specs + stock_state + product_url + is_blem |
| Phase 8 — /history, /stats       | price_cents (over time), stock_state, first/last_seen |
| Phase 9 — /admin                 | source, is_active, last_seen_at, stock_state        |
