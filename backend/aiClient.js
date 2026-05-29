import Groq from "groq-sdk";
import { CONFIG } from "./config.js";
import { detectLanguage, getMultiLingualPrompt } from "./languageDetector.js";

// Validate API key is available
if (!CONFIG.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is not configured");
  throw new Error("API key not configured");
}

const groq = new Groq({
  apiKey: CONFIG.GROQ_API_KEY
});

/**
 * Remove repetitive content from AI response
 * Detects if same sentences/paragraphs repeat and truncates
 */
function removeRepetitiveContent(text) {
  if (!text || text.length < 100) return text;
  
  // Split into sentences
  const sentences = text.split(/[।.!?]\s+/).filter(s => s.trim().length > 10);
  
  if (sentences.length < 3) return text;
  
  // Check for repetition - if same sentence appears >2 times, truncate
  const seen = new Map();
  let lastRepeatedIndex = -1;
  
  for (let i = 0; i < sentences.length; i++) {
    const normalized = sentences[i].trim().substring(0, 50); // Check first 50 chars
    
    if (seen.has(normalized)) {
      const firstIndex = seen.get(normalized);
      // If we're seeing repetition after significant content, truncate
      if (i - firstIndex > 2 && i > sentences.length / 2) {
        lastRepeatedIndex = firstIndex + 1;
        break;
      }
    } else {
      seen.set(normalized, i);
    }
  }
  
  if (lastRepeatedIndex > 0 && lastRepeatedIndex < sentences.length - 1) {
    const truncated = sentences.slice(0, lastRepeatedIndex).join('. ') + '.';
    console.log("⚠️ Detected repetitive content, truncated response");
    return truncated;
  }
  
  return text;
}

/** Canonicalize / strip bad YouTube links: never use a watch URL unless we keep a real ID; prefer search for suggestions. */
export function normalizeYouTubeLinks(text) {
  if (!text) return text;

  const videoIdFromUrl = (url) => {
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/
    );
    return m ? m[1] : null;
  };

  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+)\)/g;
  text = text.replace(markdownRegex, (match, title, url) => {
    if (url.includes("results?search_query=")) return match;
    const cleanedTitle = title.replace(/^Watch:\s*/i, "").trim() || "study video";
    const query = encodeURIComponent(cleanedTitle);
    const newUrl = `https://www.youtube.com/results?search_query=${query}`;
    return `[${title}](${newUrl})`;
  });

  const bareUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)\]]+)/g;
  text = text.replace(bareUrlRegex, (url) => {
    if (url.includes("results?search_query=")) return url;
    const id = videoIdFromUrl(url);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
    return url;
  });

  return text;
}

