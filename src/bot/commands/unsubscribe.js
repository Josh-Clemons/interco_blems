/**
 * /unsubscribe <id> — deactivates one of the calling user's subscriptions.
 *
 * Safe against cross-user abuse: repo.deactivateSubscription scopes the
 * UPDATE to the calling user_id, so asking to unsubscribe someone else's
 * subscription just returns false.
 */

const { SlashCommandBuilder } = require('discord.js');
const repo = require('../../db/repository');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unsubscribe')
        .setDescription('Remove one of your subscriptions by ID.')
        .addIntegerOption(o => o
            .setName('id')
            .setDescription('Subscription ID from /subscriptions')
            .setRequired(true)),

    async execute(interaction) {
        const id = interaction.options.getInteger('id', true);
        const ok = repo.deactivateSubscription(id, interaction.user.id);

        if (!ok) {
            await interaction.reply({
                content: `❌ No active subscription **#${id}** found for you.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.reply({
            content: `🗑️ Subscription **#${id}** removed.`,
            ephemeral: true,
        });
    },
};
