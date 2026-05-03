import { isAuthorized, getConfiguredPlatforms } from '../util/util.js';
import { PostState } from '../struct/PostState.js';
import { UI } from '../util/UI.js';

export class Actions {
    constructor(bot, memory, messages, publisher) {
        this.bot = bot;
        this.memory = memory;
        this.messages = messages;
        this.publisher = publisher;
    }

    registerActions() {
        this.bot.action(/^page_tags_(\d+)$/, (ctx) =>
            this.#handleTagsPage(ctx),
        );
        this.bot.action(/^page_delpreset_(\d+)$/, (ctx) =>
            this.#handleDelPresetMenu(ctx),
        );
        this.bot.action(/^page_editpreset_(\d+)$/, (ctx) =>
            this.#handleEditPresetMenu(ctx),
        );
        this.bot.action(/^preset_(.+)$/, (ctx) =>
            this.#handlePresetSelection(ctx),
        );
        this.bot.action('action_add_preset', (ctx) =>
            this.#handleAddPreset(ctx),
        );
        this.bot.action('action_del_preset_menu', (ctx) =>
            this.#handleDelPresetMenu(ctx),
        );
        this.bot.action('action_edit_preset_menu', (ctx) =>
            this.#handleEditPresetMenu(ctx),
        );
        this.bot.action(/^editpreset_(.+)$/, (ctx) =>
            this.#handleEditPresetSelection(ctx),
        );
        this.bot.action(/^delpreset_(.+)$/, (ctx) =>
            this.#handleDelPresetExecution(ctx),
        );
        this.bot.action(/^removetag_(.+)$/, (ctx) =>
            this.#handleRemoveTag(ctx),
        );
        this.bot.action('action_clear_tags', (ctx) =>
            this.#handleClearTags(ctx),
        );
        this.bot.action('action_add_alt_text', (ctx) =>
            this.#handleAddAltText(ctx),
        );
        this.bot.action(/^toggle_(bsky|tumblr|tg|zip)$/, (ctx) =>
            this.#handleToggleDestination(ctx),
        );
        this.bot.action(/^toggle_default_(bsky|tumblr|tg|zip)$/, (ctx) =>
            this.#handleToggleDefaultDestination(ctx),
        );
        this.bot.action(
            /^(post_selected|post_cancel|post_edit|post_tags|post_save_queue|post_save_draft|post_clear_schedule)$/,
            (ctx) => this.#handlePostAction(ctx),
        );
        this.bot.action('countdown_force', (ctx) =>
            this.#handleCountdownForce(ctx),
        );
        this.bot.action('countdown_cancel', (ctx) =>
            this.#handleCountdownCancel(ctx),
        );
        this.bot.action('post_schedule', (ctx) =>
            this.#handlePostSchedule(ctx),
        );
        this.bot.action(/^edit_scheduled_(.+)$/, (ctx) =>
            this.#handleEditScheduled(ctx),
        );
        this.bot.action(/^del_scheduled_(.+)$/, (ctx) =>
            this.#handleDelScheduled(ctx),
        );
    }

