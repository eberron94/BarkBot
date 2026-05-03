import { escapeHtml, isAuthorized, parseScheduleTime } from '../util/util.js';
import { PostState } from '../struct/PostState.js';
import { UI } from '../util/UI.js';

export class Messages {
    constructor(memory) {
        this.memory = memory;
    }

    async handle(ctx) {
        const message = ctx.message || ctx.editedMessage;
        if (!message) return;

        // Security Check: Only allow the authorized user
        if (!isAuthorized(ctx)) {
            console.warn(
                `[SECURITY] Unauthorized access attempt from user: ${ctx.from?.username || ctx.from?.first_name || ctx.from?.id}`,
            );
            return ctx.reply(
                '⛔ Unauthorized. You do not have permission to use this bot.',
            );
        }

        if (message.media_group_id) {
            // Buffer media group messages for 1.5 seconds so we can group all the photos/videos into one album payload
            const groupId = message.media_group_id;
            if (!this.memory.mediaGroups.has(groupId)) {
                this.memory.mediaGroups.set(groupId, {
                    messages: [],
                    timer: setTimeout(
                        () => this.#processMediaGroup(ctx, groupId),
                        1500,
                    ),
                });
            }
            this.memory.mediaGroups.get(groupId).messages.push(message);
        } else {
            await this.#processMediaGroup(ctx, null, [message]);
        }
    }

    async #processMediaGroup(ctx, groupId, singleMessage = null) {
        let messages = [];
        if (groupId) {
            const group = this.memory.mediaGroups.get(groupId);
            if (!group) return;
            messages = group.messages;
            this.memory.mediaGroups.delete(groupId);
        } else {
            messages = singleMessage;
        }

        let messageText = '';
        const media = [];

        // Extract captions and media metadata from the received message(s)
        for (const msg of messages) {
            if (msg.caption) messageText = msg.caption;
            if (msg.text) messageText = msg.text;

            const photo = msg.photo ? msg.photo[msg.photo.length - 1] : null;
            const video = msg.video ? msg.video : null;
            const animation = msg.animation ? msg.animation : null;

            if (photo || video || animation) {
                media.push({
                    mediaId:
                        photo?.file_id || video?.file_id || animation?.file_id,
                    mediaType: photo
                        ? 'photo'
                        : video || animation
                          ? 'video'
                          : null, // Treat animation as video
                    mimeType: photo
                        ? 'image/jpeg'
                        : video?.mime_type || animation?.mime_type || null,
                    altText: '',
                });
            }
        }

        // Remove leading/trailing whitespace to prevent formatting issues on target platforms
        messageText = messageText.trim();

        const existingPost = this.memory.pendingPosts.get(ctx.from.id);

        if (existingPost) {
            const isPromptActive =
                existingPost.curState.isAddingPreset ||
                existingPost.curState.isScheduling ||
                existingPost.curState.isEditingPresetName ||
                existingPost.curState.isAddingAltText ||
                existingPost.curState.isAddingTags ||
                existingPost.curState.isEditing;

            if (!isPromptActive) {
                await ctx
                    .reply(
                        '⚠️ You already have an active post in progress! Please finish or cancel the current post before starting a new one.',
                    )
                    .catch(console.error);
                return;
            }
        }

        let tags = existingPost ? existingPost.post.tags || [] : [];

