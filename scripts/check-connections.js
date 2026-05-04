import dotenv from 'dotenv';
import { BskyAgent } from '@atproto/api';
import tumblr from 'tumblr.js';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

// ANSI Color Codes
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

async function checkTelegram() {
    console.log(`${c.cyan}Checking Telegram connection...${c.reset}`);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: TELEGRAM_BOT_TOKEN is not set.${c.reset}`,
        );
        return false;
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${token}/getMe`,
        );
        const data = await response.json();
        if (data.ok) {
            console.log(
                `${c.green}✅ SUCCESS: Connected to Telegram as ${c.reset}@${data.result.username}`,
            );
            return true;
        } else {
            console.error(
                `${c.red}❌ FAILED: Telegram API error - ${c.reset}${data.description}`,
            );
            return false;
        }
    } catch (err) {
        console.error(
            `${c.red}❌ FAILED: Could not connect to Telegram API. Error: ${c.reset}${err.message}`,
        );
        return false;
    }
}

async function checkAllowedUsers() {
    console.log(`\n${c.cyan}Checking Allowed Users...${c.reset}`);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const allowedUsers = process.env.ALLOWED_USER_IDS;

    if (!token || !allowedUsers) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: ALLOWED_USER_IDS is not set.${c.reset}`,
        );
        return false;
    }

    const userIds = allowedUsers
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

    if (userIds.length === 0) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: ALLOWED_USER_IDS is empty.${c.reset}`,
        );
        return false;
    }

    let allValid = true;
    for (const id of userIds) {
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${token}/getChat?chat_id=${id}`,
            );
            const data = await response.json();
            if (data.ok) {
                const name = data.result.username
                    ? `@${data.result.username}`
                    : data.result.first_name || id;
                console.log(
                    `${c.green}✅ SUCCESS: Verified user ${c.reset}${name} (${id})`,
                );
            } else {
                console.error(
                    `${c.red}❌ FAILED: Could not verify user ${id} - ${c.reset}${data.description}`,
                );
                allValid = false;
            }
        } catch (err) {
            console.error(
                `${c.red}❌ FAILED: Network error verifying user ${id} - ${c.reset}${err.message}`,
            );
            allValid = false;
        }
    }
    return allValid;
}

async function checkTelegramChannel() {
    console.log(`\n${c.cyan}Checking Telegram Channel connection...${c.reset}`);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    let channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!token || !channelId) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: TELEGRAM_CHANNEL_ID is not set.${c.reset}`,
        );
        return false;
    }

    channelId = channelId.trim();

    // Clean up common formatting mistakes (e.g. t.me links or missing @ for usernames)
    if (channelId.includes('t.me/')) {
        const parts = channelId.split('t.me/');
        channelId = '@' + parts[1].split('/')[0].split('?')[0];
    } else if (
        !channelId.startsWith('@') &&
        !channelId.startsWith('-') &&
        isNaN(Number(channelId))
    ) {
        channelId = '@' + channelId;
    }

    try {
        // First, get the basic chat info to verify the ID is correct
        const chatResponse = await fetch(
            `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(channelId)}`,
        );
        const chatData = await chatResponse.json();

        if (!chatData.ok) {
            console.error(
                `${c.red}❌ FAILED: Telegram Channel API error - ${c.reset}${chatData.description}`,
            );
            return false;
        }

        const channelName =
            chatData.result.title ||
            (chatData.result.username
                ? `@${chatData.result.username}`
                : channelId);

        // Next, verify the bot is actually an admin in the channel so it can post
        const botId = token.split(':')[0];
        const memberResponse = await fetch(
            `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${botId}`,
        );
        const memberData = await memberResponse.json();

        if (memberData.ok) {
            const status = memberData.result.status;
            if (status === 'administrator' || status === 'creator') {
                if (
                    status === 'administrator' &&
                    memberData.result.can_post_messages === false
                ) {
                    console.error(
                        `${c.red}❌ FAILED: Bot is an admin in ${channelName} but does NOT have permission to post messages.${c.reset}`,
                    );
                    return false;
                }
                console.log(
                    `${c.green}✅ SUCCESS: Bot has admin access to post in Telegram Channel: ${c.reset}${channelName}`,
                );
                return true;
            } else {
                console.error(
                    `${c.red}❌ FAILED: Bot is not an administrator in ${channelName}. Current status is '${c.reset}${status}${c.red}'. Please add the bot as an admin.${c.reset}`,
                );
                return false;
            }
        } else {
            console.error(
                `${c.red}❌ FAILED: Could not verify bot permissions in ${channelName}. Error - ${c.reset}${memberData.description}`,
            );
            return false;
        }
    } catch (err) {
        console.error(
            `${c.red}❌ FAILED: Could not connect to Telegram Channel. Error: ${c.reset}${err.message}`,
        );
        return false;
    }
}

