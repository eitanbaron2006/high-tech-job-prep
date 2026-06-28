import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPLANATION_MAX_OUTPUT_TOKENS,
  EXPLANATION_RETRY_MAX_OUTPUT_TOKENS,
  EXPLANATION_WORD_LIMIT,
  buildExplainGenerationConfig,
  buildExplainSystemInstruction,
  ensureExplanationComplete,
  isExplanationTruncated,
  stripLeadingAcknowledgement,
} from "./explain-helpers.ts";

test("uses enough output tokens to avoid cutting Hebrew explanations mid-sentence", () => {
  const config = buildExplainGenerationConfig();

  assert.equal(config.maxOutputTokens, EXPLANATION_MAX_OUTPUT_TOKENS);
  assert.ok(EXPLANATION_MAX_OUTPUT_TOKENS >= 1200);
  assert.ok(EXPLANATION_MAX_OUTPUT_TOKENS < EXPLANATION_RETRY_MAX_OUTPUT_TOKENS);
});

test("asks Gemini for a concise user-facing explanation", () => {
  const instruction = buildExplainSystemInstruction("מערכים וחיפוש בינארי");

  assert.match(instruction, new RegExp(`עד ${EXPLANATION_WORD_LIMIT} מילים`));
  assert.match(instruction, /אל תכתוב מדריך מלא/);
  assert.match(instruction, /אל תפתח במילות אישור/);
  assert.match(instruction, /מערכים וחיפוש בינארי/);
});

test("detects explanations truncated by max output tokens", () => {
  assert.equal(
    isExplanationTruncated({
      candidates: [{ finishReason: "MAX_TOKENS" }],
    }),
    true,
  );

  assert.equal(
    isExplanationTruncated({
      candidates: [{ finishReason: "STOP" }],
    }),
    false,
  );
});

test("rejects truncated explanations after retry instead of showing broken text", () => {
  assert.throws(
    () =>
      ensureExplanationComplete({
        candidates: [{ finishReason: "MAX_TOKENS" }],
      }),
    /truncated/,
  );
});

test("removes conversational acknowledgements from explanation starts", () => {
  assert.equal(
    stripLeadingAcknowledgement("הבנתי. **הרעיון בקצרה**\nסיבוכיות היא מדד חשוב."),
    "**הרעיון בקצרה**\nסיבוכיות היא מדד חשוב.",
  );

  assert.equal(
    stripLeadingAcknowledgement("בטח, סיבוכיות היא דרך למדוד עלות של פתרון."),
    "סיבוכיות היא דרך למדוד עלות של פתרון.",
  );
});
