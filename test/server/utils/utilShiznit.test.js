const {
    updateTires,
    getTimeUntilNextRun,
    getRandomInt,
    compareResults
} = require('../../../server/utils/utilShiznit');

describe('updateTires', () => {
    test('new tires in search results are added to the list', () => {
        const searchTires = [{ sku: 'SKU1', quantity: 1, price: 1 }];
        const databaseTires = [];
        const updatedTires = updateTires(searchTires, databaseTires);
        expect(updatedTires).toEqual([{ sku: 'SKU1', quantity: 1, price: 1, id: null}]);
    });

    test('match tire does not notify if price or quantity remain the same', () => {
        const searchTires = [{ sku: 'SKU1', quantity: 1, price: 1, notify: true }];
        const databaseTires = [{ sku: 'SKU1', quantity: 1, price: 1, notify: false }];
        const updatedTires = updateTires(searchTires, databaseTires);
        expect(updatedTires).toEqual([{ sku: 'SKU1', quantity: 1, price: 1, new: false, notify: false, discontinued: false }]);
    });

    test('match tire does not change notify if it was already true', () => {
        const searchTires = [{ sku: 'SKU1', quantity: 1, price: 1, notify: true }];
        const databaseTires = [{ id: 1, sku: 'SKU1', quantity: 1, price: 1, notify: true }];
        const updatedTires = updateTires(searchTires, databaseTires);
        expect(updatedTires).toEqual([{ id: 1, sku: 'SKU1', quantity: 1, price: 1, new: false, discontinued: false, notify: true }]);
    });

    test('tires not found in search get set to discontinue if active in database results', () => {
        const searchTires = [];
        const databaseTires = [{ sku: 'SKU1', quantity: 1, price: 1 }];
        const updatedTires = updateTires(searchTires, databaseTires);
        expect(updatedTires).toEqual([{ sku: 'SKU1', quantity: 1, price: 1, new: false, notify: false, discontinued: true }]);
    });
});

describe('getTimeUntilNextRun', () => {
    beforeEach(() => {
        // Use fake timers before each test
        jest.useFakeTimers('modern');
    });

    afterEach(() => {
        // Clean up after each test
        jest.useRealTimers();
    });

    test('should return time until next half hour mark during weekdays and working hours', () => {
        // Set the current date and time to be a weekday at 6:15am CT
        jest.setSystemTime(new Date('2024-04-12T11:15:00Z').getTime());

        const result = getTimeUntilNextRun();
        // 15 minutes in milliseconds
        const expected = 15 * 60 * 1000;

        expect(result).toBe(expected);
    });

    test('should return time until 6am of the same day during weekdays and before working hours', () => {
        // Mock the current date and time to be a weekday at 5:30am CT
        jest.setSystemTime(new Date('2024-04-12T10:30:00Z').getTime());

        const result = getTimeUntilNextRun();
        // 30 minutes in milliseconds
        const expected = 30 * 60 * 1000;

        expect(result).toBe(expected);
    });

    test('should return time until 6am of the next day during weekdays and after working hours', () => {
        // Mock the current date and time to be a weekday at 6:30pm
        jest.setSystemTime(new Date('2024-04-11T23:30:00Z').getTime());

        const result = getTimeUntilNextRun();
        // 11.5 hours in milliseconds
        const expected = 11.5 * 60 * 60 * 1000;

        expect(result).toBe(expected);
    });

    test('should return time until 6am Monday during Friday after hours', () => {
        // Mock the current date and time to be a friday at 6:30pm
        jest.setSystemTime(new Date('2024-04-12T23:30:00Z').getTime());

        const result = getTimeUntilNextRun();
        // 2 days 11.5 hours in milliseconds
        const expected = (2 * 24 + 11.5) * 60 * 60 * 1000;

        expect(result).toBe(expected);
    });

    test('should return time until next Monday at 6am during weekends', () => {
        // Mock the current date and time to be a Saturday at 10:30am
        jest.setSystemTime(new Date('2024-04-13T15:30:00Z').getTime());

        const result = getTimeUntilNextRun();
        // 1 day and 19.5 hours in milliseconds
        const expected = (24 + 19.5) * 60 * 60 * 1000;

        expect(result).toBe(expected);
    });
});