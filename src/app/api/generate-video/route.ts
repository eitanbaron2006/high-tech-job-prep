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
    const { prompt, aspectRatio } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "No prompt specified for video" }, { status: 400 });
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

    return NextResponse.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Error in generate-video:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate video generation" }, { status: 500 });
  }
}
