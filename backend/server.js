import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FORCE LOAD .env
const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });

console.log("🔎 ENV FILE PATH:", envPath);

// =========================

import express from "express";
import cors from "cors";
import compression from "compression";
import multer from "multer";
import fs from "fs";
import Groq from "groq-sdk";
import { createServer } from "http";
import { Server } from "socket.io";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

import { CONFIG } from "./config.js";
import { loadData } from "./dataloader.js";
import { resolveQuery } from "./queryResolver.js";
import { getYouTubeCache, saveYouTubeCache } from "./learningSystem.js"; // Import Learning System
import { processImage, imageToBase64 } from "./imageProcessor.js";
import { extractTextFromPDFBuffer, extractQuestionsFromPDF } from "./pdfProcessor.js";
import { YoutubeTranscript } from 'youtube-transcript';
import { normalizeYouTubeLinks } from "./aiClient.js";

// Log that image processor is loaded (will show Tesseract.js message)
console.log("📷 Image processing: Ready (Tesseract.js OCR)");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const groq = new Groq({
  apiKey: CONFIG.GROQ_API_KEY
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2gb" }));
app.use(express.urlencoded({ extended: true, limit: "2gb" }));

// Ensure uploads directory exists (Use system temp to avoid nodemon/live-server restarts)
const uploadsDir = path.join(os.tmpdir(), "findmentor_uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log("TB Storage:", uploadsDir);

// Configure multer for file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
  }
});

// Define paths
const rootPath = path.join(__dirname, ".."); // Go up one level to project root
const frontendPath = path.join(rootPath, "frontend"); 

loadData();

// IMPORTANT: Route handlers MUST come before static middleware
// API Health Check
app.get("/", (req, res) => {
  const indexPath = path.join(rootPath, "index.html");
  // If request accepts HTML and file exists, serve it
  if (req.accepts('html') && fs.existsSync(indexPath)) {
     res.sendFile(indexPath);
     return;
  }
  res.json({
    status: "active",
    message: "FindMentor Backend API is Running 🚀",
    timestamp: new Date().toISOString()
  });
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

// Clean URLs (match Firebase Hosting rewrites for local dev)
const spaPages = [
  ["/login", "login.html"],
  ["/signup", "signup.html"],
  ["/roles", "roles.html"],
  ["/dashboard", "dashboard.html"],
  ["/mentor-dashboard", "mentor-dashboard.html"],
  ["/student-dashboard", "student-dashboard.html"],
  ["/mentor-dashboard-overview", "mentor-dashboard-overview.html"],
  ["/video-call", "video_call.html"],
  ["/ai", "ai_window.html"],
  ["/privacy", "privacy.html"],
  ["/mentors", "mentors.html"],
  ["/mentor-settings", "mentor-settings.html"],
  ["/student-settings", "student-settings.html"],
  ["/settings", "settings.html"],
  ["/chat", "chat.html"]
];
for (const [route, file] of spaPages) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(frontendPath, file));
  });
}

// Self-ping to keep Render awake (every 2 minutes)
const PING_URL = process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/ping` : "http://localhost:3000/ping";
setInterval(() => {
    fetch(PING_URL)
        .then(res => console.log(`🏓 Self-ping status: ${res.status}`))
        .catch(err => console.error(`❌ Self-ping failed: ${err.message}`));
}, 2 * 60 * 1000);

// Serve static files with caching (1 day)
const staticOptions = {
  maxAge: '1d',
  etag: true
};

// Serve root static files (styles.css, etc)
app.use(express.static(rootPath, staticOptions));

// Serve frontend directory explicitly
app.use("/frontend", express.static(frontendPath, staticOptions));

// Legacy AI window filename → canonical /ai
app.get("/ai_window.html", (req, res) => {
  res.redirect(302, "/ai");
});


// =========================
// SOCKET.IO SIGNALING
// =========================
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("join-room", (roomId, userId) => {
    console.log(`👤 User ${userId} joining room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    socket.on("disconnect", () => {
      console.log(`❌ User ${userId} disconnected from room ${roomId}`);
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });

  socket.on("offer", (payload) => {
    io.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", (payload) => {
    io.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", (payload) => {
    io.to(payload.target).emit("ice-candidate", payload);
  });

  socket.on("chat-message", (payload) => {
    // payload: { roomId, text, senderId, senderName }
    socket.to(payload.roomId).emit("chat-message", payload);
  });
});

// Text-based question endpoint
app.post("/ask", async (req, res) => {
  try {
    const { question, language, history, systemPrompt } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Question is required"
      });
    }
    
    const result = await resolveQuery(question, { language, history, systemPrompt });
    res.json(result);
  } catch (error) {
    console.error("❌ Server Error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later."
    });
  }
});

