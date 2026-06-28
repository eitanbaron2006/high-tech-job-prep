import { NextResponse } from "next/server";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

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
    const { operationName } = await req.json();
    if (!operationName) {
      return NextResponse.json({ error: "operationName is required" }, { status: 400 });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      return NextResponse.json({ error: "Video URI not available yet or operation failed" }, { status: 400 });
    }

    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!videoRes.ok) {
      return NextResponse.json({ error: "Failed to download video from Google servers" }, { status: videoRes.status });
    }

    const buffer = await videoRes.arrayBuffer();
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
      },
    });
  } catch (error: any) {
    console.error("Error in video-download:", error);
    return NextResponse.json({ error: error.message || "Failed to download generated video" }, { status: 500 });
  }
}
