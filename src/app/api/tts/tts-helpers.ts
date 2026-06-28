type EnvLike = Partial<Record<string, string | undefined>>;

export type GeminiTtsProvider = "ai-studio" | "vertex";

export interface GeminiTtsAttempt {
  provider: GeminiTtsProvider;
  model: string;
}

export interface ExtractedAudio {
  base64Audio: string;
  mimeType: string;
}

export const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const isVertexConfigured = (env: EnvLike = process.env): boolean =>
  env.USE_VERTEX_AI === "true" || !!env.VERTEX_PROJECT_ID;

export const getGeminiTtsModel = (env: EnvLike = process.env): string =>
  env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL;

export const buildGeminiTtsAttempts = (env: EnvLike = process.env): GeminiTtsAttempt[] => {
  const hasAiStudioKey = !!env.GEMINI_API_KEY;
  const hasVertexConfig = isVertexConfigured(env);
  const preferVertex = env.GEMINI_TTS_PREFER_VERTEX === "true";
  const model = getGeminiTtsModel(env);

  const aiStudioAttempt: GeminiTtsAttempt = { provider: "ai-studio", model };
  const vertexAttempt: GeminiTtsAttempt = { provider: "vertex", model };

  if (preferVertex) {
    return [
      ...(hasVertexConfig ? [vertexAttempt] : []),
      ...(hasAiStudioKey ? [aiStudioAttempt] : []),
    ];
  }

  return [
    ...(hasAiStudioKey ? [aiStudioAttempt] : []),
    ...(hasVertexConfig ? [vertexAttempt] : []),
  ];
};

export const extractAudioFromGenerateContentResponse = (response: any): ExtractedAudio | null => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return null;
  }

  for (const part of parts) {
    if (part?.inlineData?.data) {
      return {
        base64Audio: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "audio/L16;codec=pcm;rate=24000",
      };
    }
  }

  return null;
};
