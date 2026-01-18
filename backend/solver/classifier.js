export function classifyMathQuestion(question) {
  const q = question.toLowerCase();

  // Math keywords and patterns
  const mathKeywords = [
    "solve", "calculate", "find", "compute", "evaluate", "simplify",
    "equation", "inequality", "derivative", "integral", "limit", "matrix",
    "polynomial", "quadratic", "linear", "trigonometry", "geometry",
    "algebra", "calculus", "statistics", "probability", "fraction",
    "percentage", "ratio", "proportion", "area", "volume", "perimeter",
    "angle", "triangle", "circle", "square", "rectangle", "graph",
    "function", "logarithm", "exponential", "sin", "cos", "tan"
  ];

  // Math symbols
  const mathSymbols = [
    "+", "-", "*", "/", "=", "≠", "<", ">", "≤", "≥", "√", "²", "³",
    "∫", "∑", "π", "∞", "θ", "α", "β", "γ", "Δ", "∂", "∇"
  ];

  // Check for math keywords
  const hasMathKeyword = mathKeywords.some(keyword => q.includes(keyword));
  
  // Check for math symbols
  const hasMathSymbol = mathSymbols.some(symbol => question.includes(symbol));
  
  // Check for numbers with operations
  const hasMathExpression = /[\d+\-*/=()²³√∫∑]/.test(question);
  
  // Check for variables (x, y, z, a, b, c, etc.)
  const hasVariables = /[a-z]\s*[=+\-*/]|[=+\-*/]\s*[a-z]|\b(x|y|z|a|b|c|n|m|t)\b/i.test(question);

  if (hasMathKeyword || hasMathSymbol || (hasMathExpression && hasVariables)) {
    // Determine specific type if possible
    if (q.includes("∫") || q.includes("integrate") || q.includes("integration")) {
      return "integrals";
    }
    if (q.includes("derivative") || q.includes("differentiate") || q.includes("d/dx")) {
      return "calculus";
    }
    if (q.includes("matrix") || q.includes("determinant")) {
      return "linear_algebra";
    }
    if (q.includes("trig") || q.includes("sin") || q.includes("cos") || q.includes("tan")) {
      return "trigonometry";
    }
    if (q.includes("geometry") || q.includes("area") || q.includes("volume") || q.includes("perimeter")) {
      return "geometry";
    }
    if (q.includes("probability") || q.includes("statistics")) {
      return "statistics";
    }
    return "math"; // General math problem
  }

  return "unknown";
}
