import 'dotenv/config';
import tumblr from 'tumblr.js';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

let outDir = path.join(process.cwd(), 'output');
let unpack = false;
const targetTags = [];

for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--help' || arg === '-h') {
        console.log(`
BarkBot Tumblr-to-Zip Utility
-----------------------------
Scans your connected Tumblr blog for original posts containing ALL specified tags,
downloads the media, and generates perfectly formatted .zip archives.

Usage: npm run zip:tumblr -- [options]

Options:
  --tags, --tag <tags...>  (Required) The tag(s) to filter posts by. 
                           Example: --tags art drawing
  --outDir <path>          The destination folder for the downloads.
                           (Default: output/)
  --unpack                 Automatically extract the generated .zip files 
                           into folders of the same name.
  --help, -h               Show this help message.

Important: When running via 'npm run', you must include an extra '--' before
your arguments so that npm passes them to the script.
Example: npm run zip:tumblr -- --tags original_character --unpack
`);
        process.exit(0);
    } else if (arg === '--outDir' && i + 1 < process.argv.length) {
        outDir = path.resolve(process.cwd(), process.argv[i + 1]);
        i++;
    } else if (arg === '--unpack') {
        unpack = true;
    } else if (arg === '--tags' || arg === '--tag') {
        while (
            i + 1 < process.argv.length &&
            !process.argv[i + 1].startsWith('--')
        ) {
            i++;
            targetTags.push(process.argv[i].toLowerCase());
        }
    }
}

if (targetTags.length === 0) {
    console.error(
        '⚠️ Please provide at least one tag to scan for.\nExample: npm run zip:tumblr -- --tags art drawing\n(Note the extra "--" is required when using npm run!)',
    );
    process.exit(1);
}

const {
    TUMBLR_CONSUMER_KEY,
    TUMBLR_CONSUMER_SECRET,
    TUMBLR_TOKEN,
    TUMBLR_TOKEN_SECRET,
    TUMBLR_BLOG_NAME,
} = process.env;

if (!TUMBLR_CONSUMER_KEY || !TUMBLR_BLOG_NAME) {
    console.error(
        '⚠️ Tumblr credentials or blog name are missing in your .env file.',
    );
    process.exit(1);
}

const client = tumblr.createClient({
    consumer_key: TUMBLR_CONSUMER_KEY,
    consumer_secret: TUMBLR_CONSUMER_SECRET,
    token: TUMBLR_TOKEN,
    token_secret: TUMBLR_TOKEN_SECRET,
});

