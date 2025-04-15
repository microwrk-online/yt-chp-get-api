# yt-chp-get-api

🧱 Project Requirements

npm install express ytdl-core@npm:@distube/ytdl-core uuid

# Also make sure FFmpeg is installed and added to your system PATH.
Test with:
ffmpeg -version

#Example Usage

✅ GET /api/chapters?url=YOUTUBE_URL

✅ GET /api/split?url=YOUTUBE_URL → returns downloadable chapter links

# Cleanup Tip

Since videos and clips are stored in folders, you may want to:

Auto-delete files after some time (e.g., with a cron job or cleanup middleware)

Limit simultaneous jobs to avoid overloading the server
