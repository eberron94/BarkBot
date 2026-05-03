import tumblr from 'tumblr.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SocialLink } from '../struct/SocialLink.js';

export class TumblrPost {
    constructor(credentials) {
        this.client = tumblr.createClient(credentials);
        this.blogName = process.env.TUMBLR_BLOG_NAME;
    }

    async post(postData) {
        const { messageText, downloadedMedia, tags } = postData;
        const tempFiles = [];

        try {
            const content = [];
            for (const item of downloadedMedia) {
                let ext = '.bin'; // Default to binary if mimeType is unknown
                if (item.mimeType === 'image/jpeg') ext = '.jpg';
                else if (item.mimeType === 'image/png') ext = '.png';
                else if (item.mimeType === 'image/gif') ext = '.gif';
                else if (item.mimeType === 'video/mp4') ext = '.mp4';
                else if (item.mimeType === 'video/quicktime') ext = '.mov';

                const tempFilePath = path.join(
                    os.tmpdir(),
                    `tumblr_upload_${item.mediaId}${ext}`, // Use determined extension
                );
                await fs.promises.writeFile(
                    tempFilePath,
                    Buffer.from(item.buffer),
                );
                tempFiles.push(tempFilePath);

                const mediaBlock = {
                    type: item.mimeType.startsWith('video/')
                        ? 'video'
                        : 'image', // Determine type based on mimeType
                    media: fs.createReadStream(tempFilePath),
                };
                if (item.altText) {
                    mediaBlock.alt_text = item.altText;
                }
                content.push(mediaBlock);
            }

            if (messageText) {
                content.push({
                    type: 'text',
                    text: messageText,
                });
            }

            const tumblrOptions = { content: content };
            if (tags.length > 0) {
                tumblrOptions.tags = tags.map((tag) => tag.replace(/_/g, ' '));
            }

            const hasVideo = downloadedMedia.some(
                (item) => item.mediaType === 'video',
            );

            const tumblrRes = await this.client.createPost(
                this.blogName,
                tumblrOptions,
            );

            let tumblrLink;
            if (hasVideo) {
                const blogIdentifier = this.blogName.replace('.tumblr.com', '');
                tumblrLink = `https://www.tumblr.com/${blogIdentifier}`;
                console.log(
                    '[TUMBLR] Video post created. Linking to main blog due to processing delay.',
                );
            } else {
                const postDetails = {
                    ...(tumblrRes.response || {}),
                    ...tumblrRes,
                };
                const postId = postDetails.id_string || postDetails.id;

                if (postDetails.post_url) {
                    tumblrLink = postDetails.post_url;
                } else if (postId) {
                    const blogIdentifier = this.blogName.replace(
                        '.tumblr.com',
                        '',
                    );
                    tumblrLink = `https://www.tumblr.com/${blogIdentifier}/${postId}`;
                }

                if (tumblrLink) {
                    console.log(
                        `[TUMBLR] Successfully created post. URL: ${tumblrLink}`,
                    );
                } else {
                    throw new Error(
                        'Could not determine Tumblr post URL from API response.',
                    );
                }
            }
            return new SocialLink('Tumblr', tumblrLink);
        } finally {
            for (const file of tempFiles) {
                await fs.promises.unlink(file).catch(() => {});
            }
        }
    }
}
