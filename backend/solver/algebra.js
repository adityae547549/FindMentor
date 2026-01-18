export function solveAlgebra(question) {
  const match = question.replace(/\s+/g, "")
    .match(/(\d+)x-(\d+)=(\d+)/);

  if (!match) {
    return { error: "Algebra format not supported yet" };
  }

  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = Number(match[3]);

  return {
    steps: [
      `Given equation: ${a}x - ${b} = ${c}`,
      `Add ${b} to both sides`,
      `${a}x = ${c + b}`,
      `Divide both sides by ${a}`
    ],
    answer: `x = ${(c + b) / a}`
  };
}
