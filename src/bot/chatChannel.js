/**
 * Dedicated chat channel handler.
 *
 * When DISCORD_CHAT_CHANNEL_ID is set, the bot watches that channel for messages
 * and opens a thread off each one for a natural, visible conversation. Subsequent
 * messages inside the thread continue the conversation.
 *
 * Requires the GuildMessages and MessageContent privileged intents to be enabled
 * on the bot application (Discord Developer Portal → Bot → Privileged Gateway Intents).
 */

const log = require('../logger');
const { parseQuery } = require('../llm/parseQuery');
const { executeQuery, buildResultEmbeds } = require('./commands/ask');

const CHAT_CHANNEL_ID = process.env.DISCORD_CHAT_CHANNEL_ID;

async function handleChatMessage(message) {
    if (message.author.bot) return;

    const inRootChannel = message.channelId === CHAT_CHANNEL_ID;
    const inChatThread  = message.channel.isThread?.() && message.channel.parentId === CHAT_CHANNEL_ID;

    if (!inRootChannel && !inChatThread) return;

    const queryText = message.content.trim();
    if (!queryText) return;

    try {
        await message.channel.sendTyping();

        const { filters, fallback } = await parseQuery(queryText);
        const isSearch = fallback || filters?.intent === 'search';

        // Determine reply target — open a thread if we're in the root channel
        let replyTarget = message.channel;
        if (inRootChannel) {
            try {
                replyTarget = await message.startThread({
                    name:                queryText.slice(0, 100),
                    autoArchiveDuration: 60,
                });
            } catch (err) {
                log.warn(`[chatChannel] Could not start thread: ${err.message} — replying in channel`);
            }
        }

        if (isSearch) {
            const { results } = await executeQuery(queryText);
            const embeds = buildResultEmbeds(results, queryText, fallback);
            await replyTarget.send({ embeds });
        } else {
            // Conversational reply from the LLM
            await replyTarget.send(filters.reply || "I don't do small talk. What tires do you want?");
        }
    } catch (err) {
        log.error('[chatChannel] Error handling message:', err.message);
        await message.reply('Something went wrong. Try `/ask` instead.').catch(() => {});
    }
}

function attachChatChannelHandler(client) {
    if (!CHAT_CHANNEL_ID) {
        log.info('[chatChannel] DISCORD_CHAT_CHANNEL_ID not set — chat channel disabled');
        return;
    }
    log.info(`[chatChannel] Watching channel ${CHAT_CHANNEL_ID} for messages`);
    client.on('messageCreate', handleChatMessage);
}

module.exports = { attachChatChannelHandler };
