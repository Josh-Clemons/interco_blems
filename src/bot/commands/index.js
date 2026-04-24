/**
 * Command registry.
 *
 * Loads every command module in this directory (except index.js itself) and
 * exposes them as a Map keyed by command name. Also provides a helper to
 * register the commands with Discord's API.
 *
 * To add a command:
 *   1. Create src/bot/commands/<name>.js exporting { data, execute }
 *   2. Import + push it into COMMAND_MODULES below
 */

const { REST, Routes } = require('discord.js');

const ping = require('./ping');
const blems = require('./blems');
const sources = require('./sources');
const subscribe = require('./subscribe');
const subscriptions = require('./subscriptions');
const unsubscribe = require('./unsubscribe');
const history = require('./history');
const stats = require('./stats');
const log = require('../../logger');

// Registry — add new commands to this array as they're built in later phases.
const COMMAND_MODULES = [ping, blems, sources, subscribe, subscriptions, unsubscribe, history, stats];

const commands = new Map();
for (const mod of COMMAND_MODULES) {
    commands.set(mod.data.name, mod);
}

/**
 * Registers slash commands with Discord.
 *
 * If DISCORD_GUILD_ID is set, registers as guild commands (instant updates,
 * perfect for development). Otherwise registers globally (up to 1-hour
 * propagation delay, appropriate for production).
 */
async function registerCommands() {
    const token    = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId  = process.env.DISCORD_GUILD_ID;

    if (!token || !clientId) {
        throw new Error('DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required');
    }

    const rest = new REST({ version: '10' }).setToken(token);

    const body = COMMAND_MODULES.map(m => m.data.toJSON());
    const route = guildId
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId);

    log.info(`[bot] Registering ${body.length} command(s) ${guildId ? `to guild ${guildId}` : 'globally'}...`);
    await rest.put(route, { body });
    log.info('[bot] Slash commands registered.');
}

module.exports = { commands, registerCommands };
