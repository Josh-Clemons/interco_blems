const {Builder, By} = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const {logger} = require('../clients/logClient');

async function fetchTiresFromInterco() {

    let driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(new chrome.Options().addArguments("--headless"))
        .build();

    await driver.manage().setTimeouts({ pageLoad: 240000 });

    let tires = [];
    try {

        const sizesToCheck = [
            "37X", "/37",
            "38X", "/38",
            "39X", "/39",
            "40X", "/40",
            "41X", "/41",
            "42X", "/42",
            "43X", "/43",
            "44X", "/44",
            "45X", "/45",
            "46X", "/46",
            "47X", "/47",
            "48X", "/48",
            "49x", "/49",
            "51X", "/51",
            "52X", "/52",
            "53X", "/53",
            "54X", "/54"]

        logger.info('Fetching tires from Interco');
        await driver.get('https://www.intercotire.com/blem_list_0');

        const tables = await driver.findElements(By.tagName("table"));
        let rows = [];
        for(let size of sizesToCheck) {
            // checks the first table only (this is the "Light Truck" table)
            const newRows = await tables[0].findElements(By.xpath(`.//tr[.//td[contains(text(), '${size}')]]`));
            rows.push(...newRows);
        }

        logger.info('Found', rows.length, 'tires');

        for(let i = 0; i < rows.length; i++){
            const tdsInRow = await rows[i].findElements(By.tagName("td"));

            const sku = await tdsInRow[1].getText();
            const brand = await tdsInRow[2].getText();
            const size = await tdsInRow[3].getText();
            const quantity = await tdsInRow[4].getText();
            const price = await tdsInRow[5].getText();

            const tire = {
                sku: sku,
                brand: brand,
                size: size,
                quantity: quantity,
                price: price,
                notify: true,
                new: true,
                discontinued: false
            }
            tires = [...tires, tire];
        }
    } finally {
        await driver.quit();
    }
    return tires;
}

module.exports = {
    fetchTiresFromInterco
}