async function run() {
    console.log(
        `🔍 Scanning ${TUMBLR_BLOG_NAME} for posts containing all tags: ${targetTags.map((t) => '#' + t).join(' ')}`,
    );

    try {
        let offset = 0;
        const limit = 20;
        const allPosts = [];
        let hasMore = true;
        let fetchedCount = 0;

        while (hasMore) {
            // Fetch posts utilizing the Neue Post Format (NPF) for easier parsing
            const response = await client.blogPosts(TUMBLR_BLOG_NAME, {
                tag: targetTags[0], // Tumblr API only supports filtering by a single tag natively
                npf: true,
                reblog_info: true,
                limit: limit,
                offset: offset,
            });
            const posts = response.posts;

            if (!posts || posts.length === 0) {
                hasMore = false;
            } else {
                fetchedCount += posts.length;

                // Filter posts locally to ensure they contain ALL requested tags and are original posts
                const filtered = posts.filter((post) => {
                    if (post.reblogged_from_id || post.reblogged_from_name)
                        return false;

                    const postTagsLower = (post.tags || []).map((t) =>
                        t.toLowerCase(),
                    );
                    return targetTags.every((tag) =>
                        postTagsLower.includes(tag),
                    );
                });

                allPosts.push(...filtered);
                offset += posts.length;

                if (posts.length === limit) {
                    console.log(
                        `   ⏳ Fetched ${fetchedCount} posts so far (found ${allPosts.length} matches)... continuing scan...`,
                    );

                    // Add a 1-second delay between page requests to avoid rate limits
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                } else {
                    hasMore = false;
                }
            }
        }

        if (allPosts.length === 0) {
            console.log('📭 No posts found matching all those tags.');
            return;
        }

        console.log(
            `📦 Found ${allPosts.length} post(s) total matching your tags.`,
        );

        const rl = readline.createInterface({ input, output });
        const answer = await rl.question(
            '\n❓ Do you want to generate archives for these posts? (y/N): ',
        );
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('🛑 Aborted by user.');
            return;
        }

        console.log(`\nGenerating archives in ${outDir}...`);

        // Ensure output directory exists
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        for (const post of allPosts) {
            const zip = new AdmZip();

            // 1. Format the Date (yyyy-mm-dd-hh-mm)
            const d = new Date(post.timestamp * 1000);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}-${hh}-${min}`;

            // 2. Format the Tags (--tag_tag_tag)
            // Sanitizing to ensure no illegal filename characters are used
            const tagsStr =
                post.tags && post.tags.length > 0
                    ? '--' +
                      post.tags
                          .map((t) => t.replace(/[^a-zA-Z0-9]/g, '_'))
                          .join('_')
                    : '';

            const fileName = `${dateStr}${tagsStr}.zip`;
            const filePath = path.join(outDir, fileName);

            if (fs.existsSync(filePath)) {
                console.log(
                    `   ⏭️ Skipped ${fileName} (already exists) - ${post.post_url}`,
                );
                continue;
            }

            // 3. Extract text and media from NPF blocks
            let textContent = '';
            const mediaItems = [];

            if (post.content) {
                for (const block of post.content) {
                    if (block.type === 'text') {
                        textContent += block.text + '\n';
                    } else if (block.type === 'image') {
                        // Get the highest resolution image available
                        const originalSize = block.media.reduce(
                            (prev, current) =>
                                prev.width > current.width ? prev : current,
                        );
                        mediaItems.push({
                            url: originalSize.url,
                            altText: block.alt_text,
                        });
                    } else if (
                        block.type === 'video' &&
                        block.media &&
                        block.media.url
                    ) {
                        mediaItems.push({
                            url: block.media.url,
                            altText: null,
                        });
                    }
                }
            } else if (post.summary) {
                textContent = post.summary;
            }

            const finalPostText = textContent.trim();

            // 4. Add the formatted post text and tags to the zip
            zip.addFile('post.txt', Buffer.from(finalPostText, 'utf8'));

            if (post.tags && post.tags.length > 0) {
                zip.addFile(
                    'tags.txt',
                    Buffer.from(post.tags.join(', '), 'utf8'),
                );
            }

            if (post.title && typeof post.title === 'string' && post.title.trim().length > 0) {
                zip.addFile('title.txt', Buffer.from(post.title.trim(), 'utf8'));
            }

            // 5. Download media files and add them to the zip
            for (let i = 0; i < mediaItems.length; i++) {
                const { url, altText } = mediaItems[i];
                const mediaRes = await fetch(url);
                const arrayBuffer = await mediaRes.arrayBuffer();
                // Grab the extension from the URL (stripping query parameters)
                const ext = url.split('.').pop().split('?')[0] || 'jpg';
                zip.addFile(`media_${i + 1}.${ext}`, Buffer.from(arrayBuffer));

                // Save alt text if it exists and isn't just a repeat of the main post text
                if (altText && altText.trim() !== finalPostText) {
                    zip.addFile(
                        `media_${i + 1}_alt.txt`,
                        Buffer.from(altText.trim(), 'utf8'),
                    );
                }
            }

            // 6. Save the Zip File to the disk
            zip.writeZip(filePath);
            console.log(`   ✅ Created ${fileName} - ${post.post_url}`);

            // 7. Unpack if requested
            if (unpack) {
                const folderName = fileName.replace('.zip', '');
                const folderPath = path.join(outDir, folderName);
                zip.extractAllTo(folderPath, true);
                console.log(`      📂 Unpacked to /${folderName}/`);
            }
        }

        console.log(
            `\n🎉 Success! Extracted archives are located in the ${outDir} directory.`,
        );
    } catch (error) {
        console.error('❌ Error during script execution:', error);
    }
}

run();
