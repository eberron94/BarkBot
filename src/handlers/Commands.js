import { Markup } from 'telegraf';
import fs from 'node:fs';
import { escapeHtml, isAuthorized, getConfiguredPlatforms } from '../util/util.js';
import { PostState } from '../struct/PostState.js';
import { UI } from '../util/UI.js';

export class Commands {
    constructor(bot, memory, messages) {
        this.bot = bot;
        this.memory = memory;
        this.messages = messages;
    }

    /**
     * Registers all bot commands.
     * @returns {Commands} this instance for chaining.
     */
    registerCommands() {
        this.registerStartCommand();
        this.registerHelpCommand();
        this.registerPresetsCommand();
        this.registerAddPresetCommand();
        this.registerDelPresetCommand();
        this.registerDelayCommand();
        this.registerToggleLinksCommand();
        this.registerQueueCommand();
        this.registerUnqueueCommand();
        this.registerEditCommand();
        this.registerDefaultDestCommand();
        this.registerStatusCommand();
        return this;
    }

    registerStartCommand() {
        this.bot.start((ctx) => {
            console.log(
                `[START] User ${ctx.from?.username || ctx.from?.first_name} started the bot.`,
            );
            const botName = process.env.BOT_NAME || 'PostBot';
            return ctx.reply(
                `Welcome to ${botName}! I am ready to cross-post.`,
            );
        });
        return this;
    }

    registerHelpCommand() {
        this.bot.help((ctx) => {
            console.log(
                `[HELP] User ${ctx.from?.username || ctx.from?.first_name} requested help.`,
            );
            const botName = process.env.BOT_NAME || 'PostBot';
            const platforms = getConfiguredPlatforms();
            const activePlatforms = [
                platforms.bsky && 'Bluesky',
                platforms.tumblr && 'Tumblr',
                platforms.tg && 'Telegram',
                platforms.zip && 'Zip',
            ].filter(Boolean).join(', ') || 'None';

            const helpMessage =
                `Welcome to ${botName}! I am ready to cross-post.\n\n` +
                `<b>How to use:</b>\n` +
                `1. Send me a message with text and/or media.\n` +
                `2. Use the preview menu to edit, add tags, and add alt text.\n` +
                `3. Choose a destination for the post!\n\n` +
                `<b>Active Platforms:</b> ${activePlatforms}\n\n` +
                `<b>Available Commands:</b>\n` +
                `<code>/presets</code> - View tag presets\n` +
                `<code>/addpreset &lt;name&gt; &lt;tags&gt;</code> - Add a new tag preset\n` +
                `<code>/delpreset &lt;name&gt;</code> - Delete a tag preset\n` +
                `<code>/queue</code> - View scheduled posts\n` +
                `<code>/unqueue &lt;id&gt;</code> - Cancel a scheduled post\n` +
                `<code>/edit &lt;id&gt;</code> - Edit a scheduled post\n` +
                `<code>/status</code> - View bot status and uptime\n` +
                `<code>/delay &lt;seconds&gt;</code> - Set the post countdown delay\n` +
                `<code>/defaultdest &lt;bsky|tumblr|tg|zip&gt;</code> - Toggle default post destinations\n` +
                `<code>/togglelinks</code> - Toggle cross-post links in channel posts\n` +
                `<code>/help</code> - Show this help message`;
            return ctx.reply(helpMessage, { parse_mode: 'HTML' });
        });
        return this;
    }

