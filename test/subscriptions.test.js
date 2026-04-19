const {
    tireMatchesSubscription,
    hasNarrowingFilter,
    eventsForSub,
    buildUserHits,
    dispatchSubscriptionAlerts,
} = require('../src/subscriptions');

const tire = (over = {}) => ({
    source: 'interco',
    sku: 'SKU1',
    brand: 'Bogger',
    size: '37x12.50R17LT',
    quantity: '4',
    price: '$450.00',
    ...over,
});

const sub = (over = {}) => ({
    id: 1,
    user_id: 'u1',
    source: null,
    sku: null,
    brand: null,
    size: null,
    size_min: null,
    price_max: null,
    notify_dm: 1,
    notify_channel: null,
    notify_changed: 0,
    notify_removed: 0,
    active: 1,
    ...over,
});

describe('tireMatchesSubscription', () => {
    test('no filters matches everything', () => {
        expect(tireMatchesSubscription(tire(), sub())).toBe(true);
    });

    test('source must match exactly', () => {
        expect(tireMatchesSubscription(tire(), sub({ source: 'interco' }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ source: 'mickey' }))).toBe(false);
    });

    test('sku is exact (case-insensitive)', () => {
        expect(tireMatchesSubscription(tire(), sub({ sku: 'SKU1' }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ sku: 'sku1' }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ sku: 'SKU2' }))).toBe(false);
    });

    test('size is exact (case-insensitive)', () => {
        expect(tireMatchesSubscription(tire(), sub({ size: '37x12.50R17LT' }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ size: '37X12.50R17LT' }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ size: '35x12.50R17LT' }))).toBe(false);
    });

    test('brand is case-insensitive substring', () => {
        expect(tireMatchesSubscription(tire(), sub({ brand: 'bog' }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ brand: 'maxxis' }))).toBe(false);
    });

    test('size_min excludes smaller tires', () => {
        expect(tireMatchesSubscription(tire(), sub({ size_min: 35 }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ size_min: 40 }))).toBe(false);
    });

    test('price_max excludes overpriced tires', () => {
        expect(tireMatchesSubscription(tire(), sub({ price_max: 500 }))).toBe(true);
        expect(tireMatchesSubscription(tire(), sub({ price_max: 400 }))).toBe(false);
    });

    test('all filters AND together', () => {
        const s = sub({ source: 'interco', brand: 'bogger', size_min: 35, price_max: 500 });
        expect(tireMatchesSubscription(tire(), s)).toBe(true);
        expect(tireMatchesSubscription(tire({ price: '$999.00' }), s)).toBe(false);
    });
});

describe('hasNarrowingFilter', () => {
    test('empty sub has none', () => {
        expect(hasNarrowingFilter(sub())).toBe(false);
    });
    test('only price_max / source do not narrow', () => {
        expect(hasNarrowingFilter(sub({ price_max: 500 }))).toBe(false);
        expect(hasNarrowingFilter(sub({ source: 'interco' }))).toBe(false);
    });
    test('sku, brand, size, size_min all narrow', () => {
        expect(hasNarrowingFilter(sub({ sku: 'X' }))).toBe(true);
        expect(hasNarrowingFilter(sub({ brand: 'bogger' }))).toBe(true);
        expect(hasNarrowingFilter(sub({ size: '37x12.50R17' }))).toBe(true);
        expect(hasNarrowingFilter(sub({ size_min: 37 }))).toBe(true);
    });
});

describe('eventsForSub', () => {
    test('default = added + reactivated only', () => {
        expect(eventsForSub(sub())).toEqual(['added', 'reactivated']);
    });
    test('notify_changed adds changed', () => {
        expect(eventsForSub(sub({ notify_changed: 1 }))).toEqual(['added', 'reactivated', 'changed']);
    });
    test('notify_removed adds removed', () => {
        expect(eventsForSub(sub({ notify_removed: 1 }))).toEqual(['added', 'reactivated', 'removed']);
    });
    test('both add both', () => {
        expect(eventsForSub(sub({ notify_changed: 1, notify_removed: 1 })))
            .toEqual(['added', 'reactivated', 'changed', 'removed']);
    });
});

