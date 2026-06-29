import { NextResponse } from "next/server";
import { ai, getModelName } from "../../../lib/gemini";
import { generateEducationalImage } from "../../../lib/imageGen";

const IMAGE_MARKER = "@@IMAGE@@";

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

      יצירת תמונות:
      - אם — ורק אם — המשתמש מבקש במפורש תמונה / איור / אינפוגרפיקה / תרשים / דיאגרמה / "צייר" / "צור תמונה" / "הראה לי ויזואלית", אל תכתוב תשובה טקסטואלית רגילה.
      - במקרה כזה החזר שורה אחת בלבד, בדיוק בפורמט הזה: ${IMAGE_MARKER} <תיאור קצר וברור באנגלית של התמונה שצריך לצייר>. בלי שום טקסט נוסף לפני או אחרי.
      - בכל מקרה אחר (שאלות, הסברים, סימולציות) — ענה כרגיל בעברית, ואל תשתמש בסימון הזה.
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

    const text = (response.text || "").trim();

    // The model signalled that the user asked for a visual — generate it.
    if (text.startsWith(IMAGE_MARKER)) {
      const lastUserText = [...messages].reverse().find((m: any) => m.role !== "assistant")?.text || "";
      const imagePrompt = text.slice(IMAGE_MARKER.length).trim() || lastUserText;
      try {
        const imageUrl = await generateEducationalImage(imagePrompt);
        return NextResponse.json({ type: "image", imageUrl, prompt: imagePrompt });
      } catch (imgErr: any) {
        console.error("Error generating chat image:", imgErr);
        return NextResponse.json({
          response:
            "מצטער, לא הצלחתי ליצור את התמונה כרגע. ייתכן שמכסת יצירת התמונות מוצתה או שמודל התמונה אינו זמין בפרויקט. נסה שוב או נסח את הבקשה אחרת.",
        });
      }
    }

    return NextResponse.json({ response: text });
  } catch (error: any) {
    console.error("Error in chat:", error);
    return NextResponse.json({ error: error.message || "Chat response failed" }, { status: 500 });
  }
}