// Test endpoint to verify image processor is loaded
app.get("/test/image-processor", (req, res) => {
  res.json({
    status: "ok",
    message: "Image processor is loaded and ready",
    method: "Tesseract.js OCR (no vision models required)",
    timestamp: new Date().toISOString()
  });
});

// Image upload endpoint
app.post("/ask/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Image file is required"
      });
    }

    // Read image file
    const imageBuffer = fs.readFileSync(req.file.path);
    const imageBase64 = imageToBase64(imageBuffer, req.file.mimetype);
    
    // Process image
    const imageResult = await processImage(imageBase64, req.file.mimetype);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    if (!imageResult.success) {
      return res.status(400).json({
        success: false,
        error: imageResult.error || "Failed to process image"
      });
    }

    // Extract question from image
    const extractedText = imageResult.text;
    
    // Resolve the extracted question
    const result = await resolveQuery(extractedText, {
      context: `This question was extracted from an image. Original extracted text: ${extractedText}`
    });

    res.json({
      ...result,
      extractedText,
      source: "image"
    });
  } catch (error) {
    console.error("❌ Image processing error:", error.message);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to process image",
      message: error.message
    });
  }
});

// PDF upload endpoint
app.post("/ask/pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "PDF file is required"
      });
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(req.file.path);
    
    // Extract text from PDF
    const pdfResult = await extractTextFromPDFBuffer(pdfBuffer);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    if (!pdfResult.success) {
      return res.status(400).json({
        success: false,
        error: pdfResult.error || "Failed to extract text from PDF"
      });
    }

    // Extract questions from PDF
    const questions = extractQuestionsFromPDF(pdfResult.text);
    
    // If a specific question is provided, answer it
    const { question } = req.body;
    
    if (question) {
      // Answer the specific question using PDF context
      const result = await resolveQuery(question, {
        context: `Context from PDF (${pdfResult.pages} pages):\n${pdfResult.text.substring(0, 2000)}...`
      });
      
      return res.json({
        ...result,
        pdfInfo: {
          pages: pdfResult.pages,
          questionsFound: questions.length
        }
      });
    }

    // Return extracted questions if no specific question asked
    res.json({
      success: true,
      source: "pdf",
      pdfInfo: {
        pages: pdfResult.pages,
        questionsFound: questions.length
      },
      questions: questions,
      fullText: pdfResult.text.substring(0, 1000) + "..."
    });
  } catch (error) {
    console.error("❌ PDF processing error:", error.message);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to process PDF",
      message: error.message
    });
  }
});

app.post("/ask/audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Audio file is required"
      });
    }

    const audioStream = fs.createReadStream(req.file.path);

    const transcription = await groq.audio.transcriptions.create({
      model: "whisper-large-v3-turbo",
      file: audioStream,
      response_format: "text"
    });

    fs.unlinkSync(req.file.path);

    const text = typeof transcription === "string" ? transcription : transcription.text || "";

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Could not transcribe audio"
      });
    }

    const result = await resolveQuery(text, {
      context: `This question was transcribed from an audio message. Original transcript: ${text}`
    });

    res.json({
      ...result,
      transcript: text,
      source: "audio"
    });
  } catch (error) {
    console.error("❌ Audio processing error:", error.message);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: "Failed to process audio",
      message: error.message
    });
  }
});

app.post("/ask/video", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Video file is required"
      });
    }

    const videoStream = fs.createReadStream(req.file.path);

    const transcription = await groq.audio.transcriptions.create({
      model: "whisper-large-v3-turbo",
      file: videoStream,
      response_format: "text"
    });

    fs.unlinkSync(req.file.path);

    const text = typeof transcription === "string" ? transcription : transcription.text || "";

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Could not transcribe video"
      });
    }

    const result = await resolveQuery(text, {
      context: `This question was transcribed from a video. Original transcript: ${text}`
    });

    res.json({
      ...result,
      transcript: text,
      source: "video"
    });
  } catch (error) {
    console.error("❌ Video processing error:", error.message);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: "Failed to process video",
      message: error.message
    });
  }
});