describe('buildUserHits', () => {
    test('dedupes when one tire matches multiple subs for same user', () => {
        const diff = { added: [tire()], reactivated: [], changed: [], removed: [] };
        const subs = [
            sub({ id: 1, user_id: 'u1', brand: 'bog' }),
            sub({ id: 2, user_id: 'u1', size_min: 30 }),
        ];
        const byUser = buildUserHits(diff, subs);
        const entry = byUser.get('u1');
        expect(entry.subs.size).toBe(2);
        expect(entry.tires.size).toBe(1);
    });

    test('includes reactivated', () => {
        const diff = { added: [], reactivated: [tire()], changed: [], removed: [] };
        expect(buildUserHits(diff, [sub()]).get('u1').tires.size).toBe(1);
    });

    test('excludes changed unless notify_changed', () => {
        const diff = { added: [], reactivated: [], changed: [tire()], removed: [] };
        expect(buildUserHits(diff, [sub()]).size).toBe(0);
        expect(buildUserHits(diff, [sub({ notify_changed: 1 })]).get('u1').tires.size).toBe(1);
    });

    test('excludes removed unless notify_removed', () => {
        const diff = { added: [], reactivated: [], changed: [], removed: [tire()] };
        expect(buildUserHits(diff, [sub()]).size).toBe(0);
        expect(buildUserHits(diff, [sub({ notify_removed: 1 })]).get('u1').tires.size).toBe(1);
    });

    test('tags pinned when any matching sub has sku set', () => {
        const diff = { added: [tire()], reactivated: [], changed: [], removed: [] };
        const entry = buildUserHits(diff, [sub({ sku: 'SKU1' })]).get('u1');
        expect(entry.anyPinned).toBe(true);
        const hit = entry.tires.get('interco:SKU1');
        expect(hit.pinned).toBe(true);
        expect(hit.event).toBe('added');
    });

    test('pinned wins when broad + pinned both match', () => {
        const diff = { added: [tire()], reactivated: [], changed: [], removed: [] };
        const subs = [
            sub({ id: 1, user_id: 'u1', brand: 'bogger' }),
            sub({ id: 2, user_id: 'u1', sku: 'SKU1' }),
        ];
        const entry = buildUserHits(diff, subs).get('u1');
        expect(entry.anyPinned).toBe(true);
        expect(entry.tires.get('interco:SKU1').pinned).toBe(true);
    });

    test('separate users get separate entries', () => {
        const diff = { added: [tire()], reactivated: [], changed: [], removed: [] };
        const subs = [sub({ id: 1, user_id: 'u1' }), sub({ id: 2, user_id: 'u2' })];
        expect(buildUserHits(diff, subs).size).toBe(2);
    });
});

describe('dispatchSubscriptionAlerts', () => {
    function makeDeps(overrides = {}) {
        return {
            getActiveSubscriptions: () => [sub()],
            sendDm:      jest.fn().mockResolvedValue(undefined),
            sendChannel: jest.fn().mockResolvedValue(undefined),
            buildEmbedsForUser: jest.fn(() => ({ embeds: [{ title: 'x' }] })),
            logger: { warn: jest.fn() },
            ...overrides,
        };
    }

    const baseDiff = { added: [tire()], reactivated: [], changed: [], removed: [] };

    test('dm route calls sendDm, not sendChannel', async () => {
        const deps = makeDeps();
        const stats = await dispatchSubscriptionAlerts(baseDiff, deps);
        expect(deps.sendDm).toHaveBeenCalledTimes(1);
        expect(deps.sendChannel).not.toHaveBeenCalled();
        expect(stats.usersNotified).toBe(1);
    });

    test('channel route calls sendChannel, not sendDm', async () => {
        const deps = makeDeps({
            getActiveSubscriptions: () => [sub({ notify_dm: 0, notify_channel: 'chan1' })],
        });
        await dispatchSubscriptionAlerts(baseDiff, deps);
        expect(deps.sendChannel).toHaveBeenCalledWith('chan1', expect.any(Object));
    });

    test('dm failure is counted, does not throw', async () => {
        const deps = makeDeps({ sendDm: jest.fn().mockRejectedValue(new Error('DMs closed')) });
        const stats = await dispatchSubscriptionAlerts(baseDiff, deps);
        expect(stats.dmFailures).toBe(1);
        expect(stats.usersNotified).toBe(0);
    });

    test('no subs = no-op', async () => {
        const deps = makeDeps({ getActiveSubscriptions: () => [] });
        const stats = await dispatchSubscriptionAlerts(baseDiff, deps);
        expect(stats.usersNotified).toBe(0);
        expect(deps.sendDm).not.toHaveBeenCalled();
    });

    test('one message per user even with multiple matching subs', async () => {
        const deps = makeDeps({
            getActiveSubscriptions: () => [
                sub({ id: 1, user_id: 'u1' }),
                sub({ id: 2, user_id: 'u1', brand: 'bog' }),
            ],
        });
        await dispatchSubscriptionAlerts(baseDiff, deps);
        expect(deps.sendDm).toHaveBeenCalledTimes(1);
    });

    test('pinned watch with track_removed gets alerted on removal', async () => {
        const deps = makeDeps({
            getActiveSubscriptions: () => [sub({ sku: 'SKU1', notify_removed: 1 })],
        });
        const diff = { added: [], reactivated: [], changed: [], removed: [tire()] };
        const stats = await dispatchSubscriptionAlerts(diff, deps);
        expect(stats.usersNotified).toBe(1);
    });
});
