const {transporter} = require('../modules/emailClient');
const {fetchTiresFromDatabase, saveTiresToDatabase} = require('../repository/blemRepository');

const NOTIFY_LIST = ['mrjoshc@gmail.com']
async function sendUpdateEmail() {
    let tires = await fetchTiresFromDatabase();
    let newTires = tires.filter(tire => tire.new === true && tire.discontinued === false);
    let changedTires = tires.filter(tire => tire.new === false && tire.notify === true && tire.discontinued === false);

    let htmlBody = '<h2>New Tires</h2>';
    newTires.forEach(tire => {
        htmlBody += `
            <p>
                SKU: ${tire.sku}<br>
                Brand: ${tire.brand}<br>
                Price: ${tire.price}<br>
                Quantity: ${tire.quantity}<br>
            </p>
        `;
    });

    changedTires.size > 0 ? htmlBody += '<h2>Changed Tires</h2>' : "";
    changedTires.forEach(tire => {
        htmlBody += `
            <p>
                SKU: ${tire.sku}<br>
                Brand: ${tire.brand}<br>
                Price: ${tire.price}<br>
                Quantity: ${tire.quantity}<br>
            </p>
        `;
    });

    let mailOptions = {};
    mailOptions.from = process.env.EMAIL_ADDRESS;
    mailOptions.to = NOTIFY_LIST;
    mailOptions.subject = 'Interco Blem Update';
    mailOptions.html = htmlBody;

    // Create a new promise that resolves when the email has been sent
    let sendEmailPromise = new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                reject(error);
            } else {
                console.log('Email sent: ' + info.response);
                resolve(info);
            }
        });
    });

    for(let tire of tires) {
        tire.notify = false;
        tire.new = false;
    }

    // Wait for both the email to be sent and the tires to be saved to the database
    return Promise.all([sendEmailPromise, saveTiresToDatabase(tires)]);
}

module.exports = {
    sendUpdateEmail
}