    registerPresetsCommand() {
        this.bot.command('presets', (ctx) => {
            // Ensure only the authorized admin can trigger commands
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /presets triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            // Clear any active typing states so the bot doesn't misinterpret future messages
            const postData = this.memory.pendingPosts.get(ctx.from.id);
            if (postData) {
                postData.curState.isAddingTags = false;
                postData.curState.isAddingPreset = false;
                postData.curState.isEditingPresetName = null;
                postData.curState.isAddingAltText = false;
                postData.curState.isScheduling = false;
            }

            // Load presets from disk and check if any exist
            const presets = this.memory.loadPresets();
            if (Object.keys(presets).length === 0) {
                return ctx.reply('⚠️ No presets found.').catch(console.error);
            }

            let msg = '📋 <b>Current Presets:</b>\n\n';
            for (const [name, tags] of Object.entries(presets)) {
                const safeTags = Array.isArray(tags) ? tags : [];
                msg += `• <b>${escapeHtml(name)}</b>: ${safeTags.map((t) => `#${escapeHtml(t)}`).join(' ')}\n`;
            }
            return ctx.reply(msg, { parse_mode: 'HTML' }).catch(console.error);
        });
        return this;
    }

    registerAddPresetCommand() {
        this.bot.command('addpreset', (ctx) => {
            // Ensure only the authorized admin can trigger commands
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /addpreset triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            // Clear any active typing states
            const postData = this.memory.pendingPosts.get(ctx.from.id);
            if (postData) {
                postData.curState.isAddingTags = false;
                postData.curState.isAddingPreset = false;
                postData.curState.isEditingPresetName = null;
                postData.curState.isAddingAltText = false;
                postData.curState.isScheduling = false;
            }

            // Parse the command arguments (e.g., "/addpreset myPreset tag1 tag2")
            const args = ctx.message.text.split(/\s+/).slice(1);
            if (args.length < 2) {
                return ctx
                    .reply(
                        '⚠️ Usage: /addpreset <name> <tag1> <tag2> ...\nExample: /addpreset art sketch wip drawing',
                    )
                    .catch(console.error);
            }

            const name = args[0].toLowerCase();
            // Clean the tags (removes accidental '#' prefixes and trailing commas)
            const tags = args
                .slice(1)
                .map((t) => t.replace(/^#/, '').replace(/,$/, ''))
                .filter(Boolean);

            // Load the file, add the new preset, and save it back to disk
            const presets = this.memory.loadPresets();
            presets[name] = tags;
            this.memory.savePresets(presets);

            return ctx
                .reply(
                    `✅ Preset '${name}' saved with tags: ${tags.map((t) => `#${t}`).join(' ')}`,
                )
                .catch(console.error);
        });
        return this;
    }

    registerDelPresetCommand() {
        this.bot.command('delpreset', (ctx) => {
            // Ensure only the authorized admin can trigger commands
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /delpreset triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            // Clear any active typing states
            const postData = this.memory.pendingPosts.get(ctx.from.id);
            if (postData) {
                postData.curState.isAddingTags = false;
                postData.curState.isAddingPreset = false;
                postData.curState.isEditingPresetName = null;
                postData.curState.isAddingAltText = false;
                postData.curState.isScheduling = false;
            }

            // Parse the target preset name to delete
            const args = ctx.message.text.split(/\s+/).slice(1);
            if (args.length !== 1)
                return ctx
                    .reply(
                        '⚠️ Usage: /delpreset <name>\nExample: /delpreset dice',
                    )
                    .catch(console.error);

            // Load the file, check if the preset exists, and delete it if it does
            const presets = this.memory.loadPresets();
            if (!presets[args[0].toLowerCase()])
                return ctx
                    .reply(`⚠️ Preset '${args[0]}' not found.`)
                    .catch(console.error);
            delete presets[args[0].toLowerCase()];
            this.memory.savePresets(presets);
            return ctx
                .reply(`✅ Preset '${args[0]}' deleted.`)
                .catch(console.error);
        });
        return this;
    }

    registerDelayCommand() {
        this.bot.command('delay', (ctx) => {
            // Ensure only the authorized admin can trigger commands
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /delay triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const args = ctx.message.text.split(/\s+/).slice(1);
            if (args.length !== 1) {
                return ctx
                    .reply(
                        `⚠️ Usage: /delay <seconds>\nCurrent delay is ${this.memory.delayPostSeconds} seconds.`,
                    )
                    .catch(console.error);
            }

            const newDelay = parseInt(args[0], 10);
            if (isNaN(newDelay) || newDelay < 0) {
                return ctx
                    .reply(
                        '⚠️ Please provide a valid positive number for the delay.',
                    )
                    .catch(console.error);
            }

            this.memory.delayPostSeconds = newDelay;

            return ctx
                .reply(`✅ Post delay updated to ${newDelay} seconds.`)
                .catch(console.error);
        });
        return this;
    }

    registerToggleLinksCommand() {
        this.bot.command('togglelinks', (ctx) => {
            // Ensure only the authorized admin can trigger commands
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /togglelinks triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const showLinks = !this.memory.showCrossPostLinks;
            this.memory.showCrossPostLinks = showLinks;

            const emoji = showLinks ? '✅' : '❌';
            const status = showLinks ? 'enabled' : 'disabled';
            return ctx
                .reply(`${emoji} Cross-post links are now ${status}.`)
                .catch(console.error);
        });
        return this;
    }

    registerDefaultDestCommand() {
        this.bot.command('defaultdest', (ctx) => {
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /defaultdest triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const platforms = getConfiguredPlatforms();
            const allowedArgs = [];
            if (platforms.bsky) allowedArgs.push('bsky');
            if (platforms.tumblr) allowedArgs.push('tumblr');
            if (platforms.tg) allowedArgs.push('tg');
            if (platforms.zip) allowedArgs.push('zip');

            const args = ctx.message.text.split(/\s+/).slice(1);
            if (
                args.length !== 1 ||
                !allowedArgs.includes(args[0].toLowerCase())
            ) {
                const dests = this.memory.defaultDestinations;
                return ctx
                    .reply(
                        '⚙️ <b>Default Post Destinations:</b>\nToggle which platforms are selected by default for new posts.',
                        {
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                [
                                    Markup.button.callback(
                                        `${dests.bsky ? '✅' : '❌'} Bluesky`,
                                        'toggle_default_bsky',
                                    ),
                                    Markup.button.callback(
                                        `${dests.tumblr ? '✅' : '❌'} Tumblr`,
                                        'toggle_default_tumblr',
                                    ),
                                    Markup.button.callback(
                                        `${dests.zip ? '✅' : '❌'} Zip`,
                                        'toggle_default_zip',
                                    ),
                                ],
                            ]),
                        },
                    )
                    .catch(console.error);
            }

            const target = args[0].toLowerCase();
            const dests = this.memory.defaultDestinations;
            dests[target] = !dests[target];
            this.memory.defaultDestinations = dests;

            const targetName =
                target === 'bsky'
                    ? 'Bluesky'
                    : target === 'tumblr'
                      ? 'Tumblr'
                      : target === 'zip'
                      ? 'Zip'
                      : 'Telegram';
            return ctx
                .reply(
                    `✅ Default destination for ${targetName} is now ${dests[target] ? 'enabled' : 'disabled'}.`,
                )
                .catch(console.error);
        });
        return this;
    }

