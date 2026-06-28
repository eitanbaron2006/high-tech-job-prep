import test from "node:test";
import assert from "node:assert/strict";
import {
  createFreshChatThread,
  createChatTitleFromMessage,
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
