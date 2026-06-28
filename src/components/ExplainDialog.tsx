import React, { useState, useEffect, useRef } from "react";
import { ExplanationItem } from "../types";
import { User } from "firebase/auth";
import { collection, addDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import ReactMarkdown from "react-markdown";
import { buildTtsChunks, TtsProvider } from "../lib/tts";
import {
  TTS_PLAYBACK_RATE_MAX,
  TTS_PLAYBACK_RATE_MIN,
  TTS_PLAYBACK_RATE_STEP,
  TtsPlaybackRate,
  getPlaybackStartIndex,
  normalizePlaybackRate,
} from "../lib/tts-player";
import { 
  Play, 
  Pause,
  Square, 
  Loader2, 
  Sparkles, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  X, 
  Volume2, 
  RotateCcw,
  Download, 
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface ExplainDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  contextTitle: string;
  user: User | null;
  onSave?: (item: ExplanationItem) => void;
  existingItem?: ExplanationItem | null;
}

export default function ExplainDialog({
  isOpen,
  onClose,
  selectedText,
  contextTitle,
  user,
  onSave,
  existingItem
}: ExplainDialogProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  
  // Audio state
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("edge");
  const [ttsPlaybackRate, setTtsPlaybackRate] = useState<TtsPlaybackRate>(1);
  const [ttsVolume, setTtsVolume] = useState(1);
  const [hasCompleteTtsCache, setHasCompleteTtsCache] = useState(false);

  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const audioQueueRef = useRef<(string | null)[]>([]);
  const audioFetchPromisesRef = useRef<(Promise<string> | null)[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const geminiWarmupAbortControllerRef = useRef<AbortController | null>(null);
  const activeTtsCacheKeyRef = useRef("");

  // Keep track of provider and explanation for the cached audio
  const [cachedProvider, setCachedProvider] = useState<TtsProvider>("gemini");
  const [cachedExplanation, setCachedExplanation] = useState<string>("");

  // YouTube state
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [ytLoading, setYtLoading] = useState(false);

  const [firestoreId, setFirestoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const isCurrentTtsCacheComplete =
    hasCompleteTtsCache && cachedProvider === ttsProvider && cachedExplanation === explanation;

  // Re-run explain generation or load existing item
  useEffect(() => {
    if (!isOpen) return;

    if (existingItem) {
      setExplanation(existingItem.explanationText);
      setFirestoreId(existingItem.id);
      setLoading(false);
      setError(null);
      return;
    }

    // Reset states
    setExplanation("");
    setYoutubeVideoId(null);
    setFirestoreId(null);
    setError(null);
    setTtsWarning(null);
    stopTTS();

    generateExplanation();
    searchYouTubeVideo();
  }, [isOpen, selectedText, existingItem]);

  // Clean up audio on close
  useEffect(() => {
    return () => {
      stopTTS();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = ttsPlaybackRate;
    }
  }, [ttsPlaybackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = ttsVolume;
    }
  }, [ttsVolume]);

  useEffect(() => {
    if (!isOpen || !explanation) return;

    warmGeminiTTSCache(explanation);

    return () => {
      if (geminiWarmupAbortControllerRef.current) {
        geminiWarmupAbortControllerRef.current.abort();
        geminiWarmupAbortControllerRef.current = null;
      }
    };
  }, [isOpen, explanation]);

  const generateExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedText, contextTitle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setExplanation(data.explanation);

      // Save to Firestore automatically if user is authenticated
      if (user) {
        try {
          const docRef = await addDoc(collection(db, "explanations"), {
            userId: user.uid,
            selectedText,
            explanationText: data.explanation,
            createdAt: Timestamp.now().toDate().toISOString(),
          });
          setFirestoreId(docRef.id);
          if (onSave) {
            onSave({
              id: docRef.id,
              userId: user.uid,
              selectedText,
              explanationText: data.explanation,
              createdAt: Timestamp.now().toDate().toISOString(),
            });
          }
        } catch (fsErr) {
          console.error("Failed to save to Firestore:", fsErr);
          handleFirestoreError(fsErr, OperationType.CREATE, "explanations");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate explanation");
    } finally {
      setLoading(false);
    }
  };

  const getTtsCacheKey = (provider: TtsProvider, text: string) => `${provider}:${text}`;

  const isAudioCacheComplete = () =>
    chunksRef.current.length > 0 &&
    audioQueueRef.current.length === chunksRef.current.length &&
    audioQueueRef.current.every(Boolean);

  const activateTtsCache = (provider: TtsProvider, text: string, chunks: string[]) => {
    activeTtsCacheKeyRef.current = getTtsCacheKey(provider, text);
    chunksRef.current = chunks;
    audioQueueRef.current = new Array(chunks.length).fill(null);
    audioFetchPromisesRef.current = new Array(chunks.length).fill(null);
    currentChunkIndexRef.current = 0;
    setCachedProvider(provider);
    setCachedExplanation(text);
    setHasCompleteTtsCache(false);
  };

  const finishTTS = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setTtsLoading(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    currentChunkIndexRef.current = 0;
    setHasCompleteTtsCache(isAudioCacheComplete());
  };

  const stopTTS = () => {
    finishTTS();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (geminiWarmupAbortControllerRef.current) {
      geminiWarmupAbortControllerRef.current.abort();
      geminiWarmupAbortControllerRef.current = null;
    }
  };

  const pauseTTS = () => {
    if (!audioRef.current || !isPlayingRef.current) return;

    audioRef.current.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(true);
  };

  const resumeTTS = () => {
    if (!isPaused) return;

    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);

    if (audioRef.current) {
      audioRef.current.playbackRate = ttsPlaybackRate;
      audioRef.current.volume = ttsVolume;
      audioRef.current.play().catch((err) => {
        setError(err.message || "Failed to resume TTS");
        stopTTS();
      });
      return;
    }

    playNextChunk();
  };

  const fetchTtsAudioUrl = async (
    text: string,
    provider: TtsProvider,
    signal?: AbortSignal,
  ): Promise<string> => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, provider }),
      signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    if (data.fallback) {
      setTtsWarning("קריין Gemini אינו נתמך כעת בחשבון הגוגל שלך (הגבלת מודל/מכסה). המערכת העבירה אותך לקריין Edge.");
    }

    return `data:${data.mimeType || "audio/wav"};base64,${data.audio}`;
  };

  const fetchChunkTTS = async (
    text: string,
    index: number,
    provider: TtsProvider = ttsProvider,
    signal: AbortSignal | undefined = abortControllerRef.current?.signal,
  ): Promise<string> => {
    if (audioQueueRef.current[index]) {
      return audioQueueRef.current[index]!;
    }

    if (audioFetchPromisesRef.current[index]) {
      return audioFetchPromisesRef.current[index]!;
    }

    const cacheKey = activeTtsCacheKeyRef.current;
    const fetchPromise = fetchTtsAudioUrl(text, provider, signal)
      .then((url) => {
        if (activeTtsCacheKeyRef.current === cacheKey) {
          audioQueueRef.current[index] = url;
          setHasCompleteTtsCache(isAudioCacheComplete());
        }
        return url;
      })
      .finally(() => {
        if (activeTtsCacheKeyRef.current === cacheKey) {
          audioFetchPromisesRef.current[index] = null;
        }
      });

    audioFetchPromisesRef.current[index] = fetchPromise;
    return fetchPromise;
  };

  const warmGeminiTTSCache = (text: string) => {
    const provider: TtsProvider = "gemini";
    const cacheKey = getTtsCacheKey(provider, text);
    if (activeTtsCacheKeyRef.current === cacheKey && isAudioCacheComplete()) return;

    if (geminiWarmupAbortControllerRef.current) {
      geminiWarmupAbortControllerRef.current.abort();
    }

    if (activeTtsCacheKeyRef.current !== cacheKey) {
      activateTtsCache(provider, text, buildTtsChunks(text, provider));
    }

    if (chunksRef.current.length === 0) return;

    const warmupController = new AbortController();
    geminiWarmupAbortControllerRef.current = warmupController;

    Promise.all(
      chunksRef.current.map((chunk, index) =>
        fetchChunkTTS(chunk, index, provider, warmupController.signal),
      ),
    )
      .catch((err: any) => {
        if (err.name !== "AbortError") {
          console.error("[TTS Warmup] Gemini prefetch failed:", err);
        }
      })
      .finally(() => {
        if (geminiWarmupAbortControllerRef.current === warmupController) {
          geminiWarmupAbortControllerRef.current = null;
        }
      });
  };

  const prefetchNextChunks = () => {
    const nextIndex = currentChunkIndexRef.current + 1;
    if (nextIndex < chunksRef.current.length && !audioQueueRef.current[nextIndex]) {
      fetchChunkTTS(chunksRef.current[nextIndex], nextIndex, ttsProvider).catch((err) => {
        console.error(`Failed to prefetch chunk ${nextIndex}:`, err);
      });
    }
  };

  const playNextChunk = async () => {
    if (!isPlayingRef.current) return;

    const index = currentChunkIndexRef.current;
    if (index >= chunksRef.current.length) {
      finishTTS();
      return;
    }

    const text = chunksRef.current[index];
    let url = audioQueueRef.current[index];
    
    if (!url) {
      setTtsLoading(true);
      try {
        url = await fetchChunkTTS(text, index);
        setTtsLoading(false);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "TTS Chunk failed");
        stopTTS();
        return;
      }
    }

    if (!isPlayingRef.current) return;

    // Skip empty or invalid audio chunks gracefully
    const base64Data = url ? url.split(",")[1] : "";
    if (!base64Data || base64Data === "undefined" || base64Data === "") {
      console.log(`[TTS Player] Skipping empty chunk ${index}: "${text}"`);
      currentChunkIndexRef.current++;
      playNextChunk();
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    audioRef.current = new Audio(url);
    audioRef.current.playbackRate = ttsPlaybackRate;
    audioRef.current.volume = ttsVolume;
    audioRef.current.play().catch((err) => {
      setError(err.message || "Audio playback failed");
      stopTTS();
    });
    
    audioRef.current.onended = () => {
      currentChunkIndexRef.current++;
      playNextChunk();
    };

    audioRef.current.onerror = (e) => {
      console.error("Audio playback error:", e);
      currentChunkIndexRef.current++;
      playNextChunk();
    };

    prefetchNextChunks();
  };

  const startTTS = async (replayRequested = false) => {
    if (isPlaying && !replayRequested) {
      pauseTTS();
      return;
    }

    if (replayRequested) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
    }

    if (isPaused && !replayRequested) {
      resumeTTS();
      return;
    }

    if (!explanation) return;

    const isCacheValid = activeTtsCacheKeyRef.current === getTtsCacheKey(ttsProvider, explanation);
    
    if (!isCacheValid) {
      const chunks = buildTtsChunks(explanation, ttsProvider);
      console.log("[TTS Player] Built chunks:", chunks);
      activateTtsCache(ttsProvider, explanation, chunks);
    }

    currentChunkIndexRef.current = getPlaybackStartIndex({
      chunkCount: chunksRef.current.length,
      currentIndex: currentChunkIndexRef.current,
      isPaused,
      replayRequested,
    });
    abortControllerRef.current = new AbortController();
    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);

    playNextChunk();
  };

  const playTTS = () => {
    startTTS(false);
  };

  const replayTTS = () => {
    if (!isCurrentTtsCacheComplete || ttsLoading) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    startTTS(true);
  };

  const handleTtsProviderChange = (value: TtsProvider) => {
    setTtsProvider(value);
    if (value === "gemini" && explanation) {
      warmGeminiTTSCache(explanation);
      return;
    }

    if (geminiWarmupAbortControllerRef.current) {
      geminiWarmupAbortControllerRef.current.abort();
      geminiWarmupAbortControllerRef.current = null;
    }
  };

  const handlePlaybackRateChange = (value: string) => {
    setTtsPlaybackRate(normalizePlaybackRate(value));
  };

  // YouTube video search
  const searchYouTubeVideo = async () => {
    setYtLoading(true);
    setYoutubeVideoId(null);
    try {
      const cleanConcept = selectedText.length > 60 ? selectedText.substring(0, 60) : selectedText;
      const res = await fetch("/api/youtube-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanConcept, contextTitle }),
      });
      const data = await res.json();
      if (data.videoId) {
        setYoutubeVideoId(data.videoId);
        setYoutubeTitle(data.title || "סרטון הדרכה");
      }
    } catch (err) {
      console.error("Failed to search YouTube:", err);
    } finally {
      setYtLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--panel)] border border-[var(--border)] w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl text-[var(--text)] overflow-hidden" dir="rtl">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-black/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent)] text-white rounded-lg flex items-center justify-center font-bold text-lg">
              א
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[var(--text)]">עוזר למידה אלגוריתמי — "אני לא מבין"</h3>
              <p className="text-xs text-[var(--muted)]">{contextTitle || "ניתוח והסבר טקסט מסומן"}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/10 transition text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* DIALOG BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* User selection context */}
          <div className="bg-black/5 rounded-xl p-4 border border-[var(--border)] border-r-4 border-r-[var(--accent)]">
            <h4 className="text-xs font-bold text-[var(--muted)] mb-1">הטקסט שבחרת:</h4>
            <p className="text-sm italic text-[var(--text)] font-medium leading-relaxed">
              "{selectedText}"
            </p>
          </div>

          {/* Detailed Friendly Explanation */}
          <div className="bg-white/40 dark:bg-black/10 rounded-xl p-6 border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h4 className="font-bold text-base flex items-center gap-2">
                <Sparkles size={18} className="text-[var(--accent)]" />
                הסבר ידידותי וממוקד:
              </h4>

              {/* TTS Action */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <select
                  value={ttsProvider}
                  onChange={(e) => handleTtsProviderChange(e.target.value as TtsProvider)}
                  disabled={isPlaying || isPaused || ttsLoading}
                  className="bg-black/5 dark:bg-white/5 border border-[var(--border)] text-xs rounded-lg px-2 py-1.5 outline-none text-[var(--text)] font-semibold transition hover:border-[var(--accent)] focus:border-[var(--accent)] disabled:opacity-50 cursor-pointer"
                >
                  <option value="gemini">קריין Gemini</option>
                  <option value="edge">קריין Edge</option>
                </select>

                <div
                  className="flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-lg px-2 py-1.5 transition hover:border-[var(--accent)]"
                  title="מהירות הקריאה"
                >
                  <input
                    type="range"
                    min={TTS_PLAYBACK_RATE_MIN}
                    max={TTS_PLAYBACK_RATE_MAX}
                    step={TTS_PLAYBACK_RATE_STEP}
                    value={ttsPlaybackRate}
                    onChange={(e) => handlePlaybackRateChange(e.target.value)}
                    aria-label="מהירות הקריאה"
                    className="w-12 accent-[var(--accent)]"
                  />
                  <span className="text-xs font-black tabular-nums text-[var(--text)] min-w-10 text-center">
                    {ttsPlaybackRate.toFixed(2)}x
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-lg px-2 py-1.5 transition hover:border-[var(--accent)]"
                  title="עוצמת הקול"
                >
                  <Volume2 size={14} className="text-[var(--muted)] shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={ttsVolume}
                    onChange={(e) => setTtsVolume(Number(e.target.value))}
                    aria-label="עוצמת הקול"
                    className="w-12 accent-[var(--accent)]"
                  />
                  <span className="text-xs font-black tabular-nums text-[var(--text)] min-w-10 text-center">
                    {Math.round(ttsVolume * 100)}%
                  </span>
                </div>

                <button
                  onClick={playTTS}
                  disabled={loading || ttsLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    isPlaying 
                      ? "bg-red-500 text-white" 
                      : isPaused
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white"
                  } disabled:opacity-50`}
                >
                  {ttsLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isPlaying ? (
                    <Pause size={14} />
                  ) : isPaused ? (
                    <Play size={14} />
                  ) : (
                    <Volume2 size={14} />
                  )}
                  {isPlaying ? "השהה" : isPaused ? "המשך" : "הקרא"}
                </button>

                <button
                  onClick={replayTTS}
                  disabled={loading || ttsLoading || !isCurrentTtsCacheComplete}
                  className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="השמע שוב ללא יצירת קריין מחדש"
                >
                  <RotateCcw size={15} />
                </button>

                {(isPlaying || isPaused) && (
                  <button
                    onClick={stopTTS}
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-[var(--border)] text-red-500 hover:border-red-500 transition"
                    title="עצור"
                  >
                    <Square size={15} />
                  </button>
                )}
              </div>
              {ttsWarning && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                  ⚠️ {ttsWarning}
                </p>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
                <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
                <p className="text-sm font-medium">בונה הסבר ממוקד ומעודד... אנא המתן</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-[var(--text)] dark:prose-invert leading-relaxed">
                <ReactMarkdown>{explanation}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Interactive media tabs (YouTube Video) */}
          <div className="w-full">
            
            {/* YouTube Tutorial Video Card */}
            <div className="bg-white/30 dark:bg-black/5 rounded-xl p-5 border border-[var(--border)] flex flex-col space-y-3">
              <div className="flex items-center gap-2 text-[var(--text)] font-bold">
                <VideoIcon size={18} className="text-red-500" />
                <span>סרטון הדרכה מומלץ (YouTube)</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                סרטון הסבר רלוונטי שמצאנו עבורך ב-YouTube להמחשת המושג בצורה פשוטה.
              </p>

              {ytLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <Loader2 size={24} className="text-red-500 animate-spin" />
                  <p className="text-xs text-[var(--muted)]">מחפש סרטון מתאים ב-YouTube...</p>
                </div>
              ) : youtubeVideoId ? (
                <div className="relative rounded-lg overflow-hidden border border-[var(--border)] aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                    title={youtubeTitle}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center text-center text-[var(--muted)] space-y-1">
                  <AlertCircle size={24} className="text-[var(--muted)]" />
                  <p className="text-xs font-medium">לא נמצא סרטון הדרכה מתאים ב-YouTube</p>
                </div>
              )}
            </div>
          </div>

          {/* Non-auth friendly tip */}
          {!user && (
            <div className="bg-[var(--accent-tint)] border border-[var(--accent)]/20 p-3.5 rounded-xl text-xs text-[var(--text)] flex items-center gap-2.5">
              <CheckCircle size={16} className="text-[var(--accent)] shrink-0" />
              <span>
                <strong>טיפ למידה:</strong> התחבר באמצעות חשבון גוגל כדי לשמור את כל ההסברים, הציורים והסרטונים הללו ב<strong>מסך היסטוריית למידה</strong> אישית!
              </span>
            </div>
          )}

        </div>

        {/* DIALOG FOOTER */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-black/5 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-black/10 hover:bg-black/15 text-[var(--text)] font-bold text-sm rounded-xl transition"
          >
            סגור מדריך
          </button>
        </div>

      </div>
    </div>
  );
}
