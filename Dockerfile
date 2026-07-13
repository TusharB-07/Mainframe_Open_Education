FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libu2f-udev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]