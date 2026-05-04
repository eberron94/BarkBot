import { Markup } from 'telegraf';
import { getConfiguredPlatforms } from './util.js';

export class UI {
    static defaultDestinations(dests) {
        const platforms = getConfiguredPlatforms();
        const buttons = [];
        
        if (platforms.bsky) buttons.push(Markup.button.callback(`${dests.bsky ? '✅' : '❌'} Bluesky`, 'toggle_default_bsky'));
        if (platforms.tumblr) buttons.push(Markup.button.callback(`${dests.tumblr ? '✅' : '❌'} Tumblr`, 'toggle_default_tumblr'));
        if (platforms.tg) buttons.push(Markup.button.callback(`${dests.tg ? '✅' : '❌'} Telegram`, 'toggle_default_tg'));
        if (platforms.zip) buttons.push(Markup.button.callback(`${dests.zip ? '✅' : '❌'} Zip`, 'toggle_default_zip'));

        if (platforms.discord && platforms.discord.length > 0) {
            platforms.discord.forEach((label) => {
                const isEnabled = dests.discord && dests.discord.includes(label);
                buttons.push(
                    Markup.button.callback(`${isEnabled ? '✅' : '❌'} Discord: ${label}`, `toggle_default_discord_${label}`)
                );
            });
        }

        const rows = [];
        for (let i = 0; i < buttons.length; i += 2) {
            rows.push(buttons.slice(i, i + 2));
        }

        return Markup.inlineKeyboard(rows);
    }

    static queuePagination(page, totalPages) {
        const buttons = [];
        if (page > 1) {
            buttons.push(
                Markup.button.callback(
                    '⬅️ Prev Page',
                    `queue_page_${page - 1}`,
                ),
            );
        }
        if (page < totalPages) {
            buttons.push(
                Markup.button.callback(
                    'Next Page ➡️',
                    `queue_page_${page + 1}`,
                ),
            );
        }
        return buttons.length > 0 ? Markup.inlineKeyboard([buttons]) : {};
    }

