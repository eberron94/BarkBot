import { escapeHtml, getConfiguredPlatforms } from '../util/util.js';

export class Publisher {
    /**
     * @param {object} bot The Telegraf bot instance.
     * @param {object} blueskyPost The Bluesky publisher instance.
     * @param {object} tumblrPost The Tumblr publisher instance.
     * @param {object} channelPost The Telegram publisher instance.
     * @param {object} zipPost The Zip archive publisher instance.
     * @param {object} memory The Memory storage instance.
     */
    constructor(bot, blueskyPost, tumblrPost, channelPost, zipPost, memory) {
        this.bot = bot;
        this.blueskyPost = blueskyPost;
        this.tumblrPost = tumblrPost;
        this.channelPost = channelPost;
        this.zipPost = zipPost;
        this.memory = memory;
    }

    /**
     * Executes the post, downloading media and cross-posting to the selected destinations.
     * @param {object} post The Post data model to publish.
     * @param {object|null} ctx The Telegraf context, if triggered manually.
     * @param {number} userId The ID of the user executing the post.
     * @returns {Promise<void>}
     */
    async publish(post, ctx, userId) {
        const { text: messageText, media, tags = [], destinations } = post;

        console.log(
            `[POST] Starting execution for post ID: ${post.id || 'Immediate'} (User ${userId}). Destinations:`,
            destinations,
        );

        let statusMessage;
        const initText =
            media.length > 0
                ? '⏳ Downloading media and posting...'
                : '⏳ Posting...';

        if (ctx) {
            await ctx.editMessageText(initText).catch(console.error);
        } else {
            statusMessage = await this.bot.telegram
                .sendMessage(
                    userId,
                    `⏳ Executing scheduled post <code>${post.id || 'N/A'}</code>...\n${initText}`,
                    { parse_mode: 'HTML' },
                )
                .catch(console.error);
        }

        const downloadedMedia = [];
        for (const item of media) {
            try {
                const fileLink = await this.bot.telegram.getFileLink(
                    item.mediaId,
                );
                const response = await fetch(fileLink.href);
                downloadedMedia.push({
                    buffer: await response.arrayBuffer(),
                    ...item,
                });
            } catch (err) {
                console.error(
                    '[ERROR] Failed to download media from Telegram (is it over 20MB?):',
                    err,
                );
                const errMsg =
                    '❌ Failed to download attached media from Telegram. Files over 20MB are not supported by the Bot API.';
                if (ctx) {
                    await ctx.editMessageText(errMsg).catch(console.error);
                } else if (statusMessage) {
                    await this.bot.telegram
                        .editMessageText(
                            userId,
                            statusMessage.message_id,
                            undefined,
                            errMsg,
                        )
                        .catch(console.error);
                }
                return;
            }
        }

        let bskySuccess = false;
        let tumblrSuccess = false;
        let tgSuccess = false;
        let zipSuccess = false;
        let bskyLink;
        let tumblrLink;
        let tgLink;
        let zipLink;
        const errors = [];

        const postDestinations = destinations || {};
        const platforms = getConfiguredPlatforms();

        if (postDestinations.bsky && platforms.bsky) {
            const bskyVideos = downloadedMedia.filter(
                (m) => m.mediaType === 'video',
            );
            const bskyPhotos = downloadedMedia.filter(
                (m) => m.mediaType === 'photo',
            );

            if (bskyVideos.length > 0 && bskyPhotos.length > 0) {
                errors.push(
                    'Bluesky: Posts with mixed media types (photos and videos) are not supported. Please post either photos or videos, but not both.',
                );
                console.error(
                    '[ERROR] Bluesky does not support mixed media types.',
                );
            } else {
                try {
                    const result = await this.blueskyPost.post({
                        messageText,
                        downloadedMedia,
                        tags,
                    });
                    bskySuccess = true;
                    bskyLink = result;
                } catch (error) {
                    console.error(
                        '[ERROR] Failed to cross-post to Bluesky:',
                        error,
                    );
                    errors.push(`Bluesky: ${error.message}`);
                }
            }
        }

        if (postDestinations.tumblr && platforms.tumblr) {
            try {
                const result = await this.tumblrPost.post({
                    messageText,
                    downloadedMedia,
                    tags,
                });
                tumblrSuccess = true;
                tumblrLink = result;
            } catch (error) {
                console.error('[ERROR] Failed to cross-post to Tumblr:', error);
                errors.push(`Tumblr: ${error.message}`);
            }
        }

        if (postDestinations.tg && platforms.tg) {
            try {
                const crossPostLinks = [];
                if (bskySuccess && bskyLink) crossPostLinks.push(bskyLink);
                if (tumblrSuccess && tumblrLink)
                    crossPostLinks.push(tumblrLink);

                const result = await this.channelPost.post(
                    { messageText, media },
                    crossPostLinks,
                    this.memory.showCrossPostLinks,
                );
                tgSuccess = true;
                tgLink = result;
            } catch (error) {
                console.error(
                    '[ERROR] Failed to cross-post to Telegram:',
                    error,
                );
                errors.push(`Telegram: ${error.message}`);
            }
        }

        if (postDestinations.zip && platforms.zip) {
            try {
                const result = await this.zipPost.post(
                    {
                        messageText,
                        downloadedMedia,
                        tags,
                    },
                    userId,
                );
                zipSuccess = true;
                zipLink = result;
            } catch (error) {
                console.error('[ERROR] Failed to generate Zip archive:', error);
                errors.push(`Zip: ${error.message}`);
            }
        }

        let finalStatus = '';
        const successMessages = [];
        if (bskySuccess) successMessages.push(`✅ ${bskyLink.link}`);
        if (tumblrSuccess) {
            const hasVideo = downloadedMedia.some(
                (item) => item.mediaType === 'video',
            );
            if (hasVideo && postDestinations.tumblr) {
                successMessages.push(
                    `✅ ${tumblrLink.link} (video processing, linked to blog)`,
                );
            } else {
                successMessages.push(`✅ ${tumblrLink.link}`);
            }
        }
        if (tgSuccess) successMessages.push(`✅ ${tgLink.link}`);
        if (zipSuccess) successMessages.push(`✅ Zip: ${zipLink.link}`);

        if (successMessages.length > 0) {
            finalStatus += `🎉 Cross-posting complete!\n\n${successMessages.join('\n')}`;
        }

        if (errors.length > 0) {
            const escapedErrors = errors.map((e) => escapeHtml(e));
            finalStatus +=
                (finalStatus ? '\n\n' : '') +
                `❌ Errors:\n${escapedErrors.join('\n')}`;
        }

        if (!finalStatus) {
            finalStatus = '❌ Failed to cross-post entirely.';
        }

        if (ctx) {
            await ctx
                .editMessageText(finalStatus, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                })
                .catch(console.error);
        } else if (statusMessage) {
            await this.bot.telegram
                .editMessageText(
                    userId,
                    statusMessage.message_id,
                    undefined,
                    finalStatus,
                    {
                        parse_mode: 'HTML',
                        link_preview_options: { is_disabled: true },
                    },
                )
                .catch(console.error);
        }
    }
}
