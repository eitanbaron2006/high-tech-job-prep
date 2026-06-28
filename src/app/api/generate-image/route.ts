import { NextResponse } from "next/server";
import { getAiClient, getModelName } from "../../../lib/gemini";

export async function POST(req: Request) {
  try {
    const { prompt, size } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "No prompt specified for image" }, { status: 400 });
    }

    const resolvedSize = size === "4K" ? "4K" : size === "2K" ? "2K" : "1K";
    
    // The exact prompt that the user liked and tested on the Gemini website
    const imagePrompt = `A professional, clean, and modern educational infographic diagram explaining the computer science concept: "${prompt}". 
The diagram should use clean visual metaphors, flow arrows, and simple geometric shapes. 
All text labels on the diagram must be real, correctly spelled English words (such as "Input", "Output", "Process", "Storage", "Unique", "Duplicate", "Server", "Client", "Database"). 
CRITICAL: Do NOT generate any gibberish characters, fake words, or nonsense letters. If you write text, it must be short, clear, and perfectly spelled English words. 
Style: Minimalist, white background, flat design, professional tech illustration, color palette of orange, grey, and dark blue. High contrast, extremely clean, no clutter.`;

    let base64Image = "";
    let foundImage = false;

    // 1. Try Vertex AI
    try {
      const client = getAiClient(false); // Try Vertex AI
      const response = await client.models.generateImages({
        model: getModelName("imagen-3.0-generate-002", false),
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/png",
          aspectRatio: "16:9",
        },
      });

      const imgBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (imgBytes) {
        base64Image = imgBytes;
        foundImage = true;
      }
    } catch (vertexErr: any) {
      console.warn("[Image Generation] Vertex AI failed, falling back to AI Studio. Error:", vertexErr.message || vertexErr);
      
      // 2. Fallback to AI Studio
      const client = getAiClient(true); // Force AI Studio
      const response = await client.models.generateImages({
        model: "imagen-3.0-generate-002", // AI Studio Imagen 3 model
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/png",
          aspectRatio: "16:9",
        },
      });

      const imgBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (imgBytes) {
        base64Image = imgBytes;
        foundImage = true;
      }
    }

    if (foundImage && base64Image) {
      return NextResponse.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      return NextResponse.json({ error: "No image was generated" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in generate-image:", error);
    let friendlyMessage = error.message || "Failed to generate diagram image";
    if (
      friendlyMessage.includes("Quota exceeded") || 
      friendlyMessage.includes("429") || 
      friendlyMessage.includes("billing") ||
      friendlyMessage.includes("limit: 0")
    ) {
      const isVertex = process.env.USE_VERTEX_AI === "true" || !!process.env.VERTEX_PROJECT_ID;
      friendlyMessage = isVertex
        ? "חריגה ממכסת יצירת התמונות ב-Vertex AI או ב-AI Studio. אנא ודא שהפעלת את ה-API של Imagen בפרויקט שלך ושמכסת ה-Quota מאפשרת יצירת תמונות."
        : "חריגה ממכסת יצירת התמונות החינמית של גוגל (Imagen 3). כדי לאפשר יצירת תרשימים ויזואליים, יש להפעיל חיוב (Billing) בחשבון ה-Google AI Studio שלך.";
    }
    return NextResponse.json({ error: friendlyMessage }, { status: 500 });
  }
}
