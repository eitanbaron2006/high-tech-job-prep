import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_NANO_BANANA_2_MODEL,
  IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS,
  NANO_BANANA_IMAGE_ASPECT_RATIO,
  NANO_BANANA_IMAGE_SIZE,
  buildImagePrompt,
  buildImageGenerationAttempts,
  extractImageDataUrl,
  generateEducationalImageWithClient,
} from "./imageGen.ts";

test("uses Nano Banana 2 as the default primary image model", () => {
  assert.equal(DEFAULT_NANO_BANANA_2_MODEL, "gemini-3.1-flash-image");

  const attempts = buildImageGenerationAttempts();

  assert.deepEqual(attempts[0], {
    model: "gemini-3.1-flash-image",
    forceAiStudio: false,
    vertexLocation: "global",
  });
  assert.ok(!attempts.some((attempt) => attempt.model === "gemini-3-pro-image-preview"));
});

test("extracts image output from a generateContent response", () => {
  const dataUrl = extractImageDataUrl({
    candidates: [
      {
        content: {
          parts: [{ inlineData: { data: "abc123", mimeType: "image/webp" } }],
        },
      },
    ],
  });

  assert.equal(dataUrl, "data:image/webp;base64,abc123");
});

test("generates Nano Banana 2 images through generateContent", async () => {
  const calls: any[] = [];
  const client = {
    models: {
      generateContent: async (params: any) => {
        calls.push(params);
        return {
          candidates: [
            {
              content: {
                parts: [{ inlineData: { data: "png-bytes", mimeType: "image/png" } }],
              },
            },
          ],
        };
      },
    },
    interactions: {
      create: async () => {
        throw new Error("interactions API should not be used for Nano Banana 2 image generation");
      },
    },
  };

  const image = await generateEducationalImageWithClient(client, "Binary search", [
    { model: DEFAULT_NANO_BANANA_2_MODEL, forceAiStudio: false, vertexLocation: "global" },
  ]);

  assert.equal(image, "data:image/png;base64,png-bytes");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, DEFAULT_NANO_BANANA_2_MODEL);
  assert.deepEqual(calls[0].config.responseModalities, ["IMAGE"]);
  assert.deepEqual(calls[0].config.imageConfig, {
    aspectRatio: "16:9",
    imageSize: "2K",
  });
  assert.match(calls[0].contents, /Binary search/);
});

test("times out a stalled Nano Banana 2 image request", async () => {
  const client = {
    models: {
      generateContent: async () => new Promise(() => {}),
    },
  };

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await assert.rejects(
      () =>
        generateEducationalImageWithClient(
          client,
          "Binary search",
          [{ model: DEFAULT_NANO_BANANA_2_MODEL, forceAiStudio: false, vertexLocation: "global" }],
          5,
        ),
      /timed out/,
    );
  } finally {
    console.warn = originalWarn;
  }
});

test("uses a bounded default timeout for each image attempt", () => {
  assert.ok(IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS > 0);
  assert.ok(IMAGE_GENERATION_ATTEMPT_TIMEOUT_MS <= 90_000);
});

test("requests the richer 2K 16:9 output used by Gemini image examples", () => {
  assert.equal(NANO_BANANA_IMAGE_ASPECT_RATIO, "16:9");
  assert.equal(NANO_BANANA_IMAGE_SIZE, "2K");
});

test("asks Nano Banana 2 for Hebrew labels when the user asks in Hebrew", () => {
  const prompt = buildImagePrompt("צור לי cheat sheet בעברית על 8 תבניות אלגוריתמים");

  assert.match(prompt, /Hebrew/);
  assert.match(prompt, /RTL/);
  assert.match(prompt, /rich/);
  assert.match(prompt, /2x4/);
  assert.match(prompt, /תבנית/);
  assert.doesNotMatch(prompt, /English words only/);
});
