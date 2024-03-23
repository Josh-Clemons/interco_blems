const {transporter} = require('../modules/emailClient');

const NOTIFY_LIST = ['mrjoshc@gmail.com']
async function sendUpdateEmail(tires) {
    let newTires = tires.filter(tire => tire.new === true && tire.discontinued === false);
    let changedTires = tires.filter(tire => tire.new === false && tire.notify === true && tire.discontinued === false);
    let notifyTires = JSON.parse(JSON.stringify(tires)); // create a deep copy of the tires array so original is not modified

    if(newTires.length === 0) {
        console.log('Not sending email, no new tires.');
        return {notifyTires};
    }

    for(let tire of notifyTires) {
        tire.notify = false;
        tire.new = false;
    }

    let htmlBody = '<h2>New Tires</h2>' +
        `<p>${new Date().toLocaleString()}</p>`;

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

    changedTires.length > 0 ? htmlBody += '<br><h2>Changed Tires</h2>' : "";
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


    console.log('Sending email');
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                reject(error);
            } else {
                console.log(`Email sent to: ${NOTIFY_LIST}`);
                resolve({notifyTires});
            }
        });
    });
}

module.exports = {
    sendUpdateEmail
}