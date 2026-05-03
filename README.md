# 🤖 BarkBot (Cross-Posting Telegram Bot)

A powerful Telegram bot designed to help you easily draft, schedule, and cross-post your content to multiple social media platforms simultaneously right from your Telegram app.

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
git clone https://github.com/yourusername/postbot.git
cd postbot
npm install
```

### 3. Configuration

Copy the provided `.env.example` file and rename it to `.env`:

```bash
cp .env.example .env
```

Open the `.env` file in your favorite text editor, fill in the general settings, remove the `#` in front of each variable you fill in with platform-specific credentials, and save. The bot will automatically adapt its interface based on which platforms you provide keys for.

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

---

## 💻 Running the Bot

Once your `.env` file is configured, start the bot:

```bash
npm start
```

_(For production environments, it is recommended to run the bot using a process manager like PM2 or within a Docker container.)_

Once running, open Telegram and send `/start` to your bot!

### Running with Docker (Recommended)
If you prefer to run the bot in a container, you can use Docker Compose. Ensure your .env file is filled out, then simply run: 

```bash +docker-compose up -d```

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

---

## 📂 File Structure & State

The bot automatically manages its own internal state, including your tag presets, configuration preferences, and the post queue.

All persistent state is saved locally in the `data/` directory:

- `data/presets.json`
- `data/memory.json`
- `data/queue.json`

If you ever need to migrate your bot to a new server, simply copy the `.env` file and the `data/` folder to retain all your configurations and drafts.

---

## 🛡️ Privacy & Security

This bot is designed to be a personal tool. It will aggressively reject messages and commands from any Telegram User ID not explicitly listed in the `ALLOWED_USER_IDS` environment variable, preventing unauthorized users from accessing your social media accounts.

