FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

ENV NODE_ENV=production

COPY . .

CMD ["node", "bot.js"]