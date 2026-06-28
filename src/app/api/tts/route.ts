import { NextResponse } from "next/server";
import { getAiClient } from "../../../lib/gemini";
import { Communicate } from "edge-tts-universal";
import {
  buildGeminiTtsAttempts,
  extractAudioFromGenerateContentResponse,
} from "./tts-helpers";

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
    const { text, provider } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided for TTS" }, { status: 400 });
    }

    const cleanText = text
      .replace(/[*_#`~[\]()]/g, "")
      .replace(/<[^>]*>/g, "")
      .substring(0, 5000); // safety length limit for speech

    if (provider === "edge") {
      let chunks: any[] = [];
      const attempts = 3;
      let delayMs = 150;

      // Check if text has any alphanumeric characters (Hebrew, English, Numbers)
      const hasAlphaNumeric = /[a-zA-Z0-9\u0590-\u05FF]/.test(cleanText);
      if (!hasAlphaNumeric) {
        return NextResponse.json({ audio: "", mimeType: "audio/mpeg" });
      }

      console.log(`[Edge TTS] Synthesizing chunk: "${cleanText}"`);

      for (let i = 0; i < attempts; i++) {
        try {
          const comm = new Communicate(cleanText, {
            voice: "he-IL-HilaNeural",
          });

          chunks = [];
          for await (const chunk of comm.stream()) {
            if (chunk.type === "audio") {
              chunks.push(chunk.data);
            }
          }

          if (chunks.length > 0) {
            break; // Success
          }
        } catch (streamErr) {
          console.warn(`[Edge TTS] Attempt ${i + 1} failed for "${cleanText}":`, streamErr);
          if (i === attempts - 1) {
            // Return empty audio so the client can skip it gracefully
            return NextResponse.json({ audio: "", mimeType: "audio/mpeg" });
          }
          await new Promise((res) => setTimeout(res, delayMs));
          delayMs *= 2; // Exponential backoff
        }
      }

      const buffer = Buffer.concat(chunks);
      const base64Audio = buffer.toString("base64");

      return NextResponse.json({ audio: base64Audio, mimeType: "audio/mpeg" });
    }

    // Default: Gemini TTS
    try {
      let base64Audio = "";
      let mimeType = "audio/L16;codec=pcm;rate=24000";
      let lastGeminiError: any = null;
      const attempts = buildGeminiTtsAttempts();

      if (attempts.length === 0) {
        throw new Error("No Gemini TTS credentials configured");
      }

      for (const attempt of attempts) {
        const label = attempt.provider === "ai-studio" ? "AI Studio" : "Vertex AI";
        try {
          const client = getAiClient(attempt.provider === "ai-studio");
          const response = await client.models.generateContent({
            model: attempt.model,
            contents: [
              {
                role: "user",
                parts: [{ text: cleanText }],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede",
                  },
                },
              },
            },
          });

          const audio = extractAudioFromGenerateContentResponse(response);
          if (audio) {
            base64Audio = audio.base64Audio;
            mimeType = audio.mimeType;
            break;
          }

          throw new Error(`No audio stream returned from ${label} Gemini TTS`);
        } catch (err: any) {
          lastGeminiError = err;
          console.warn(`[TTS] ${label} Gemini TTS failed. Error:`, err.message || err);
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
        throw lastGeminiError || new Error("No audio stream returned from Gemini TTS");
      }
    } catch (geminiError: any) {
      console.warn("[TTS] Gemini TTS failed on both clients, falling back to Edge TTS. Error:", geminiError.message || geminiError);
      
      // FALLBACK TO EDGE TTS
      let chunks: any[] = [];
      const attempts = 3;
      let delayMs = 150;

      // Check if text has any alphanumeric characters (Hebrew, English, Numbers)
      const hasAlphaNumeric = /[a-zA-Z0-9\u0590-\u05FF]/.test(cleanText);
      if (!hasAlphaNumeric) {
        return NextResponse.json({ audio: "", mimeType: "audio/mpeg" });
      }

      console.log(`[Edge TTS Fallback] Synthesizing chunk: "${cleanText}"`);

      for (let i = 0; i < attempts; i++) {
        try {
          const comm = new Communicate(cleanText, {
            voice: "he-IL-HilaNeural",
          });

          chunks = [];
          for await (const chunk of comm.stream()) {
            if (chunk.type === "audio") {
              chunks.push(chunk.data);
            }
          }

          if (chunks.length > 0) {
            break; // Success
          }
        } catch (streamErr) {
          console.warn(`[Edge TTS Fallback] Attempt ${i + 1} failed for "${cleanText}":`, streamErr);
          if (i === attempts - 1) {
            return NextResponse.json({ audio: "", mimeType: "audio/mpeg" });
          }
          await new Promise((res) => setTimeout(res, delayMs));
          delayMs *= 2;
        }
      }

      const buffer = Buffer.concat(chunks);
      const base64Audio = buffer.toString("base64");

      return NextResponse.json({ audio: base64Audio, mimeType: "audio/mpeg", fallback: true });
    }
  } catch (error: any) {
    console.error("Error in tts:", error);
    return NextResponse.json({ error: error.message || "TTS speech generation failed" }, { status: 500 });
  }
}
