// Must be set before any require so client.js uses an isolated in-memory DB.
process.env.DB_PATH = ':memory:';

const { getDb } = require('../../src/db/client');
const { searchTires } = require('../../src/db/repository');

function insert(overrides) {
    const row = {
        source: 'interco', sku: 'DEFAULT-SKU', brand: 'DefaultBrand',
        title: 'Default Tire 35x12.50R17LT', size: '35x12.50R17LT',
        is_active: 1, is_blem: 1,
        ...overrides,
    };
    getDb().prepare(`
        INSERT INTO tires (source, sku, brand, title, size, is_active, is_blem)
        VALUES (@source, @sku, @brand, @title, @size, @is_active, @is_blem)
    `).run(row);
}

beforeAll(() => {
    insert({ source: 'interco',    sku: 'XBOG-42R',   brand: 'Bogger',      title: 'Bogger 42x14.50R17LT',   size: '42x14.50R17LT'  });
    insert({ source: 'treadwright',sku: 'TW-CLAW37',  brand: 'TreadWright', title: 'CLAW II 37x12.50R17LT',  size: '37x12.50R17LT'  });
    insert({ source: 'tiremart',   sku: 'tm-irok-35', brand: 'Interco',     title: 'IROK ND 35x12.50R18',    size: '35x12.50R18'    });
    insert({ source: 'tiremart',   sku: 'tm-legacy-16', brand: 'Interco',   title: 'Legacy M/T 285/75R16',   size: '285/75R16'      });
    // Inactive row — must never appear in results
    insert({ source: 'interco',    sku: 'INACTIVE-1', brand: 'Bogger',      title: 'Old Bogger 37x12.50R17', size: '37x12.50R17LT', is_active: 0 });
});

describe('searchTires()', () => {
    test('matches on brand', () => {
        const r = searchTires('bogger');
        expect(r).toHaveLength(1);
        expect(r[0].sku).toBe('XBOG-42R');
    });

    test('is case-insensitive', () => {
        expect(searchTires('BOGGER')).toHaveLength(1);
        expect(searchTires('BogGer')).toHaveLength(1);
    });

    test('matches on sku', () => {
        const r = searchTires('XBOG-42R');
        expect(r).toHaveLength(1);
        expect(r[0].sku).toBe('XBOG-42R');
    });

    test('matches on size string', () => {
        const r = searchTires('37x12.50R17');
        expect(r).toHaveLength(1);
        expect(r[0].sku).toBe('TW-CLAW37');
    });

    test('matches on title substring', () => {
        const r = searchTires('claw');
        expect(r).toHaveLength(1);
        expect(r[0].brand).toBe('TreadWright');
    });

    test('excludes inactive tires', () => {
        // INACTIVE-1 is a Bogger but is_active=0
        const r = searchTires('bogger');
        expect(r).toHaveLength(1);
        expect(r.every(t => t.is_active === 1)).toBe(true);
    });

    test('returns empty array for no match', () => {
        expect(searchTires('xyznotexist123')).toHaveLength(0);
    });

    test('filters by source', () => {
        const all = searchTires('irok');
        expect(all).toHaveLength(1);

        const match = searchTires('irok', { source: 'tiremart' });
        expect(match).toHaveLength(1);
        expect(match[0].source).toBe('tiremart');

        const nomatch = searchTires('irok', { source: 'interco' });
        expect(nomatch).toHaveLength(0);
    });

    test('filters by diameter', () => {
        // 'R17' text matches XBOG-42R (42") and TW-CLAW37 (37")
        const both = searchTires('R17');
        expect(both).toHaveLength(2);

        const only37 = searchTires('R17', { size: 37 });
        expect(only37).toHaveLength(1);
        expect(only37[0].sku).toBe('TW-CLAW37');

        const only42 = searchTires('R17', { size: 42 });
        expect(only42).toHaveLength(1);
        expect(only42[0].sku).toBe('XBOG-42R');
    });

    test('source + diameter filters combine correctly', () => {
        const r = searchTires('R17', { source: 'treadwright', size: 37 });
        expect(r).toHaveLength(1);
        expect(r[0].sku).toBe('TW-CLAW37');

        const none = searchTires('R17', { source: 'treadwright', size: 42 });
        expect(none).toHaveLength(0);
    });

    test('filters by exact rim diameter', () => {
        const r17 = searchTires('R', { rim: 17 });
        expect(r17.map(t => t.sku).sort()).toEqual(['TW-CLAW37', 'XBOG-42R']);

        const r18 = searchTires('R', { rim: 18 });
        expect(r18.map(t => t.sku)).toEqual(['tm-irok-35']);

        const r16 = searchTires('R', { rim: 16 });
        expect(r16.map(t => t.sku)).toEqual(['tm-legacy-16']);
    });
});
