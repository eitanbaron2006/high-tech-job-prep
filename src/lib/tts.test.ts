import test from "node:test";
import assert from "node:assert/strict";
import {
  GEMINI_TTS_SINGLE_CHUNK_CHAR_LIMIT,
  buildTtsChunks,
  cleanTtsText,
} from "./tts.ts";

test("cleans markdown and html for reusable TTS text", () => {
  assert.equal(cleanTtsText("**כותרת** <b>מודגשת</b>\n\n`קוד` פשוט"), "כותרת מודגשת קוד פשוט");
});

test("keeps normal Gemini TTS explanations in one request", () => {
  const text = "א".repeat(GEMINI_TTS_SINGLE_CHUNK_CHAR_LIMIT);

  assert.deepEqual(buildTtsChunks(text, "gemini"), [text]);
});

test("splits only very long Gemini TTS text into no more than three requests", () => {
  const longText = [
    "חלק ראשון מסביר את הרעיון המרכזי בצורה רגועה וברורה.",
    "חלק שני מוסיף דוגמה שימושית כדי להפוך את הנושא לקל יותר להבנה.",
    "חלק שלישי מחבר בין המושגים ומראה איך משתמשים בהם בזמן פתרון בעיה.",
    "חלק רביעי מסכם את התהליך ומדגיש את הנקודות החשובות לזכירה.",
    "חלק חמישי נותן טיפ קצר לתרגול עצמאי אחרי ההסבר.",
  ].join(" ").repeat(12);

  const chunks = buildTtsChunks(longText, "gemini");

  assert.ok(chunks.length > 1);
  assert.ok(chunks.length <= 3);
  assert.equal(chunks.join(" "), longText);
});

test("keeps Edge chunking optimized for shorter streaming chunks", () => {
  const longText = "משפט קצר וברור. ".repeat(80);

  const chunks = buildTtsChunks(longText, "edge");

  assert.ok(chunks.length > 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 380));
});
