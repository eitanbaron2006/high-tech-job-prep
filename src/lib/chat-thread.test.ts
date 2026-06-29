import test from "node:test";
import assert from "node:assert/strict";
import {
  createFreshChatThread,
  createChatTitleFromMessage,
  getActiveChatStorageKey,
  getChatHistoryStorageKey,
  mergeChatThreads,
  resolveInitialChatThread,
  sanitizeChatMessagesForStorage,
  upsertChatThread,
} from "./chat-thread.ts";

test("creates a fresh AlgoBuddy thread with only the welcome message", () => {
  const thread = createFreshChatThread({
    id: "thread_1",
    userId: "user_1",
    createdAt: "2026-06-28T12:00:00.000Z",
  });

  assert.equal(thread.id, "thread_1");
  assert.equal(thread.userId, "user_1");
  assert.equal(thread.title, "שיחה חדשה לגבי אלגוריתמים");
  assert.equal(thread.createdAt, "2026-06-28T12:00:00.000Z");
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.messages[0].sender, "ai");
  assert.match(thread.messages[0].text, /AlgoBuddy/);
});

test("creates a concise chat title from the first user message", () => {
  assert.equal(
    createChatTitleFromMessage("אני רוצה להבין איך עובד חיפוש בינארי על מערך ממוין"),
    "אני רוצה להבין איך עובד חיפוש ...",
  );
});

test("uses a stable active-chat storage key per user", () => {
  assert.equal(getActiveChatStorageKey("user_1"), "algobuddy_active_chat_user_1");
  assert.equal(getActiveChatStorageKey(null), "algobuddy_active_chat_guest");
  assert.equal(getChatHistoryStorageKey("user_1"), "algobuddy_chat_history_user_1");
  assert.equal(getChatHistoryStorageKey(null), "algobuddy_chat_history_guest");
});

test("restores the active chat instead of starting a new one", () => {
  const existing = createFreshChatThread({
    id: "thread_existing",
    userId: "user_1",
    createdAt: "2026-06-28T12:00:00.000Z",
  });
  existing.messages.push({
    sender: "user",
    text: "מה ההבדל בין BFS ל-DFS?",
    createdAt: Date.now(),
  });

  const resolved = resolveInitialChatThread({
    storedThread: existing,
    userId: "user_1",
    now: new Date("2026-06-29T12:00:00.000Z"),
  });

  assert.equal(resolved, existing);
});

test("creates a fresh chat when stored active chat belongs to a different user", () => {
  const otherUserThread = createFreshChatThread({
    id: "thread_other",
    userId: "user_2",
    createdAt: "2026-06-28T12:00:00.000Z",
  });

  const resolved = resolveInitialChatThread({
    storedThread: otherUserThread,
    userId: "user_1",
    now: new Date("2026-06-29T12:00:00.000Z"),
  });

  assert.notEqual(resolved.id, "thread_other");
  assert.equal(resolved.userId, "user_1");
  assert.equal(resolved.messages.length, 1);
});

test("sanitizes chat messages for Firestore without undefined fields", () => {
  const sanitized = sanitizeChatMessagesForStorage([
    {
      sender: "ai",
      text: "הנה תמונה",
      imageUrl: "data:image/png;base64,abc123",
      imagePrompt: undefined,
      createdAt: 123,
    },
    {
      sender: "ai",
      text: "תמונה שמורה",
      imageUrl: "https://storage.example/image.png",
      imagePrompt: "Binary search",
      createdAt: 456,
    },
  ]);

  assert.equal(Object.hasOwn(sanitized[0], "imageUrl"), false);
  assert.equal(Object.hasOwn(sanitized[0], "imagePrompt"), false);
  assert.equal(sanitized[1].imageUrl, "https://storage.example/image.png");
  assert.equal(sanitized[1].imagePrompt, "Binary search");
});

test("upserts chat history locally without keeping heavy generated data URLs", () => {
  const previous = createFreshChatThread({
    id: "temp_1",
    userId: "user_1",
    createdAt: "2026-06-29T10:00:00.000Z",
  });
  previous.messages.push({
    sender: "ai",
    text: "image",
    imageUrl: "data:image/png;base64,abc123",
    createdAt: 2,
  });

  const saved = upsertChatThread([], previous);

  assert.equal(saved.length, 1);
  assert.equal(Object.hasOwn(saved[0].messages[1], "imageUrl"), false);

  const promoted = { ...previous, id: "firestore-id" };
  const replaced = upsertChatThread(saved, promoted, previous.id);

  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, "firestore-id");
});

test("merges chat histories by id and sorts newest first", () => {
  const older = createFreshChatThread({
    id: "older",
    userId: "user_1",
    createdAt: "2026-06-29T10:00:00.000Z",
  });
  const newer = createFreshChatThread({
    id: "newer",
    userId: "user_1",
    createdAt: "2026-06-29T11:00:00.000Z",
  });

  assert.deepEqual(
    mergeChatThreads([older], [newer], [older]).map((thread) => thread.id),
    ["newer", "older"]
  );
});
