/**
 * PDF Processing and Text Extraction
 */

import fs from "fs";

/**
 * Extract text from PDF file
 * Note: Requires pdf-parse package
 */
export async function extractTextFromPDF(pdfPath) {
  try {
    // Dynamic import to handle optional dependency
    const pdfParse = await import("pdf-parse").catch(() => null);
    
    if (!pdfParse || !pdfParse.default) {
      throw new Error("pdf-parse package not installed. Run: npm install pdf-parse");
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse.default(dataBuffer);
    
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error("❌ PDF extraction error:", error.message);
    return {
      success: false,
      error: error.message,
      text: null
    };
  }
}

/**
 * Extract text from PDF buffer (for uploaded files)
 */
export async function extractTextFromPDFBuffer(pdfBuffer) {
  try {
    const pdfParse = await import("pdf-parse").catch(() => null);
    
    if (!pdfParse || !pdfParse.default) {
      throw new Error("pdf-parse package not installed. Run: npm install pdf-parse");
    }

    const data = await pdfParse.default(pdfBuffer);
    
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error("❌ PDF extraction error:", error.message);
    return {
      success: false,
      error: error.message,
      text: null
    };
  }
}

/**
 * Extract questions/problems from PDF text
 */
export function extractQuestionsFromPDF(text) {
  const questions = [];
  const lines = text.split('\n');
  
  let currentQuestion = "";
  let questionNumber = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect question patterns
    if (/^\d+[\.\)]/.test(trimmed) || 
        trimmed.toLowerCase().includes("question") ||
        trimmed.includes("?") ||
        trimmed.toLowerCase().includes("solve") ||
        trimmed.toLowerCase().includes("find")) {
      
      if (currentQuestion) {
        questions.push({
          number: questionNumber++,
          text: currentQuestion.trim()
        });
      }
      currentQuestion = trimmed;
    } else if (currentQuestion && trimmed.length > 0) {
      currentQuestion += " " + trimmed;
    }
  }
  
  // Add last question
  if (currentQuestion) {
    questions.push({
      number: questionNumber++,
      text: currentQuestion.trim()
    });
  }
  
  return questions;
}
