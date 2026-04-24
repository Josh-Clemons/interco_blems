# Phase 5 — Schema Impact Summary

## Current Schema (v1)

```sql
tires (id, source, sku, title, brand, size, quantity, price, is_active,
       first_seen_at, last_seen_at, notified_at)
```

All fields TEXT except id (INTEGER) and is_active (INTEGER).

## Required Changes for v2

### 1. New columns on `tires` (additive — no data loss)

```sql
ALTER TABLE tires ADD COLUMN product_line   TEXT;
ALTER TABLE tires ADD COLUMN category       TEXT;  -- 'mud', 'all-terrain', etc.
ALTER TABLE tires ADD COLUMN is_blem        INTEGER NOT NULL DEFAULT 1;  -- existing rows are all blems
ALTER TABLE tires ADD COLUMN price_cents    INTEGER;
ALTER TABLE tires ADD COLUMN msrp_cents     INTEGER;
ALTER TABLE tires ADD COLUMN sale_price_cents INTEGER;
ALTER TABLE tires ADD COLUMN quantity_raw   TEXT;   -- rename quantity → quantity_raw
ALTER TABLE tires ADD COLUMN quantity_n     INTEGER;
ALTER TABLE tires ADD COLUMN stock_state    TEXT DEFAULT 'unknown';
ALTER TABLE tires ADD COLUMN load_index     INTEGER;
ALTER TABLE tires ADD COLUMN speed_rating   TEXT;
ALTER TABLE tires ADD COLUMN load_range     TEXT;
ALTER TABLE tires ADD COLUMN ply            INTEGER;
ALTER TABLE tires ADD COLUMN weight_oz      INTEGER;
ALTER TABLE tires ADD COLUMN tread_depth_32 INTEGER;
ALTER TABLE tires ADD COLUMN overall_diam   REAL;
ALTER TABLE tires ADD COLUMN section_width  REAL;
ALTER TABLE tires ADD COLUMN utqg_wear      INTEGER;
ALTER TABLE tires ADD COLUMN utqg_traction  TEXT;
ALTER TABLE tires ADD COLUMN utqg_temp      TEXT;
ALTER TABLE tires ADD COLUMN three_pms      INTEGER;
ALTER TABLE tires ADD COLUMN product_url    TEXT;
ALTER TABLE tires ADD COLUMN image_url      TEXT;
ALTER TABLE tires ADD COLUMN extra          TEXT;  -- JSON blob
```

### 2. Data migration for existing rows

```sql
-- Backfill is_blem for existing interco rows (all are blems)
UPDATE tires SET is_blem = 1 WHERE source = 'interco';

-- Migrate price TEXT → price_cents INTEGER
UPDATE tires SET price_cents = CAST(REPLACE(REPLACE(price, '$', ''), ',', '') AS REAL) * 100
WHERE price IS NOT NULL;

-- Copy quantity → quantity_raw
UPDATE tires SET quantity_raw = quantity WHERE quantity IS NOT NULL;

-- Derive quantity_n from numeric quantities
UPDATE tires SET quantity_n = CAST(quantity AS INTEGER)
WHERE quantity GLOB '[0-9]*';

-- Derive stock_state
UPDATE tires SET stock_state = CASE
    WHEN quantity_n IS NOT NULL AND quantity_n > 4 THEN 'in_stock'
    WHEN quantity_n IS NOT NULL AND quantity_n > 0 THEN 'low_stock'
    WHEN quantity_n IS NOT NULL AND quantity_n = 0 THEN 'out_of_stock'
    ELSE 'unknown'
END;
```

### 3. After migration, drop old columns (optional, can defer)

SQLite doesn't support DROP COLUMN before 3.35.0. If needed:
- Create new table with v2 schema
- INSERT INTO new_table SELECT ... FROM tires
- DROP TABLE tires
- ALTER TABLE new_table RENAME TO tires

Or just leave old `price` and `quantity` columns as deprecated.

### 4. New indexes

```sql
CREATE INDEX IF NOT EXISTS idx_tires_source    ON tires(source);
CREATE INDEX IF NOT EXISTS idx_tires_brand     ON tires(brand);
CREATE INDEX IF NOT EXISTS idx_tires_size      ON tires(size);
CREATE INDEX IF NOT EXISTS idx_tires_blem      ON tires(is_blem);
CREATE INDEX IF NOT EXISTS idx_tires_active    ON tires(is_active);
CREATE INDEX IF NOT EXISTS idx_tires_category  ON tires(category);
CREATE INDEX IF NOT EXISTS idx_tires_price     ON tires(price_cents);
```

### 5. No new tables needed

The `extra` JSON column absorbs source-specific fields without new tables.
A separate `tire_details` sideload table was considered but rejected —
the spec fields (load_index, ply, etc.) are small and frequently read,
so they belong on the main row.

---

## Impact on Existing Code

| File                      | Change needed                                    |
|---------------------------|--------------------------------------------------|
| src/scrapers/interco.js   | Emit new fields: is_blem=1, price_cents, quantity_raw, stock_state, product_url, image_url |
| src/db/repository.js      | Update INSERT/UPSERT to include new columns      |
| src/tracker.js            | Diff logic may need to account for price_cents vs price |
| src/bot/commands/blems.js | Read from new fields (price_cents, stock_state)  |
| src/bot/embeds.js         | Display image_url, product_url, is_blem badge    |
| src/alertFilter.js        | Add is_blem filter option                        |
| database.sql              | Full v2 schema                                   |

### Migration strategy

Run as a one-time migration script (not in database.sql which is for
fresh installs). Existing interco data is preserved; new columns are
nullable so the scraper can be updated incrementally.
