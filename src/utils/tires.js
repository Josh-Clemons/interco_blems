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

module.exports = { parseDiameter, parsePrice };
