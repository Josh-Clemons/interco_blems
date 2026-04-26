/**
 * /admin — server-admin controls for scraping, source health, and run history.
 * Requires MANAGE_GUILD permission.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const scrapers = require('../../scrapers');
const repo     = require('../../db/repository');
const runner   = require('../../runner');

const SOURCE_CHOICES = scrapers.map(s => ({ name: s.name, value: s.name }));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin controls — scrape, source health, run history.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName('scrape')
            .setDescription('Trigger an immediate scrape outside the normal schedule.')
            .addStringOption(opt => opt
                .setName('source')
                .setDescription('Scrape one source (omit to scrape all non-nightly sources)')
                .addChoices(...SOURCE_CHOICES)
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('sources')
            .setDescription('List all registered scrapers with status and tire counts.'))
        .addSubcommand(sub => sub
            .setName('runs')
            .setDescription('Show recent scrape run log.')
            .addStringOption(opt => opt
                .setName('source')
                .setDescription('Filter to one source')
                .addChoices(...SOURCE_CHOICES)
                .setRequired(false))
            .addIntegerOption(opt => opt
                .setName('limit')
                .setDescription('Number of runs to show (default 10, max 25)')
                .setMinValue(1)
                .setMaxValue(25)
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('errors')
            .setDescription('Show scrapes that errored in the last 7 days.')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'scrape')   return handleScrape(interaction);
        if (sub === 'sources')  return handleSources(interaction);
        if (sub === 'runs')     return handleRuns(interaction);
        if (sub === 'errors')   return handleErrors(interaction);
    },
};

// ---------------------------------------------------------------------------

function discordTimestamp(isoStr) {
    return `<t:${Math.floor(new Date(isoStr + 'Z').getTime() / 1000)}:R>`;
}

// ---------------------------------------------------------------------------

async function handleScrape(interaction) {
    const source = interaction.options.getString('source');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!source) {
        await interaction.editReply('⏳ Scraping all sources…');
        const results = await runner.triggerAll();
        if (!results) {
            await interaction.editReply('⚠️ A scrape is already in progress — try again shortly.');
            return;
        }
        await interaction.editReply({ embeds: [buildRunSummaryEmbed(results)] });
        return;
    }

    const scraper = scrapers.find(s => s.name === source);
    const nightlyWarning = scraper?.nightly
        ? '\n⚠️ This is a nightly scraper — the crawl may take several hours.'
        : '';
    await interaction.editReply(`⏳ Scraping **${source}**…${nightlyWarning}`);

    const result = await runner.triggerOne(source);
    if (result.error) {
        await interaction.editReply(`❌ **${source}**: ${result.error}`);
        return;
    }
    await interaction.editReply({ embeds: [buildRunSummaryEmbed([result])] });
}

function buildRunSummaryEmbed(results) {
    const lines = results.map(r => {
        if (r.error) return `**${r.source}** ❌ ${r.error}`;
        return (
            `**${r.source}** — ${r.tires_found} found | ` +
            `+${r.added} new, ~${r.reactivated} reactivated, ` +
            `${r.changed} changed, -${r.removed} removed`
        );
    });

    return new EmbedBuilder()
        .setTitle('Scrape Complete')
        .setColor(results.some(r => r.error) ? 0xE74C3C : 0x2ECC71)
        .setDescription(lines.join('\n'))
        .setTimestamp();
}

// ---------------------------------------------------------------------------

async function handleSources(interaction) {
    const tireStats    = repo.getTireSources();
    const statsBySource = new Map(tireStats.map(s => [s.source, s]));
    const lastRunBySource = new Map(repo.getLastRunPerSource().map(r => [r.source, r]));

    const fields = scrapers.map(sc => {
        const row     = statsBySource.get(sc.name);
        const lastRun = lastRunBySource.get(sc.name);
        const active  = row?.active_count ?? 0;
        const total   = row?.total_count  ?? 0;
        const label   = sc.nightly ? ' *(nightly)*' : '';

        let status = '✅ OK';
        if (lastRun?.error) status = `⚠️ ${lastRun.error.slice(0, 80)}`;
        else if (!lastRun)  status = 'No runs yet';

        const lastRunAgo = lastRun?.finished_at ? discordTimestamp(lastRun.finished_at) : 'never';

        return {
            name: `${sc.name}${label}`,
            value:
                `URL: ${sc.url}\n` +
                `Active: **${active}**  |  Total tracked: ${total}\n` +
                `Last run: ${lastRunAgo}  |  Status: ${status}`,
            inline: false,
        };
    });

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('Scraper Sources')
                .setDescription(`${scrapers.length} source${scrapers.length !== 1 ? 's' : ''} registered.`)
                .setColor(0x2B2D31)
                .addFields(...fields)
                .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
    });
}

// ---------------------------------------------------------------------------

async function handleRuns(interaction) {
    const source = interaction.options.getString('source');
    const limit  = interaction.options.getInteger('limit') ?? 10;

    const runs = repo.getRecentRuns(limit, source);

    if (runs.length === 0) {
        await interaction.reply({ content: 'No runs found.', flags: MessageFlags.Ephemeral });
        return;
    }

    const lines = runs.map(r => {
        const dur = r.finished_at && r.started_at
            ? `${Math.round((new Date(r.finished_at + 'Z') - new Date(r.started_at + 'Z')) / 1000)}s`
            : 'running';
        const summary = `+${r.added}/-${r.removed}/~${r.changed}`;
        const err = r.error ? ` ⚠️ ${r.error.slice(0, 50)}` : '';
        return `\`${r.started_at?.slice(0, 16)}\` **${r.source}** ${summary} (${dur})${err}`;
    });

    const title = source ? `Recent Runs — ${source}` : 'Recent Runs';

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle(title)
                .setColor(0x2B2D31)
                .setDescription(lines.join('\n'))
                .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
    });
}

// ---------------------------------------------------------------------------

async function handleErrors(interaction) {
    const errors = repo.getErrorRuns(7);

    if (errors.length === 0) {
        await interaction.reply({ content: '✅ No scrape errors in the last 7 days.', flags: MessageFlags.Ephemeral });
        return;
    }

    const lines = errors.map(r => `${discordTimestamp(r.started_at)} **${r.source}** — ${r.error}`);

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle(`Scrape Errors — Last 7 Days (${errors.length})`)
                .setColor(0xE74C3C)
                .setDescription(lines.join('\n'))
                .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
    });
}