    async #handleRemoveTag(ctx) {
        const tagToRemove = ctx.match[1];
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData && postData.post.tags) {
            postData.post.tags = postData.post.tags.filter(
                (t) => t !== tagToRemove,
            );
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }

        // Redraw the tags menu
        await this.messages.showTagsMenu(ctx, ctx.from.id);
        return ctx.answerCbQuery(`Removed tag: #${tagToRemove}`);
    }

    async #handleToggleDestination(ctx) {
        const destination = ctx.match[1];
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData) {
            await ctx.editMessageText('⚠️ No pending post found.');
            return ctx.answerCbQuery();
        }

        const platforms = getConfiguredPlatforms();
        if (!platforms[destination]) {
            return ctx.answerCbQuery(`⚠️ ${destination} is not configured.`, { show_alert: true });
        }

        // Initialize destinations if they don't exist
        if (!postData.post.destinations) {
            postData.post.destinations = { ...this.memory.defaultDestinations };
        }

        // Toggle the specific destination
        postData.post.destinations[destination] =
            !postData.post.destinations[destination];

        console.log(
            `[ACTION] User ${ctx.from?.username || ctx.from?.first_name} toggled destination '${destination}' to ${postData.post.destinations[destination]}`,
        );

        this.memory.pendingPosts.set(ctx.from.id, postData);

        // Redraw the preview with the updated state
        await this.messages.sendPreview(ctx, ctx.from.id);
        return ctx.answerCbQuery();
    }

    async #handleToggleDefaultDestination(ctx) {
        const destination = ctx.match[1];
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const platforms = getConfiguredPlatforms();
        if (!platforms[destination]) {
            return ctx.answerCbQuery(`⚠️ ${destination} is not configured.`, { show_alert: true });
        }

        const dests = this.memory.defaultDestinations;
        dests[destination] = !dests[destination];
        this.memory.defaultDestinations = dests;

        console.log(
            `[ACTION] User ${ctx.from?.username || ctx.from?.first_name} toggled default destination '${destination}' to ${dests[destination]}`,
        );

        await ctx
            .editMessageText(
                '⚙️ <b>Default Post Destinations:</b>\nToggle which platforms are selected by default for new posts.',
                {
                    parse_mode: 'HTML',
                    ...UI.defaultDestinations(dests),
                },
            )
            .catch(() => {});
        return ctx.answerCbQuery();
    }

    async #handlePresetSelection(ctx) {
        const action = ctx.match[1];

        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData) {
            await ctx.editMessageText('⚠️ No pending post found.');
            return ctx.answerCbQuery();
        }

        // This is the cancel button from the tags menu, it should go back to the main preview
        if (action === 'cancel') {
            postData.curState.isAddingTags = false;
            postData.curState.isAddingPreset = false;
            postData.curState.isEditingPresetName = null;
            postData.curState.isAddingAltText = false;
            postData.curState.isScheduling = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
            await this.messages.sendPreview(ctx, ctx.from.id);
            return ctx.answerCbQuery();
        }

        const presets = this.memory.loadPresets();
        if (presets[action]) {
            const currentTags = new Set(postData.post.tags || []);
            presets[action].forEach((tag) => currentTags.add(tag));
            postData.post.tags = Array.from(currentTags);
        }

        this.memory.pendingPosts.set(ctx.from.id, postData);

        // Redraw the tags menu to show the new tags and allow for more changes
        await this.messages.showTagsMenu(ctx, ctx.from.id);
        return ctx.answerCbQuery('Tags added!');
    }

    async #handleAddPreset(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            postData.curState.isAddingTags = false;
            postData.curState.isAddingPreset = true;
            postData.curState.isEditingPresetName = null;
            postData.curState.isAddingAltText = false;
            postData.curState.isScheduling = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }

        await ctx
            .editMessageText(
                '➕ <b>Add a New Preset</b>\n\nPlease send the name of your preset followed by the tags.\n\n<i>Example:</i> <code>jewelry chainmail ring silver</code>',
                {
                    parse_mode: 'HTML',
                    ...UI.cancel('post_tags'),
                },
            )
            .catch(console.error);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleTagsPage(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }
        const page = ctx.match && typeof ctx.match[1] === 'string' ? parseInt(ctx.match[1], 10) : 1;
        await this.messages.showTagsMenu(ctx, ctx.from.id, page);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleDelPresetMenu(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const page = ctx.match && typeof ctx.match[1] === 'string' ? parseInt(ctx.match[1], 10) : 1;
        const presets = this.memory.loadPresets();
        await ctx
            .editMessageText(
                '🗑️ <b>Delete a Preset</b>\n\nClick a preset below to permanently delete it:',
                {
                    parse_mode: 'HTML',
                    ...UI.presetList(presets, 'delpreset', 'post_tags', '❌ ', page),
                },
            )
            .catch(console.error);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleEditPresetMenu(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const page = ctx.match && typeof ctx.match[1] === 'string' ? parseInt(ctx.match[1], 10) : 1;
        const presets = this.memory.loadPresets();
        await ctx
            .editMessageText(
                '✏️ <b>Edit a Preset</b>\n\nClick a preset below to edit its tags:',
                {
                    parse_mode: 'HTML',
                    ...UI.presetList(presets, 'editpreset', 'post_tags', '✏️ ', page),
                },
            )
            .catch(console.error);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleEditPresetSelection(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const key = ctx.match[1];
        const presets = this.memory.loadPresets();
        if (!presets[key]) {
            await ctx.answerCbQuery(`⚠️ Preset not found.`).catch(() => {});
            return this.messages.showTagsMenu(ctx, ctx.from.id);
        }

        const postData =
            this.memory.pendingPosts.get(ctx.from.id) ||
            new PostState({
                media: [],
                tags: [],
            });
        postData.curState.isAddingTags = false;
        postData.curState.isAddingPreset = false;
        postData.curState.isEditingPresetName = key;
        postData.curState.isAddingAltText = false;
        postData.curState.isScheduling = false;
        this.memory.pendingPosts.set(ctx.from.id, postData);

        const currentTags = presets[key].map((t) => `#${t}`).join(' ');

        await ctx
            .editMessageText(
                `✏️ <b>Editing Preset: ${key}</b>\n\nCurrent tags: ${currentTags}\n\nPlease send the new tags separated by spaces.`,
                {
                    parse_mode: 'HTML',
                    ...UI.cancel('post_tags'),
                },
            )
            .catch(console.error);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleDelPresetExecution(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const key = ctx.match[1];
        const presets = this.memory.loadPresets();
        if (presets[key]) {
            delete presets[key];
            this.memory.savePresets(presets);
            await ctx
                .answerCbQuery(`✅ Deleted preset: ${key}`)
                .catch(() => {});
        } else {
            await ctx.answerCbQuery(`⚠️ Preset not found.`).catch(() => {});
        }

        await this.messages.showTagsMenu(ctx, ctx.from.id);
    }

    async #handleClearTags(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            postData.post.tags = [];
            postData.curState.isAddingTags = false;
            postData.curState.isAddingPreset = false;
            postData.curState.isEditingPresetName = null;
            postData.curState.isAddingAltText = false;
            postData.curState.isScheduling = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }
        await this.messages.sendPreview(ctx, ctx.from.id);
        return ctx.answerCbQuery('🧹 Tags cleared!').catch(() => {});
    }

    async #handleAddAltText(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            postData.curState.isAddingTags = false;
            postData.curState.isAddingPreset = false;
            postData.curState.isEditingPresetName = null;
            postData.curState.isAddingAltText = true;
            postData.curState.isScheduling = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }

        await ctx
            .editMessageText(
                '🖼️ <b>Add Alt Text</b>\n\nPlease send the alt text for your media.\n\n<i>If you have multiple images in an album, separate the alt text for each image with "---" or a new line. If you only send one description, it will be applied to all images automatically!</i>',
                {
                    parse_mode: 'HTML',
                    ...UI.cancel('preset_cancel'),
                },
            )
            .catch(console.error);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handlePostAction(ctx) {
        const action = ctx.match[1];

        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        console.log(
            `[ACTION] User ${ctx.from?.username || ctx.from?.first_name} clicked post action: ${action}`,
        );

        switch (action) {
            case 'post_edit':
                return this.#handlePostEdit(ctx);
            case 'post_tags':
                return this.#handlePostTags(ctx);
            case 'post_save_queue':
                return this.#handlePostSaveQueue(ctx);
            case 'post_save_draft':
                return this.#handlePostSaveDraft(ctx);
            case 'post_clear_schedule':
                return this.#handlePostClearSchedule(ctx);
            case 'post_cancel':
                return this.#handlePostCancel(ctx);
            case 'post_selected':
                return this.#handlePostSelected(ctx);
            default:
                return ctx.answerCbQuery();
        }
    }

    async #handlePostEdit(ctx) {
        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            postData.curState.isEditing = true;
            postData.curState.isAddingAltText = false;
            postData.curState.isScheduling = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }
        await ctx.editMessageText(
            '✏️ Please send your corrected message below. (Your attached media will be kept automatically!)',
        );
        return ctx.answerCbQuery();
    }

    async #handlePostTags(ctx) {
        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            postData.curState.isAddingTags = true;
            postData.curState.isAddingPreset = false;
            postData.curState.isEditingPresetName = null;
            postData.curState.isAddingAltText = false;
            postData.curState.isScheduling = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }

        await this.messages.showTagsMenu(ctx, ctx.from.id);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handlePostSaveQueue(ctx) {
        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData || !postData.post.postAt) {
            return ctx.answerCbQuery('⚠️ No schedule set.', {
                show_alert: true,
            });
        }

        const scheduled = this.memory.scheduledPosts;
        scheduled.push(postData.post);
        scheduled.sort(
            (a, b) => (a.postAt || Infinity) - (b.postAt || Infinity),
        );
        this.memory.scheduledPosts = scheduled;
        this.memory.pendingPosts.delete(ctx.from.id);

        const dateStr = new Date(postData.post.postAt).toLocaleString();
        await ctx
            .editMessageText(
                `✅ Post saved back to queue for ${dateStr}.\nID: <code>${postData.post.id}</code>\n\nUse /queue to see scheduled posts.`,
                { parse_mode: 'HTML' },
            )
            .catch(console.error);
        return ctx.answerCbQuery();
    }

    async #handlePostSaveDraft(ctx) {
        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData) {
            return ctx.answerCbQuery('⚠️ No pending post found.', {
                show_alert: true,
            });
        }

        delete postData.post.postAt;
        postData.post.id =
            postData.post.id || Math.random().toString(36).substring(2, 8);
        postData.post.userId = ctx.from.id;

        const scheduled = this.memory.scheduledPosts;
        scheduled.push(postData.post);
        scheduled.sort(
            (a, b) => (a.postAt || Infinity) - (b.postAt || Infinity),
        );
        this.memory.scheduledPosts = scheduled;
        this.memory.pendingPosts.delete(ctx.from.id);

        await ctx
            .editMessageText(
                `✅ Post saved as a draft.\nID: <code>${postData.post.id}</code>\n\nUse /queue to see scheduled posts and drafts.`,
                { parse_mode: 'HTML' },
            )
            .catch(console.error);
        return ctx.answerCbQuery();
    }

    async #handlePostClearSchedule(ctx) {
        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            delete postData.post.postAt;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }
        await this.messages.sendPreview(ctx, ctx.from.id);
        return ctx.answerCbQuery('Schedule cleared.');
    }

    async #handlePostCancel(ctx) {
        this.memory.pendingPosts.delete(ctx.from.id);
        await ctx.editMessageText('❌ Post cancelled.');
        return ctx.answerCbQuery();
    }

    async #handlePostSelected(ctx) {
        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData) {
            await ctx.editMessageText(
                '⚠️ No pending post found. Please send your message again.',
            );
            return ctx.answerCbQuery();
        }

        const delaySeconds = this.memory.delayPostSeconds || 30;

        postData.curState.targetAction = 'post_selected';
        postData.curState.countdownTimer = setTimeout(() => {
            this.#executePost(ctx, ctx.from.id);
        }, delaySeconds * 1000);
        this.memory.pendingPosts.set(ctx.from.id, postData);

        const destinations = postData.post.destinations || {};
        const platforms = getConfiguredPlatforms();
        const enabledDestinations = Object.entries(destinations)
            .filter(([key, enabled]) => enabled && platforms[key])
            .map(([key]) => {
                if (key === 'bsky') return 'Bluesky';
                if (key === 'tumblr') return 'Tumblr';
                if (key === 'tg') return 'Telegram';
                if (key === 'zip') return 'Zip';
                return '';
            })
            .filter(Boolean);

        let destinationText;
        if (enabledDestinations.length === 0) {
            destinationText = 'No destinations!';
        } else {
            destinationText = enabledDestinations.join(', ');
        }

        const previewMessage = postData.post.getPreviewMessage();
        const countdownMessage = `${previewMessage}\n\nDestinations: <b>${destinationText}</b>\n\n⏳ Countdown started (${delaySeconds}s)...`;

        await ctx
            .editMessageText(countdownMessage, {
                parse_mode: 'HTML',
                ...UI.countdown(),
            })
            .catch(console.error);
        return ctx.answerCbQuery();
    }

    async #handleCountdownForce(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData || !postData.curState.countdownTimer)
            return ctx.answerCbQuery('⚠️ No pending post found.', {
                show_alert: true,
            });

        clearTimeout(postData.curState.countdownTimer);
        postData.curState.countdownTimer = null;

        const action = postData.curState.targetAction;
        await this.#executePost(ctx, ctx.from.id);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleCountdownCancel(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (!postData || !postData.curState.countdownTimer)
            return ctx.answerCbQuery('⚠️ No pending post found.', {
                show_alert: true,
            });

        clearTimeout(postData.curState.countdownTimer);
        postData.curState.countdownTimer = null;
        postData.curState.targetAction = null;

        this.memory.pendingPosts.set(ctx.from.id, postData);

        await this.messages.sendPreview(ctx, ctx.from.id);
        return ctx
            .answerCbQuery('❌ Post cancelled, returned to edit mode.')
            .catch(() => {});
    }

    async #handlePostSchedule(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const postData = this.memory.pendingPosts.get(ctx.from.id);
        if (postData) {
            postData.curState.isScheduling = true;
            postData.curState.isAddingTags = false;
            postData.curState.isAddingPreset = false;
            postData.curState.isEditingPresetName = null;
            postData.curState.isAddingAltText = false;
            this.memory.pendingPosts.set(ctx.from.id, postData);
        }

        await ctx
            .editMessageText(
                '🕰️ <b>Schedule Post</b>\n\nHow many minutes from now should this post be sent? (e.g., <code>60</code> for 1 hour)\n\nAlternatively, send a specific date and time (e.g., <code>2026-05-02 12:00</code>).',
                {
                    parse_mode: 'HTML',
                    ...UI.cancel('preset_cancel'),
                },
            )
            .catch(console.error);
        return ctx.answerCbQuery().catch(() => {});
    }

    async #handleDelScheduled(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const id = ctx.match[1];
        const scheduled = this.memory.scheduledPosts;
        const index = scheduled.findIndex((p) => p.id === id);

        if (index === -1) {
            return ctx.answerCbQuery('⚠️ Scheduled post not found.', {
                show_alert: true,
            });
        }

        scheduled.splice(index, 1);
        this.memory.scheduledPosts = scheduled;

        console.log(
            `[QUEUE] Scheduled post ${id} deleted by user ${ctx.from?.username || ctx.from?.first_name} via inline button`,
        );

        await ctx.answerCbQuery(`🗑️ Post ${id} deleted!`);

        // Replace the queue message with a deleted indicator
        await ctx
            .editMessageText(
                `🗑️ <b>Deleted:</b> Scheduled post <code>${id}</code>`,
                { parse_mode: 'HTML' },
            )
            .catch(() => {});
    }

    async #handleEditScheduled(ctx) {
        if (!isAuthorized(ctx)) {
            return ctx.answerCbQuery('⛔ Unauthorized.', { show_alert: true });
        }

        const id = ctx.match[1];
        const scheduled = this.memory.scheduledPosts;
        const index = scheduled.findIndex((p) => p.id === id);

        if (index === -1) {
            return ctx.answerCbQuery('⚠️ Scheduled post not found.', {
                show_alert: true,
            });
        }

        const post = scheduled[index];
        scheduled.splice(index, 1);
        this.memory.scheduledPosts = scheduled;

        this.memory.pendingPosts.set(ctx.from.id, new PostState(post));

        await ctx.answerCbQuery('✏️ Post moved to active editing!');
        await this.messages.sendPreview(ctx, ctx.from.id);
    }

    async #executePost(ctx, userId) {
        const postData = this.memory.pendingPosts.get(userId);
        if (!postData) {
            if (ctx)
                await ctx
                    .editMessageText('⚠️ No pending post found.')
                    .catch(console.error);
            return;
        }
        this.memory.pendingPosts.delete(userId);
        await this.publisher.publish(postData.post, ctx, userId);
    }
}
