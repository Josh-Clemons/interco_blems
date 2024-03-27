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
});