    registerQueueCommand() {
        this.bot.command('queue', async (ctx) => {
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /queue triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const args = (ctx.message?.text || '').split(/\s+/).slice(1);
            let page = 1;
            if (args.length > 0) {
                page = parseInt(args[0], 10);
                if (isNaN(page) || page < 1) page = 1;
            }

            await this.#sendQueuePage(ctx, page);
        });

        this.bot.action(/^queue_page_(\d+)$/, async (ctx) => {
            if (!isAuthorized(ctx)) {
                return ctx.answerCbQuery('⛔ Unauthorized.', {
                    show_alert: true,
                });
            }
            const page = parseInt(ctx.match[1], 10);

            // Remove buttons from the old summary message to prevent duplicate clicks
            await ctx.editMessageReplyMarkup(undefined).catch(() => {});
            await ctx.answerCbQuery();

            await this.#sendQueuePage(ctx, page);
        });

        return this;
    }

    async #sendQueuePage(ctx, page) {
        const scheduled = this.memory.scheduledPosts;
        if (!scheduled || scheduled.length === 0) {
            return ctx.reply('📭 The queue is empty.').catch(console.error);
        }

        const limit = 10;
        const totalPages = Math.ceil(scheduled.length / limit);
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * limit;
        const end = Math.min(start + limit, scheduled.length);

