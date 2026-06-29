import test from "node:test";
import assert from "node:assert/strict";
import { resolveVertexLocation } from "./gemini.ts";

test("keeps global Vertex AI location when explicitly requested", () => {
  assert.equal(resolveVertexLocation("global"), "global");
});

test("uses configured Vertex AI location or the existing default", () => {
  assert.equal(resolveVertexLocation("europe-west4"), "europe-west4");
  assert.equal(resolveVertexLocation(undefined), "us-central1");
});
