const { parseDiameter, parsePrice, extractSizeToken } = require('../../src/utils/tires');

describe('parseDiameter()', () => {
    test('35x12.50R18LT  -> 35', () => expect(parseDiameter('35x12.50R18LT')).toBe(35));
    test('54x19.5/20LT   -> 54', () => expect(parseDiameter('54x19.5/20LT')).toBe(54));
    test('14/42-17       -> 42', () => expect(parseDiameter('14/42-17')).toBe(42));
    test('33X12.50R20    -> 33', () => expect(parseDiameter('33X12.50R20')).toBe(33));
    test('235x85R16 (metric) -> null', () => expect(parseDiameter('235x85R16')).toBeNull());
    test('245x75R16 (metric) -> null', () => expect(parseDiameter('245x75R16')).toBeNull());
    test('null/empty -> null', () => {
        expect(parseDiameter('')).toBeNull();
        expect(parseDiameter(null)).toBeNull();
    });
});

describe('parsePrice()', () => {
    test('$888.00   -> 888',  () => expect(parsePrice('$888.00')).toBe(888));
    test('$1,299.99 -> 1299.99', () => expect(parsePrice('$1,299.99')).toBe(1299.99));
    test('$199      -> 199',  () => expect(parsePrice('$199')).toBe(199));
    test('bogus     -> null', () => expect(parsePrice('free!')).toBeNull());
    test('null      -> null', () => expect(parsePrice(null)).toBeNull());
});

describe('extractSizeToken()', () => {
    test('extracts flotation size from title', () => {
        expect(extractSizeToken('Nitto Mud Grappler 33x12.50R20LT Light Truck Tires')).toBe('33x12.50R20LT');
    });

    test('extracts metric size from title', () => {
        expect(extractSizeToken('Some Model 285/75R16 Tire')).toBe('285/75R16');
    });

    test('returns null when no size token present', () => {
        expect(extractSizeToken('Westlake Mud Terrain Light Truck Tires')).toBeNull();
    });
});
