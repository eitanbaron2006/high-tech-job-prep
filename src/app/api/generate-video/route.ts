import { NextResponse } from "next/server";
import { getAiClient, getModelName } from "../../../lib/gemini";

export async function POST(req: Request) {
  try {
    const { prompt, aspectRatio } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "No prompt specified for video" }, { status: 400 });
    }

    const resolvedAspectRatio = aspectRatio === "9:16" ? "9:16" : "16:9";
    let operation;

    try {
      const client = getAiClient(false); // Try Vertex AI
      operation = await client.models.generateVideos({
        model: getModelName("veo-3.1-fast-generate-preview", false),
        prompt: `An elegant software engineering tutorial video about: ${prompt}. Minimalistic whiteboard style, simple clean animation detailing the algorithm with orange and black accents. Highly professional.`,
        config: {
          numberOfVideos: 1,
          resolution: "720p",
          aspectRatio: resolvedAspectRatio,
        },
      });
    } catch (vertexErr: any) {
      console.warn("[Video Generation] Vertex AI failed, falling back to AI Studio. Error:", vertexErr.message || vertexErr);
      
      const client = getAiClient(true); // Force AI Studio
      operation = await client.models.generateVideos({
        model: getModelName("veo-3.1-fast-generate-preview", true),
        prompt: `An elegant software engineering tutorial video about: ${prompt}. Minimalistic whiteboard style, simple clean animation detailing the algorithm with orange and black accents. Highly professional.`,
        config: {
          numberOfVideos: 1,
          resolution: "720p",
          aspectRatio: resolvedAspectRatio,
        },
      });
    }

    return NextResponse.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Error in generate-video:", error);
    return NextResponse.json({ error: error.message || "Failed to initiate video generation" }, { status: 500 });
  }
}
