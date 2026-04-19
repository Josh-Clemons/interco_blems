/**
 * Interaction router.
 *
 * Routes slash commands to their execute() and button clicks to the owning
 * command's handleButton() based on the customId prefix.
 *
 * Button customId convention: "<commandname>_..." — everything before the
 * first underscore identifies which command owns the button.
 */

const { commands } = require('./commands');

function attachInteractionHandler(client) {
    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isChatInputCommand()) {
                await handleSlashCommand(interaction);
            } else if (interaction.isButton()) {
                await handleButton(interaction);
            }
        } catch (err) {
            console.error('[bot] Interaction handler error:', err);
            const reply = { content: 'Something went wrong.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply(reply).catch(() => {});
            }
        }
    });
}

async function handleSlashCommand(interaction) {
    const command = commands.get(interaction.commandName);
    if (!command) {
        console.warn(`[bot] Unknown command: ${interaction.commandName}`);
        return;
    }
    await command.execute(interaction);
}

async function handleButton(interaction) {
    const prefix = interaction.customId.split('_')[0];
    const command = commands.get(prefix);
    if (!command || typeof command.handleButton !== 'function') {
        console.warn(`[bot] No button handler for customId: ${interaction.customId}`);
        await interaction.reply({ content: 'This button is no longer active.', ephemeral: true }).catch(() => {});
        return;
    }
    await command.handleButton(interaction, interaction.customId);
}

module.exports = { attachInteractionHandler };
