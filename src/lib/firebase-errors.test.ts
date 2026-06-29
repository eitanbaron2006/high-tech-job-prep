import test from "node:test";
import assert from "node:assert/strict";
import {
  isFirebasePermissionError,
  shouldSilenceCloudHistoryError,
} from "./firebase-errors.ts";

test("classifies Firestore permission failures as expected cloud-history fallbacks", () => {
  assert.equal(isFirebasePermissionError({ code: "permission-denied" }), true);
  assert.equal(isFirebasePermissionError({ code: "unauthenticated" }), true);
  assert.equal(isFirebasePermissionError({ code: "firestore/permission-denied" }), true);
  assert.equal(isFirebasePermissionError(new Error("Missing or insufficient permissions.")), true);
});

test("does not silence unexpected Firebase or application errors", () => {
  assert.equal(shouldSilenceCloudHistoryError({ code: "unavailable" }), false);
  assert.equal(shouldSilenceCloudHistoryError(new Error("boom")), false);
});
