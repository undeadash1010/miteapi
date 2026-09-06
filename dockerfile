FROM node:20-bookworm

# Install yt-dlp and ffmpeg
RUN apt-get update && apt-get install -y yt-dlp ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
