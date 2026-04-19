/**
 * /ping — health check command.
 * Confirms the bot is alive and reports WebSocket latency.
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check that the blem bot is alive.'),

    async execute(interaction) {
        const latency = interaction.client.ws.ping;
        await interaction.reply({
            content: `Pong! WebSocket latency: ${latency}ms`,
            ephemeral: true,
        });
    },
};