    static queueItem(id) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(`✏️ Edit ${id}`, `edit_scheduled_${id}`),
                Markup.button.callback(`🗑️ Delete`, `del_scheduled_${id}`),
            ],
        ]);
    }

    static cancel(callbackData) {
        return Markup.inlineKeyboard([
            [Markup.button.callback('↩️ Cancel', callbackData)],
        ]);
    }

    static presetList(
        presets,
        actionPrefix,
        cancelCallback,
        icon = '',
        page = 1,
    ) {
        const keys = Object.keys(presets);
        const limit = 4;
        const totalPages = Math.ceil(keys.length / limit) || 1;
        const safePage = Math.max(1, Math.min(page, totalPages));
        const start = (safePage - 1) * limit;
        const pagedKeys = keys.slice(start, start + limit);

        const buttons = pagedKeys.map((key) =>
            Markup.button.callback(
                `${icon}${key}`,
                `${actionPrefix}_${key}`.substring(0, 64),
            ),
        );

        const buttonRows = [];
        for (let i = 0; i < buttons.length; i += 2) {
            buttonRows.push(buttons.slice(i, i + 2));
        }

        if (totalPages > 1) {
            const pageButtons = [];
            if (safePage > 1)
                pageButtons.push(
                    Markup.button.callback(
                        '⬅️ Prev',
                        `page_${actionPrefix}_${safePage - 1}`,
                    ),
                );
            if (safePage < totalPages)
                pageButtons.push(
                    Markup.button.callback(
                        'Next ➡️',
                        `page_${actionPrefix}_${safePage + 1}`,
                    ),
                );
            buttonRows.push(pageButtons);
        }

        buttonRows.push([Markup.button.callback('↩️ Cancel', cancelCallback)]);

        return Markup.inlineKeyboard(buttonRows);
    }

    static countdown() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Force Post', 'countdown_force')],
            [Markup.button.callback('❌ Cancel Post', 'countdown_cancel')],
        ]);
    }

    static preview(dest, hasMedia, hasSchedule) {
        const platforms = getConfiguredPlatforms();
        const destinationButtons = [];
        
        if (platforms.bsky) destinationButtons.push(Markup.button.callback(`${dest.bsky ? '✅' : '❌'} Bluesky`, 'toggle_bsky'));
        if (platforms.tumblr) destinationButtons.push(Markup.button.callback(`${dest.tumblr ? '✅' : '❌'} Tumblr`, 'toggle_tumblr'));
        if (platforms.tg) destinationButtons.push(Markup.button.callback(`${dest.tg ? '✅' : '❌'} Telegram`, 'toggle_tg'));
        if (platforms.zip) destinationButtons.push(Markup.button.callback(`${dest.zip ? '✅' : '❌'} Zip`, 'toggle_zip'));

        if (platforms.discord && platforms.discord.length > 0) {
            platforms.discord.forEach((label) => {
                const isEnabled = dest.discord && dest.discord.includes(label);
                destinationButtons.push(
                    Markup.button.callback(`${isEnabled ? '✅' : '❌'} Discord: ${label}`, `toggle_discord_${label}`)
                );
            });
        }

        const destRows = [];
        for (let i = 0; i < destinationButtons.length; i += 2) {
            destRows.push(destinationButtons.slice(i, i + 2));
        }

        const optionsRow = [
            Markup.button.callback('Edit Text', 'post_edit'),
            Markup.button.callback('Tags', 'post_tags'),
        ];
        if (hasMedia) {
            optionsRow.push(
                Markup.button.callback('Alt Text', 'action_add_alt_text'),
            );
        }

        const scheduleRows = [];
        if (hasSchedule) {
            scheduleRows.push([
                Markup.button.callback('💾 Save to Queue', 'post_save_queue'),
                Markup.button.callback('🕰️ Reschedule', 'post_schedule'),
            ]);
            scheduleRows.push([
                Markup.button.callback(
                    '❌ Clear Schedule',
                    'post_clear_schedule',
                ),
            ]);
        } else {
            scheduleRows.push([
                Markup.button.callback('🕰️ Schedule Post', 'post_schedule'),
                Markup.button.callback('📝 Save as Draft', 'post_save_draft'),
            ]);
        }

        return Markup.inlineKeyboard([
            ...destRows,
            [Markup.button.callback('🚀 Post to Selected', 'post_selected')],
            ...scheduleRows,
            optionsRow,
            [Markup.button.callback('Cancel', 'post_cancel')],
        ]);
    }

    static tagsMenu(currentTags, presets, page = 1) {
        const keys = Object.keys(presets);
        const limit = 4;
        const totalPages = Math.ceil(keys.length / limit) || 1;
        const safePage = Math.max(1, Math.min(page, totalPages));
        const start = (safePage - 1) * limit;
        const pagedKeys = keys.slice(start, start + limit);

        const presetButtons = pagedKeys.map((key) =>
            Markup.button.callback(
                `🏷️ ${key.charAt(0).toUpperCase() + key.slice(1)}`,
                `preset_${key}`.substring(0, 64),
            ),
        );

        const buttonRows = [];
        if (currentTags.length > 0) {
            const tagRemovalButtons = currentTags.map((tag) =>
                Markup.button.callback(
                    `❌ #${tag}`,
                    `removetag_${tag}`.substring(0, 64),
                ),
            );
            for (let i = 0; i < tagRemovalButtons.length; i += 3) {
                buttonRows.push(tagRemovalButtons.slice(i, i + 3));
            }
            buttonRows.push([]); // Add a separator row
        }

        for (let i = 0; i < presetButtons.length; i += 2) {
            buttonRows.push(presetButtons.slice(i, i + 2));
        }

        if (totalPages > 1) {
            const pageButtons = [];
            if (safePage > 1)
                pageButtons.push(
                    Markup.button.callback(
                        '⬅️ Prev',
                        `page_tags_${safePage - 1}`,
                    ),
                );
            if (safePage < totalPages)
                pageButtons.push(
                    Markup.button.callback(
                        'Next ➡️',
                        `page_tags_${safePage + 1}`,
                    ),
                );
            buttonRows.push(pageButtons);
        }

        buttonRows.push([
            Markup.button.callback('➕ Add', 'action_add_preset'),
            Markup.button.callback('✏️ Edit', 'action_edit_preset_menu'),
            Markup.button.callback('🗑️ Delete', 'action_del_preset_menu'),
        ]);
        buttonRows.push([
            Markup.button.callback('🧹 Clear Post Tags', 'action_clear_tags'),
            Markup.button.callback('↩️ Back to Preview', 'preset_cancel'),
        ]);

        return Markup.inlineKeyboard(buttonRows);
    }
}
