import { searchData } from "./dataloader.js";
import { askAI } from "./aiClient.js";
import { formatAnswer } from "./aiFormatter.js";
import { classifyMathQuestion } from "./solver/classifier.js";
import { solveAlgebra } from "./solver/algebra.js";
import { solveIntegral } from "./solver/integrals.js";
import { detectLanguage } from "./languageDetector.js";
import { findLearnedAnswer, learnAnswer } from "./learningSystem.js";

export async function resolveQuery(question, options = {}) {
  const { context = null, language = null, skipMath = false, history = null, systemPrompt = null } = options;
  
  // 0️⃣ Check Learned Memory (Self-Learning)
  // Only check memory if no specific context is provided (generic questions)
  if (!context) {
      const learned = findLearnedAnswer(question);
      if (learned) {
          console.log(`🧠 Memory Hit: "${question.substring(0,20)}..."`);
          return {
              success: true,
              source: "memory",
              answer: learned.answer
          };
      }
  }

  // 1️⃣ Try dataset first
  const result = searchData(question);

  if (result.found) {
    return {
      success: true,
      source: "dataset",
      answer: formatAnswer(result)
    };
  }

  // 2️⃣ Check if it's a math question (unless skipped)
  let isMathProblem = false;
  let mathType = "unknown";

  if (!skipMath) {
      mathType = classifyMathQuestion(question);
      isMathProblem = mathType !== "unknown";
  }
  
  // Try specialized solvers first (if available)
  if (mathType === "algebra") {
    const solution = solveAlgebra(question);
    if (!solution.error) {
      return {
        success: true,
        source: "solver",
        type: "algebra",
        answer: formatAnswer(solution)
      };
    }
  } else if (mathType === "integrals") {
    const solution = solveIntegral(question);
    if (!solution.error) {
      return {
        success: true,
        source: "solver",
        type: "integrals",
        answer: formatAnswer(solution)
      };
    }
  }

  // 3️⃣ If it's a math problem, use AI with math-specific prompt
  // Otherwise, try dataset and then AI
  if (isMathProblem) {
    console.log(`🔢 Math problem detected (${mathType}) — using AI math solver`);
    try {
      const detectedLang = language || detectLanguage(question);
      const aiAnswer = await askAI(question, {
        isMathProblem: true,
        language: detectedLang,
        context,
        history
      });
      
      if (aiAnswer && aiAnswer.includes("Sorry")) {
        return {
          success: false,
          source: "ai",
          error: aiAnswer,
          message: "Math solver unavailable. Please check your API configuration."
        };
      }

      return {
        success: true,
        source: "ai_math",
        type: mathType,
        answer: formatAnswer(aiAnswer)
      };
    } catch (error) {
      console.error("❌ Error in math solving:", error.message);
      return {
        success: false,
        source: "ai_math",
        error: error.message,
        message: "Unable to solve the math problem. Please try again or rephrase your question."
      };
    }
  }

  // 4️⃣ Dataset and solver failed → fallback to AI (non-math)
  console.log("⚠️ Dataset and solver miss — switching to AI");

  try {
    const detectedLang = language || detectLanguage(question);
    const aiAnswer = await askAI(question, {
      isMathProblem: false,
      language: detectedLang,
      context,
      history
    });
    
    // Check if AI returned an error message
    if (aiAnswer && aiAnswer.includes("Sorry")) {
      return {
        success: false,
        source: "ai",
        error: aiAnswer,
        message: "AI service unavailable. Please try a different question or check your API configuration."
      };
    }

    // Learn this answer (if no context was provided, it's general knowledge)
    if (!context && !history) {
        learnAnswer(question, aiAnswer, "ai");
    }

    return {
      success: true,
      source: "ai",
      answer: formatAnswer(aiAnswer)
    };
  } catch (error) {
    console.error("❌ Error in query resolution:", error.message);
    return {
      success: false,
      source: "ai",
      error: error.message,
      message: "Unable to process your question. Please try again or rephrase your question."
    };
  }
}
