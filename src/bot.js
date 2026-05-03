import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { Commands } from './handlers/Commands.js';
import { Memory } from './core/Memory.js';
import { BlueskyPost } from './posts/BlueskyPost.js';
import { Actions } from './handlers/Actions.js';
import { Messages } from './handlers/Messages.js';
import { TumblrPost } from './posts/TumblrPost.js';
import { ChannelPost } from './posts/ChannelPost.js';
import { Scheduler } from './core/Scheduler.js';
import { ZipPost } from './posts/ZipPost.js';
import { Publisher } from './core/Publisher.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Instantiate Handlers
const blueskyPost = new BlueskyPost({
    identifier: process.env.BLUESKY_IDENTIFIER,
    password: process.env.BLUESKY_PASSWORD,
});
const tumblrPost = new TumblrPost({
    consumer_key: process.env.TUMBLR_CONSUMER_KEY,
    consumer_secret: process.env.TUMBLR_CONSUMER_SECRET,
    token: process.env.TUMBLR_TOKEN,
    token_secret: process.env.TUMBLR_TOKEN_SECRET,
});

// Store pending posts temporarily in memory. Maps Telegram User IDs to their current draft.
const tgChannelPost = new ChannelPost(
    bot.telegram,
    process.env.TELEGRAM_CHANNEL_ID,
);

const zipPost = new ZipPost(bot.telegram);

// Instantiate managers
const memory = new Memory();

// Instantiate message handler
const messages = new Messages(memory);

// Instantiate the publisher orchestrator
const publisher = new Publisher(
    bot,
    blueskyPost,
    tumblrPost,
    tgChannelPost,
    zipPost,
    memory,
);

// Instantiate action handler
const actions = new Actions(bot, memory, messages, publisher);
actions.registerActions();

// Instantiate and start the scheduler
const scheduler = new Scheduler(memory, publisher);
scheduler.start();

// Register all commands using the BotMaker
const commands = new Commands(bot, memory, messages);
commands.registerCommands();
commands.registerMessageListeners();

// Start the bot
commands.launch();
