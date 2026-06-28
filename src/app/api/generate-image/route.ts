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
    const { prompt, size } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "No prompt specified for image" }, { status: 400 });
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
      return NextResponse.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      return NextResponse.json({ error: "No image part returned in response candidates" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in generate-image:", error);
    return NextResponse.json({ error: error.message || "Failed to generate diagram image" }, { status: 500 });
  }
}
