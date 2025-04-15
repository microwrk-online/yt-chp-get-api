const express = require("express");
const ytdl = require("ytdl-core");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

const TMP_DIR = path.join(__dirname, "tmp");
const CLIPS_DIR = path.join(__dirname, "clips");

// Ensure directories exist
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);
if (!fs.existsSync(CLIPS_DIR)) fs.mkdirSync(CLIPS_DIR);

// 🧠 Helper: Convert HH:MM:SS to seconds
function timeToSeconds(t) {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

// 🧠 GET chapter metadata
app.get("/api/chapters", async (req, res) => {
  const { url } = req.query;

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title;
    const chapters = info.videoDetails.chapters || [];

    res.json({ title: videoTitle, chapters });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve chapters" });
  }
});

// 🎬 Extract chapters and return download links
app.get("/api/split", async (req, res) => {
  const { url } = req.query;

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, "_");
    const chapters = info.videoDetails.chapters || [];

    if (!chapters.length) {
      return res.status(400).json({ error: "No chapters found in this video" });
    }

    // Download full video
    const videoId = uuidv4();
    const videoPath = path.join(TMP_DIR, `${videoId}.mp4`);
    const videoStream = ytdl(url, { quality: "highestvideo" });

    const writeStream = fs.createWriteStream(videoPath);
    videoStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Split into chapters using FFmpeg
    const downloadLinks = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const start = timeToSeconds(chapter.start_time);
      const end = chapters[i + 1]
        ? timeToSeconds(chapters[i + 1].start_time)
        : Math.floor(info.videoDetails.lengthSeconds);
      const duration = end - start;

      const safeTitle = chapter.title.replace(/[^\w\s]/gi, "_");
      const outputName = `${videoId}_${i}_${safeTitle}.mp4`;
      const outputPath = path.join(CLIPS_DIR, outputName);

      const cmd = `ffmpeg -y -i "${videoPath}" -ss ${start} -t ${duration} -c copy "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
          if (err) {
            console.error("FFmpeg error:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      downloadLinks.push({
        title: chapter.title,
        download: `http://localhost:${PORT}/clips/${outputName}`,
      });
    }

    res.json({ title: videoTitle, clips: downloadLinks });
  } catch (err) {
    console.error("Split error:", err);
    res.status(500).json({ error: "Failed to split video" });
  }
});

// Static file serving for downloads
app.use("/clips", express.static(CLIPS_DIR));

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
