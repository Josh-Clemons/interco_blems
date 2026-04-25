/**
 * /sources — lists all registered scrapers and their stats.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const scrapers = require('../../scrapers');
const { getTireSources } = require('../../db/repository');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sources')
        .setDescription('Show all registered scraper sources and tire counts.'),

    async execute(interaction) {
        const stats = getTireSources();
        const statsBySource = new Map(stats.map(s => [s.source, s]));

        const fields = scrapers.map(sc => {
            const row = statsBySource.get(sc.name);
            const active = row ? row.active_count : 0;
            const total  = row ? row.total_count  : 0;
            const lastSeen = row && row.last_seen_at
                ? `<t:${Math.floor(new Date(row.last_seen_at + 'Z').getTime() / 1000)}:R>`
                : 'never';

            return {
                name: sc.name,
                value:
                    `URL: ${sc.url}\n` +
                    `Active: **${active}**  |  Total tracked: ${total}\n` +
                    `Last seen: ${lastSeen}`,
                inline: false,
            };
        });

        await interaction.reply({
            embeds: [{
                title: 'Registered Scrapers',
                description: `${scrapers.length} source${scrapers.length !== 1 ? 's' : ''} registered.`,
                color: 0x2B2D31,
                fields,
                timestamp: new Date().toISOString(),
            }],
            flags: MessageFlags.Ephemeral,
        });
    },
};
