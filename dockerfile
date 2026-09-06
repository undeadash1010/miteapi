FROM node:20-bookworm-slim

# 1. Install system dependencies & yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 2. Install yt-dlp via pip
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# 3. Setup Node app
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
