export const EXPLANATION_WORD_LIMIT = 220;
export const EXPLANATION_MAX_OUTPUT_TOKENS = 1400;
export const EXPLANATION_RETRY_MAX_OUTPUT_TOKENS = 2200;

export const buildExplainSystemInstruction = (
  contextTitle?: string,
): string => `
  אתה מנטור אלגוריתמים מומחה ומראיין הייטק בכיר.
  המשתמש סימן קטע טקסט שהוא לא הבין מתוך מדריך הכנה לראיונות הייטק.
  הנושא הכללי של הקטע הוא: ${contextTitle || "אלגוריתמים לראיונות"}.

  ענה בעברית רהוטה, מקצועית ובגובה העיניים.
  המטרה היא לתת הסבר ממוקד שמספיק להבנה ראשונית, לא מדריך מלא.
  אל תכתוב מדריך מלא ואל תוסיף הרחבות צדדיות.
  אל תפתח במילות אישור כמו "הבנתי", "בטח", "כמובן" או "בשמחה".
  התחל ישירות בכותרת או במשפט ההסבר הראשון.
  שמור על תשובה קצרה: עד ${EXPLANATION_WORD_LIMIT} מילים.

  השתמש במבנה הבא:
  1. **הרעיון בקצרה** - 2-3 משפטים פשוטים, אפשר עם אנלוגיה קצרה.
  2. **למה זה חשוב בראיונות** - 1-2 משפטים על מה המראיין מחפש.
  3. **דוגמה קטנה** - מקרה קצר מאוד או 3-4 צעדים תמציתיים.

  עצב את התשובה ב-Markdown ברור עם כותרות קצרות.
`;

export const buildExplainGenerationConfig = (retry = false) => ({
  maxOutputTokens: retry ? EXPLANATION_RETRY_MAX_OUTPUT_TOKENS : EXPLANATION_MAX_OUTPUT_TOKENS,
  thinkingConfig: {
    thinkingBudget: 0,
  },
});

export const isExplanationTruncated = (response: any): boolean =>
  response?.candidates?.[0]?.finishReason === "MAX_TOKENS";

export const ensureExplanationComplete = (response: any): void => {
  if (isExplanationTruncated(response)) {
    throw new Error("Gemini returned a truncated explanation after retry");
  }
};

export const stripLeadingAcknowledgement = (text: string): string =>
  text
    .replace(/^\s*(הבנתי|בטח|כמובן|בשמחה|אין בעיה)[\s,.!־-]+/u, "")
    .trimStart();
