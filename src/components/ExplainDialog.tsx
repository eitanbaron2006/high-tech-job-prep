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

  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const audioQueueRef = useRef<(string | null)[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Image state
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgSize, setImgSize] = useState<"1K" | "2K" | "4K">("1K");
  const [imgLoading, setImgLoading] = useState(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);

  // Video state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [operationName, setOperationName] = useState<string | null>(null);

  const [firestoreId, setFirestoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-run explain generation or load existing item
  useEffect(() => {
    if (!isOpen) return;

    if (existingItem) {
      setExplanation(existingItem.explanationText);
      setGeneratedImg(existingItem.imageUrl || null);
      setVideoUrl(existingItem.videoUrl || null);
      setFirestoreId(existingItem.id);
      setLoading(false);
      setError(null);
      return;
    }

    // Reset states
    setExplanation("");
    setGeneratedImg(null);
    setVideoUrl(null);
    setOperationName(null);
    setFirestoreId(null);
    setError(null);
    stopTTS();

    // Auto-generate default prompts based on selected text
    const textSnippet = selectedText.length > 50 ? selectedText.substring(0, 50) + "..." : selectedText;
    setImgPrompt(`Visual explanation diagram of: ${textSnippet}`);
    setVideoPrompt(`Educational animation showing ${textSnippet}`);

    generateExplanation();
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

  // Helper to split text into readable chunks for TTS
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
      body: JSON.stringify({ text }),
      signal: abortControllerRef.current?.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const url = `data:audio/wav;base64,${data.audio}`;
    audioQueueRef.current[index] = url;
    return url;
  };

  const prefetchNextChunks = () => {
    const currentIndex = currentChunkIndexRef.current;
    for (let i = 1; i <= 2; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < chunksRef.current.length && !audioQueueRef.current[nextIndex]) {
        fetchChunkTTS(chunksRef.current[nextIndex], nextIndex).catch((err) => {
          console.error(`Failed to prefetch chunk ${nextIndex}:`, err);
        });
      }
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
    chunksRef.current = splitTextIntoChunks(explanation);
    currentChunkIndexRef.current = 0;
    audioQueueRef.current = new Array(chunksRef.current.length).fill(null);
    isPlayingRef.current = true;
    setIsPlaying(true);

    playNextChunk();
  };

  // Image diagram generator
  const generateDiagram = async () => {
    setImgLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt, size: imgSize }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGeneratedImg(data.imageUrl);

      // Update in firestore if saved
      if (user && firestoreId) {
        try {
          await updateDoc(doc(db, "explanations", firestoreId), {
            imageUrl: data.imageUrl
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `explanations/${firestoreId}`);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate illustration");
    } finally {
      setImgLoading(false);
    }
  };

  // Video generator logic with polling
  const generateVideo = async () => {
    setVideoLoading(true);
    setVideoStatus("מאתחל יצירת סרטון...");
    setError(null);
    try {
      const startRes = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: videoPrompt, aspectRatio }),
      });
      const startData = await startRes.json();
      if (startData.error) throw new Error(startData.error);

      const opName = startData.operationName;
      setOperationName(opName);

      // Save operation in firestore
      if (user && firestoreId) {
        try {
          await updateDoc(doc(db, "explanations", firestoreId), {
            videoOperationName: opName
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `explanations/${firestoreId}`);
        }
      }

      // Start polling
      pollVideoStatus(opName);
    } catch (err: any) {
      setError(err.message || "Failed to generate video");
      setVideoLoading(false);
    }
  };

  const pollVideoStatus = (opName: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      setVideoStatus(`מייצר סרטון... (${attempts * 5}שנ' חלפו. אנא המתן, יצירת סרטונים ב-AI לוקחת 1-3 דקות)`);
      try {
        const checkRes = await fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName: opName }),
        });
        const checkData = await checkRes.json();

        if (checkData.done) {
          clearInterval(interval);
          setVideoStatus("הסרטון מוכן! מוריד ומזרים את הקובץ...");
          downloadVideo(opName);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);
  };

  const downloadVideo = async (opName: string) => {
    try {
      const dlRes = await fetch("/api/video-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName: opName }),
      });
      if (!dlRes.ok) throw new Error("Video download failed");

      const blob = await dlRes.blob();
      const localUrl = URL.createObjectURL(blob);
      setVideoUrl(localUrl);

      // Save locally/update firestore if required
      if (user && firestoreId) {
        try {
          await updateDoc(doc(db, "explanations", firestoreId), {
            videoUrl: localUrl
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `explanations/${firestoreId}`);
        }
      }
    } catch (err: any) {
      setError("טעינת הסרטון נכשלה: " + err.message);
    } finally {
      setVideoLoading(false);
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

          {/* Interactive media tabs (Image/Video AI generators) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* AI Image Illustration Generator */}
            <div className="bg-white/30 dark:bg-black/5 rounded-xl p-5 border border-[var(--border)] flex flex-col space-y-3">
              <div className="flex items-center gap-2 text-[var(--text)] font-bold">
                <ImageIcon size={18} className="text-[var(--accent)]" />
                <span>צור תרשים ויזואלי להסבר (AI Illustration)</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                יצרן תרשימים באמצעות Gemini. הסבר גרפי מדויק לאלגוריתם שבחרת.
              </p>

              {generatedImg ? (
                <div className="relative rounded-lg overflow-hidden border border-[var(--border)] bg-black/5">
                  <img src={generatedImg} alt="AI Diagram" className="w-full h-auto max-h-60 object-contain" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => setGeneratedImg(null)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                    placeholder="תיאור התרשים שברצונך ליצור..."
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[var(--muted)]">רזולוציה:</span>
                      {(["1K", "2K", "4K"] as const).map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setImgSize(sz)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                            imgSize === sz
                              ? "bg-[var(--accent)] text-white"
                              : "bg-black/5 text-[var(--text)]"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={generateDiagram}
                      disabled={imgLoading || loading}
                      className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {imgLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      צור תרשים
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* AI Video Tutorial Generator (VEO) */}
            <div className="bg-white/30 dark:bg-black/5 rounded-xl p-5 border border-[var(--border)] flex flex-col space-y-3">
              <div className="flex items-center gap-2 text-[var(--text)] font-bold">
                <VideoIcon size={18} className="text-[var(--accent)]" />
                <span>צור סרטון הדרכה באנימציה (AI Video)</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                יצירת סרטון אנימציה קצר המסביר את החומר בלוח לבן ואינטראקטיבי באמצעות Veo 3.
              </p>

              {videoUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-[var(--border)] bg-black/20">
                  <video src={videoUrl} controls className="w-full h-auto max-h-60 object-contain" />
                  <button 
                    onClick={() => setVideoUrl(null)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : videoLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <Loader2 size={32} className="text-[var(--accent)] animate-spin" />
                  <p className="text-xs font-bold text-[var(--text)]">{videoStatus}</p>
                  <p className="text-[10px] text-[var(--muted)] max-w-xs">
                    שירות יצירת וידאו של Veo בונה סרטוני המחשה של הייטק. אנא אל תסגור חלון זה.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="תיאור סרטון ההדרכה..."
                    className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[var(--muted)]">יחס מסך:</span>
                      {(["16:9", "9:16"] as const).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                            aspectRatio === ratio
                              ? "bg-[var(--accent)] text-white"
                              : "bg-black/5 text-[var(--text)]"
                          }`}
                        >
                          {ratio === "16:9" ? "16:9 רוחבי" : "9:16 אורכי"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={generateVideo}
                      disabled={videoLoading || loading}
                      className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles size={12} />
                      צור וידאו
                    </button>
                  </div>
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
