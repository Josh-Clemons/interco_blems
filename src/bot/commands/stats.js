/**
 * /stats — show bot-wide statistics: tire counts, recent activity, last scrape times.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBotStats, getRecentRuns } = require('../../db/repository');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show bot statistics — tire counts, recent activity, scrape health.'),

    async execute(interaction) {
        const { totalBySource, last7d, last30d, lastRun } = getBotStats();

        // Tire counts
        const tireLines = totalBySource.map(r =>
            `**${r.source}** — ${r.active} active / ${r.total} total`
        );
        const totalActive = totalBySource.reduce((s, r) => s + r.active, 0);
        const totalAll = totalBySource.reduce((s, r) => s + r.total, 0);
        tireLines.push(`\n**Total:** ${totalActive} active / ${totalAll} total`);

        // Activity summaries
        const fmtActivity = (rows) => {
            if (rows.length === 0) return 'No activity';
            return rows.map(r => `${r.event}: ${r.cnt}`).join(', ');
        };

        // Last scrape times
        const runLines = lastRun.map(r => {
            const ago = r.last_run ? timeSince(r.last_run) : 'never';
            return `**${r.source}** — ${ago}`;
        });

        // Recent runs (last 5)
        const recentRuns = getRecentRuns(5);
        const recentLines = recentRuns.map(r => {
            const dur = r.finished_at && r.started_at
                ? `${Math.round((new Date(r.finished_at + 'Z') - new Date(r.started_at + 'Z')) / 1000)}s`
                : 'running';
            const err = r.error ? ` ⚠️ ${r.error.slice(0, 60)}` : '';
            return `\`${r.started_at?.slice(5, 16)}\` **${r.source}** +${r.added}/-${r.removed}/~${r.changed} (${dur})${err}`;
        });

        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistics')
            .setColor(0x2ECC71)
            .addFields(
                { name: 'Tires by Source', value: tireLines.join('\n') || 'None', inline: false },
                { name: 'Last 7 Days', value: fmtActivity(last7d), inline: true },
                { name: 'Last 30 Days', value: fmtActivity(last30d), inline: true },
                { name: 'Last Scrape', value: runLines.join('\n') || 'No runs yet', inline: false },
                { name: 'Recent Runs', value: recentLines.join('\n') || 'No runs yet', inline: false },
            );

        await interaction.reply({ embeds: [embed] });
    },
};

function timeSince(isoStr) {
    const diff = Date.now() - new Date(isoStr + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