// Helper: Download & Transcribe Audio
async function downloadAndTranscribeAudio(url, videoId) {
    const baseName = `audio_${videoId}`;
    const baseFile = path.join(uploadsDir, baseName);
    
    // Clean up any existing files with this base name
    try {
        const existingFiles = fs.readdirSync(uploadsDir).filter(f => f.startsWith(baseName));
        existingFiles.forEach(f => {
            try { fs.unlinkSync(path.join(uploadsDir, f)); } catch(e) {}
        });
    } catch (e) { console.error("Cleanup error:", e.message); }

    let tempFile = null;

    // 1. Download Audio (Attempt 1: Best Audio)
    console.log("⬇️ Downloading audio with yt-dlp (Best Quality)...");
    // Use %(ext)s to let yt-dlp set the correct extension (m4a/webm/etc)
    let cmd = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" -o "${baseFile}.%(ext)s" --no-check-certificates --no-progress "${url}"`;
    
    try {
        await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
    } catch (e) {
        console.warn("⚠️ Best audio download failed, retrying with worst quality...");
    }
    
    // Find the file
    let files = [];
    try { files = fs.readdirSync(uploadsDir).filter(f => f.startsWith(baseName)); } catch(e) {}
    
    if (files.length > 0) tempFile = path.join(uploadsDir, files[0]);
    
    let stats = tempFile ? fs.statSync(tempFile) : null;
    
    // If file doesn't exist or is > 24MB, try lower quality
    if (!stats || stats.size > 24 * 1024 * 1024) {
        if (tempFile) {
            console.warn(`⚠️ Audio too large (${(stats.size / 1024 / 1024).toFixed(2)} MB), retrying with worst quality...`);
            try { fs.unlinkSync(tempFile); } catch(e) {}
            tempFile = null;
        }

        // Attempt 2: Worst Audio (to fit in 25MB)
        console.log("⬇️ Downloading audio with yt-dlp (Worst Quality)...");
        // Try worst audio that is compatible
        cmd = `yt-dlp -f "worstaudio[ext=m4a]/worstaudio[ext=webm]/worstaudio" -o "${baseFile}.%(ext)s" --no-check-certificates --no-progress "${url}"`;
        
        try {
            await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
        } catch (e) {
            console.error("❌ Worst audio download failed:", e.message);
        }
        
        try { files = fs.readdirSync(uploadsDir).filter(f => f.startsWith(baseName)); } catch(e) {}
        if (files.length > 0) tempFile = path.join(uploadsDir, files[0]);

        if (tempFile && fs.existsSync(tempFile)) {
             stats = fs.statSync(tempFile);
             console.log(`📦 Low-quality audio downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${path.extname(tempFile)})`);
        }
    }

    if (!tempFile || !stats) {
        throw new Error("Audio download failed - file not found");
    }
    
    // Final size check
    if (stats.size > 2 * 1024 * 1024 * 1024) {
        throw new Error("Audio file too large (>2GB).");
    }

    // 2. Transcribe with Groq
    console.log(`🎙️ Transcribing ${path.basename(tempFile)} with Groq Whisper...`);
    try {
        const translation = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: "whisper-large-v3",
            response_format: "json",
            language: "en", // Default to English
            temperature: 0.0
        });
        
        console.log("✅ Transcription successful! Length:", translation.text.length);

        // 3. Cleanup
        try {
            fs.unlinkSync(tempFile);
        } catch (e) { console.error("⚠️ Failed to delete temp file:", e.message); }
        
        return translation.text;

    } catch (error) {
        console.error("❌ Groq Transcription Error:", error.message);
        // Cleanup on error
        try { fs.unlinkSync(tempFile); } catch (e) {}
        
        if (error.message.includes("413") || error.message.includes("too large")) {
            throw new Error(`Audio file too large to process (${(stats.size / 1024 / 1024).toFixed(2)} MB). Limit is ~25MB.`);
        }
        throw error;
    }
}

