export const escapeHtml = (str) =>
    str
        ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        : '';

export const isAuthorized = (ctx) => {
    const allowedUserIds = (process.env.ALLOWED_USER_IDS || process.env.ALLOWED_USER_ID || '')
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    return ctx.from?.id && allowedUserIds.includes(ctx.from.id);
};

export const parseScheduleTime = (input) => {
    const trimmed = (input || '').trim();
    let postAt = null;

    // Try parsing as minutes or as a timestamp
    if (/^\d+$/.test(trimmed)) {
        postAt = Date.now() + parseInt(trimmed, 10) * 60000;
    } else {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed) && parsed > Date.now()) {
            postAt = parsed;
        }
    }

    return !postAt || postAt <= Date.now() ? null : postAt;
};

export const getConfiguredPlatforms = () => {
    return {
        bsky: !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD),
        tumblr: !!(
            process.env.TUMBLR_CONSUMER_KEY &&
            process.env.TUMBLR_CONSUMER_SECRET &&
            process.env.TUMBLR_TOKEN &&
            process.env.TUMBLR_TOKEN_SECRET &&
            process.env.TUMBLR_BLOG_NAME
        ),
        tg: !!process.env.TELEGRAM_CHANNEL_ID,
        zip: true,
    };
};

export const withRetry = async (fn, maxRetries = 3, delayMs = 5000) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            if (attempt >= maxRetries) {
                throw error;
            }
            console.warn(`[RETRY] Attempt ${attempt} failed. Retrying in ${delayMs}ms... Error: ${error.message}`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

/**
 * Reads the package.json file to get the current bot version.
 * @returns {string} The version string.
 */
export const  getVersion = () => {
    try {
        // We use '../../' because util.js is nested one directory deeper than bot.js
        const packageJson = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));
        return packageJson.version;
    } catch (e) {
        console.error('[ERROR] Failed to read version from package.json:', e);
        return 'unknown';
    }
}
