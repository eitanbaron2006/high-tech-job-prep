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

function addWavHeader(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;
  
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // 1 = PCM
  header.writeUInt16LE(1, 22); // 1 = Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); // 16-bit mono = 2 bytes
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  
  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided for TTS" }, { status: 400 });
    }

    const cleanText = text
      .replace(/[*_#`~[\]()]/g, "")
      .replace(/<[^>]*>/g, "")
      .substring(0, 5000); // safety length limit for speech

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

    let base64Audio = "";
    let mimeType = "audio/L16;codec=pcm;rate=24000";

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Audio = part.inlineData.data;
          mimeType = part.inlineData.mimeType || mimeType;
          break;
        }
      }
    }

    if (base64Audio) {
      // Parse sample rate from mimeType (usually 24000)
      let sampleRate = 24000;
      const rateMatch = mimeType.match(/rate=(\d+)/);
      if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10);
      }

      // Convert raw PCM to WAV
      const pcmBuffer = Buffer.from(base64Audio, "base64");
      const wavBuffer = addWavHeader(pcmBuffer, sampleRate);
      const wavBase64 = wavBuffer.toString("base64");

      return NextResponse.json({ audio: wavBase64, mimeType: "audio/wav" });
    } else {
      return NextResponse.json({ error: "Failed to generate voice output. No audio stream returned." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in tts:", error);
    return NextResponse.json({ error: error.message || "TTS speech generation failed" }, { status: 500 });
  }
}