async function checkBluesky() {
    console.log(`\n${c.cyan}Checking Bluesky connection...${c.reset}`);
    const identifier = process.env.BLUESKY_IDENTIFIER;
    const password = process.env.BLUESKY_PASSWORD;

    if (!identifier || !password) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: Bluesky credentials are not set.${c.reset}`,
        );
        return;
    }

    try {
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        await agent.login({ identifier, password });
        console.log(
            `${c.green}✅ SUCCESS: Logged into Bluesky as ${c.reset}${identifier}`,
        );
    } catch (err) {
        console.error(
            `${c.red}❌ FAILED: Bluesky login failed. Error: ${c.reset}${err.message}`,
        );
    }
}

async function checkTumblr() {
    console.log(`\n${c.cyan}Checking Tumblr connection...${c.reset}`);
    const {
        TUMBLR_CONSUMER_KEY,
        TUMBLR_CONSUMER_SECRET,
        TUMBLR_TOKEN,
        TUMBLR_TOKEN_SECRET,
        TUMBLR_BLOG_NAME,
    } = process.env;

    if (
        !TUMBLR_CONSUMER_KEY ||
        !TUMBLR_CONSUMER_SECRET ||
        !TUMBLR_TOKEN ||
        !TUMBLR_TOKEN_SECRET ||
        !TUMBLR_BLOG_NAME
    ) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: Tumblr credentials are not fully set.${c.reset}`,
        );
        return;
    }

    try {
        const client = tumblr.createClient({
            consumer_key: TUMBLR_CONSUMER_KEY,
            consumer_secret: TUMBLR_CONSUMER_SECRET,
            token: TUMBLR_TOKEN,
            token_secret: TUMBLR_TOKEN_SECRET,
        });
        const info = await client.blogInfo(TUMBLR_BLOG_NAME);
        console.log(
            `${c.green}✅ SUCCESS: Connected to Tumblr blog: ${c.reset}${info.blog.title}`,
        );
    } catch (err) {
        console.error(
            `${c.red}❌ FAILED: Tumblr connection failed. Error: ${c.reset}${err.message}`,
        );
    }
}

async function checkDiscord() {
    console.log(`\n${c.cyan}Checking Discord connection(s)...${c.reset}`);
    const webhooksStr = process.env.DISCORD_WEBHOOKS;

    if (!webhooksStr) {
        console.log(
            `${c.yellow}⚪️ SKIPPED: DISCORD_WEBHOOKS is not set.${c.reset}`,
        );
        return;
    }

    const webhooks = webhooksStr
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);

    for (const hook of webhooks) {
        const parts = hook.split('|');
        if (parts.length < 2) {
            console.error(
                `${c.red}❌ FAILED: Invalid Discord Webhook format '${hook}'. Expected 'Label|URL'.${c.reset}`,
            );
            continue;
        }

        const label = parts[0].trim();
        const url = parts.slice(1).join('|').trim();

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (response.ok && data.id && data.token) {
                console.log(
                    `${c.green}✅ SUCCESS: Connected to Discord Webhook '${label}' (Channel: ${c.reset}${data.channel_id || 'Unknown'}${c.green})${c.reset}`,
                );
            } else {
                console.error(
                    `${c.red}❌ FAILED: Discord Webhook '${label}' error - ${c.reset}${data.message || 'Unknown error'}`,
                );
            }
        } catch (err) {
            console.error(
                `${c.red}❌ FAILED: Could not connect to Discord Webhook '${label}'. Error: ${c.reset}${err.message}`,
            );
        }
    }
}

async function main() {
    console.log(
        `${c.bold}${c.cyan}🤖 BarkBot Connection Status Check${c.reset}`,
    );
    console.log(`${c.cyan}------------------------------------${c.reset}`);
    await checkTelegram();
    await checkAllowedUsers();
    await checkTelegramChannel();
    await checkBluesky();
    await checkTumblr();
    await checkDiscord();
    console.log(`${c.cyan}------------------------------------${c.reset}`);
    console.log(`${c.bold}${c.green}Check complete.${c.reset}`);
}

main().catch(console.error);
