# 🤖 BarkBot (Cross-Posting Telegram Bot)

A Telegram bot designed to help you easily draft, schedule, and cross-post your content to multiple social media platforms simultaneously right from your Telegram app.

Currently supports cross-posting to **Telegram Channels**, **Bluesky**, and **Tumblr**, as well as generating downloadable **`.zip` archives** containing your media and text for manual posting to platforms without accessible APIs (like TikTok or Instagram Reels).

---

## ✨ Features

- **Multi-Platform Posting:** Write once, post to Telegram, Bluesky, and Tumblr simultaneously.
- **Media Support:** Seamlessly handles photos, videos, and multi-image albums.
- **Accessibility First:** Easily add custom `alt text` to your images before sending.
- **Tag Presets:** Save groups of hashtags and apply them with a single click.
- **Scheduling & Drafts:** Queue up multiple posts to be sent at specific dates/times, or save them as unscheduled drafts to work on later.

---

## 🚀 Installation & Setup

### 1. Prerequisites

- Node.js (v18 or higher recommended)
- A Telegram account
- API credentials for the platforms you wish to post to (see below).

### 2. Clone and Install

Clone the repository and install the dependencies:

```bash
git clone https://github.com/yourusername/barkbot.git
cd barkbot
npm install
```

### 3. Configuration

Run the setup wizard to easily configure your bot's `.env` file:

```bash
npm run setup
```

> 💡 Tip: To paste long keys into this console, try Right-Clicking, or use Shift+Insert / Ctrl+Shift+V (Cmd+V on Mac).

Alternatively, you can manually copy the provided `.env.example` to `.env` and fill it out. The bot will automatically adapt its interface based on which platforms you provide keys for.

#### General Settings

- `BOT_NAME`: A display name for your bot (e.g., "My Cross-Posting Bot").
- `TELEGRAM_BOT_TOKEN`: The token provided by @BotFather when you create your bot.
- `ALLOWED_USER_IDS`: A comma-separated list of your Telegram User IDs (e.g., `123456789,987654321`). You can find your ID using a bot like @userinfobot.

#### Telegram Channel (Optional)

- `TELEGRAM_CHANNEL_ID`: The `@username` of the channel you want to post to. **Note:** Your bot must be added as an Admin to this channel to post!

#### Bluesky (Optional)

- `BLUESKY_IDENTIFIER`: Your full Bluesky handle (e.g., `username.bsky.social`).
- `BLUESKY_PASSWORD`: An **App Password**. Do not use your main account password! Generate one in your Bluesky Settings -> Advanced -> App Passwords.

#### Tumblr (Optional)

To post to Tumblr, you need to register an application to get OAuth credentials.

1. Go to the Tumblr API Console and register an app.
2. Obtain your `Consumer Key` and `Consumer Secret`.
3. Use the console to generate an `OAuth Token` and `OAuth Token Secret`.

- `TUMBLR_BLOG_NAME`: Your full blog URL (e.g., `myblog.tumblr.com`).

### 4. Verify Connections

You can test your API keys and connection status to all configured platforms at any time by running the built-in diagnostic script:

```bash
npm run check
```

This will verify your Telegram token, allowed users, channel permissions, and attempt to log into Bluesky and Tumblr, providing clear success or error messages.

---

## 💻 Running the Bot

Once your `.env` file is configured, start the bot:

```bash
npm start
```

_(For production environments, it is recommended to run the bot using a process manager like PM2 or within a Docker container.)_

Once running, open Telegram and send `/start` to your bot!

### Running with PM2 (Recommended)

If you want the bot to run continuously in the background and restart automatically on crashes, PM2 is highly recommended.

1. Install PM2 globally: `npm install -g pm2`
2. Run the PM2 setup wizard to generate your configuration file: `npm run setup:pm2`
3. Start the bot: `pm2 start ecosystem.config.cjs`
4. Save your PM2 process list so it remembers the bot: `pm2 save`

_(Optional: Run `pm2 startup` to configure PM2 to automatically launch when your server boots!)_

### Running with Docker

If you prefer to run the bot in a container, you can use Docker Compose. Ensure your .env file is filled out, then simply run:

`bash +docker-compose up -d`

This will build the image, start the bot in the background, and automatically mount the `data/` directory so your state persists across updates and restarts.

---

## 📖 How to Use

### Drafting a Post

Creating a post is as simple as sending a message to your bot.

1. Send text, a photo, a video, or an album to the bot.
2. The bot will reply with an interactive **Preview Menu**.
3. Use the inline buttons to:
    - **Edit Text:** Rewrite the caption.
    - **Tags:** Append saved tag presets or manual tags to the end of the post.
    - **Alt Text:** Write descriptions for your images.
    - **Schedule / Draft:** Save the post for later.
4. Toggle which destinations you want to send the post to.
5. Click **🚀 Post to Selected**.

### Bot Commands

You can manage your bot's behavior and your queued posts at any time using the following commands:

- `/help` - Show the help message and current platform status.
- `/status` - View bot uptime, RAM/Disk usage, and queue size.
- `/presets` - View your saved tag presets.
- `/addpreset <name> <tags>` - Create a new tag preset (e.g., `/addpreset art sketch illustration`).
- `/delpreset <name>` - Delete a tag preset.
- `/queue` - View all scheduled posts and drafts.
- `/edit <id>` - Pull a post from the queue back into active editing.
- `/unqueue <id>` - Permanently delete a scheduled post or draft.
- `/delay <seconds>` - Set the cancellation countdown timer length before a post executes.
- `/defaultdest <platform>` - Toggle whether a platform is selected by default for new posts.
- `/togglelinks` - Toggle whether Telegram channel posts automatically include links to the Bluesky/Tumblr cross-posts.

### Using Zip Archives

The **Zip** destination is a special feature designed for platforms that either don't have open APIs (like Instagram or TikTok) or aren't natively supported by the bot yet.

When you select **Zip** as a destination and post, the bot will generate and send you a `.zip` document directly in your chat. This archive contains:

- All of your high-quality media files (photos, videos, etc.).
- A `post.txt` file containing your perfectly formatted caption, alt-text descriptions, and tags.

**How to use:**

1. Select the **Zip** option in your post's preview menu.
2. Click **🚀 Post to Selected**.
3. Download the generated `.zip` file sent by the bot and extract the contents to your phone or computer.
4. Copy the text from `post.txt` and upload your media to any app you want!

---

## 📂 File Structure & State

The bot automatically manages its own internal state, including your tag presets, configuration preferences, and the post queue.

All persistent state is saved locally in the `data/` directory:

- `data/presets.json`
- `data/memory.json`
- `data/queue.json`

### Backing Up Your Data

To safely back up your bot's state (including scheduled posts, tag presets, and memory), simply copy the `data/` folder and your `.env` file to a secure location.

- **Standard/PM2:** It is recommended to stop the bot before copying the files to ensure no data is being written mid-backup (e.g., `pm2 stop ecosystem.config.cjs`).
- **Docker:** Back up the mapped `data/` volume directory on your host machine.

If you ever need to migrate your bot to a new server or restore a backup, simply place your saved `.env` file and `data/` folder back into the project root before starting the bot.

---

## 🛡️ Privacy & Security

This bot is designed to be a personal tool. It will aggressively reject messages and commands from any Telegram User ID not explicitly listed in the `ALLOWED_USER_IDS` environment variable, preventing unauthorized users from accessing your social media accounts.
