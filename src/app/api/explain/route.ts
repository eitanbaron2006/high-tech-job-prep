import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export async function POST(req: Request) {
  try {
    const { selectedText, contextTitle } = await req.json();
    if (!selectedText) {
      return NextResponse.json({ error: "No text selected" }, { status: 400 });
    }

    const systemInstruction = `
      אתה מנטור אלגוריתמים מומחה ומראיין הייטק בכיר.
      המשתמש סימן קטע טקסט שהוא לא הבין מתוך מדריך הכנה לראיונות הייטק, ומבקש הסבר פשוט, ידידותי, מעשי וברור יותר.
      הנושא הכללי של הקטע הוא: ${contextTitle || "אלגוריתמים לראיונות"}.
      
      ענה בעברית רהוטה ומקצועית, אך בגובה העיניים ובסגנון מעודד.
      השתמש במבנה הבא:
      1. **הסבר פשוט ואינטואיטיבי (ללא קוד)** - השתמש באנלוגיה מחיי היומיום כדי להסביר את הרעיון.
      2. **למה זה חשוב בראיונות** - מה המראיין מחפש לראות כשהוא שואל על זה.
      3. **דוגמה מעשית/פרקטית** - הסבר קצר של צעד אחר צעד על מקרה פשוט.
      
      עצב את התשובה בצורת Markdown יפה עם כותרות ברורות ורווחים.
    `;

    const prompt = `הטקסט שסימנתי ולא הבנתי הוא:\n"${selectedText}"\nאנא הסבר לי אותו בצורה ברורה וידידותית יותר.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    return NextResponse.json({ explanation: response.text });
  } catch (error: any) {
    console.error("Error in explain:", error);
    return NextResponse.json({ error: error.message || "Failed to generate explanation" }, { status: 500 });
  }
}
