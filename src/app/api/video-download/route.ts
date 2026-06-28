import { NextResponse } from "next/server";
import { ai } from "../../../lib/gemini";
import { GenerateVideosOperation } from "@google/genai";
import { GoogleAuth } from "google-auth-library";

export async function POST(req: Request) {
  try {
    const { operationName } = await req.json();
    if (!operationName) {
      return NextResponse.json({ error: "operationName is required" }, { status: 400 });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    const videoBytes = updated.response?.generatedVideos?.[0]?.video?.videoBytes;
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (videoBytes) {
      const buffer = Buffer.from(videoBytes, "base64");
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
        },
      });
    }

    if (!uri) {
      console.error("[Video Download] Operation failed or has no video data. Details:", JSON.stringify(updated));
      const errMsg = updated.error?.message || "Video generation operation failed on Google servers";
      return NextResponse.json({ error: errMsg, details: updated.error }, { status: 400 });
    }

    let authHeaders = {};
    const useVertex = process.env.USE_VERTEX_AI === "true" || !!process.env.VERTEX_PROJECT_ID;
    if (useVertex) {
      const auth = new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/cloud-platform",
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      authHeaders = { "Authorization": `Bearer ${token.token}` };
    } else {
      const apiKey = process.env.GEMINI_API_KEY || "";
      authHeaders = { "x-goog-api-key": apiKey };
    }

    const videoRes = await fetch(uri, {
      headers: authHeaders,
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
