import { escapeHtml } from '../util/util.js';

export class Post {
    constructor(data = {}) {
        this.id = data.id || null;
        this.userId = data.userId || null;
        this.text = data.text || '';
        this.media = data.media || [];
        this.tags = data.tags || [];
        this.destinations = data.destinations || null;
        this.sourceChatId = data.sourceChatId || null;
        this.sourceMessageId = data.sourceMessageId || null;
        this.sourceChatUsername = data.sourceChatUsername || null;
        this.postAt = data.postAt || null;
    }

    /**
     * Generates a formatted preview message of the post for editing.
     * @returns {string} The formatted preview text.
     */
    getPreviewMessage() {
        const { text: messageText, media, tags = [] } = this;

        // --- Media and Text Analysis ---
        const photoCount = media.filter((m) => m.mediaType === 'photo').length;
        const videoCount = media.filter((m) => m.mediaType === 'video').length;
        let bskyTextPreview = messageText;
        if (tags.length > 0) {
            bskyTextPreview +=
                (bskyTextPreview ? '\n\n' : '') +
                tags.map((t) => '#' + t).join(' ');
        }
        const charCount = bskyTextPreview.length;

        // --- Warning Generation ---
        const warnings = [];
        if (charCount > 300) {
            warnings.push(`Post exceeds Bluesky's 300 character limit.`);
        }
        if (videoCount > 0 && photoCount > 0) {
            warnings.push(
                `Bluesky does not support mixed media. The post will not be sent to Bluesky.`,
            );
        } else if (videoCount > 1) {
            warnings.push(
                `Bluesky only supports 1 video. Only the first will be sent.`,
            );
        }
        if (videoCount > 0) {
            warnings.push(
                `Tumblr video posts will link to the main blog due to processing delays.`,
            );
        }

        // --- Build Preview Text ---
        let previewText = `👀 <b>POST PREVIEW</b> 👀\n`;

        if (media.length > 0) {
            previewText += `━━━━━━━━━━━━━━\n`;
            if (photoCount > 0)
                previewText += `🖼️ [${photoCount} Attached Photo${
                    photoCount > 1 ? 's' : ''
                }]\n`;
            if (videoCount > 0)
                previewText += `🎞️ [${videoCount} Attached Video${
                    videoCount > 1 ? 's' : ''
                }]\n`;

            const altTexts = media.map((m, i) =>
                m.altText
                    ? `  ${i + 1}: <code>${escapeHtml(m.altText)}</code>`
                    : `  ${i + 1}: ❌ None`,
            );
            previewText += `\n📝 <b>Alt Text</b>\n${altTexts.join('\n')}\n`;
        }

        if (messageText) {
            previewText += `━━━━━━━━━━━━━━\n`;
            previewText += `📝 | <code>${escapeHtml(messageText)}</code>\n`;
        }

        if (tags.length > 0) {
            previewText += `━━━━━━━━━━━━━━\n`;
            previewText += `🏷️ <b>Tags:</b> ${tags
                .map((t) => `#${escapeHtml(t)}`)
                .join(', ')}\n`;
        }

        previewText += `━━━━━━━━━━━━━━\n`;
        previewText += `📊 <b>Length:</b> ${charCount} characters`;

        if (this.postAt) {
            previewText += `\n⏰ <b>Scheduled For:</b> ${new Date(this.postAt).toLocaleString()}`;
        } else if (this.id) {
            previewText += `\n📝 <b>Draft</b> (Unscheduled)`;
        }

        if (warnings.length > 0) {
            previewText +=
                `\n\n⚠️ <b>Warnings:</b>\n` +
                warnings.map((w) => `• <i>${w}</i>`).join('\n');
        }

        return previewText;
    }

    /**
     * Generates a formatted summary string for this post to display in the /queue command list.
     * @param {number} index The numerical position of this post in the queue.
     * @param {object} defaultDestinations The bot's default destination settings.
     * @returns {string} The formatted queue item string.
     */
    getQueueMessage(index, defaultDestinations) {
        const dateStr = this.postAt
            ? new Date(this.postAt).toLocaleString()
            : 'Draft (Unscheduled)';
        const previewText = this.text
            ? this.text.length > 30
                ? this.text.substring(0, 30) + '...'
                : this.text
            : '[Media Only]';

        const dests = this.destinations || defaultDestinations;
        const destString =
            [
                dests.bsky && 'Bluesky',
                dests.tumblr && 'Tumblr',
                dests.tg && 'Telegram',
                dests.tiktok && 'TikTok',
            ]
                .filter(Boolean)
                .join(', ') || 'None';

        return `<b>${index}.</b> ID: <code>${this.id}</code>\n⏰ ${dateStr}\n🌍 <b>Destinations:</b> ${destString}\n📝 <i>${escapeHtml(previewText)}</i>`;
    }

    /**
     * Generates a brief summary string for this post to display in the bot's startup message.
     * @param {number} index The numerical position of this post in the queue.
     * @param {number} now The current timestamp to check if the post missed its schedule.
     * @returns {string} The formatted startup queue item string.
     */
    getStartupQueueMessage(index, now) {
        const dateStr = this.postAt
            ? new Date(this.postAt).toLocaleString()
            : 'Draft';
        const isMissed = this.postAt && this.postAt <= now;
        return `\n    └ ${index}. ${isMissed ? '⚠️ ' : ''}<code>${this.id}</code> @ ${dateStr}`;
    }
}
