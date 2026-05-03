import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// ANSI Color Codes
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

async function main() {
    const envPath = fileURLToPath(new URL('../.env', import.meta.url));
    const configPath = fileURLToPath(
        new URL('../ecosystem.config.cjs', import.meta.url),
    );

    const rl = readline.createInterface({ input, output });

    rl.on('SIGINT', () => {
        console.log(
            `\n${c.yellow}Setup aborted. Exiting gracefully...${c.reset}`,
        );
        process.exit(0);
    });

    console.log(`${c.bold}${c.cyan}🤖 BarkBot PM2 Setup Wizard${c.reset}`);
    console.log(
        `${c.cyan}This will generate an ecosystem.config.cjs file for PM2 deployment.${c.reset}\n`,
    );

    let defaultName = 'barkbot';
    if (fs.existsSync(envPath)) {
        const existingEnv = dotenv.parse(fs.readFileSync(envPath));
        if (existingEnv.BOT_NAME) {
            // Sanitize the bot name into a clean string for PM2 (e.g., "My Bot" -> "my-bot")
            defaultName = existingEnv.BOT_NAME.toLowerCase().replace(
                /[^a-z0-9-_]/g,
                '-',
            );
        }
    }

    async function ask(prompt, defaultVal) {
        const defaultText = defaultVal
            ? ` ${c.reset}[${defaultVal}]${c.cyan}`
            : '';
        const answer = await rl.question(
            `${c.cyan}${prompt}${defaultText}: ${c.reset}`,
        );
        return answer.trim() || defaultVal || '';
    }

    const appName = await ask('Enter the PM2 app name', defaultName);

    rl.close();

    console.log(`\n${c.cyan}Generating ecosystem.config.cjs...${c.reset}`);

    const configContent = `module.exports = {
  apps: [{
    name: "${appName}",
    script: "./src/bot.js",
    watch: false,
    env: {
      NODE_ENV: "production",
    }
  }]
};
`;

    fs.writeFileSync(configPath, configContent);
    console.log(
        `${c.green}✅ ecosystem.config.cjs successfully created!${c.reset}`,
    );
    console.log(
        `${c.bold}${c.cyan}You can now start the bot using: pm2 start ecosystem.config.cjs${c.reset}`,
    );
    console.log(
        `${c.cyan}Don't forget to run 'pm2 save' afterward to save your process list!${c.reset}`,
    );
}

main().catch((err) => {
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
