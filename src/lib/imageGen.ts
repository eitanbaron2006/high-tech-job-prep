import { getAiClient } from "./gemini.ts";

// "Nano Banana 2" is Google's Gemini image-generation model. Keep it
// configurable, but default to the current GA model id.
export const DEFAULT_NANO_BANANA_2_MODEL = "gemini-3.1-flash-image";
export const NANO_BANANA_2_VERTEX_LOCATION = "global";
export const NANO_BANANA_IMAGE_ASPECT_RATIO = "16:9";
export const NANO_BANANA_IMAGE_SIZE = process.env.NANO_BANANA_IMAGE_SIZE || "2K";
export const IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS = Number(
  process.env.NANO_BANANA_TIMEOUT_MS || 60_000
);
const NANO_BANANA_MODEL = process.env.NANO_BANANA_MODEL || DEFAULT_NANO_BANANA_2_MODEL;

interface ImageGenerationAttempt {
  model: string;
  forceAiStudio: boolean;
  vertexLocation?: string;
}

const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

export const buildImagePrompt = (concept: string) => {
  if (containsHebrew(concept)) {
    return `Create a rich, premium, high-information Hebrew educational infographic / cheat sheet that visually explains: "${concept}".
Use a right-to-left (RTL) layout and write all visible labels in clear, correctly spelled Hebrew only.
Use a polished 2x4 grid of 8 numbered cards when the prompt asks for 8 patterns. Each card should feel complete: a bold pattern name, a compact "מה מזהה" section, a compact "יישום Python" section, and one colorful icon/diagram.
Use exact short Hebrew labels where relevant: "תבנית", "מזהים", "יישום Python", "שני מצביעים", "חלון מחליק", "מפת גיבוב", "BFS/DFS", "תכנון דינמי", "ערימה", "חיפוש בינארי", "מחסנית מונוטונית".
If code appears, keep it very short and use Python keywords only where helpful, such as "for", "while", "dict", "heapq", "stack", "deque"; do not generate long code blocks.
Do NOT write gibberish, fake Hebrew, random letters, misspelled Hebrew, or mixed-up right-to-left text.
Style: rich but readable, crisp RTL typography, colorful rounded cards, subtle coding background, professional tech illustration, high contrast, dense enough to feel like a memorable cheat sheet, no clutter.`;
  }

  return `A professional, clean and modern educational infographic that visually explains: "${concept}".
Use clear visual metaphors, flow arrows and simple geometric shapes so the idea is understood at a glance.
All text labels must be short, correctly-spelled English words only (e.g. "Input", "Output", "Array", "Hash Map", "Pointer", "Stack", "Queue", "Node"). Do NOT write gibberish, fake words or nonsense letters.
Style: minimalist, light background, flat design, professional tech illustration, palette of orange, grey and dark blue, high contrast, no clutter.`;
};

export const extractImageDataUrl = (response: any): string | null => {
  const outputImage = response?.output_image;
  if (outputImage?.data) {
    return `data:${outputImage.mime_type || "image/png"};base64,${outputImage.data}`;
  }

  const outputs = response?.outputs || [];
  for (const output of outputs) {
    if (output?.type === "image" && output?.data) {
      return `data:${output.mime_type || "image/png"};base64,${output.data}`;
    }
  }

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

export const buildImageGenerationAttempts = (): ImageGenerationAttempt[] => [
  {
    model: NANO_BANANA_MODEL,
    forceAiStudio: false,
    vertexLocation: NANO_BANANA_2_VERTEX_LOCATION,
  },
  {
    model: NANO_BANANA_MODEL,
    forceAiStudio: true,
  },
];

const tryGenerate = async (
  client: any,
  model: string,
  prompt: string,
  timeoutMs: number
): Promise<string | null> => {
  const response = await withTimeout(
    client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: NANO_BANANA_IMAGE_ASPECT_RATIO,
          imageSize: NANO_BANANA_IMAGE_SIZE,
        },
      },
    }),
    timeoutMs,
    `Nano Banana 2 image generation (${model})`
  );
  return extractImageDataUrl(response);
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export async function generateEducationalImageWithClient(
  client: any,
  concept: string,
  attempts = buildImageGenerationAttempts(),
  timeoutMs = IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS
): Promise<string> {
  const prompt = buildImagePrompt(concept);

  let lastError: any = null;
  for (const { model } of attempts) {
    try {
      const url = await tryGenerate(client, model, prompt, timeoutMs);
      if (url) return url;
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[imageGen] generation failed (model=${model}, api=generateContent):`,
        err?.message || err
      );
    }
  }

  throw new Error(lastError?.message || "No image was generated");
}

/**
 * Generates an educational infographic for the given concept and returns a
 * base64 data URL. Tries Nano Banana 2 on Vertex AI first, then AI Studio.
 */
export async function generateEducationalImage(concept: string): Promise<string> {
  const prompt = buildImagePrompt(concept);

  const attempts = buildImageGenerationAttempts();

  let lastError: any = null;
  for (const { model, forceAiStudio, vertexLocation } of attempts) {
    try {
      const url = await tryGenerate(
        getAiClient(forceAiStudio, vertexLocation, IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS),
        model,
        prompt,
        IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS
      );
      if (url) return url;
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[imageGen] generation failed (model=${model}, aiStudio=${forceAiStudio}, api=generateContent):`,
        err?.message || err
      );
    }
  }

  throw new Error(lastError?.message || "No image was generated");
}
