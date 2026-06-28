import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_TTS_MODEL,
  buildGeminiTtsAttempts,
  extractAudioFromGenerateContentResponse,
  isVertexConfigured,
} from "./tts-helpers.ts";

test("uses a TTS-capable Gemini model for AI Studio fallback", () => {
  const attempts = buildGeminiTtsAttempts({
    GEMINI_API_KEY: "api-key",
    USE_VERTEX_AI: "true",
    VERTEX_PROJECT_ID: "vertex-project",
  });

  assert.equal(attempts[0].provider, "ai-studio");
  assert.equal(attempts[0].model, DEFAULT_GEMINI_TTS_MODEL);
  assert.notEqual(attempts[0].model, "gemini-2.0-flash");
});

test("prefers AI Studio for TTS when both API key and Vertex config are present", () => {
  const attempts = buildGeminiTtsAttempts({
    GEMINI_API_KEY: "api-key",
    USE_VERTEX_AI: "true",
    VERTEX_PROJECT_ID: "vertex-project",
  });

  assert.deepEqual(
    attempts.map((attempt) => attempt.provider),
    ["ai-studio", "vertex"],
  );
});

test("can explicitly prefer Vertex for TTS", () => {
  const attempts = buildGeminiTtsAttempts({
    GEMINI_API_KEY: "api-key",
    USE_VERTEX_AI: "true",
    VERTEX_PROJECT_ID: "vertex-project",
    GEMINI_TTS_PREFER_VERTEX: "true",
  });

  assert.deepEqual(
    attempts.map((attempt) => attempt.provider),
    ["vertex", "ai-studio"],
  );
});

test("recognizes Vertex when either flag or project is configured", () => {
  assert.equal(isVertexConfigured({ USE_VERTEX_AI: "true" }), true);
  assert.equal(isVertexConfigured({ VERTEX_PROJECT_ID: "vertex-project" }), true);
  assert.equal(isVertexConfigured({}), false);
});

test("extracts inline audio from generateContent responses", () => {
  const audio = extractAudioFromGenerateContentResponse({
    candidates: [
      {
        content: {
          parts: [
            { text: "ignored" },
            {
              inlineData: {
                data: "cGNt",
                mimeType: "audio/L16;codec=pcm;rate=24000",
              },
            },
          ],
        },
      },
    ],
  });

  assert.deepEqual(audio, {
    base64Audio: "cGNt",
    mimeType: "audio/L16;codec=pcm;rate=24000",
  });
});
