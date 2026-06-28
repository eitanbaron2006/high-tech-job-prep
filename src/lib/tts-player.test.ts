import test from "node:test";
import assert from "node:assert/strict";
import {
  TTS_PLAYBACK_RATE_DEFAULT,
  TTS_PLAYBACK_RATE_MAX,
  TTS_PLAYBACK_RATE_MIN,
  TTS_PLAYBACK_RATE_STEP,
  getPlaybackStartIndex,
  normalizePlaybackRate,
} from "./tts-player.ts";

test("replay starts from the beginning after playback reached the last chunk", () => {
  assert.equal(
    getPlaybackStartIndex({
      chunkCount: 2,
      currentIndex: 2,
      isPaused: false,
      replayRequested: false,
    }),
    0,
  );
});

test("resume keeps the current chunk while paused", () => {
  assert.equal(
    getPlaybackStartIndex({
      chunkCount: 3,
      currentIndex: 1,
      isPaused: true,
      replayRequested: false,
    }),
    1,
  );
});

test("explicit replay starts from the beginning even if currently paused", () => {
  assert.equal(
    getPlaybackStartIndex({
      chunkCount: 3,
      currentIndex: 1,
      isPaused: true,
      replayRequested: true,
    }),
    0,
  );
});

test("normalizes playback rates to the slider range", () => {
  assert.equal(TTS_PLAYBACK_RATE_MIN, 0.75);
  assert.equal(TTS_PLAYBACK_RATE_MAX, 1.5);
  assert.equal(TTS_PLAYBACK_RATE_DEFAULT, 1);
  assert.equal(TTS_PLAYBACK_RATE_STEP, 0.05);
  assert.equal(normalizePlaybackRate("1.3"), 1.3);
  assert.equal(normalizePlaybackRate("2"), 1.5);
  assert.equal(normalizePlaybackRate("0.4"), 0.75);
  assert.equal(normalizePlaybackRate("not-a-number"), 1);
});

test("keeps slider playback rates as continuous values", () => {
  assert.equal(normalizePlaybackRate("1.27"), 1.27);
});
