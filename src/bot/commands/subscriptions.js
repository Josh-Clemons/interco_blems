/**
 * /subscriptions — lists the calling user's active subscriptions.
 */

const { SlashCommandBuilder } = require('discord.js');
const repo = require('../../db/repository');
const { describeSub, describeEvents } = require('./subscribe');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('subscriptions')
        .setDescription('List your active blem-tire subscriptions.'),

    async execute(interaction) {
        const subs = repo.listSubscriptionsForUser(interaction.user.id);

        if (subs.length === 0) {
            await interaction.reply({
                content: 'You have no active subscriptions. Use `/subscribe` to create one.',
                ephemeral: true,
            });
            return;
        }

        const lines = subs.map(s => {
            const filter = describeSub(s) || 'no filters';
            const route  = s.notify_dm ? 'DM' : `<#${s.notify_channel}>`;
            const events = describeEvents(s);
            return `**#${s.id}** — ${filter} → ${route} _(${events})_`;
        });

        await interaction.reply({
            embeds: [{
                title: 'Your Subscriptions',
                description: lines.join('\n'),
                color: 0x2B2D31,
                footer: { text: 'Use /unsubscribe <id> to remove one. 📌 = pinned SKU watch.' },
            }],
            ephemeral: true,
        });
    },
};
