import React, { useState, useEffect, useRef } from "react";
import { ExplanationItem } from "../types";
import { User } from "firebase/auth";
import { collection, addDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import ReactMarkdown from "react-markdown";
import { 
  Play, 
  Square, 
  Loader2, 
  Sparkles, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  X, 
  Volume2, 
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
  const [ttsProvider, setTtsProvider] = useState<"gemini" | "edge">("edge");

  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const audioQueueRef = useRef<(string | null)[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep track of provider and explanation for the cached audio
  const [cachedProvider, setCachedProvider] = useState<"gemini" | "edge">("gemini");
  const [cachedExplanation, setCachedExplanation] = useState<string>("");

  // YouTube state
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [ytLoading, setYtLoading] = useState(false);

  const [firestoreId, setFirestoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

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

  // Helper to split text into readable chunks for TTS (only used for Edge)
  const splitTextIntoChunks = (text: string): string[] => {
    const paragraphs = text.split(/\n+/);
    const chunks: string[] = [];
    
    for (const para of paragraphs) {
      const cleanPara = para.trim().replace(/[*_#`~[\]()]/g, "").replace(/<[^>]*>/g, "");
      if (!cleanPara) continue;
      
      if (cleanPara.length > 350) {
        const sentences = cleanPara.split(/(?<=[.!?])\s+/);
        let currentChunk = "";
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > 350) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += " " + sentence;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
      } else {
        chunks.push(cleanPara);
      }
    }
    return chunks;
  };

  const stopTTS = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setTtsLoading(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const fetchChunkTTS = async (text: string, index: number): Promise<string> => {
    if (audioQueueRef.current[index]) {
      return audioQueueRef.current[index]!;
    }

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, provider: ttsProvider }),
      signal: abortControllerRef.current?.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    if (data.fallback) {
      setTtsWarning("קריין Gemini אינו נתמך כעת בחשבון הגוגל שלך (הגבלת מודל/מכסה). המערכת העבירה אותך לקריין Edge.");
    }

    const url = `data:${data.mimeType || "audio/wav"};base64,${data.audio}`;
    audioQueueRef.current[index] = url;
    return url;
  };

  const prefetchNextChunks = () => {
    if (ttsProvider !== "edge") return;
    
    const nextIndex = currentChunkIndexRef.current + 1;
    if (nextIndex < chunksRef.current.length && !audioQueueRef.current[nextIndex]) {
      fetchChunkTTS(chunksRef.current[nextIndex], nextIndex).catch((err) => {
        console.error(`Failed to prefetch chunk ${nextIndex}:`, err);
      });
    }
  };

  const playNextChunk = async () => {
    if (!isPlayingRef.current) return;

    const index = currentChunkIndexRef.current;
    if (index >= chunksRef.current.length) {
      stopTTS();
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
    audioRef.current.play();
    
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

  const playTTS = async () => {
    if (isPlaying) {
      stopTTS();
      return;
    }

    if (!explanation) return;

    abortControllerRef.current = new AbortController();
    
    const isCacheValid = cachedProvider === ttsProvider && cachedExplanation === explanation;
    
    if (!isCacheValid) {
      chunksRef.current = ttsProvider === "gemini" 
        ? [explanation] 
        : splitTextIntoChunks(explanation);
        
      console.log("[TTS Player] Built chunks:", chunksRef.current);
      currentChunkIndexRef.current = 0;
      audioQueueRef.current = new Array(chunksRef.current.length).fill(null);
      setCachedProvider(ttsProvider);
      setCachedExplanation(explanation);
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    playNextChunk();
  };

  // YouTube video search
  const searchYouTubeVideo = async () => {
    setYtLoading(true);
    setYoutubeVideoId(null);
    try {
      const cleanConcept = selectedText.length > 40 ? selectedText.substring(0, 40) : selectedText;
      const res = await fetch("/api/youtube-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanConcept }),
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
                הסבר ידידותי ומפורט:
              </h4>

              {/* TTS Action */}
              <div className="flex items-center gap-2">
                <select
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value as "gemini" | "edge")}
                  disabled={isPlaying || ttsLoading}
                  className="bg-black/5 dark:bg-white/5 border border-[var(--border)] text-xs rounded-lg px-2 py-1.5 outline-none text-[var(--text)] font-semibold transition hover:border-[var(--accent)] focus:border-[var(--accent)] disabled:opacity-50 cursor-pointer"
                >
                  <option value="gemini">קריין Gemini (איכותי)</option>
                  <option value="edge">קריין Edge (חופשי ומהיר)</option>
                </select>

                <button
                  onClick={playTTS}
                  disabled={loading || ttsLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    isPlaying 
                      ? "bg-red-500 text-white" 
                      : "bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white"
                  } disabled:opacity-50`}
                >
                  {ttsLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isPlaying ? (
                    <Square size={14} />
                  ) : (
                    <Volume2 size={14} />
                  )}
                  {isPlaying ? "עצור הקראה" : "הקרא הסבר בקול"}
                </button>
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
                <p className="text-sm font-medium">בונה הסבר מפורט ומעודד... אנא המתן</p>
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
