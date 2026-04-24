# Interco Tire Corporation (retroactive)

- URL(s):             https://www.intercotire.com/blem-list
- Rendering:          server (plain HTML table, no JS needed — `fetch` + cheerio works)
- robots.txt status:  allowed (`/blem-list` is not disallowed; robots.txt is standard Drupal boilerplate blocking `/admin/`, `/core/`, `/search/`, etc.)
- ToS status:         needs review (no explicit scraping clause found; page is publicly accessible without login)
- Requires login:     no

## Blem / closeout page

- Layout:             single HTML `<table>` with `<thead>` + `<tbody>`
- Pagination:         none (all tires rendered in one page)
- CMS:                Drupal (evidenced by robots.txt comments, `views-*` table header IDs)
- is_blem:            **always true** — this page is exclusively cosmetically blemished tires

### Page structure

The page has two main sections:

1. **Introductory text** — explains what a blem is, ordering rules (phone-only at 800-299-8000), all-sales-final policy, payment methods, and preference to sell sets of 4+.
2. **Data table** — a Drupal Views table with 7 columns.

### Raw field inventory

Each `<tr>` in `<tbody>` contains 7 `<td>` cells identified by `headers` attributes:

| # | `headers` attribute                                | Content                        | Maps to          |
|---|---------------------------------------------------|--------------------------------|------------------|
| 1 | `view-views-conditional-field-1-table-column`     | Thumbnail image (link to detail page) | extra.image_url / extra.detail_url |
| 2 | `view-views-conditional-field-table-column`       | SKU as `<a>` link              | tires.sku        |
| 3 | `view-title-table-column`                         | Full title (brand + size)      | tires.title      |
| 4 | `view-field-brand-table-column`                   | Brand / tread pattern name     | tires.brand      |
| 5 | `view-field-size-table-column`                    | Size string                    | tires.size       |
| 6 | `view-field-stock-table-column`                   | Quantity in `<span>`           | tires.quantity   |
| 7 | `view-price-number-table-column`                  | Price with `$` prefix          | tires.price      |

The SKU cell (col 2) and image cell (col 1) both contain `<a href="/blem/...">` links pointing to a detail page for that tire.

### Column header IDs (for table sorting)

The `Title` column header is a sortable link (`?order=title&sort=asc`). Other headers are static text.

## Sample parsed JSON row

```json
{
  "sku": "XBOG-5420",
  "title": "Bogger 54x19.5/20LT",
  "brand": "Bogger",
  "size": "54x19.5/20LT",
  "quantity": "4",
  "price": "$888.00"
}
```

## Format quirks / gotchas

1. **Size strings are non-standard** — mix of flotation (`54x19.5/20LT`), metric-ish (`235x85R16`), competition (`14/42-17`), and standard (`33X12.50R20`). Parsing diameter requires handling all four formats.
2. **Price is a display string** — includes `$` and commas; needs stripping for numeric comparison.
3. **Quantity is text** — always a bare integer string inside a `<span>`, but stored as TEXT.
4. **Title = brand + size concatenated** — redundant with columns 4+5 but sometimes has slightly different formatting.
5. **SKU link doubles as detail URL** — the `<a>` in column 2 has `href="/blem/<slug>"` which could be captured for richer embeds.
6. **Image column exists but is ignored** — column 1 has a thumbnail image wrapped in a link. The scraper skips it entirely.
7. **No explicit is_blem field** — the entire page is blems; the scraper/DB must set `is_blem = true` implicitly (currently the DB schema has no `is_blem` column; the `source = 'interco'` effectively implies it).
8. **Malformed-row guard** — rows missing both SKU and size are skipped (scraper checks `if (!sku || !size)`).
9. **No pagination** — all inventory loads in a single page. If the list grows very large this could change, but currently it's a single-shot scrape.

## Gaps: what the scraper does NOT currently extract

| Available on page         | Currently captured? | Notes                                          |
|--------------------------|--------------------|-------------------------------------------------|
| Thumbnail image URL      | ❌                 | Col 1 `<img>` src — useful for Discord embeds   |
| Detail page URL          | ❌                 | Col 1/2 `<a>` href — `/blem/<slug>`             |
| Sortable column headers  | N/A                | Not data, but could be used for alt sort orders  |

### DB schema gaps

The `tires` table stores: `source, sku, title, brand, size, quantity, price, is_active, first_seen_at, last_seen_at, notified_at`. There is no:
- `is_blem` column (implied by source; may need explicit flag when non-blem sources are added)
- `image_url` column
- `detail_url` / `product_url` column
- `extra` JSON column (proposed in roadmap for source-specific overflow)

## Catalog / search page (for /find)

Interco does not expose a public search API or catalog endpoint for blems. The blem list is the only source. Their main tire catalog at `/tires` is a separate browsing experience with no blem pricing.

## Verdict

✅ **Go** — already implemented and working. Server-rendered, no bot-detection, robots.txt allows access, single-page table is trivial to parse. Future enhancements: capture image_url and detail_url for richer Discord embeds.
