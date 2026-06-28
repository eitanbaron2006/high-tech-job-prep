export const TTS_PLAYBACK_RATE_MIN = 0.75;
export const TTS_PLAYBACK_RATE_MAX = 1.5;
export const TTS_PLAYBACK_RATE_DEFAULT = 1;
export const TTS_PLAYBACK_RATE_STEP = 0.05;

export type TtsPlaybackRate = number;

export const normalizePlaybackRate = (value: string | number): TtsPlaybackRate => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return TTS_PLAYBACK_RATE_DEFAULT;

  const clampedValue = Math.max(
    TTS_PLAYBACK_RATE_MIN,
    Math.min(TTS_PLAYBACK_RATE_MAX, numericValue),
  );

  return Math.round(clampedValue * 100) / 100;
};

export const getPlaybackStartIndex = ({
  chunkCount,
  currentIndex,
  isPaused,
  replayRequested,
}: {
  chunkCount: number;
  currentIndex: number;
  isPaused: boolean;
  replayRequested: boolean;
}): number => {
  if (chunkCount <= 0) return 0;
  if (replayRequested || currentIndex >= chunkCount) return 0;
  if (isPaused) return Math.max(0, Math.min(currentIndex, chunkCount - 1));
  return Math.max(0, currentIndex);
};
