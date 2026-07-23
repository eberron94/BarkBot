# Use an official Node.js runtime as a parent image.
# The README recommends v18+, so we'll use a recent LTS version.
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package.json ./
COPY package-lock.json* ./

# Install app dependencies using 'npm ci' for clean, consistent installs
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# The bot's entry point is src/bot.js, which is run via 'npm start'
# Make sure your package.json has a "start": "node src/bot.js" script.
CMD [ "npm", "start" ]