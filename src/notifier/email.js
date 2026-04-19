require('dotenv').config();
const nodemailer = require('nodemailer');

const NOTIFY_EMAILS = (process.env.NOTIFY_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function buildTransport() {
    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST || 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

function tireRows(tires) {
    return tires.map(t => `
        <tr>
            <td style="padding:6px 12px;border:1px solid #ddd;">${t.sku}</td>
            <td style="padding:6px 12px;border:1px solid #ddd;">${t.brand || ''}</td>
            <td style="padding:6px 12px;border:1px solid #ddd;">${t.size}</td>
            <td style="padding:6px 12px;border:1px solid #ddd;">${t.quantity}</td>
            <td style="padding:6px 12px;border:1px solid #ddd;">${t.price}</td>
        </tr>`).join('');
}

function tableHeader(heading) {
    return `
        <h2 style="font-family:sans-serif;color:#333;">${heading}</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
            <thead>
                <tr style="background:#f4f4f4;">
                    <th style="padding:6px 12px;border:1px solid #ddd;">SKU</th>
                    <th style="padding:6px 12px;border:1px solid #ddd;">Brand</th>
                    <th style="padding:6px 12px;border:1px solid #ddd;">Size</th>
                    <th style="padding:6px 12px;border:1px solid #ddd;">Qty</th>
                    <th style="padding:6px 12px;border:1px solid #ddd;">Price</th>
                </tr>
            </thead>
            <tbody>`;
}

function buildHtml({ added, reactivated, changed, source }) {
    let html = `<p style="font-family:sans-serif;color:#888;">
        ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} &mdash; Source: ${source}
    </p>`;

    if (added.length) {
        html += tableHeader('&#127381; New Blem Tires');
        html += tireRows(added);
        html += '</tbody></table>';
    }

    if (reactivated.length) {
        html += tableHeader('&#9851; Reactivated Tires');
        html += tireRows(reactivated);
        html += '</tbody></table>';
    }

    if (changed.length) {
        html += tableHeader('&#128260; Price / Qty Changes');
        html += tireRows(changed);
        html += '</tbody></table>';
    }

    html += `<br><p style="font-family:sans-serif;font-size:12px;color:#aaa;">
        <a href="https://www.intercotire.com/blem-list">View full blem list</a>
    </p>`;

    return html;
}

/**
 * Sends a blem alert email.
 * @param {object} diff - { added, reactivated, changed } arrays of tires
 * @param {string} source - scraper name for display
 * @returns {object} emailData - saved to DB by caller
 */
async function sendAlert(diff, source) {
    if (NOTIFY_EMAILS.length === 0) {
        console.warn('[email] No NOTIFY_EMAILS configured. Skipping send.');
        return null;
    }

    const total = diff.added.length + diff.reactivated.length;
    const subject = `Interco Blem ALERT - ${total} new tire${total !== 1 ? 's' : ''} found!`;
    const body = buildHtml({ ...diff, source });

    const transport = buildTransport();
    await transport.sendMail({
        from:    process.env.SMTP_FROM || process.env.SMTP_USER,
        to:      NOTIFY_EMAILS.join(', '),
        subject,
        html:    body,
    });

    console.log(`[email] Alert sent to ${NOTIFY_EMAILS.join(', ')}`);

    return {
        recipients: NOTIFY_EMAILS.join(','),
        subject,
        body,
    };
}

module.exports = { sendAlert };