        const buttons = [];
        if (page > 1) {
            buttons.push(
                Markup.button.callback(
                    '⬅️ Prev Page',
                    `queue_page_${page - 1}`,
                ),
            );
        }
        if (page < totalPages) {
            buttons.push(
                Markup.button.callback(
                    'Next Page ➡️',
                    `queue_page_${page + 1}`,
                ),
            );
        }

        const opts = { parse_mode: 'HTML' };
        if (buttons.length > 0) {
            opts.reply_markup = { inline_keyboard: [buttons] };
        }

        let summaryMsg = `🗓️ <b>Scheduled Posts: ${scheduled.length}</b>`;
        if (totalPages > 1) {
            summaryMsg += ` (Page ${page}/${totalPages})`;
        }
        summaryMsg += `\n\nUse <code>/unqueue &lt;id&gt;</code> to cancel a scheduled post.`;

        await ctx.reply(summaryMsg, opts).catch(console.error);

        for (let index = start; index < end; index++) {
            const post = scheduled[index];
            const msg = post.getQueueMessage(index + 1, this.memory.defaultDestinations);

            const itemOpts = {
                parse_mode: 'HTML',
                ...UI.queueItem(post.id),
            };

            if (post.sourceMessageId && post.media && post.media.length > 0) {
                itemOpts.reply_parameters = {
                    message_id: post.sourceMessageId,
                    allow_sending_without_reply: true,
                };
                if (post.sourceChatId && post.sourceChatId !== ctx.chat?.id) {
                    itemOpts.reply_parameters.chat_id = post.sourceChatId;
                }
            }

            await ctx.reply(msg, itemOpts).catch(console.error);
        }
    }

    registerUnqueueCommand() {
        this.bot.command(['unqueue', 'cancel'], (ctx) => {
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /unqueue triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const args = ctx.message.text.split(/\s+/).slice(1);
            if (args.length !== 1) {
                return ctx
                    .reply('⚠️ Usage: /unqueue <id>')
                    .catch(console.error);
            }

            const id = args[0];
            const scheduled = this.memory.scheduledPosts;
            const index = scheduled.findIndex((p) => p.id === id);

            if (index === -1)
                return ctx
                    .reply(
                        `⚠️ Scheduled post with ID <code>${id}</code> not found.`,
                        { parse_mode: 'HTML' },
                    )
                    .catch(console.error);

            scheduled.splice(index, 1);
            this.memory.scheduledPosts = scheduled;
            console.log(
                `[QUEUE] Scheduled post ${id} cancelled by user ${ctx.from?.username || ctx.from?.first_name}`,
            );
            return ctx
                .reply(
                    `✅ Scheduled post <code>${id}</code> has been cancelled.`,
                    { parse_mode: 'HTML' },
                )
                .catch(console.error);
        });
        return this;
    }

    registerEditCommand() {
        this.bot.command('edit', async (ctx) => {
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /edit triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const args = ctx.message.text.split(/\s+/).slice(1);
            if (args.length !== 1) {
                return ctx.reply('⚠️ Usage: /edit <id>').catch(console.error);
            }

            const id = args[0];
            const scheduled = this.memory.scheduledPosts;
            const index = scheduled.findIndex((p) => p.id === id);

            if (index === -1) {
                return ctx
                    .reply(
                        `⚠️ Scheduled post with ID <code>${id}</code> not found.`,
                        { parse_mode: 'HTML' },
                    )
                    .catch(console.error);
            }

            const post = scheduled[index];
            scheduled.splice(index, 1);
            this.memory.scheduledPosts = scheduled;

            this.memory.pendingPosts.set(ctx.from.id, new PostState(post));

            console.log(
                `[QUEUE] Scheduled post ${id} moved to active editing by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            await ctx
                .reply(
                    `✏️ Post <code>${id}</code> has been removed from the queue and is now active.`,
                    { parse_mode: 'HTML' },
                )
                .catch(console.error);
            return this.messages.sendPreview(ctx, ctx.from.id);
        });
        return this;
    }

    registerStatusCommand() {
        this.bot.command('status', (ctx) => {
            if (!isAuthorized(ctx)) return;

            console.log(
                `[COMMAND] /status triggered by user ${ctx.from?.username || ctx.from?.first_name}`,
            );

            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            const queueSize = this.memory.scheduledPosts.length;
            const activeDrafts = this.memory.pendingPosts.size;

            const memUsageMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
            let diskUsage = 0;
            ['presets.json', 'memory.json', 'queue.json'].forEach((file) => {
                try {
                    if (fs.existsSync(`data/${file}`)) {
                        diskUsage += fs.statSync(`data/${file}`).size;
                    }
                } catch (e) {}
            });
            const diskUsageKb = (diskUsage / 1024).toFixed(2);

            const dests = this.memory.defaultDestinations;
            const defaultDestString =
                [
                    dests.bsky && 'Bluesky',
                    dests.tumblr && 'Tumblr',
                    dests.tg && 'Telegram',
                    dests.zip && 'Zip',
                ]
                    .filter(Boolean)
                    .join(', ') || 'None';

            const platforms = getConfiguredPlatforms();
            const activePlatforms = [
                platforms.bsky && 'Bluesky',
                platforms.tumblr && 'Tumblr',
                platforms.tg && 'Telegram',
                platforms.zip && 'Zip',
            ].filter(Boolean).join(', ') || 'None';

            const statusMessage =
                `🤖 <b>Bot Status</b>\n\n` +
                `⏱️ <b>Uptime:</b> ${uptimeStr}\n` +
                `💾 <b>RAM Usage:</b> ${memUsageMb} MB\n` +
                `💽 <b>Disk Usage (State):</b> ${diskUsageKb} KB\n` +
                `📭 <b>Queue Size:</b> ${queueSize} post(s)\n` +
                `📝 <b>Active Drafts:</b> ${activeDrafts}\n\n` +
                `<b>Configuration:</b>\n` +
                `• Delay: ${this.memory.delayPostSeconds}s\n` +
                `• Cross-post links: ${this.memory.showCrossPostLinks ? 'ON' : 'OFF'}\n` +
                `• Default Destinations: ${defaultDestString}\n` +
                `• Active Platforms: ${activePlatforms}`;

            return ctx.reply(statusMessage, { parse_mode: 'HTML' }).catch(console.error);
        });
        return this;
    }

    registerMessageListeners() {
        this.bot.on(['text', 'photo', 'video', 'animation'], (ctx) =>
            this.messages.handle(ctx),
        );
        this.bot.on('edited_message', (ctx) => this.messages.handle(ctx));
        return this;
    }

    launch() {
        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));

        this.bot.launch();
        const botName = process.env.BOT_NAME || 'PostBot';
        console.log(
            `🤖 ${botName} is now running and listening for messages...`,
        );
        this.#sendStartupMessage();
    }

    async #sendStartupMessage() {
        const adminUserIds = (process.env.ALLOWED_USER_IDS || process.env.ALLOWED_USER_ID || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        if (adminUserIds.length === 0) return;

        // Set bot commands for the UI menu
        try {
            const commands = [
                { command: 'presets', description: 'View tag presets' },
                { command: 'addpreset', description: 'Add a new tag preset' },
                { command: 'delpreset', description: 'Delete a tag preset' },
                { command: 'queue', description: 'View scheduled posts' },
                { command: 'unqueue', description: 'Cancel a scheduled post' },
                { command: 'edit', description: 'Edit a scheduled post' },
                {
                    command: 'delay',
                    description: 'Set the post countdown delay',
                },
                {
                    command: 'togglelinks',
                    description: 'Toggle cross-post links',
                },
                {
                    command: 'defaultdest',
                    description: 'Toggle default post destinations',
                },
                { command: 'status', description: 'View bot status and uptime' },
                { command: 'help', description: 'Show this help message' },
            ];
            for (const adminUserId of adminUserIds) {
                await this.bot.telegram.setMyCommands(commands, {
                    scope: { type: 'chat', chat_id: adminUserId },
                });
            }
            console.log('[STARTUP] Bot commands updated successfully.');
        } catch (err) {
            console.error('[ERROR] Failed to set bot commands:', err);
        }

        try {
            const scheduled = this.memory.scheduledPosts || [];
            let queueText = `\n• <code>/queue</code> - <b>${scheduled.length}</b> scheduled post${scheduled.length === 1 ? '' : 's'}.`;
            const now = Date.now();
            let missedPosts = 0;

            if (scheduled.length > 0) {
                scheduled.forEach((post, index) => {
                    const isMissed = post.postAt && post.postAt <= now;
                    if (isMissed) missedPosts++;
                    queueText += post.getStartupQueueMessage(index + 1, now);
                });
            }

            if (missedPosts > 0) {
                queueText += `\n\n⚠️ <b>Warning:</b> <b>${missedPosts}</b> scheduled post(s) missed their target time (e.g. while the bot was offline) and will be processed momentarily.`;
            }

            const dests = this.memory.defaultDestinations;
            const defaultDestString =
                [
                    dests.bsky && 'Bluesky',
                    dests.tumblr && 'Tumblr',
                    dests.tg && 'Telegram',
                    dests.zip && 'Zip',
                ]
                    .filter(Boolean)
                    .join(', ') || 'None';

            const platforms = getConfiguredPlatforms();
            const activePlatforms = [
                platforms.bsky && 'Bluesky',
                platforms.tumblr && 'Tumblr',
                platforms.tg && 'Telegram',
                platforms.zip && 'Zip',
            ].filter(Boolean).join(', ') || 'None';

            const botName = process.env.BOT_NAME || 'PostBot';
            const startupMessage =
                `🤖 <b>${botName} is now online!</b>\n\n` +
                `I'm ready to cross-post your content.\n\n` +
                `<b>Active Platforms:</b> ${activePlatforms}\n\n` +
                `<b>Configuration & Status:</b>\n` +
                `• <code>/delay ${this.memory.delayPostSeconds}</code> - Current post countdown.\n` +
                `• <code>/togglelinks</code> - Cross-post links are currently <b>${this.memory.showCrossPostLinks ? 'ON' : 'OFF'}</b>.\n` +
                `• Default Destinations: <b>${defaultDestString}</b>` +
                queueText;

            const lastMessageIds = this.memory.startupMessageId || {};
            const newStartupMessageIds = {};

            for (const adminUserId of adminUserIds) {
                // Support migration from single ID to multiple IDs object map
                const lastMessageId = typeof lastMessageIds === 'object' ? lastMessageIds[adminUserId] : lastMessageIds;

                if (lastMessageId) {
                    try {
                        await this.bot.telegram.deleteMessage(adminUserId, lastMessageId);
                        console.log(`[STARTUP] Deleted previous startup message (ID: ${lastMessageId}) for user ${adminUserId}.`);
                    } catch (err) {
                        if (err.response?.description !== 'Bad Request: message to delete not found') {
                            console.warn(`[STARTUP] Could not delete previous startup message (ID: ${lastMessageId}) for user ${adminUserId}:`, err.response?.description || err.message);
                        }
                    }
                }

                try {
                    const newMessage = await this.bot.telegram.sendMessage(
                        adminUserId,
                        startupMessage,
                        { disable_notification: true, parse_mode: 'HTML' },
                    );
                    newStartupMessageIds[adminUserId] = newMessage.message_id;
                    console.log(`[STARTUP] Sent new startup message (ID: ${newMessage.message_id}) to user ${adminUserId}.`);
                } catch (err) {
                    console.error(`[ERROR] Failed to send startup message to user ${adminUserId}:`, err);
                }
            }

            this.memory.startupMessageId = newStartupMessageIds;
        } catch (err) {
            console.error('[ERROR] Failed to send startup message:', err);
        }
    }
}
