/**
 * Discord bot client singleton.
 *
 * Exports a lazy-initialized Client that the rest of the app imports.
 * Login is triggered explicitly by index.js on startup.
 */

const { Client, GatewayIntentBits } = require('discord.js');

let _client = null;

function getClient() {
    if (_client) return _client;

    _client = new Client({
        // Minimum intents needed for slash commands and sending messages.
        // Guild intent is required so the bot can resolve guild/channel context.
        intents: [
            GatewayIntentBits.Guilds,
        ],
    });

    return _client;
}

async function login() {
    const client = getClient();
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        throw new Error('DISCORD_BOT_TOKEN not set in .env');
    }

    await client.login(token);
    return client;
}

module.exports = { getClient, login };
