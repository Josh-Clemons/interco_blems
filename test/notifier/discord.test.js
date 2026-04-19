const { sendDiscordAlert } = require('../../src/notifier/discord');

// We test the embed builder by monkey-patching fetch and inspecting the payload.

const baseTire = (sku, size) => ({
    sku,
    title: `${sku} ${size}`,
    brand: 'TestBrand',
    size,
    quantity: '4',
    price: '$300.00',
});

function captureFetch(statusCode = 200) {
    const calls = [];
    global.fetch = async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return { ok: statusCode === 200, status: statusCode, text: async () => 'error' };
    };
    return calls;
}

afterEach(() => {
    delete global.fetch;
    delete process.env.DISCORD_WEBHOOK_URL;
});

describe('sendDiscordAlert()', () => {
    test('does nothing when DISCORD_WEBHOOK_URL is not set', async () => {
        const calls = captureFetch();
        await sendDiscordAlert({ added: [baseTire('X1', '37x12.5R17')], reactivated: [], changed: [] });
        expect(calls).toHaveLength(0);
    });

    test('posts green embed for added tires', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
        const calls = captureFetch();

        await sendDiscordAlert({ added: [baseTire('X1', '37x12.5R17')], reactivated: [], changed: [] });

        expect(calls).toHaveLength(1);
        const embed = calls[0].body.embeds[0];
        expect(embed.color).toBe(0x57F287);
        expect(embed.title).toContain('New Blem Tire');
        expect(embed.fields[0].name).toContain('X1');
    });

    test('posts yellow embed for reactivated tires', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
        const calls = captureFetch();

        await sendDiscordAlert({ added: [], reactivated: [baseTire('X2', '40x13.5R17')], changed: [] });

        expect(calls).toHaveLength(1);
        const embed = calls[0].body.embeds[0];
        expect(embed.color).toBe(0xFEE75C);
        expect(embed.title).toContain('Back in Stock');
    });

    test('posts blurple embed for changed tires', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
        const calls = captureFetch();

        await sendDiscordAlert({ added: [], reactivated: [], changed: [baseTire('X3', '42x14R17')] });

        expect(calls).toHaveLength(1);
        const embed = calls[0].body.embeds[0];
        expect(embed.color).toBe(0x5865F2);
    });

    test('sends all three embeds in one message when all categories present', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
        const calls = captureFetch();

        await sendDiscordAlert({
            added:       [baseTire('X1', '37x12.5R17')],
            reactivated: [baseTire('X2', '40x13.5R17')],
            changed:     [baseTire('X3', '42x14R17')],
        });

        expect(calls).toHaveLength(1);
        expect(calls[0].body.embeds).toHaveLength(3);
    });

    test('throws when Discord returns a non-200', async () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
        captureFetch(429); // rate limited

        await expect(
            sendDiscordAlert({ added: [baseTire('X1', '37x12.5R17')], reactivated: [], changed: [] })
        ).rejects.toThrow('Discord webhook failed 429');
    });
});
