import { NextResponse } from "next/server";
import { ai, getModelName } from "../../../lib/gemini";

export async function POST(req: Request) {
  try {
    const { messages, highThinking } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    let systemInstruction = `
      אתה "אלגו-באדי" (AlgoBuddy) - צ'אט בוט חכם, ידידותי ומקצועי המלווה את המשתמש בלמידת אלגוריתמים לראיונות הייטק.
      תפקידך:
      - לענות על שאלות בנושא 8 התבניות שבמדריך (שני מצביעים, חלון מחליק, מפת גיבוב, BFS/DFS, תכנון דינמי, ערימה, חיפוש בינארי, מחסנית מונוטונית).
      - לספק טיפים מעשיים לסימולציות ראיונות בזמן אמת.
      - לעזור למשתמש לפתור בעיות, לתרגל חשיבה בקול רם, ולפתח אסטרטגיות זיהוי תבניות.
      - תמיד לענות בעברית תומכת, מעצימה ובגובה העיניים.
      - כשהמשתמש מבקש "סימולציה", שאל אותו שאלה מתוך הראיונות (כמו Two Sum, Binary Search, Coin Change, וכו') והנחה אותו צעד אחר צעד לפתור אותה תוך מתן פידבק בונה על הסיבוכיות והחשיבה שלו.
    `;

    if (highThinking) {
      systemInstruction += `
      - המשתמש הפעיל "מצב חשיבה גבוהה" (Gemini Pro / High Reasoning).
      - עליך לספק תשובות מעמיקות, מפורטות ומנותחות בצורה יסודית במיוחד.
      - בצע חשיבה מעמיקה שלב-אחר-שלב (Chain of Thought), נתח מקרי קצה פוטנציאליים, והשווה בין גישות פתרון שונות (למשל, יעילות זמן מול זיכרון, יתרונות וחסרונות של כל גישה).
      `;
    }

    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: getModelName("gemini-2.5-flash"),
      contents: contents,
      config: {
        systemInstruction,
      },
    });

    return NextResponse.json({ response: response.text });
  } catch (error: any) {
    console.error("Error in chat:", error);
    return NextResponse.json({ error: error.message || "Chat response failed" }, { status: 500 });
  }
}
