/**
 * /history — show price/stock history for a tire by SKU.
 *
 * Usage:
 *   /history sku:ABC123
 *   /history sku:ABC123 source:simpletire
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTireHistory } = require('../../db/repository');

function formatEvent(row) {
    const ts = row.recorded_at?.slice(0, 16).replace('T', ' ') || '?';
    const parts = [`\`${ts}\` **${row.event}**`];

    if (row.old_price_cents != null && row.new_price_cents != null && row.old_price_cents !== row.new_price_cents) {
        const oldP = (row.old_price_cents / 100).toFixed(2);
        const newP = (row.new_price_cents / 100).toFixed(2);
        parts.push(`$${oldP} → $${newP}`);
    } else if (row.new_price_cents != null) {
        parts.push(`$${(row.new_price_cents / 100).toFixed(2)}`);
    }

    if (row.old_stock_state && row.new_stock_state && row.old_stock_state !== row.new_stock_state) {
        parts.push(`${row.old_stock_state} → ${row.new_stock_state}`);
    }

    return parts.join(' · ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Show price/stock change history for a tire.')
        .addStringOption(o => o.setName('sku').setDescription('Tire SKU').setRequired(true))
        .addStringOption(o => o.setName('source').setDescription('Filter by source (optional)')),

    async execute(interaction) {
        const sku = interaction.options.getString('sku');
        const source = interaction.options.getString('source') || null;

        const rows = getTireHistory(sku, source);

        if (rows.length === 0) {
            await interaction.reply({
                embeds: [{
                    title: 'Tire History',
                    description: `No history found for SKU \`${sku}\`${source ? ` (source: ${source})` : ''}.`,
                    color: 0x2B2D31,
                }],
                ephemeral: true,
            });
            return;
        }

        const title = rows[0].title || sku;
        const lines = rows.map(formatEvent);

        // Truncate to fit embed limits
        let description = lines.join('\n');
        if (description.length > 4000) {
            description = description.slice(0, 3990) + '\n…(truncated)';
        }

        const embed = new EmbedBuilder()
            .setTitle(`📈 History: ${title}`)
            .setDescription(description)
            .setColor(0x3498DB)
            .setFooter({ text: `${rows.length} event${rows.length !== 1 ? 's' : ''} · SKU: ${sku}` });

        await interaction.reply({ embeds: [embed] });
    },
};
