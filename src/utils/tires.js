/**
 * Pure helpers for working with tire data.
 *
 * parseDiameter(size) returns the overall diameter in inches, or null if it
 * can't be determined. Handles the formats seen on manufacturer sites:
 *
 *   NNxMM.MMRdd   e.g. "35x12.50R18LT"  -> 35   (leading number IS the diameter)
 *   NNXmm.mmRdd   e.g. "54x19.5/20LT"   -> 54
 *   NNNxMMRdd     e.g. "235x85R16"       -> null  (metric width, not a diameter)
 *   NNN/MMRdd     e.g. "245/55R19"       -> 29.6  (metric: computed from formula)
 *   NN/MM-dd      e.g. "14/42-17"        -> 42    (specialty: number after slash IS diameter)
 *   NN.N/MM-dd    e.g. "17.5/50-24"      -> 50    (specialty with decimal width)
 *
 * For metric sizes the computed diameter is a float; for all others it's an integer.
 */
function parseDiameter(size) {
    if (!size) return null;

    // Mud-terrain: "35x12.50R18LT" — leading integer IS the overall diameter
    const leading = size.match(/^(\d+)[xX]/);
    if (leading) {
        const n = parseInt(leading[1], 10);
        if (n > 100) return null; // "245x75R16" — metric width, not a diameter
        return n;
    }

    // Standard slash format where the leading token is a pure integer (no decimal)
    const slashMatch = size.match(/^(\d+)\/(\d+)(?:[Rr](\d+(?:\.\d+)?))?/);
    if (slashMatch) {
        const first = parseInt(slashMatch[1], 10);
        if (first > 100) {
            // Metric: WIDTH_mm / ASPECT_RATIO R RIM_DIAM  →  compute overall diameter
            const width  = first;
            const aspect = parseInt(slashMatch[2], 10);
            const rim    = slashMatch[3] ? parseFloat(slashMatch[3]) : null;
            if (rim == null) return null;
            return rim + 2 * (width * aspect / 100) / 25.4;
        }
        // Specialty "14/42-17" — number after slash IS the overall diameter
        return parseInt(slashMatch[2], 10);
    }

    // Fallback: decimal-width specialty formats like "17.5/50-24"
    const afterSlash = size.match(/\/(\d+)/);
    if (afterSlash) {
        return parseInt(afterSlash[1], 10);
    }

    return null;
}

/**
 * Parses the rim/wheel diameter from a size string, or null if undetermined.
 * Handles all formats seen across sources:
 *
 *   35x12.50R18LT  → 18    (after R)
 *   245/55R19      → 19    (after R)
 *   38x15.50R16.5  → 16.5  (decimal rim)
 *   14/42-17       → 17    (after dash)
 *   17.5/50-24     → 24    (after dash)
 *   54x19.5/20LT   → 20    (after trailing slash)
 */
function parseRimDiam(size) {
    if (!size) return null;

    // R-style rim: "R18", "R19", "R16.5"
    const rMatch = size.match(/[Rr](\d+(?:\.\d+)?)/);
    if (rMatch) return parseFloat(rMatch[1]);

    // Dash-style rim: "14/42-17", "17.5/50-24"
    const dashMatch = size.match(/-(\d+(?:\.\d+)?)$/);
    if (dashMatch) return parseFloat(dashMatch[1]);

    // Trailing-slash rim: "54x19.5/20LT" (x-format with slash rim, no R)
    const slashRim = size.match(/\/(\d+(?:\.\d+)?)[A-Za-z]*$/);
    if (slashRim) return parseFloat(slashRim[1]);

    return null;
}

/**
 * Parses a price string like "$888.00" into a number. Returns null if
 * unparseable.
 */
function parsePrice(price) {
    if (!price) return null;
    const m = price.replace(/,/g, '').match(/(\d+\.?\d*)/);
    return m ? parseFloat(m[1]) : null;
}

/**
 * Filters an array of tire objects against a freetext query and optional
 * diameter. Used by scraper search() methods to apply user input client-side.
 *
 * @param {object[]} tires
 * @param {string}   query  - matched against sku, title, brand, size (case-insensitive substring)
 * @param {object}   [opts]
 * @param {number}   [opts.size] - exact diameter in inches (uses parseDiameter)
 * @returns {object[]}
 */
function filterSearchResults(tires, query, { size } = {}) {
    const q = query ? query.toLowerCase() : null;
    return tires.filter(tire => {
        if (q) {
            const haystack = [tire.sku, tire.title, tire.brand, tire.size]
                .filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        if (size != null) {
            const diam = parseDiameter(tire.size);
            if (diam == null || diam !== size) return false;
        }
        return true;
    });
}

module.exports = { parseDiameter, parseRimDiam, parsePrice, filterSearchResults };
