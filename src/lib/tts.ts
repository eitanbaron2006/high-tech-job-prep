export type TtsProvider = "gemini" | "edge";

export const GEMINI_TTS_SINGLE_CHUNK_CHAR_LIMIT = 1800;
const GEMINI_TTS_MAX_CHUNKS = 3;
const EDGE_TTS_TARGET_CHUNK_LENGTH = 350;

export const cleanTtsText = (text: string): string =>
  text
    .replace(/[*_#`~[\]()]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const splitSentences = (text: string): string[] =>
  text.split(/(?<=[.!?])\s+/).filter(Boolean);

const splitIntoTargetChunks = (
  text: string,
  targetLength: number,
  maxChunks = Number.POSITIVE_INFINITY,
): string[] => {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    const hasMoreSlots = chunks.length < maxChunks - 1;

    if (currentChunk && candidate.length > targetLength && hasMoreSlots) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  if (chunks.length <= maxChunks) {
    return chunks;
  }

  return [
    ...chunks.slice(0, maxChunks - 1),
    chunks.slice(maxChunks - 1).join(" "),
  ];
};

export const buildGeminiTtsChunks = (text: string): string[] => {
  const cleanText = cleanTtsText(text);
  if (!cleanText) return [];
  if (cleanText.length <= GEMINI_TTS_SINGLE_CHUNK_CHAR_LIMIT) return [cleanText];

  return splitIntoTargetChunks(
    cleanText,
    Math.ceil(cleanText.length / GEMINI_TTS_MAX_CHUNKS),
    GEMINI_TTS_MAX_CHUNKS,
  );
};

export const buildEdgeTtsChunks = (text: string): string[] => {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const cleanParagraph = cleanTtsText(paragraph);
    if (!cleanParagraph) continue;

    if (cleanParagraph.length > EDGE_TTS_TARGET_CHUNK_LENGTH) {
      chunks.push(...splitIntoTargetChunks(cleanParagraph, EDGE_TTS_TARGET_CHUNK_LENGTH));
    } else {
      chunks.push(cleanParagraph);
    }
  }

  return chunks;
};

export const buildTtsChunks = (text: string, provider: TtsProvider): string[] =>
  provider === "gemini" ? buildGeminiTtsChunks(text) : buildEdgeTtsChunks(text);
