import { GoogleGenAI } from "@google/genai";

export const getAiClient = (forceAiStudio = false) => {
  const useVertex = !forceAiStudio && (process.env.USE_VERTEX_AI === "true" || !!process.env.VERTEX_PROJECT_ID);
  
  return useVertex
    ? new GoogleGenAI({
        vertexai: true,
        project: process.env.VERTEX_PROJECT_ID,
        location: process.env.VERTEX_LOCATION === "global" ? "us-central1" : (process.env.VERTEX_LOCATION || "us-central1"),
      })
    : new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || "",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
};

export const getModelName = (baseModel: string, forceAiStudio = false): string => {
  const useVertex = !forceAiStudio && (process.env.USE_VERTEX_AI === "true" || !!process.env.VERTEX_PROJECT_ID);
  if (useVertex) {
    if (baseModel.includes("image")) {
      return "imagen-3.0-generate-002";
    }
    if (baseModel.includes("veo") || baseModel.includes("video")) {
      return "veo-2.0-generate-001";
    }
    if (baseModel.includes("flash")) {
      return "gemini-2.5-flash";
    }
    if (baseModel.includes("pro")) {
      return "gemini-2.5-pro";
    }
  }
  return baseModel;
};

// Export a dynamic proxy for backwards compatibility
export const ai = new Proxy({} as GoogleGenAI, {
  get(target, prop) {
    const client = getAiClient();
    return (client as any)[prop];
  }
});
