FROM node:20-slim

# Install python3 and yt-dlp
RUN apt-get update && apt-get install -y python3 python3-pip curl ffmpeg
RUN pip3 install --break-system-packages yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "api/index.js"]
