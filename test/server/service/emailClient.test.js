const { transporter } = require('../../../server/clients/emailClient.js');

test('should send an email successfully', async () => {
    const mailOptions = {
        from: process.env.EMAIL_ADDRESS,
        to: 'mrjoshc@gmail.com',
        subject: 'Test Email',
        text: 'This is a test email sent from the email client integration test.'
    };

    const result = await transporter.sendMail(mailOptions);
    expect(result.accepted).toContain('mrjoshc@gmail.com');
});