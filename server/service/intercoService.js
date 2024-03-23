const {Builder, By} = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function fetchTiresFromInterco() {

    let driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(new chrome.Options().addArguments("--headless"))
        .build();


    let tires = [];
    try {

        const sizesToCheck = [
            "40X", "/40",
            "41X", "/41",
            "42X", "/42",
            "43X", "/43",
            "44X", "/44",
            "45X", "/45",
            "46X", "/46",
            "47X", "/47",
            "48X", "/48",
            "51X", "/51",
            "52X", "/52",
            "53X", "/53",
            "54X", "/54"]

        await driver.get('https://www.intercotire.com/blem_list_0');

        const tables = await driver.findElements(By.tagName("table"));
        let rows = [];
        for(let size of sizesToCheck) {
            // checks the first table only (this is the "Light Truck" table)
            const newRows = await tables[0].findElements(By.xpath(`.//tr[.//td[contains(text(), '${size}')]]`));
            rows.push(...newRows);
        }

        console.log('\n******* Lets find them big bitches ********');
        console.log('Found', rows.length, 'rows');
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
            console.log(tire);
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