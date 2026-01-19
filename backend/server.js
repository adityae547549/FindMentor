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
import multer from "multer";
import fs from "fs";
import Groq from "groq-sdk";
import { createServer } from "http";
import { Server } from "socket.io";

import { CONFIG } from "./config.js";
import { loadData } from "./dataloader.js";
import { resolveQuery } from "./queryResolver.js";
import { processImage, imageToBase64 } from "./imageProcessor.js";
import { extractTextFromPDFBuffer, extractQuestionsFromPDF } from "./pdfProcessor.js";

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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Define paths
const rootPath = path.join(__dirname, "..");
const frontendPath = path.join(__dirname, "..", "frontend");

loadData();

// IMPORTANT: Route handlers MUST come before static middleware
// Serve index.html as the landing page (root route)
app.get("/", (req, res) => {
  const indexPath = path.join(rootPath, "index.html");
  console.log("📍 Root route hit! Serving index.html from:", indexPath);
  console.log("📍 File exists:", fs.existsSync(indexPath));
  
  // Set headers to prevent browser caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      res.status(500).send("Error loading index.html");
    } else {
      console.log("✅ index.html served successfully");
    }
  });
});

// Serve ai_window.html
app.get("/ai_window.html", (req, res) => {
  res.sendFile(path.join(frontendPath, "ai_window.html"));
});

// Serve CSS and other root static files explicitly (avoid serving root index.html via static)
app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(rootPath, "styles.css"));
});

// Serve static files from frontend directory
app.use("/frontend", express.static(frontendPath));

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
});

// Text-based question endpoint
app.post("/ask", async (req, res) => {
  try {
    const { question, language } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Question is required"
      });
    }
    
    const result = await resolveQuery(question, { language });
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
  console.log("🚀 Server running on http://localhost:" + CONFIG.PORT);
  console.log("📷 Image upload: POST /ask/image");
  console.log("📄 PDF upload: POST /ask/pdf");
  console.log("📞 Socket.io ready for video calls");
});
