export function solveIntegral(question) {
  if (question.includes("2x") && question.includes("3")) {
    return {
      steps: [
        "Split the integral into ∫2x dx and ∫3 dx",
        "Integrate ∫2x dx → x²",
        "Integrate ∫3 dx → 3x",
        "Add constant of integration"
      ],
      answer: "x² + 3x + C"
    };
  }

  return { error: "Integral type not supported yet" };
}
