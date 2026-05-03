import fs from 'node:fs';
import path from 'node:path';
import { Post } from '../struct/Post.js';

const DATA_DIR = 'data';
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

export class Memory {
    constructor() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        this.pendingPosts = new Map();
        this.mediaGroups = new Map();
        this._presets = this.#initPresets();
        this._config = this.#initMemory();
        this._scheduledPosts = this.#initQueue().map((p) => new Post(p));
    }

    #initPresets() {
        const defaultPresets = {
            art: ['art', 'illustration', 'drawing', 'artistsoninstagram'],
            photography: ['photography', 'photooftheday', 'nature'],
            updates: ['update', 'news', 'announcement'],
        };
        // Create the file with default presets if it doesn't exist yet
        if (!fs.existsSync(PRESETS_FILE)) {
            fs.writeFileSync(
                PRESETS_FILE,
                JSON.stringify(defaultPresets, null, 4),
            );
            return defaultPresets;
        }
        try {
            return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf-8'));
        } catch (e) {
            // If the file gets corrupted or is invalid JSON, fallback safely instead of crashing
            console.error(
                '[ERROR] Failed to parse presets.json. Falling back to defaults.',
                e,
            );
            return defaultPresets;
        }
    }

    loadPresets() {
        return this._presets;
    }

    savePresets(presets) {
        this._presets = presets;
        fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 4), (err) => {
            if (err) console.error('[ERROR] Failed to save presets.json:', err);
        });
    }

    #initMemory() {
        const defaultMemory = {
            startupMessageId: null,
            delayPostSeconds: 30,
            showCrossPostLinks: true,
            defaultDestinations: {
                bsky: true,
                tumblr: true,
                tg: true,
                zip: false,
            },
        };
        if (!fs.existsSync(MEMORY_FILE)) {
            return defaultMemory;
        }
        try {
            const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
            // Merge with defaults to ensure all keys are present
            return { ...defaultMemory, ...JSON.parse(data) };
        } catch (e) {
            console.error(
                '[ERROR] Failed to parse memory.json. Falling back to defaults.',
                e,
            );
            return defaultMemory;
        }
    }

    #saveMemory() {
        fs.writeFile(
            MEMORY_FILE,
            JSON.stringify(this._config, null, 4),
            (err) => {
                if (err)
                    console.error('[ERROR] Failed to save memory.json:', err);
            },
        );
    }

    #initQueue() {
        if (!fs.existsSync(QUEUE_FILE)) {
            return [];
        }
        try {
            return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
        } catch (e) {
            console.error(
                '[ERROR] Failed to parse queue.json. Falling back to empty queue.',
                e,
            );
            return [];
        }
    }

    saveQueue(queue) {
        fs.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 4), (err) => {
            if (err) {
                console.error('[ERROR] Failed to save queue.json:', err);
            }
        });
    }

    get delayPostSeconds() {
        return this._config.delayPostSeconds;
    }

    set delayPostSeconds(value) {
        this._config.delayPostSeconds = value;
        this.#saveMemory();
    }

    get showCrossPostLinks() {
        return this._config.showCrossPostLinks;
    }

    set showCrossPostLinks(value) {
        this._config.showCrossPostLinks = value;
        this.#saveMemory();
    }

    get startupMessageId() {
        return this._config.startupMessageId;
    }

    set startupMessageId(value) {
        this._config.startupMessageId = value;
        this.#saveMemory();
    }

    get scheduledPosts() {
        return this._scheduledPosts;
    }

    set scheduledPosts(value) {
        this._scheduledPosts = value;
        this.saveQueue(value);
    }

    get defaultDestinations() {
        return (
            this._config.defaultDestinations || {
                bsky: true,
                tumblr: true,
                tg: true,
                zip: false,
            }
        );
    }

    set defaultDestinations(value) {
        this._config.defaultDestinations = value;
        this.#saveMemory();
    }
}
