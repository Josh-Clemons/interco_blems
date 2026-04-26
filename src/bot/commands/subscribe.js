/**
 * /subscribe — creates a per-user alert subscription.
 *
 * Unifies two use cases into one command:
 *   • Broad subscription: "alert me when a new 37"+ Bogger shows up"
 *         /subscribe size_min:37 brand:bogger
 *   • Pinned watch: "alert me on ANY event for this specific SKU"
 *         /subscribe sku:XBOG-3712 track_changes:true track_removed:true
 *
 * Guard: track_changes / track_removed require at least one narrowing filter
 * (sku, brand, size, size_min, or rim) to prevent firehose spam.
 */

const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const repo = require('../../db/repository');
const { hasNarrowingFilter } = require('../../subscriptions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('subscribe')
        .setDescription('Get alerted when blem tires match your criteria.')
        .addStringOption(o  => o.setName('sku').setDescription('Pin a specific SKU (e.g. XBOG-3712). Exact match.'))
        .addStringOption(o  => o.setName('brand').setDescription('Brand substring match (e.g. bogger)'))
        .addStringOption(o  => o.setName('size').setDescription('Exact tire size (e.g. 37x12.50R17LT)'))
        .addIntegerOption(o => o.setName('size_min').setDescription('Minimum tire diameter in inches (e.g. 37)'))
        .addIntegerOption(o => o.setName('rim').setDescription('Exact rim diameter in inches (e.g. 17)'))
        .addNumberOption(o  => o.setName('price_max').setDescription('Maximum price in dollars'))
        .addStringOption(o  => o.setName('source').setDescription('Only this source (e.g. interco)'))
        .addBooleanOption(o => o.setName('track_changes').setDescription('Also alert on qty/price changes (requires a narrowing filter).'))
        .addBooleanOption(o => o.setName('track_removed').setDescription('Also alert when a matching tire disappears (requires a narrowing filter).'))
        .addBooleanOption(o => o.setName('notify_dm').setDescription('DM me (default true). If false, alerts go to a channel.'))
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Channel for alerts when notify_dm is false. Defaults to the current channel.')
            .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {
        const user = interaction.user;
        repo.upsertUser(user.id, user.username);

        const notify_dm = interaction.options.getBoolean('notify_dm');
        const dmFlag = notify_dm == null ? true : notify_dm;

        const channelOption = interaction.options.getChannel('channel');
        const notify_channel = dmFlag
            ? null
            : (channelOption ? channelOption.id : interaction.channelId);

        const track_changes = !!interaction.options.getBoolean('track_changes');
        const track_removed = !!interaction.options.getBoolean('track_removed');

        const draft = {
            user_id:        user.id,
            source:         interaction.options.getString('source')  || null,
            sku:            interaction.options.getString('sku')     || null,
            brand:          interaction.options.getString('brand')   || null,
            size:           interaction.options.getString('size')    || null,
            size_min:       interaction.options.getInteger('size_min'),
            rim:            interaction.options.getInteger('rim'),
            price_max:      interaction.options.getNumber('price_max'),
            notify_dm:      dmFlag,
            notify_channel,
            notify_changed: track_changes,
            notify_removed: track_removed,
        };

        // Guard against firehose subscriptions with change/removal tracking.
        if ((track_changes || track_removed) && !hasNarrowingFilter(draft)) {
            await interaction.reply({
                content:
                    '❌ `track_changes` and `track_removed` require at least one narrowing filter — ' +
                    'add `sku`, `brand`, `size`, `size_min`, or `rim` so you don\'t get alerted on every tire.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const sub = repo.createSubscription(draft);

        const filterSummary = describeSub(sub) || 'no filters (alert on everything)';
        const route = dmFlag ? 'DM' : `<#${notify_channel}>`;
        const events = describeEvents(sub);

        await interaction.reply({
            content:
                `✅ Subscription **#${sub.id}** created.\n` +
                `• Filter: ${filterSummary}\n` +
                `• Events: ${events}\n` +
                `• Route: ${route}` +
                (dmFlag
                    ? '\n_Tip: DMs require you to allow messages from server members. If you don\'t get one, check your privacy settings._'
                    : ''),
            flags: MessageFlags.Ephemeral,
        });
    },
};

function describeSub(sub) {
    const parts = [];
    if (sub.sku)              parts.push(`📌 sku:${sub.sku}`);
    if (sub.brand)            parts.push(`brand:${sub.brand}`);
    if (sub.size)             parts.push(`size:${sub.size}`);
    if (sub.size_min != null) parts.push(`≥${sub.size_min}"`);
    if (sub.rim != null)      parts.push(`rim:${sub.rim}"`);
    if (sub.price_max != null) parts.push(`≤$${sub.price_max}`);
    if (sub.source)           parts.push(`source:${sub.source}`);
    return parts.join(', ');
}

function describeEvents(sub) {
    const events = ['new', 'reactivated'];
    if (sub.notify_changed) events.push('changed');
    if (sub.notify_removed) events.push('removed');
    return events.join(' + ');
}

module.exports.describeSub = describeSub;
module.exports.describeEvents = describeEvents;
