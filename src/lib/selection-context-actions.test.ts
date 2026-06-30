import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSelectionContextActions,
  buildSelectionPrompt,
  looksAlgorithmic,
} from "./selection-context-actions.ts";

test("offers English translation for Hebrew selected text", () => {
  const actions = buildSelectionContextActions("שני מצביעים היא תבנית יעילה במערך ממוין");
  const translate = actions.find((action) => action.id === "translate");

  assert.equal(translate?.label, "תרגם לאנגלית");
  assert.equal(translate?.targetLanguage, "English");
});

test("offers Hebrew translation for English selected text", () => {
  const actions = buildSelectionContextActions("Two pointers scans a sorted array from both ends");
  const translate = actions.find((action) => action.id === "translate");

  assert.equal(translate?.label, "תרגם לעברית");
  assert.equal(translate?.targetLanguage, "Hebrew");
});

test("offers Python implementation only for algorithmic selections", () => {
  assert.equal(looksAlgorithmic("Two Sum with a sorted array and left/right pointers"), true);
  assert.equal(looksAlgorithmic("ברוכים הבאים למדריך ההכנה לראיונות"), false);

  const algorithmActions = buildSelectionContextActions("כתוב פתרון לשאלת two sum במערך ממוין");
  const generalActions = buildSelectionContextActions("ברוכים הבאים למדריך ההכנה לראיונות");

  assert.ok(algorithmActions.some((action) => action.id === "python"));
  assert.ok(!generalActions.some((action) => action.id === "python"));
});

test("builds focused chat prompts for advanced context actions", () => {
  const selected = "Two Pointers";

  assert.match(buildSelectionPrompt("translate", selected), /תרגם|Translate/);
  assert.match(buildSelectionPrompt("python", selected), /Python/);
  assert.match(buildSelectionPrompt("practice", selected), /שאלת תרגול/);
  assert.match(buildSelectionPrompt("diagram", selected), /צור לי תמונה/);
});
