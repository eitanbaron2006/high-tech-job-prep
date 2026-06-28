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
    return NextResponse.json({ done: updated.done });
  } catch (error: any) {
    console.error("Error in video-status:", error);
    return NextResponse.json({ error: error.message || "Failed to check video status" }, { status: 500 });
  }
}
