export function formatAnswer(data) {
  // If it's already a string (from AI), return as is
  if (typeof data === "string") {
    return data;
  }

  // If it's a dataset result object
  if (data.found && data.answer) {
    let formatted = data.answer;
    
    if (data.class) {
      formatted = `[Class ${data.class}] ${formatted}`;
    }
    
    if (data.subject) {
      formatted = `${formatted}\n\nSubject: ${data.subject}`;
    }
    
    if (data.chapter) {
      formatted = `${formatted}\nChapter: ${data.chapter}`;
    }
    
    return formatted;
  }

  // If it's a solver result with steps
  if (data.steps && Array.isArray(data.steps)) {
    let formatted = "**Solution Steps:**\n\n";
    data.steps.forEach((step, index) => {
      formatted += `${index + 1}. ${step}\n`;
    });
    
    if (data.answer) {
      formatted += `\n**Answer:** ${data.answer}`;
    }
    
    return formatted;
  }

  // If it has an answer property
  if (data.answer) {
    return data.answer;
  }

  // Fallback: stringify the object
  return JSON.stringify(data, null, 2);
}