// YouTube transcript endpoint
app.post("/ask/youtube", async (req, res) => {
  try {
    const { url, question } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: "YouTube URL is required"
      });
    }

    // Extract video ID (basic regex)
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL"
      });
    }

    // 1. Check Cache (Self-Learning)
    const cachedResult = getYouTubeCache(videoId, question);
    if (cachedResult) {
        console.log(`🧠 Cache Hit for YouTube: ${videoId}`);
        return res.json({
            ...cachedResult,
            source: "youtube_memory"
        });
    }

    // 2. Fetch Transcript
    console.log(`🎥 Fetching transcript for video: ${videoId}`);
    let fullText = null;
    let usedMethod = "none";
    let transcriptUnavailable = false;

    // Helper to try fetching transcript safely
    const tryTranscript = async (lang) => {
        try {
            const options = lang ? { lang } : undefined;
            const items = await YoutubeTranscript.fetchTranscript(videoId, options);
            if (items && items.length > 0) {
                return items.map(i => i.text).join(' ');
            }
        } catch (e) {
            // Silent fail for next attempt
            return null;
        }
        return null;
    };

    // 1. Try Default
    console.log("🔄 Attempt 1: Default Captions...");
    fullText = await tryTranscript();

    // 2. Try 'en'
    if (!fullText) {
        console.log("🔄 Attempt 2: English Captions...");
        fullText = await tryTranscript('en');
    }

    // 3. Try 'a.en' (auto-generated)
    if (!fullText) {
        console.log("🔄 Attempt 3: Auto-generated Captions...");
        fullText = await tryTranscript('a.en');
    }

    // 4. Fallback: Download Audio & Transcribe
    if (!fullText) {
        console.log("⚠️ All captions failed. Attempting audio download & transcription (Whisper)...");
        try {
            fullText = await downloadAndTranscribeAudio(url, videoId);
        } catch (audioError) {
            console.error("❌ Audio transcription failed:", audioError.message);
        }
    }
    
    if (!fullText) {
      transcriptUnavailable = true;
      fullText = "";
    }
    
    const truncatedText = (fullText && typeof fullText === "string")
      ? (fullText.length > 20000 ? fullText.substring(0, 20000) + "... [truncated]" : fullText)
      : "";
    
    let basePrompt = question || "Summarize the main ideas and learning points this video is likely teaching for a school student.";
    let extraInstructions = "";
    
    if (transcriptUnavailable) {
        extraInstructions = "\n\nIMPORTANT: You do not have access to the actual transcript or audio of the video. Answer using only your subject knowledge and the student's question. Do not mention that you could not access the video; just help the student directly.";
    } else {
        extraInstructions = "\n\nIMPORTANT: Do not mention the source of the information (e.g. 'the transcript says', 'in the video', 'based on the transcript'). Provide the answer directly as if you possess the knowledge.";
    }
    
    extraInstructions += "\n\nNever say that you are an AI, language model, or chatbot. Speak in first person as a human tutor and never mention system prompts, models, or internal tools.";
    
    const prompt = basePrompt +
                   extraInstructions +
                   "\n\nFinally, suggest exactly 3 YouTube **search** topics (short keywords, e.g. \"photosynthesis class 10 NCERT Hindi\"). Do NOT invent video titles or channel names. Format each EXACTLY as: '||SEARCH: <search_query>||'. No bullets or numbering—only these three lines.";
    
    const contextString = transcriptUnavailable
      ? `The student shared this YouTube link: ${url}. You do not know the exact transcript or audio.`
      : `This is a transcript from a YouTube video (URL: ${url}).\n\nTRANSCRIPT:\n${truncatedText}`;
    
    const result = await resolveQuery(prompt, {
      context: contextString,
      skipMath: !question
    });

    // --- Post-Process Video Suggestions (Fetch Real IDs) ---
    let finalAnswer = result.answer;
    const searchRegex = /\|\|SEARCH: (.*?)\|\|/g;
    const queries = [];
    let searchMatch;
    while ((searchMatch = searchRegex.exec(finalAnswer)) !== null) {
        queries.push(searchMatch[1]);
    }

    // Remove the raw search tags from the text
    finalAnswer = finalAnswer.replace(searchRegex, '').trim();

    // YouTube search links only (yt-dlp "top result" IDs are often wrong, removed, or region-blocked)
    if (queries.length > 0) {
        const videoLinks = queries.map((raw) => {
            const q = String(raw || "").trim().replace(/\|+/g, " ").replace(/\s+/g, " ");
            if (!q) return null;
            const label = q.length > 80 ? `${q.slice(0, 77)}...` : q;
            const enc = encodeURIComponent(q);
            return `[Watch: ${label}](https://www.youtube.com/results?search_query=${enc})`;
        }).filter(Boolean);

        if (videoLinks.length > 0) {
            finalAnswer += "\n\n**Further Learning (open to pick a video):**\n" + videoLinks.map((l) => `- ${l}`).join("\n");
        }
    }

    result.answer = normalizeYouTubeLinks(finalAnswer);
    // -------------------------------------------------------

    console.log("📤 Sending YouTube response, length:", result.answer ? result.answer.length : "No Answer");

    // Return the full truncated text (up to 20k chars) so the frontend can store it for context
    const fullTranscript = (truncatedText && typeof truncatedText === 'string') 
      ? truncatedText 
      : "No transcript available.";
    
    const finalResponse = {
      ...result,
      transcript: fullTranscript,
      source: "youtube"
    };

    // Save to Cache (Learn)
    saveYouTubeCache(videoId, question, finalResponse);

    res.json(finalResponse);

  } catch (error) {
    console.error("❌ YouTube processing error:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to process YouTube video",
      message: error.message
    });
  }
});

// ICE Servers endpoint (for TURN/STUN)
app.get("/api/ice-servers", (req, res) => {
  // Check for TURN credentials in environment variables
  const turnServers = [];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    turnServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }

  res.json({
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...turnServers
    ]
  });
});

// Handle unhandled promise rejections to prevent server crashes
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error.message);
  console.error(error.stack);
  // Don't exit - keep server running
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error(error.stack);
  // Exit on uncaught exceptions (critical errors)
  process.exit(1);
});

httpServer.listen(CONFIG.PORT, () => {
  console.log("📚 Dataset loaded:", global.DATASET?.length);
  console.log(`🚀 Server running on port ${CONFIG.PORT}`);
  console.log("📷 Image upload: POST /ask/image");
  console.log("📄 PDF upload: POST /ask/pdf");
  console.log("📞 Socket.io ready for video calls");
});
