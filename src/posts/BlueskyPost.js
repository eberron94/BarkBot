import { BskyAgent, RichText } from '@atproto/api';
import { SocialLink } from '../struct/SocialLink.js';

export class BlueskyPost {
    constructor(credentials) {
        this.agent = new BskyAgent({ service: 'https://bsky.social' });
        this.credentials = credentials;
    }

    async post(postData) {
        const { messageText, downloadedMedia, tags } = postData;

        await this.agent.login(this.credentials);

        let embed;
        if (downloadedMedia.length > 0) {
            const bskyVideos = downloadedMedia.filter(
                (m) => m.mediaType === 'video',
            );
            const bskyPhotos = downloadedMedia.filter(
                (m) => m.mediaType === 'photo',
            );

            if (bskyVideos.length > 0) {
                const uploadRes = await this.agent.uploadBlob(
                    Buffer.from(bskyVideos[0].buffer),
                    {
                        encoding: bskyVideos[0].mimeType,
                    },
                );

                embed = {
                    $type: 'app.bsky.embed.video',
                    video: uploadRes.data.blob,
                    alt:
                        bskyVideos[0].altText ||
                        messageText ||
                        'Cross-posted video',
                };
            } else if (bskyPhotos.length > 0) {
                const images = [];
                // Bluesky allows a maximum of 4 images per post
                for (const photo of bskyPhotos.slice(0, 4)) {
                    const uploadRes = await this.agent.uploadBlob(
                        Buffer.from(photo.buffer),
                        { encoding: photo.mimeType },
                    );
                    images.push({
                        image: uploadRes.data.blob,
                        alt:
                            photo.altText ||
                            messageText ||
                            'Cross-posted image',
                    });
                }
                embed = {
                    $type: 'app.bsky.embed.images',
                    images: images,
                };
            }
        }

        let bskyText = messageText;
        if (tags.length > 0) {
            bskyText +=
                (bskyText ? '\n\n' : '') + tags.map((t) => `#${t}`).join(' ');
        }

        const rt = new RichText({ text: bskyText });
        await rt.detectFacets(this.agent);

        const bskyRes = await this.agent.post({
            text: rt.text,
            facets: rt.facets,
            embed: embed,
        });
        const rkey = bskyRes.uri.split('/').pop();
        const link = `https://bsky.app/profile/${this.credentials.identifier}/post/${rkey}`;

        console.log(`[BLUESKY] Successfully created post. URL: ${link}`);

        return new SocialLink('Bluesky', link);
    }
}
