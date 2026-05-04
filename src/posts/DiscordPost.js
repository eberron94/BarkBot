import { WebhookClient, AttachmentBuilder } from 'discord.js';
import { SocialLink } from '../struct/SocialLink.js';

export class DiscordPost {
    constructor(webhooksStr) {
        this.webhookClients = new Map();

        if (webhooksStr) {
            const webhooks = webhooksStr
                .split(',')
                .map((w) => w.trim())
                .filter(Boolean);
            for (const hook of webhooks) {
                const parts = hook.split(':');
                if (parts.length >= 2) {
                    const label = parts[0].trim();
                    const url = parts.slice(1).join(':').trim();
                    this.webhookClients.set(label, new WebhookClient({ url }));
                }
            }
        }
    }

    async post(postData, label, crossPostLinks, showLinks = true) {
        if (this.webhookClients.size === 0)
            throw new Error('No Discord Webhooks are configured.');

        const client = this.webhookClients.get(label);
        if (!client) {
            throw new Error(
                `Discord Webhook for '${label}' is not configured.`,
            );
        }

        const { messageText, downloadedMedia, tags = [] } = postData;

        console.log(`[DISCORD] Preparing to post to '${label}'...`);

        let discordText = messageText || '';

        if (tags.length > 0) {
            discordText +=
                (discordText ? '\n\n' : '') +
                tags.map((t) => `#${t}`).join(' ');
        }

        if (showLinks && crossPostLinks && crossPostLinks.length > 0) {
            const linkText = crossPostLinks
                .map((link) => `• ${link.link}`)
                .join('\n');
            discordText +=
                (discordText ? '\n\n' : '') +
                `🔗 Cross-posted to:\n` +
                linkText;
        }

        const files = downloadedMedia.map((media, i) => {
            let ext = '.bin';
            if (media.mimeType === 'image/jpeg') ext = '.jpg';
            else if (media.mimeType === 'image/png') ext = '.png';
            else if (media.mimeType === 'image/gif') ext = '.gif';
            else if (media.mimeType === 'video/mp4') ext = '.mp4';
            else if (media.mimeType === 'video/quicktime') ext = '.mov';

            const attachment = new AttachmentBuilder(
                Buffer.from(media.buffer),
                {
                    name: `media_${i + 1}${ext}`,
                },
            );

            if (media.altText) {
                attachment.setDescription(media.altText);
            }

            return attachment;
        });

        const sendOptions = {
            content: discordText.length > 0 ? discordText : undefined,
            files: files,
        };

        if (process.env.DISCORD_USERNAME) {
            sendOptions.username = process.env.DISCORD_USERNAME;
        }
        if (process.env.DISCORD_AVATAR_URL) {
            sendOptions.avatarURL = process.env.DISCORD_AVATAR_URL;
        }

        await client.send(sendOptions);

        console.log(`[DISCORD] Successfully created post to '${label}'.`);

        // Discord Webhooks do not return a direct URL to the message unless we know the Server's Guild ID,
        // so we will return a generic success message instead.
        return new SocialLink('Discord', 'Message sent to channel');
    }
}
