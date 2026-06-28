import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

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
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided for TTS" }, { status: 400 });
    }

    const cleanText = text
      .replace(/[*_#`~[\]()]/g, "")
      .replace(/<[^>]*>/g, "")
      .substring(0, 1000); 

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
      return NextResponse.json({ audio: base64Audio });
    } else {
      return NextResponse.json({ error: "Failed to generate voice output. No audio stream returned." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in tts:", error);
    return NextResponse.json({ error: error.message || "TTS speech generation failed" }, { status: 500 });
  }
}
