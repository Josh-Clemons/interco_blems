/**
 * Pure helpers for working with tire data.
 *
 * parseDiameter(size) returns the overall diameter in inches, or null if it
 * can't be determined. Handles the three common formats seen on manufacturer
 * sites:
 *
 *   NNxMM.MMRdd   e.g. "35x12.50R18LT"  -> 35
 *   NNXmm.mmRdd   e.g. "54x19.5/20LT"   -> 54
 *   NN/MM-dd      e.g. "14/42-17"       -> 42 (diameter follows the slash)
 *   NNNxMMRdd     e.g. "235x85R16"      -> null (metric width, not a diameter)
 */
function parseDiameter(size) {
    if (!size) return null;

    const leading = size.match(/^(\d+)[xX]/);
    if (leading) {
        const n = parseInt(leading[1], 10);
        if (n > 100) return null;     // metric width, not overall diameter
        return n;
    }

    const afterSlash = size.match(/\/(\d+)/);
    if (afterSlash) {
        return parseInt(afterSlash[1], 10);
    }

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

module.exports = { parseDiameter, parsePrice, filterSearchResults };
