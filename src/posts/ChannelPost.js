import { SocialLink } from '../struct/SocialLink.js';

export class ChannelPost {
    constructor(telegram, channelId) {
        this.telegram = telegram;
        this.channelId =
            channelId.startsWith('@') || channelId.startsWith('-')
                ? channelId
                : `@${channelId}`;
    }

    async post(postData, crossPostLinks, showLinks = true) {
        const { messageText, media } = postData;

        let tgText = messageText
            ? messageText
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
            : '';

        if (showLinks && crossPostLinks.length > 0) {
            const linkText = crossPostLinks
                .map((link) => `• ${link.link}`)
                .join('\n');
            tgText +=
                (tgText ? '\n\n' : '') + `🔗 Cross-posted to:\n` + linkText;
        }

        let tgMessage;
        if (media.length > 1) {
            const mediaGroup = media.map((m, i) => ({
                type: m.mediaType,
                media: m.mediaId,
                caption: i === 0 ? tgText : undefined,
                parse_mode: i === 0 ? 'HTML' : undefined,
            }));
            const responses = await this.telegram.sendMediaGroup(
                this.channelId,
                mediaGroup,
            );
            tgMessage = responses[0];
        } else if (media.length === 1) {
            if (media[0].mediaType === 'video') {
                tgMessage = await this.telegram.sendVideo(
                    this.channelId,
                    media[0].mediaId,
                    {
                        caption: tgText,
                        parse_mode: 'HTML',
                    },
                );
            } else {
                tgMessage = await this.telegram.sendPhoto(
                    this.channelId,
                    media[0].mediaId,
                    {
                        caption: tgText,
                        parse_mode: 'HTML',
                    },
                );
            }
        } else {
            tgMessage = await this.telegram.sendMessage(
                this.channelId,
                tgText,
                {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                },
            );
        }

        let tgLink;
        if (!this.channelId.startsWith('-')) {
            tgLink = `https://t.me/${this.channelId.replace('@', '')}/${
                tgMessage.message_id
            }`;
        }

        console.log(`[TELEGRAM] Successfully created post. URL: ${tgLink}`);
        return new SocialLink('Telegram', tgLink);
    }
}
