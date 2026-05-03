import AdmZip from 'adm-zip';

export class ZipPost {
    constructor(telegram) {
        this.telegram = telegram;
    }

    async post(postData, userId) {
        const { messageText, downloadedMedia, tags } = postData;
        const zip = new AdmZip();

        if (messageText) {
            zip.addFile('post.txt', Buffer.from(messageText, 'utf8'));
        }

        if (tags && tags.length > 0) {
            const tagsText = tags.map((t) => `#${t}`).join(' ');
            zip.addFile('tags.txt', Buffer.from(tagsText, 'utf8'));
        }

        let altTextContent = '';

        for (let i = 0; i < downloadedMedia.length; i++) {
            const item = downloadedMedia[i];
            let ext = '.bin';
            if (item.mimeType === 'image/jpeg') ext = '.jpg';
            else if (item.mimeType === 'image/png') ext = '.png';
            else if (item.mimeType === 'image/gif') ext = '.gif';
            else if (item.mimeType === 'video/mp4') ext = '.mp4';
            else if (item.mimeType === 'video/quicktime') ext = '.mov';

            zip.addFile(`media_${i + 1}${ext}`, Buffer.from(item.buffer));

            if (item.altText) {
                altTextContent += `Media ${i + 1}:\n${item.altText}\n\n`;
            }
        }

        if (altTextContent.trim()) {
            zip.addFile(
                'alt_text.txt',
                Buffer.from(altTextContent.trim(), 'utf8'),
            );
        }

        const zipBuffer = zip.toBuffer();

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const filename = `${yyyy}-${mm}-${dd}-${hh}-${min}_post.zip`;

        await this.telegram.sendDocument(
            userId,
            {
                source: zipBuffer,
                filename: filename,
            },
            {
                caption: '📦 Here is your post archive!',
            },
        );

        return { link: 'Archive sent to chat' };
    }
}
