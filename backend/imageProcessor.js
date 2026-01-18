/**
 * Image Processing and OCR Support
 * Uses Tesseract.js for OCR and Groq AI for understanding
 */

import Groq from "groq-sdk";
import { CONFIG } from "./config.js";
import { createWorker } from "tesseract.js";
import { detectLanguage } from "./languageDetector.js";

const groq = new Groq({
  apiKey: CONFIG.GROQ_API_KEY
});

// Log on module load to confirm new code is running
console.log("✅ Image Processor loaded: Using Tesseract.js OCR (no vision models required)");

// Initialize Tesseract workers (lazy load, support multiple languages)
const tesseractWorkers = {};

async function getTesseractWorker(languages = "eng") {
  // Support multiple languages: eng+hin for English + Hindi, etc.
  const langKey = Array.isArray(languages) ? languages.join("+") : languages;
  
  if (!tesseractWorkers[langKey]) {
    try {
      console.log(`🔧 Initializing Tesseract OCR worker for: ${langKey}`);
      console.log(`⏳ This may take a moment on first run (downloading language data)...`);
      
      tesseractWorkers[langKey] = await createWorker(langKey, 1, {
        logger: m => {
          if (m.status === "recognizing text") {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          } else if (m.status === "loading language traineddata") {
            console.log(`📥 Loading language data: ${m.progress * 100}%`);
          }
        }
      });
      
      console.log(`✅ Tesseract worker initialized successfully`);
    } catch (error) {
      console.error(`❌ Failed to initialize Tesseract worker:`, error.message);
      // If specific language fails, try English only
      if (langKey !== "eng") {
        console.log(`⚠️ Falling back to English only...`);
        return getTesseractWorker("eng");
      }
      throw error;
    }
  }
  return tesseractWorkers[langKey];
}

// Map language codes to Tesseract language codes
const LANGUAGE_TO_TESSERACT = {
  "en": "eng",
  "hi": "hin",
  "bn": "ben",
  "te": "tel",
  "ta": "tam",
  "gu": "guj",
  "kn": "kan",
  "ml": "mal",
  "mr": "mar",
  "pa": "pan",
  "ur": "urd"
};

/**
 * Process image and extract text/question using OCR + AI
 * Uses Tesseract.js for OCR, then Groq AI for understanding
 */
export async function processImage(imageBase64, imageType = "image/jpeg", detectedLanguage = null) {
  try {
    console.log("🔍 Starting image processing with OCR...");
    
    // Step 1: Convert base64 to buffer for Tesseract
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Step 2: Determine OCR language(s)
    let ocrLanguages = "eng";
    if (detectedLanguage && detectedLanguage.code) {
      const tesseractLang = LANGUAGE_TO_TESSERACT[detectedLanguage.code];
      if (tesseractLang) {
        ocrLanguages = detectedLanguage.code === "en" ? "eng" : `${tesseractLang}+eng`;
      }
    } else {
      const allLangs = Array.from(new Set(Object.values(LANGUAGE_TO_TESSERACT)));
      ocrLanguages = allLangs.join("+");
    }
    
    // Step 3: Use Tesseract.js for OCR
    console.log(`📸 Running OCR on image (languages: ${ocrLanguages})...`);
    
    let worker;
    try {
      worker = await getTesseractWorker(ocrLanguages);
    } catch (error) {
      // If multi-language fails, try English only
      if (ocrLanguages !== "eng") {
        console.log(`⚠️ Multi-language OCR failed, trying English only...`);
        worker = await getTesseractWorker("eng");
      } else {
        throw error;
      }
    }
    
    const { data: { text, confidence } } = await worker.recognize(imageBuffer);
    
    console.log(`✅ OCR completed. Confidence: ${Math.round(confidence)}%`);
    console.log(`📝 Extracted text: ${text.substring(0, 200)}...`);
    
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: "No text could be extracted from the image. Please ensure the image contains clear, readable text.",
        text: null
      };
    }
    
    // Step 3: Detect language from extracted text
    const detectedLang = detectLanguage(text);
    console.log(`🌐 Detected language: ${detectedLang.language} (${detectedLang.code})`);
    
    // Step 4: Use AI to clean up and understand the extracted text
    console.log("🤖 Processing extracted text with AI...");
    
    const systemPrompt = `You are an educational assistant. The user has uploaded an image and I've extracted text from it using OCR.
The text appears to be in ${detectedLang.language}.

Your task:
1. Clean up any OCR errors in the extracted text
2. Identify if it's a question, math problem, or educational content
3. If it's a math problem, ensure all symbols and equations are correct
4. Format it clearly for answering
5. Maintain the original language (${detectedLang.language})

Return the cleaned and formatted text. If it's a question, present it clearly in ${detectedLang.language}.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Here is the text extracted from an image using OCR. Please clean it up and format it properly:\n\n${text}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const cleanedText = completion.choices[0].message.content;
    
    return {
      success: true,
      text: cleanedText,
      rawOcrText: text, // Keep original OCR text for reference
      confidence: confidence,
      type: detectContentType(cleanedText),
      method: "ocr+ai"
    };
    
  } catch (error) {
    console.error("❌ Image processing error:", error.message);
    
    // If Tesseract fails, try to provide helpful error
    if (error.message?.includes("tesseract") || error.message?.includes("worker")) {
      return {
        success: false,
        error: "OCR processing failed. Please ensure the image is clear and contains readable text. You can also type your question manually.",
        text: null
      };
    }
    
    return {
      success: false,
      error: error.message || "Failed to process image. Please try again or type your question manually.",
      text: null
    };
  }
}

/**
 * Detect content type from extracted text
 */
function detectContentType(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("solve") || lowerText.includes("find") || 
      lowerText.includes("calculate") || /[+\-*/=()²³√∫∑]/.test(text)) {
    return "math";
  }
  
  if (lowerText.includes("?") || lowerText.includes("what") || 
      lowerText.includes("explain") || lowerText.includes("why")) {
    return "question";
  }
  
  return "general";
}

/**
 * Convert image file to base64
 */
export function imageToBase64(imageBuffer, mimeType) {
  return imageBuffer.toString('base64');
}
