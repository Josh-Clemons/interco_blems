/**
 * Interaction router — handles incoming slash command invocations and
 * dispatches them to the command module's execute() function.
 */

const { commands } = require('./commands');

function attachInteractionHandler(client) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = commands.get(interaction.commandName);
        if (!command) {
            console.warn(`[bot] Unknown command: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`[bot] Command ${interaction.commandName} failed:`, err);
            const reply = { content: 'Something went wrong running that command.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply(reply).catch(() => {});
            }
        }
    });
}

module.exports = { attachInteractionHandler };
