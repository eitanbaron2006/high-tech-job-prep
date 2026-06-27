import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, GenerateVideosOperation } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI with required agent header for telemetry
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json({ limit: "50mb" }));

// 1. SELECTIVE EXPLANATION (אני לא מבין)
app.post("/api/explain", async (req, res) => {
  try {
    const { selectedText, contextTitle } = req.body;
    if (!selectedText) {
      return res.status(400).json({ error: "No text selected" });
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
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    res.json({ explanation: response.text });
  } catch (error: any) {
    console.error("Error in explain:", error);
    res.status(500).json({ error: error.message || "Failed to generate explanation" });
  }
});

// 2. TEXT-TO-SPEECH (TTS)
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided for TTS" });
    }

    // Clean markdown bold symbols and brackets to make the spoken text smoother
    const cleanText = text
      .replace(/[*_#`~[\]()]/g, "")
      .replace(/<[^>]*>/g, "")
      .substring(0, 1000); // safety length limit for speech

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say clearly in a professional and friendly tone: ${cleanText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.status(500).json({ error: "Failed to generate voice output. No audio stream returned." });
    }
  } catch (error: any) {
    console.error("Error in tts:", error);
    res.status(500).json({ error: error.message || "TTS speech generation failed" });
  }
});

// 3. MULTI-TURN COMPANION CHAT (WITH REAL-TIME INTERVIEW SIMULATION & TIPS)
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, highThinking } = req.body; // Array of { role: 'user'|'model', text: string }, highThinking flag
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
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

    // Map frontend formats to SDK parts
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
      },
    });

    res.json({ response: response.text });
  } catch (error: any) {
    console.error("Error in chat:", error);
    res.status(500).json({ error: error.message || "Chat response failed" });
  }
});

// 4. IMAGE GENERATION (Drawn practice explanation diagrams)
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, size } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No prompt specified for image" });
    }

    const resolvedSize = size === "4K" ? "4K" : size === "2K" ? "2K" : "1K";

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          {
            text: `Create a clean, beautiful, educational concept diagram explaining the computer science / software engineering algorithm practice: ${prompt}. Style: modern, minimal, white background, orange color accents, high-contrast, technical diagram, easy to read, visual explanation.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: resolvedSize,
        },
      },
    });

    let foundImage = false;
    let base64Image = "";

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          foundImage = true;
          break;
        }
      }
    }

    if (foundImage && base64Image) {
      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      res.status(500).json({ error: "No image part returned in response candidates" });
    }
  } catch (error: any) {
    console.error("Error in generate-image:", error);
    res.status(500).json({ error: error.message || "Failed to generate diagram image" });
  }
});

// 5. VEO 3 VIDEO GENERATION (3-step API pattern)
// Step 1: Start Operation
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No prompt specified for video" });
    }

    const resolvedAspectRatio = aspectRatio === "9:16" ? "9:16" : "16:9";

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: `An elegant software engineering tutorial video about: ${prompt}. Minimalistic whiteboard style, simple clean animation detailing the algorithm with orange and black accents. Highly professional.`,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: resolvedAspectRatio,
      },
    });

    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Error in generate-video:", error);
    res.status(500).json({ error: error.message || "Failed to initiate video generation" });
  }
});

// Step 2: Poll Status
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({ done: updated.done });
  } catch (error: any) {
    console.error("Error in video-status:", error);
    res.status(500).json({ error: error.message || "Failed to check video status" });
  }
});

// Step 3: Stream Download Video (proxied to avoid exposed key / headers)
app.post("/api/video-download", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      return res.status(400).json({ error: "Video URI not available yet or operation failed" });
    }

    // Fetch the binary video stream from Gemini
    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: "Failed to download video from Google servers" });
    }

    res.setHeader("Content-Type", "video/mp4");
    
    // Pipe response stream in standard node-friendly chunking
    const reader = videoRes.body;
    if (reader) {
      // In node v18+ fetch body is a ReadableStream, we can convert it to Node readable or pipe it directly
      // Or simply pipe via buffer stream or consume arrayBuffer for simpler code:
      const buffer = await videoRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      res.status(500).json({ error: "Empty video stream" });
    }
  } catch (error: any) {
    console.error("Error in video-download:", error);
    res.status(500).json({ error: error.message || "Failed to download generated video" });
  }
});

// Setup dev vs production server
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