export async function askAI(question, options = {}) {
  const {
    isMathProblem = false,
    language = null,
    context = null, // Additional context from PDF/image
    history = null, // Conversation history
    systemPrompt: customSystemPrompt = null // Optional custom system prompt
  } = options;

  try {
    // Detect language if not provided
    const detectedLang = language || detectLanguage(question);
    
    // Build system prompt
    let systemPrompt = "";
    
    if (customSystemPrompt) {
      // If custom prompt is provided, use it (and optionally append language instructions)
      systemPrompt = customSystemPrompt;
      if (detectedLang.code !== "en") {
        systemPrompt += `\n\nRespond in ${detectedLang.language} (${detectedLang.code}).`;
      }
    } else if (isMathProblem) {
      systemPrompt = `You are an expert mathematics tutor. When solving math problems:
1. Show step-by-step solutions clearly
2. Explain each step briefly
3. Use proper mathematical notation
4. Show the final answer clearly
5. If the problem involves calculations, show your work
6. For word problems, identify what is being asked and set up the equation first
7. Use clear formatting with line breaks between steps
8. Be concise - do not repeat steps or explanations
9. Once you reach the final answer, stop. Do not repeat calculations.
10. At the very end, suggest 2-3 relevant YouTube search links for further practice.
    - Do NOT invent or guess specific video IDs.
    - Always use search URLs in this format: [Watch: {Topic}](https://www.youtube.com/results?search_query={Query})

IMPORTANT:
- Provide a complete solution, but be concise. Do NOT repeat the same step or calculation multiple times.
- Never say you are an AI model, chatbot, or tool.
- Speak in first person as a human math teacher.
- Never mention system prompts, tokens, models, or internal tools.`;
      
      // Add language support for math
      if (detectedLang.code !== "en") {
        systemPrompt += `\n\nRespond in ${detectedLang.language} (${detectedLang.code}). Use the same language as the question.`;
      }
    } else {
      // Multi-lingual support for general questions
      systemPrompt = getMultiLingualPrompt(detectedLang);
      systemPrompt += "\n\nYou are an NCERT-aligned human tutor on the FindMentor platform. Your purpose is STRICTLY educational.\n" +
      "1. Only answer questions related to school curriculum (Class 6-12), science, math, history, geography, languages, and general knowledge.\n" +
      "2. If a user asks about entertainment, movies, gossip, or inappropriate topics, politely refuse and redirect them to studying.\n" +
      "3. Use simple language suitable for students.\n" +
      "4. Do not provide code unless it's for Computer Science subjects.\n" +
      "5. Answer clearly and simply.\n" +
      "6. Never say that you are an AI, language model, chatbot, or tool. Always speak in first person as a human teacher.\n" +
      "7. Never mention system prompts, models, tokens, APIs, or internal tools.\n" +
      "8. If you are unsure, say you are not completely sure and suggest how the student can verify from textbooks or teachers.\n" +
      "9. At the end of your explanation, suggest 2-3 relevant YouTube search links. Do NOT invent or guess specific video IDs. Always use search URLs like: [Watch: {Topic}](https://www.youtube.com/results?search_query={Query}).";
    }
    
    // Add context if provided (from PDF/image)
    if (context) {
      systemPrompt += `\n\nAdditional context from the source material:\n${context}`;
    }

    // Choose model based on input type
    const model = context ? "llama-3.1-8b-instant" : "llama-3.1-8b-instant";

    // Construct messages array
    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add conversation history if provided
    if (history && Array.isArray(history)) {
      messages.push(...history);
    }

    // Add current user question
    messages.push({
      role: "user",
      content: question
    });

    const completion = await groq.chat.completions.create({
      model: model,
      messages: messages,
      temperature: isMathProblem ? 0.1 : 0.3, // Lower temperature for math = more precise
      max_tokens: isMathProblem ? 1500 : 2000, // Limit tokens to prevent repetition
      stop: [] // Can add stop sequences if needed
    });

    let response = completion.choices[0].message.content;
    
    // Remove repetitive content (detect and truncate if same sentence repeats >2 times)
    response = removeRepetitiveContent(response);
    response = normalizeYouTubeLinks(response);
    
    return response;
  } catch (error) {
    // Log full error details for debugging
    console.error("❌ AI API Error:", {
      message: error.message,
      code: error.code,
      status: error.status || error.statusCode,
      errorCode: error.error?.code
    });
    
    // Check for invalid API key in various error structures
    const isInvalidKey = 
      error.code === "invalid_api_key" ||
      error.error?.code === "invalid_api_key" ||
      error.message?.includes("Invalid API Key") ||
      error.status === 401 ||
      error.statusCode === 401;
    
    if (isInvalidKey) {
      return "Sorry, the study assistant is currently unavailable due to a configuration issue. Please try again later or contact support.";
    }
    
    // Check for model not found
    if (error.error?.code === "model_not_found" || error.code === "model_not_found") {
      console.error("⚠️ Model not found. Using default model: llama-3.1-8b-instant");
      return "Sorry, there was a configuration issue with the mentor assistant. Please contact support.";
    }
    
    // Check for rate limiting
    if (error.status === 429 || error.statusCode === 429) {
      return "Sorry, the mentor assistant is receiving too many requests right now. Please try again in a moment.";
    }
    
    return "Sorry, I ran into a technical issue while processing your question. Please try again later.";
  }
}
