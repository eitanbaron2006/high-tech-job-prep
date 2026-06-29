import { getAiClient } from "./gemini";

// "Nano Banana 2" is a Gemini image-generation model used via generateContent
// with an IMAGE response modality (NOT the Imagen `generateImages` API).
// The exact id can change between releases/regions, so it is configurable.
const NANO_BANANA_MODEL = process.env.NANO_BANANA_MODEL || "gemini-3-pro-image-preview";
const FALLBACK_IMAGE_MODEL = process.env.NANO_BANANA_FALLBACK_MODEL || "gemini-2.5-flash-image";

const buildImagePrompt = (concept: string) => `A professional, clean and modern educational infographic that visually explains: "${concept}".
Use clear visual metaphors, flow arrows and simple geometric shapes so the idea is understood at a glance.
All text labels must be short, correctly-spelled English words only (e.g. "Input", "Output", "Array", "Hash Map", "Pointer", "Stack", "Queue", "Node"). Do NOT write gibberish, fake words or nonsense letters.
Style: minimalist, light background, flat design, professional tech illustration, palette of orange, grey and dark blue, high contrast, no clutter.`;

const extractImage = (response: any): string | null => {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const data = part?.inlineData?.data;
    if (data) {
      const mime = part.inlineData.mimeType || "image/png";
      return `data:${mime};base64,${data}`;
    }
  }
  return null;
};

const tryGenerate = async (
  model: string,
  forceAiStudio: boolean,
  prompt: string
): Promise<string | null> => {
  const client = getAiClient(forceAiStudio);
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });
  return extractImage(response);
};

/**
 * Generates an educational infographic for the given concept and returns a
 * base64 data URL. Tries the configured Nano Banana model on Vertex AI first,
 * then a fallback image model, then AI Studio.
 */
export async function generateEducationalImage(concept: string): Promise<string> {
  const prompt = buildImagePrompt(concept);

  const attempts: Array<[string, boolean]> = [
    [NANO_BANANA_MODEL, false], // Vertex AI · Nano Banana 2
    [FALLBACK_IMAGE_MODEL, false], // Vertex AI · fallback image model
    [NANO_BANANA_MODEL, true], // AI Studio · Nano Banana 2
    [FALLBACK_IMAGE_MODEL, true], // AI Studio · fallback image model
  ];

  let lastError: any = null;
  for (const [model, forceAiStudio] of attempts) {
    try {
      const url = await tryGenerate(model, forceAiStudio, prompt);
      if (url) return url;
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[imageGen] generation failed (model=${model}, aiStudio=${forceAiStudio}):`,
        err?.message || err
      );
    }
  }

  throw new Error(lastError?.message || "No image was generated");
}