        // State Machine: Determine if the user's message is an answer to a bot prompt
        if (existingPost && existingPost.curState.isAddingPreset) {
            return this.#handleAddingPreset(ctx, existingPost, messageText);
        } else if (existingPost && existingPost.curState.isScheduling) {
            return this.#handleScheduling(ctx, existingPost, messageText);
        } else if (existingPost && existingPost.curState.isEditingPresetName) {
            return this.#handleEditingPresetName(
                ctx,
                existingPost,
                messageText,
            );
        } else if (existingPost && existingPost.curState.isAddingAltText) {
            messageText = this.#handleAddingAltText(
                ctx,
                existingPost,
                messageText,
                media,
            );
        } else if (existingPost && existingPost.curState.isAddingTags) {
            const result = this.#handleAddingTags(
                existingPost,
                messageText,
                media,
            );
            messageText = result.messageText;
            tags = result.tags;
        } else if (existingPost && existingPost.curState.isEditing) {
            this.#handleEditing(existingPost, media);
        }

        if (!messageText && media.length === 0) return;

        const sender = ctx.from?.username
            ? `@${ctx.from.username}`
            : ctx.from?.first_name;
        console.log(
            `[MESSAGE] Received post from ${sender}. Has text: ${!!messageText}, Media count: ${
                media.length
            }`,
        );

        // Save the message in our temporary map
        const postData = existingPost || new PostState();
        postData.post.text = messageText;
        postData.post.media = media;
        postData.post.tags = tags;
        postData.post.destinations = postData.post.destinations || {
            ...this.memory.defaultDestinations,
        };
        postData.post.sourceChatId =
            postData.post.sourceChatId || messages[0]?.chat?.id;
        postData.post.sourceMessageId =
            postData.post.sourceMessageId || messages[0]?.message_id;
        postData.post.sourceChatUsername =
            postData.post.sourceChatUsername || messages[0]?.chat?.username;
        this.memory.pendingPosts.set(ctx.from.id, postData);

        await this.sendPreview(ctx, ctx.from.id);
    }

    /**
     * Handles the user response when creating a new tag preset.
     * @param {object} ctx The Telegraf context.
     * @param {PostState} existingPost The currently active post state.
     * @param {string} messageText The user's message containing the preset name and tags.
     * @returns {Promise<void>}
     */
    async #handleAddingPreset(ctx, existingPost, messageText) {
        const args = messageText.split(/\s+/).filter(Boolean);
        if (args.length >= 2) {
            const name = args[0].toLowerCase();
            const newTags = args
                .slice(1)
                .map((t) => t.replace(/^#/, '').replace(/,$/, ''));
            const presets = this.memory.loadPresets();
            presets[name] = newTags;
            this.memory.savePresets(presets);

            existingPost.curState.isAddingPreset = false;
            existingPost.curState.isAddingTags = true;
            this.memory.pendingPosts.set(ctx.from.id, existingPost);

            await ctx.reply(`✅ Preset '${name}' saved!`).catch(console.error);
            console.log(
                `[PRESET] User ${ctx.from?.username || ctx.from?.first_name} created/updated preset '${name}'`,
            );
            return this.showTagsMenu(ctx, ctx.from.id);
        } else {
            await ctx
                .reply(
                    '⚠️ Please provide a name and at least one tag. (e.g., `dice ttrpg handmade`)',
                )
                .catch(console.error);
        }
    }

    /**
     * Handles the user response when providing a time to schedule a post.
     * @param {object} ctx The Telegraf context.
     * @param {PostState} existingPost The currently active post state.
     * @param {string} messageText The user's message containing the schedule time.
     * @returns {Promise<void>}
     */
    async #handleScheduling(ctx, existingPost, messageText) {
        const postAt = parseScheduleTime(messageText);

        if (!postAt) {
            await ctx
                .reply(
                    '⚠️ Invalid time. Please send a valid number of minutes in the future (e.g. 60) or a date/time (e.g. "2026-05-02 12:00").',
                )
                .catch(console.error);
            return;
        }

        existingPost.curState.isScheduling = false;
        existingPost.post.postAt = postAt;
        existingPost.post.id =
            existingPost.post.id || Math.random().toString(36).substring(2, 8);
        existingPost.post.userId = ctx.from.id;

        const scheduled = this.memory.scheduledPosts;
        scheduled.push(existingPost.post);
        scheduled.sort(
            (a, b) => (a.postAt || Infinity) - (b.postAt || Infinity),
        );
        this.memory.scheduledPosts = scheduled;

        this.memory.pendingPosts.delete(ctx.from.id);

        const dateStr = new Date(postAt).toLocaleString();
        console.log(
            `[SCHEDULE] User ${ctx.from?.username || ctx.from?.first_name} scheduled post ${existingPost.post.id} for ${dateStr}`,
        );

        await ctx
            .reply(
                `✅ Post scheduled for ${dateStr}.\nID: <code>${existingPost.post.id}</code>\n\nUse /queue to see scheduled posts.`,
                { parse_mode: 'HTML' },
            )
            .catch(console.error);
    }

    /**
     * Handles the user response when editing the tags of an existing preset.
     * @param {object} ctx The Telegraf context.
     * @param {PostState} existingPost The currently active post state.
     * @param {string} messageText The user's message containing the new tags.
     * @returns {Promise<void>}
     */
    async #handleEditingPresetName(ctx, existingPost, messageText) {
        const name = existingPost.curState.isEditingPresetName;
        const newTags = messageText
            .split(/\s+/)
            .map((t) => t.replace(/^#/, '').replace(/,$/, ''))
            .filter(Boolean);

        if (newTags.length > 0) {
            const presets = this.memory.loadPresets();
            presets[name] = newTags;
            this.memory.savePresets(presets);

            existingPost.curState.isEditingPresetName = null;
            existingPost.curState.isAddingTags = true;
            this.memory.pendingPosts.set(ctx.from.id, existingPost);

            await ctx
                .reply(`✅ Preset '${name}' updated!`)
                .catch(console.error);
            console.log(
                `[PRESET] User ${ctx.from?.username || ctx.from?.first_name} updated tags for preset '${name}'`,
            );
            return this.showTagsMenu(ctx, ctx.from.id);
        } else {
            await ctx
                .reply('⚠️ Please provide at least one tag.')
                .catch(console.error);
        }
    }

    /**
     * Handles adding alt text to the media items in the current post.
     * @param {object} ctx The Telegraf context.
     * @param {PostState} existingPost The currently active post state.
     * @param {string} messageText The user's message containing the alt text descriptions.
     * @param {Array} media The current media attachments buffer.
     * @returns {string} The original post text to replace the user's message.
     */
    #handleAddingAltText(ctx, existingPost, messageText, media) {
        const altTexts = messageText
            .split(/(?:\s*\n---\n\s*|\n+)/)
            .map((t) => t.trim())
            .filter(Boolean);
        existingPost.post.media.forEach((m, i) => {
            m.altText = altTexts[i] || altTexts[0] || '';
        });

        console.log(
            `[ALT TEXT] User ${ctx.from?.username || ctx.from?.first_name} applied alt text to ${existingPost.post.media.length} media item(s).`,
        );

        media.length = 0; // Ignore accidental media sent during alt text tagging
        media.push(...(existingPost.post.media || []));
        existingPost.curState.isAddingAltText = false;

        return existingPost.post.text;
    }

    /**
     * Handles appending manually typed tags to the current post.
     * @param {PostState} existingPost The currently active post state.
     * @param {string} messageText The user's message containing the tags.
     * @param {Array} media The current media attachments buffer.
     * @returns {object} An object containing the original post text and the newly merged tags array.
     */
    #handleAddingTags(existingPost, messageText, media) {
        const newTags = messageText
            .split(/\s+/)
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean);
        const mergedTags = new Set([
            ...(existingPost.post.tags || []),
            ...newTags,
        ]);

        media.length = 0; // Ignore accidental media sent during tagging
        media.push(...(existingPost.post.media || []));
        existingPost.curState.isAddingTags = false;

        return {
            messageText: existingPost.post.text,
            tags: Array.from(mergedTags),
        };
    }

    /**
     * Completes the post editing flow and restores media attachments.
     * @param {PostState} existingPost The currently active post state.
     * @param {Array} media The current media attachments buffer.
     */
    #handleEditing(existingPost, media) {
        if (media.length === 0) {
            // User is editing the caption of a draft that had media, but they didn't re-upload the media. Carry the media over.
            media.push(...(existingPost.post.media || []));
        }
        existingPost.curState.isEditing = false;
    }

    async sendPreview(ctx, userId) {
        const existingPost = this.memory.pendingPosts.get(userId);
        if (!existingPost) return;

        let previewText = existingPost.post.getPreviewMessage();
        previewText += `\n\nSelect destinations and post:`;

        const dest =
            existingPost.post.destinations || this.memory.defaultDestinations;

        const replyOptions = {
            parse_mode: 'HTML',
            ...UI.preview(
                dest,
                existingPost.post.media.length > 0,
                !!existingPost.post.postAt,
            ),
        };

        if (ctx.callbackQuery) {
            // If triggered by a button press, seamlessly edit the current message
            await ctx
                .editMessageText(previewText, replyOptions)
                .catch(() => {});
        } else {
            // If triggered by a normal text message, reply as a new message
            await ctx.reply(previewText, replyOptions).catch(console.error);
        }
    }

    async showTagsMenu(ctx, userId, page = 1) {
        const postData = this.memory.pendingPosts.get(userId);
        const currentTags = postData?.post?.tags || [];

        const presets = this.memory.loadPresets();

        let text = '🏷️ Manage your tags below.\n\n';
        if (currentTags.length > 0) {
            text += `<b>Current:</b> ${currentTags.map((t) => `#${escapeHtml(t)}`).join(' ')}\n\n`;
        }
        text +=
            "Click a preset or type in a new list of tags to add to the post's current tags.";

        const replyOptions = {
            parse_mode: 'HTML',
            ...UI.tagsMenu(currentTags, presets, page),
        };

        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, replyOptions).catch(console.error);
        } else {
            await ctx.reply(text, replyOptions).catch(console.error);
        }
    }
}
