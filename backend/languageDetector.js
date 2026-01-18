/**
 * Language Detection and Multi-lingual Support
 */

// Common language patterns
const LANGUAGE_PATTERNS = {
  hindi: {
    patterns: [/[\u0900-\u097F]/], // Devanagari script
    name: "Hindi",
    code: "hi"
  },
  english: {
    patterns: [/^[a-zA-Z\s]+$/],
    name: "English",
    code: "en"
  },
  bengali: {
    patterns: [/[\u0980-\u09FF]/],
    name: "Bengali",
    code: "bn"
  },
  telugu: {
    patterns: [/[\u0C00-\u0C7F]/],
    name: "Telugu",
    code: "te"
  },
  tamil: {
    patterns: [/[\u0B80-\u0BFF]/],
    name: "Tamil",
    code: "ta"
  },
  gujarati: {
    patterns: [/[\u0A80-\u0AFF]/],
    name: "Gujarati",
    code: "gu"
  },
  kannada: {
    patterns: [/[\u0C80-\u0CFF]/],
    name: "Kannada",
    code: "kn"
  },
  malayalam: {
    patterns: [/[\u0D00-\u0D7F]/],
    name: "Malayalam",
    code: "ml"
  },
  marathi: {
    patterns: [/[\u0900-\u097F]/], // Same script as Hindi, detect by context
    name: "Marathi",
    code: "mr"
  },
  punjabi: {
    patterns: [/[\u0A00-\u0A7F]/],
    name: "Punjabi",
    code: "pa"
  },
  urdu: {
    patterns: [/[\u0600-\u06FF]/], // Arabic script
    name: "Urdu",
    code: "ur"
  }
};

export function detectLanguage(text) {
  if (!text || typeof text !== "string") {
    return { language: "english", code: "en", confidence: 0 };
  }

  const scores = {};
  
  // Check each language pattern
  for (const [lang, config] of Object.entries(LANGUAGE_PATTERNS)) {
    let matches = 0;
    for (const pattern of config.patterns) {
      const matchesInText = (text.match(pattern) || []).length;
      matches += matchesInText;
    }
    if (matches > 0) {
      scores[lang] = matches;
    }
  }

  // If no matches, default to English
  if (Object.keys(scores).length === 0) {
    return { language: "english", code: "en", confidence: 0.5 };
  }

  // Find language with highest score
  const detectedLang = Object.keys(scores).reduce((a, b) => 
    scores[a] > scores[b] ? a : b
  );

  const config = LANGUAGE_PATTERNS[detectedLang];
  const confidence = Math.min(scores[detectedLang] / text.length, 1);

  return {
    language: config.name,
    code: config.code,
    confidence
  };
}

export function getMultiLingualPrompt(detectedLanguage) {
  const languageName = detectedLanguage.language || "English";
  
  return `You are an educational AI assistant. The user is asking in ${languageName}. 
Please respond in the SAME language (${languageName}) that the user used.

Important:
- If the question is in ${languageName}, answer in ${languageName}
- If the question is in English, answer in English
- Maintain the same language throughout your response
- For technical terms, you can use English terms but explain in ${languageName}
- Be clear, educational, and helpful in ${languageName}`;
}
