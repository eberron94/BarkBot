import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';
import { BskyAgent } from '@atproto/api';
import tumblr from 'tumblr.js';
import { fileURLToPath } from 'node:url';

// ANSI Color Codes
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

async function main() {
    const envPath = fileURLToPath(new URL('../.env', import.meta.url));

    const rl = readline.createInterface({ input, output });

    console.log(`${c.bold}${c.cyan}🤖 BarkBot Setup Wizard${c.reset}`);
    console.log(
        `${c.cyan}This wizard will help you create your .env configuration file.${c.reset}`,
    );
    console.log(
        `${c.cyan}See the README.md file for instructions on how to find API keys and other values.${c.reset}`,
    );
    console.log(
        `${c.cyan}💡 Tip: To paste long keys into this console, try Right-Clicking, or use Shift+Insert / Ctrl+Shift+V (Cmd+V on Mac).${c.reset}`,
    );

    let existingEnv = {};
    if (fs.existsSync(envPath)) {
        console.log(
            `${c.yellow}📦 Existing .env file found. Press Enter to keep current values.\n${c.reset}`,
        );
        existingEnv = dotenv.parse(fs.readFileSync(envPath));
    } else {
        console.log(
            `${c.cyan}Press Enter to skip any optional fields.\n${c.reset}`,
        );
    }

    const env = {};

    async function ask(prompt, defaultVal) {
        let displayVal = defaultVal;
        // Truncate long tokens/passwords for a cleaner display
        if (defaultVal && defaultVal.length > 25) {
            displayVal =
                defaultVal.substring(0, 15) +
                '...' +
                defaultVal.substring(defaultVal.length - 5);
        }
        const defaultText = displayVal
            ? ` ${c.reset}[${displayVal}]${c.cyan}`
            : '';
        const answer = await rl.question(
            `${c.cyan}${prompt}${defaultText}: ${c.reset}`,
        );
        return answer.trim() || defaultVal || '';
    }

    env.BOT_NAME = await ask(
        'Enter a display name for your bot',
        existingEnv.BOT_NAME || 'BarkBot',
    );

    let tokenValid = false;
    while (!tokenValid) {
        env.TELEGRAM_BOT_TOKEN = await ask(
            'Enter your Telegram Bot Token (from @BotFather)',
            existingEnv.TELEGRAM_BOT_TOKEN,
        );

        if (
            !env.TELEGRAM_BOT_TOKEN ||
            !/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN)
        ) {
            console.log(
                `${c.yellow}⚠️ Invalid token format. It should look like "1234567890:ABCdef...".${c.reset}`,
            );
            continue;
        }

        console.log(`${c.cyan}⏳ Verifying Telegram Bot Token...${c.reset}`);
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`,
            );
            const data = await response.json();
            if (data.ok) {
                console.log(
                    `${c.green}✅ Verified! Connected to Telegram as ${c.reset}@${data.result.username}`,
                );
                tokenValid = true;
            } else {
                console.log(
                    `${c.yellow}⚠️ Invalid Token: ${c.reset}${data.description}\n${c.yellow}Please try again.${c.reset}`,
                );
                existingEnv.TELEGRAM_BOT_TOKEN = ''; // Clear default to prevent infinite loop of bad values
            }
        } catch (err) {
            console.log(
                `${c.red}⚠️ Network error verifying token: ${c.reset}${err.message}\n${c.red}Please try again.${c.reset}`,
            );
        }
    }

    console.log(`\n${c.cyan}--- Telegram Allowed Users ---${c.reset}`);
    console.log(
        `${c.cyan}ℹ️  NOTE: User IDs must be numeric (e.g., 123456789), NOT your @username.${c.reset}`,
    );
    env.ALLOWED_USER_IDS = await ask(
        'Enter your Telegram User ID(s) (Required, comma separated). Type "find" to discover it via your bot',
        existingEnv.ALLOWED_USER_IDS,
    );
    while (
        !env.ALLOWED_USER_IDS ||
        (!/^\d+(?:\s*,\s*\d+)*$/.test(env.ALLOWED_USER_IDS) &&
            env.ALLOWED_USER_IDS.toLowerCase() !== 'find')
    ) {
        env.ALLOWED_USER_IDS = await ask(
            `${c.yellow}⚠️ Invalid format. Please enter a comma-separated list of numeric User IDs, or type "find"${c.reset}`,
        );
    }

    if (env.ALLOWED_USER_IDS.toLowerCase() === 'find') {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`\n${c.cyan}🔍 Let's find your User ID!${c.reset}`);
        console.log(
            `${c.cyan}Please open Telegram, start a chat with your bot, and send this exact PIN code: ${c.bold}${pin}${c.reset}`,
        );
        console.log(
            `${c.cyan}Waiting for your message... (Press Ctrl+C to cancel)\n${c.reset}`,
        );

        let foundId = null;
        let lastUpdateId = 0;
        let consecutiveFailures = 0;
        const maxFailures = 5;

        while (!foundId) {
            try {
                const response = await fetch(
                    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId}`,
                );
                const data = await response.json();

                if (!data.ok) {
                    console.error(
                        `\n${c.red}[ERROR] Telegram API error: ${c.reset}${data.description || 'Unknown error'}${c.red}. Please check your bot token.${c.reset}`,
                    );
                    consecutiveFailures++;
                } else if (data.result.length > 0) {
                    consecutiveFailures = 0; // Reset on successful poll
                    for (const update of data.result) {
                        lastUpdateId = update.update_id + 1;
                        if (
                            update.message &&
                            update.message.text &&
                            update.message.text.trim() === pin
                        ) {
                            foundId = update.message.from.id;
                            console.log(
                                `${c.green}✅ Found it! Your User ID is: ${c.reset}${foundId}`,
                            );

                            // Attempt to delete the PIN message to keep the chat clean
                            try {
                                await fetch(
                                    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`,
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            chat_id: update.message.chat.id,
                                            message_id:
                                                update.message.message_id,
                                        }),
                                    },
                                );
                            } catch (err) {
                                // Ignore cleanup errors
                            }

                            break;
                        }
                    }
                }
            } catch (err) {
                console.error(
                    `\n${c.red}[ERROR] Network error while polling: ${c.reset}${err.message}`,
                );
                consecutiveFailures++;
            }

            if (consecutiveFailures >= maxFailures) {
                console.log(
                    `\n${c.yellow}⚠️ Failed to connect to Telegram API after ${maxFailures} attempts.${c.reset}`,
                );
                const choice = await ask(
                    'Would you like to [r]etry or enter the User ID [m]anually?',
                    '',
                );
                if (choice.toLowerCase().startsWith('m')) {
                    foundId = 'manual_entry';
                    break;
                } else {
                    consecutiveFailures = 0;
                    console.log(`${c.cyan}Retrying...${c.reset}`);
                }
            }

            if (!foundId) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }

        if (foundId === 'manual_entry') {
            let manualId = await ask(
                'Please enter your numeric User ID(s) manually',
                existingEnv.ALLOWED_USER_IDS,
            );
            while (!/^\d+(?:\s*,\s*\d+)*$/.test(manualId) || !manualId) {
                manualId = await ask(
                    `${c.yellow}⚠️ Invalid format. Please enter a comma-separated list of numeric User IDs${c.reset}`,
                );
            }
            env.ALLOWED_USER_IDS = manualId;
        } else if (foundId) {
            if (
                existingEnv.ALLOWED_USER_IDS &&
                /^\d+(?:\s*,\s*\d+)*$/.test(existingEnv.ALLOWED_USER_IDS)
            ) {
                const currentIds = existingEnv.ALLOWED_USER_IDS.split(',').map(
                    (id) => id.trim(),
                );
                if (!currentIds.includes(foundId.toString())) {
                    env.ALLOWED_USER_IDS = `${existingEnv.ALLOWED_USER_IDS},${foundId}`;
                } else {
                    env.ALLOWED_USER_IDS = existingEnv.ALLOWED_USER_IDS;
                }
            } else {
                env.ALLOWED_USER_IDS = foundId.toString();
            }
        }
    }

    console.log(`${c.cyan}⏳ Verifying Allowed Users...${c.reset}`);
    const userIds = env.ALLOWED_USER_IDS.split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    for (const id of userIds) {
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChat?chat_id=${id}`,
            );
            const data = await response.json();
            if (data.ok) {
                const name = data.result.username
                    ? `@${data.result.username}`
                    : data.result.first_name || id;
                console.log(
                    `${c.green}✅ Verified User: ${c.reset}${name} (${id})`,
                );
            } else {
                console.log(
                    `${c.yellow}⚠️ Could not verify user ${id}: ${c.reset}${data.description}`,
                );
            }
        } catch (err) {
            console.log(
                `${c.red}⚠️ Network error verifying user ${id}: ${c.reset}${err.message}`,
            );
        }
    }

    console.log(`\n${c.cyan}--- Telegram Channel ---${c.reset}`);
    env.TELEGRAM_CHANNEL_ID = await ask(
        'Enter your Telegram Channel ID / @username (Optional)',
        existingEnv.TELEGRAM_CHANNEL_ID,
    );

    if (env.TELEGRAM_CHANNEL_ID) {
        env.TELEGRAM_CHANNEL_ID = env.TELEGRAM_CHANNEL_ID.trim();

        // Clean up common formatting mistakes
        if (env.TELEGRAM_CHANNEL_ID.includes('t.me/')) {
            const parts = env.TELEGRAM_CHANNEL_ID.split('t.me/');
            env.TELEGRAM_CHANNEL_ID =
                '@' + parts[1].split('/')[0].split('?')[0];
        } else if (
            !env.TELEGRAM_CHANNEL_ID.startsWith('@') &&
            !env.TELEGRAM_CHANNEL_ID.startsWith('-') &&
            isNaN(Number(env.TELEGRAM_CHANNEL_ID))
        ) {
            env.TELEGRAM_CHANNEL_ID = '@' + env.TELEGRAM_CHANNEL_ID;
        }

        console.log(
            `${c.cyan}⏳ Verifying Telegram Channel access...${c.reset}`,
        );
        try {
            const chatResponse = await fetch(
                `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(env.TELEGRAM_CHANNEL_ID)}`,
            );
            const chatData = await chatResponse.json();

            if (!chatData.ok) {
                console.log(
                    `${c.yellow}⚠️ Invalid Channel: ${c.reset}${chatData.description}`,
                );
            } else {
                const channelName =
                    chatData.result.title ||
                    (chatData.result.username
                        ? `@${chatData.result.username}`
                        : env.TELEGRAM_CHANNEL_ID);
                const botId = env.TELEGRAM_BOT_TOKEN.split(':')[0];
                const memberResponse = await fetch(
                    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(env.TELEGRAM_CHANNEL_ID)}&user_id=${botId}`,
                );
                const memberData = await memberResponse.json();

                if (memberData.ok) {
                    const status = memberData.result.status;
                    if (status === 'administrator' || status === 'creator') {
                        if (
                            status === 'administrator' &&
                            memberData.result.can_post_messages === false
                        ) {
                            console.log(
                                `${c.yellow}⚠️ Bot is an admin in ${c.reset}${channelName}${c.yellow} but does NOT have permission to post messages.\nPlease update permissions in Telegram.${c.reset}`,
                            );
                        } else {
                            console.log(
                                `${c.green}✅ Verified! Bot has access to post in: ${c.reset}${channelName}`,
                            );
                        }
                    } else {
                        console.log(
                            `${c.yellow}⚠️ Bot is not an administrator in ${c.reset}${channelName}${c.yellow}. Current status is '${c.reset}${status}${c.yellow}'.\nPlease add the bot as an admin in Telegram.${c.reset}`,
                        );
                    }
                } else {
                    console.log(
                        `${c.yellow}⚠️ Could not verify permissions: ${c.reset}${memberData.description}`,
                    );
                }
            }
        } catch (err) {
            console.log(
                `${c.red}⚠️ Network error verifying channel: ${c.reset}${err.message}`,
            );
        }
    }

    console.log(`\n${c.cyan}--- Bluesky ---${c.reset}`);
    env.BLUESKY_IDENTIFIER = await ask(
        'Enter your Bluesky Handle (Optional, e.g. user.bsky.social)',
        existingEnv.BLUESKY_IDENTIFIER,
    );
    if (env.BLUESKY_IDENTIFIER) {
        env.BLUESKY_PASSWORD = await ask(
            'Enter your Bluesky App Password (see README for how to generate one)',
            existingEnv.BLUESKY_PASSWORD,
        );

        console.log(`${c.cyan}⏳ Verifying Bluesky credentials...${c.reset}`);
        try {
            const agent = new BskyAgent({ service: 'https://bsky.social' });
            await agent.login({
                identifier: env.BLUESKY_IDENTIFIER,
                password: env.BLUESKY_PASSWORD,
            });
            console.log(`${c.green}✅ Bluesky credentials verified!${c.reset}`);
        } catch (err) {
            console.log(
                `${c.yellow}⚠️ Invalid Bluesky credentials: ${c.reset}${err.message}\n${c.yellow}They will be saved, but please double check them.${c.reset}`,
            );
        }
    }

    console.log(`\n${c.cyan}--- Tumblr ---${c.reset}`);
    if (!existingEnv.TUMBLR_BLOG_NAME) {
        console.log(
            `${c.cyan}See the README for instructions on how to get Tumblr API keys.${c.reset}`,
        );
    }
    env.TUMBLR_BLOG_NAME = await ask(
        'Enter your Tumblr Blog Name (Optional, e.g. myblog.tumblr.com)',
        existingEnv.TUMBLR_BLOG_NAME,
    );
    if (env.TUMBLR_BLOG_NAME) {
        env.TUMBLR_CONSUMER_KEY = await ask(
            'Enter your Tumblr Consumer Key',
            existingEnv.TUMBLR_CONSUMER_KEY,
        );
        env.TUMBLR_CONSUMER_SECRET = await ask(
            'Enter your Tumblr Consumer Secret',
            existingEnv.TUMBLR_CONSUMER_SECRET,
        );
        env.TUMBLR_TOKEN = await ask(
            'Enter your Tumblr OAuth Token',
            existingEnv.TUMBLR_TOKEN,
        );
        env.TUMBLR_TOKEN_SECRET = await ask(
            'Enter your Tumblr OAuth Token Secret',
            existingEnv.TUMBLR_TOKEN_SECRET,
        );

        console.log(`${c.cyan}⏳ Verifying Tumblr credentials...${c.reset}`);
        try {
            const client = tumblr.createClient({
                consumer_key: env.TUMBLR_CONSUMER_KEY,
                consumer_secret: env.TUMBLR_CONSUMER_SECRET,
                token: env.TUMBLR_TOKEN,
                token_secret: env.TUMBLR_TOKEN_SECRET,
            });
            await client.blogInfo(env.TUMBLR_BLOG_NAME);
            console.log(`${c.green}✅ Tumblr credentials verified!${c.reset}`);
        } catch (err) {
            console.log(
                `${c.yellow}⚠️ Invalid Tumblr credentials: ${c.reset}${err.message}\n${c.yellow}They will be saved, but please double check them.${c.reset}`,
            );
        }
    }

    rl.close();

    console.log(`\n${c.cyan}Generating .env file...${c.reset}`);

    let envContent = `# General Bot Settings\n`;
    envContent += `BOT_NAME=${env.BOT_NAME || 'BarkBot'}\n`;
    envContent += `TELEGRAM_BOT_TOKEN=${env.TELEGRAM_BOT_TOKEN}\n\n`;

    envContent += `# Comma-separated list of Telegram User IDs allowed to use the bot\n`;
    envContent += `ALLOWED_USER_IDS=${env.ALLOWED_USER_IDS}\n\n`;

    envContent += `# Telegram Channel Settings\n`;
    if (env.TELEGRAM_CHANNEL_ID) {
        envContent += `TELEGRAM_CHANNEL_ID=${env.TELEGRAM_CHANNEL_ID}\n\n`;
    } else {
        envContent += `#TELEGRAM_CHANNEL_ID=\n\n`;
    }

    envContent += `# Bluesky API Credentials\n`;
    if (env.BLUESKY_IDENTIFIER) {
        envContent += `BLUESKY_IDENTIFIER=${env.BLUESKY_IDENTIFIER}\n`;
        envContent += `BLUESKY_PASSWORD=${env.BLUESKY_PASSWORD}\n\n`;
    } else {
        envContent += `#BLUESKY_IDENTIFIER=\n`;
        envContent += `#BLUESKY_PASSWORD=\n\n`;
    }

    envContent += `# Tumblr API Credentials\n`;
    if (env.TUMBLR_BLOG_NAME) {
        envContent += `TUMBLR_BLOG_NAME=${env.TUMBLR_BLOG_NAME}\n`;
        envContent += `TUMBLR_CONSUMER_KEY=${env.TUMBLR_CONSUMER_KEY}\n`;
        envContent += `TUMBLR_CONSUMER_SECRET=${env.TUMBLR_CONSUMER_SECRET}\n`;
        envContent += `TUMBLR_TOKEN=${env.TUMBLR_TOKEN}\n`;
        envContent += `TUMBLR_TOKEN_SECRET=${env.TUMBLR_TOKEN_SECRET}\n`;
    } else {
        envContent += `#TUMBLR_BLOG_NAME=\n`;
        envContent += `#TUMBLR_CONSUMER_KEY=\n`;
        envContent += `#TUMBLR_CONSUMER_SECRET=\n`;
        envContent += `#TUMBLR_TOKEN=\n`;
        envContent += `#TUMBLR_TOKEN_SECRET=\n`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`${c.green}✅ .env file successfully created!${c.reset}`);

    const dataPath = fileURLToPath(new URL('../data', import.meta.url));
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
        console.log(`${c.green}✅ data/ directory successfully created!${c.reset}`);
    }

    console.log(
        `${c.bold}${c.cyan}You can now start the bot using: npm start${c.reset}`,
    );
}

main().catch((err) => {
    // Catch silent aborts like Ctrl+C or Ctrl+D during a prompt
    if (
        err.message &&
        (err.message.includes('interrupted') ||
            err.message.includes('closed') ||
            err.name === 'AbortError')
    ) {
        console.log(
            `\n${c.yellow}Setup aborted. Exiting gracefully...${c.reset}`,
        );
    } else {
        console.error(err);
    }
});
