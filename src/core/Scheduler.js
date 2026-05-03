export class Scheduler {
    constructor(memory, publisher) {
        this.memory = memory;
        this.publisher = publisher;
    }

    start() {
        // Start the background scheduler checking loop (every 60s)
        setInterval(() => this.#processScheduledPosts(), 60000);
        setTimeout(() => this.#processScheduledPosts(), 5000); // Check once shortly after launch
    }

    async #processScheduledPosts() {
        const now = Date.now();
        const scheduled = this.memory.scheduledPosts;
        const toPost = scheduled.filter((p) => p.postAt && p.postAt <= now);
        const remaining = scheduled.filter((p) => !p.postAt || p.postAt > now);

        if (toPost.length === 0) return;
        this.memory.scheduledPosts = remaining;
        
        console.log(`[QUEUE] Processing ${toPost.length} scheduled post(s)...`);

        for (const postData of toPost) {
            await this.publisher.publish(
                postData,
                null,
                postData.userId,
            );
        }
    }
}