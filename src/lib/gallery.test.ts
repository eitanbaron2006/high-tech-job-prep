import test from "node:test";
import assert from "node:assert/strict";
import {
  dataUrlToBlob,
  getGeneratedImagesFromChatThreads,
  isFirebaseStorageRetryLimitError,
  mergeGeneratedImages,
  saveGeneratedImageWithDeps,
} from "./gallery-core.ts";

const SAMPLE_PNG_DATA_URL = "data:image/png;base64,aGVsbG8=";

test("converts generated image data URLs to typed blobs before upload", async () => {
  const blob = await dataUrlToBlob(SAMPLE_PNG_DATA_URL);

  assert.equal(blob.type, "image/png");
  assert.equal(await blob.text(), "hello");
});

test("saves signed-in generated images through Firebase Storage with blob metadata", async () => {
  const uploads: any[] = [];
  const docs: any[] = [];
  const localWrites: any[] = [];
  const localDataWrites: any[] = [];

  const saved = await saveGeneratedImageWithDeps("user-1", SAMPLE_PNG_DATA_URL, "prompt text", {
    now: () => 1_700_000_000_000,
    getLocalImages: () => [],
    setLocalImages: (userId, images) => localWrites.push({ userId, images }),
    saveLocalImageData: async (key, dataUrl) => localDataWrites.push({ key, dataUrl }),
    uploadImage: async (path, blob, metadata) => {
      uploads.push({ path, blob, metadata });
    },
    getImageDownloadUrl: async (path) => `https://storage.example/${path}`,
    addImageDoc: async (data) => {
      docs.push(data);
      return { id: "doc-1" };
    },
  });

  assert.equal(saved.id, "doc-1");
  assert.equal(saved.url, "https://storage.example/generated-images/user-1/1700000000000.png");
  assert.equal(saved.localImageKey, "user-1_1700000000000");
  assert.deepEqual(localDataWrites, [{ key: "user-1_1700000000000", dataUrl: SAMPLE_PNG_DATA_URL }]);
  assert.equal(localWrites.length, 1);
  assert.equal(localWrites[0].images[0].url, "local-image://user-1_1700000000000");
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].blob.type, "image/png");
  assert.deepEqual(uploads[0].metadata, { contentType: "image/png" });
  assert.deepEqual(docs[0], {
    userId: "user-1",
    prompt: "prompt text",
    url: saved.url,
    storagePath: "generated-images/user-1/1700000000000.png",
    localImageKey: "user-1_1700000000000",
    createdAt: new Date(1_700_000_000_000).toISOString(),
  });
});

test("uses a caller-provided local image key for chat restore after refresh", async () => {
  const docs: any[] = [];
  const localWrites: any[] = [];
  const localDataWrites: any[] = [];

  const saved = await saveGeneratedImageWithDeps(
    "user-1",
    SAMPLE_PNG_DATA_URL,
    "prompt text",
    {
      now: () => 1_700_000_000_000,
      getLocalImages: () => [],
      setLocalImages: (userId, images) => localWrites.push({ userId, images }),
      saveLocalImageData: async (key, dataUrl) => localDataWrites.push({ key, dataUrl }),
      uploadImage: async () => {},
      getImageDownloadUrl: async (path) => `https://storage.example/${path}`,
      addImageDoc: async (data) => {
        docs.push(data);
        return { id: "doc-1" };
      },
    },
    "chat-image-key"
  );

  assert.equal(saved.localImageKey, "chat-image-key");
  assert.deepEqual(localDataWrites, [{ key: "chat-image-key", dataUrl: SAMPLE_PNG_DATA_URL }]);
  assert.equal(localWrites[0].images[0].url, "local-image://chat-image-key");
  assert.equal(docs[0].localImageKey, "chat-image-key");
});

test("falls back to local gallery storage when Firebase Storage retry limit is exceeded", async () => {
  const localWrites: any[] = [];
  const localDataWrites: any[] = [];
  const retryLimitError = Object.assign(new Error("Max retry time for operation exceeded"), {
    code: "storage/retry-limit-exceeded",
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  let saved;
  try {
    saved = await saveGeneratedImageWithDeps("user-1", SAMPLE_PNG_DATA_URL, "prompt text", {
      now: () => 1_700_000_000_000,
      getLocalImages: () => [],
      setLocalImages: (userId, images) => localWrites.push({ userId, images }),
      saveLocalImageData: async (key, dataUrl) => localDataWrites.push({ key, dataUrl }),
      uploadImage: async () => {
        throw retryLimitError;
      },
      getImageDownloadUrl: async () => {
        throw new Error("download URL should not be requested after upload failure");
      },
      addImageDoc: async () => {
        throw new Error("firestore doc should not be written after upload failure");
      },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(isFirebaseStorageRetryLimitError(retryLimitError), true);
  assert.equal(saved.localOnly, true);
  assert.equal(saved.userId, "user-1");
  assert.equal(saved.url, SAMPLE_PNG_DATA_URL);
  assert.equal(saved.localImageKey, "user-1_1700000000000");
  assert.deepEqual(localDataWrites, [{ key: "user-1_1700000000000", dataUrl: SAMPLE_PNG_DATA_URL }]);
  assert.equal(localWrites.length, 1);
  assert.equal(localWrites[0].userId, "user-1");
  assert.equal(localWrites[0].images[0].id, saved.id);
  assert.equal(localWrites[0].images[0].url, "local-image://user-1_1700000000000");
});

test("recovers generated images that only exist inside local chat history", () => {
  const images = getGeneratedImagesFromChatThreads([
    {
      id: "thread-1",
      userId: "user-1",
      title: "chat",
      createdAt: "2026-06-29T10:00:00.000Z",
      messages: [
        {
          sender: "ai",
          text: "הנה תרשים",
          imageUrl: SAMPLE_PNG_DATA_URL,
          localImageKey: "user-1_1700000000000",
          imagePrompt: "תרשים בעברית",
          createdAt: 1_700_000_000_000,
        },
      ],
    },
  ]);

  assert.equal(images.length, 1);
  assert.equal(images[0].url, SAMPLE_PNG_DATA_URL);
  assert.equal(images[0].localImageKey, "user-1_1700000000000");
  assert.equal(images[0].prompt, "תרשים בעברית");
  assert.equal(images[0].localOnly, true);
});

test("deduplicates cloud, local gallery, and chat images by local image key", () => {
  const merged = mergeGeneratedImages(
    [
      {
        id: "cloud-doc",
        userId: "user-1",
        url: "https://storage.example/image.png",
        prompt: "cloud",
        localImageKey: "user-1_1",
        createdAt: "2026-06-29T10:00:00.000Z",
      },
    ],
    [
      {
        id: "local_1",
        userId: "user-1",
        url: "local-image://user-1_1",
        prompt: "local",
        localImageKey: "user-1_1",
        createdAt: "2026-06-29T10:00:00.000Z",
        localOnly: true,
      },
    ]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "cloud-doc");
});
