import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, ChatThread } from "../types";
import { User } from "firebase/auth";
import { collection, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import {
  LEGACY_GUEST_CHAT_HISTORY_KEY,
  NEW_CHAT_TITLE,
  createChatTitleFromMessage,
  getActiveChatStorageKey,
  getChatHistoryStorageKey,
  normalizeChatThreadForHistory,
  resolveInitialChatThread,
  sanitizeChatMessagesForStorage,
  upsertChatThread,
} from "../lib/chat-thread";
import { createLocalImageKey, saveGeneratedImage, downloadImage } from "../lib/gallery";
import { hydrateChatThreadImages } from "../lib/local-image-store";
import {
  Send,
  Bot,
  User as UserIcon,
  Loader2,
  Plus,
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  Download
} from "lucide-react";

const CHAT_REQUEST_TIMEOUT_MS = 180_000;

interface CompanionChatProps {
  user: User | null;
  onClose?: () => void;
  highThinking?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onAutoWidth?: (width: number) => void;
  onImageGenerated?: () => void;
}

export default function CompanionChat({ user, onClose, highThinking = false, isFullscreen = false, onToggleFullscreen, onAutoWidth, onImageGenerated }: CompanionChatProps) {
  const currentUserId = user?.uid || "guest";
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const activeThreadRef = useRef<ChatThread | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const latestUserMessage =
    [...(activeThread?.messages || [])].reverse().find((m) => m.sender === "user")?.text || "";
  const isWaitingForImage = /תמונה|איור|אינפוגרפיקה|תרשים|דיאגרמה|צייר|ויזואלית|cheat sheet/i.test(
    latestUserMessage
  );

  // Auto-fit: report the widest natural content (code blocks / images) so the
  // floating window can grow to fit it.
  const measureContentWidth = () => {
    const el = messagesRef.current;
    if (!el || !onAutoWidth) return;
    let maxW = 0;
    el.querySelectorAll("pre").forEach((n) => {
      maxW = Math.max(maxW, (n as HTMLElement).scrollWidth);
    });
    el.querySelectorAll("img").forEach((n) => {
      const img = n as HTMLImageElement;
      maxW = Math.max(maxW, Math.min(img.naturalWidth || 0, 520));
    });
    if (maxW > 0) onAutoWidth(maxW + 130);
  };

  const setActiveThreadAndRef = (thread: ChatThread | null) => {
    activeThreadRef.current = thread;
    setActiveThread(thread);
  };

  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  useEffect(() => {
    measureContentWidth();
    const el = messagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measureContentWidth());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.messages]);

  const getStoredActiveThread = (): ChatThread | null => {
    try {
      const rawThread = localStorage.getItem(getActiveChatStorageKey(currentUserId));
      return rawThread ? JSON.parse(rawThread) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const persistActiveChatThread = (thread: ChatThread) => {
    try {
      localStorage.setItem(
        getActiveChatStorageKey(currentUserId),
        JSON.stringify(normalizeChatThreadForHistory(thread))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Restore the user's active conversation unless they explicitly start a new one.
  useEffect(() => {
    setInput("");
    const initialThread = resolveInitialChatThread({
      storedThread: getStoredActiveThread(),
      userId: currentUserId,
      now: new Date(),
    });

    setActiveThreadAndRef(initialThread);
    void hydrateChatThreadImages(initialThread).then((hydratedThread) => {
      if (activeThreadRef.current?.id === hydratedThread.id) {
        setActiveThreadAndRef(hydratedThread);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  useEffect(() => {
    if (!activeThread || activeThread.userId !== currentUserId) return;
    persistActiveChatThread(activeThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread, currentUserId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, loading]);

  const createNewThread = () => {
    const now = new Date();
    const newThread = resolveInitialChatThread({
      storedThread: null,
      userId: currentUserId,
      now,
    });

    setInput("");
    setActiveThreadAndRef(newThread);
  };

  const getStoredChatHistory = (): ChatThread[] => {
    try {
      const primary = JSON.parse(localStorage.getItem(getChatHistoryStorageKey(currentUserId)) || "[]");
      if (currentUserId !== "guest") return primary;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_GUEST_CHAT_HISTORY_KEY) || "[]");
      return [...primary, ...legacy];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const persistLocalChatHistory = (thread: ChatThread, previousId?: string) => {
    try {
      const nextThreads = upsertChatThread(getStoredChatHistory(), thread, previousId);
      localStorage.setItem(getChatHistoryStorageKey(currentUserId), JSON.stringify(nextThreads));
      if (currentUserId === "guest") {
        localStorage.setItem(LEGACY_GUEST_CHAT_HISTORY_KEY, JSON.stringify(nextThreads));
      }
    } catch (e) {
      console.error("Failed to save local chat history:", e);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const messageText = customPrompt || input;
    if (!messageText.trim() || !activeThread || loading) return;

    if (!customPrompt) setInput("");

    const userMsg: ChatMessage = {
      sender: "user",
      text: messageText,
      createdAt: Date.now(),
    };

    const updatedMessages = [...activeThread.messages, userMsg];
    const updatedThread = { ...activeThread, messages: updatedMessages };

    // Set first messages title based on prompt
    if (activeThread.messages.length === 1 && activeThread.title.startsWith(NEW_CHAT_TITLE)) {
      updatedThread.title = createChatTitleFromMessage(messageText);
    }

    setActiveThreadAndRef(updatedThread);
    persistActiveChatThread(updatedThread);
    setLoading(true);

    try {
      // Map frontend messages to backend structure
      const apiMessages = updatedMessages.map((m) => ({
        role: m.sender === "ai" ? "assistant" : "user",
        text: m.text,
      }));

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, highThinking }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      let aiMsg: ChatMessage;
      if (data.type === "image" && data.imageUrl) {
        const imageCreatedAt = Date.now();
        const localImageKey = createLocalImageKey(user?.uid || null, imageCreatedAt);
        aiMsg = {
          sender: "ai",
          text: data.prompt
            ? `הנה התרשים שיצרתי עבורך: ${data.prompt}`
            : "הנה התרשים שיצרתי עבורך:",
          imageUrl: data.imageUrl,
          localImageKey,
          imagePrompt: data.prompt || messageText,
          createdAt: imageCreatedAt,
        };

        // Show the generated image immediately. Gallery persistence can be slow
        // or fail independently, and must not keep the chat in a loading state.
        void saveGeneratedImage(user?.uid || null, data.imageUrl, data.prompt || messageText, localImageKey)
          .then((saved) => {
            const currentThread = activeThreadRef.current;
            if (!currentThread) return;

            const nextThread = {
              ...currentThread,
              messages: currentThread.messages.map((m) =>
                m.sender === "ai" && m.createdAt === imageCreatedAt
                  ? { ...m, imageUrl: saved.url, localImageKey: saved.localImageKey || localImageKey }
                  : m
              ),
            };

            setActiveThreadAndRef(nextThread);
            persistActiveChatThread(nextThread);
            persistLocalChatHistory(nextThread);
            onImageGenerated?.();

            if (user && !nextThread.id.startsWith("temp_") && !saved.localOnly) {
              void updateDoc(doc(db, "chats", nextThread.id), {
                messages: sanitizeChatMessagesForStorage(nextThread.messages),
              }).catch((err) => {
                console.error("Failed to update chat image URL in history:", err);
              });
            }
          })
          .catch((err) => {
            console.error("Failed to save generated image:", err);
          });
      } else {
        aiMsg = {
          sender: "ai",
          text: data.response,
          createdAt: Date.now(),
        };
      }

      const finalMessages = [...updatedMessages, aiMsg];
      const finalThread = { ...updatedThread, messages: finalMessages };

      setActiveThreadAndRef(finalThread);
      setLoading(false);
      persistActiveChatThread(finalThread);
      persistLocalChatHistory(finalThread);

      // Save database sync
      if (user && activeThread.id.startsWith("temp_")) {
        try {
          const docRef = await addDoc(collection(db, "chats"), {
            userId: user.uid,
            title: finalThread.title,
            messages: sanitizeChatMessagesForStorage(finalMessages),
            createdAt: Timestamp.now().toDate().toISOString(),
          });
          const savedThread = { ...finalThread, id: docRef.id };
          persistActiveChatThread(savedThread);
          persistLocalChatHistory(savedThread, finalThread.id);
          setActiveThreadAndRef(activeThreadRef.current ? { ...activeThreadRef.current, id: docRef.id } : savedThread);
        } catch (err) {
          console.error("Failed to save chat history:", err);
        }
      } else if (user) {
        try {
          await updateDoc(doc(db, "chats", activeThread.id), {
            messages: sanitizeChatMessagesForStorage(finalMessages),
            title: finalThread.title,
          });
        } catch (err) {
          console.error("Failed to update chat history:", err);
        }
      } else if (!user) {
        persistLocalChatHistory(finalThread);
      }
    } catch (error: any) {
      const message =
        error?.name === "AbortError"
          ? "הבקשה לקחה יותר מדי זמן והופסקה. יצירת תמונה יכולה להיות איטית כרגע; נסה שוב בעוד רגע או בקש תמונה פשוטה יותר."
          : error.message;
      const errorMsg: ChatMessage = {
        sender: "ai",
        text: "מצטער, חלה שגיאה בקבלת התשובה. שים לב שאתה מחובר לאינטרנט או נסה שוב מאוחר יותר. שגיאה: " + message,
        createdAt: Date.now(),
      };
      const finalMessages = [...updatedMessages, errorMsg];
      const finalThread = { ...updatedThread, messages: finalMessages };
      setActiveThreadAndRef(finalThread);
      persistActiveChatThread(finalThread);
    } finally {
      setLoading(false);
    }
  };

  const presetPrompts = [
    { label: "התחל סימולציית ראיון 🎯", text: "אני רוצה שנתחיל סימולציה של ראיון הייטק מעשי בנושא אלגוריתמים. שאל אותי שאלת LeetCode בינונית והנחה אותי." },
    { label: "טיפ מעשי לראיון בזמן אמת 💡", text: "תן לי כמה טיפים מעשיים איך להתמודד עם לחץ בראיון, איך להסביר סיבוכיות בקול רם, ואיך לחשוב ביחד עם המראיין." },
    { label: "שאלת תכנון דינמי קשה 🚀", text: "אתגר אותי בשאלת תכנון דינמי (Dynamic Programming) מעניינת מראיונות עבודה והסבר את שלבי הפתרון." },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[var(--panel)]" dir="rtl">
      
      {/* CHAT HEADER */}
      <div className="bg-[var(--panel)] border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-[var(--accent)]" />
          <h3 className="font-extrabold text-base text-[var(--text)]">AlgoBuddy</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => createNewThread()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-tint)] text-[var(--accent)] hover:brightness-95 rounded-lg transition text-xs font-extrabold disabled:opacity-50"
            title="שיחה חדשה"
          >
            <Plus size={14} />
            שיחה חדשה
          </button>
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 hover:bg-[var(--accent-tint)] text-[var(--muted)] hover:text-[var(--text)] rounded-lg transition cursor-pointer"
              title={isFullscreen ? "צא ממסך מלא" : "מסך מלא"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--accent-tint)] text-[var(--muted)] hover:text-[var(--text)] rounded-lg transition cursor-pointer"
              title="סגור צ'אט"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* MESSAGES CONVERSATION WINDOW */}
        <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
          
          {/* Messages list */}
          <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4">

            {activeThread?.messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${
                  m.sender === "user" ? "mr-auto flex-row-reverse" : "ml-auto"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  m.sender === "user" ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]"
                }`}>
                  {m.sender === "user" ? <UserIcon size={16} /> : <Bot size={16} />}
                </div>

                <div 
                  className={`companion-chat-bubble p-4 rounded-2xl leading-relaxed text-[0.8rem] shadow-xs ${
                    m.sender === "user"
                      ? "companion-chat-bubble-user bg-[var(--accent)] text-white rounded-tl-none"
                      : "bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] rounded-tr-none"
                  }`}
                  style={{ fontSize: "0.8rem" }}
                >
                  <div className="prose prose-sm max-w-none text-inherit dark:prose-invert" style={{ fontSize: "inherit" }}>
                    <ReactMarkdown rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}>
                      {m.text}
                    </ReactMarkdown>
                  </div>

                  {m.imageUrl && (
                    <div className="mt-2 relative group">
                      <img
                        src={m.imageUrl}
                        alt={m.imagePrompt || "תמונה שנוצרה"}
                        onLoad={measureContentWidth}
                        className="rounded-xl border border-[var(--border)] max-w-full w-[460px] max-h-[420px] object-contain bg-white"
                      />
                      <button
                        onClick={() =>
                          downloadImage(m.imageUrl!, `algobuddy-${m.createdAt}.png`)
                        }
                        className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 hover:bg-black/85 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer opacity-0 group-hover:opacity-100"
                        title="הורד תמונה"
                      >
                        <Download size={13} />
                        הורד
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 max-w-[80%] ml-auto items-center">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)] flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="p-4 bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)] rounded-2xl rounded-tr-none flex items-center gap-2 text-xs font-medium shadow-xs">
                  <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                  <span>{isWaitingForImage ? "יוצר תמונה ומכין אותה להצגה..." : "חושב על תשובה מעמיקה ומנסח..."}</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Preset Prompts */}
          {activeThread?.messages.length === 1 && (
            <div className="p-3 border-t border-[var(--border)] bg-[var(--accent-tint)]/25 overflow-x-auto flex gap-2 shrink-0">
              {presetPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.text)}
                  className="px-3 py-1.5 bg-[var(--panel)] hover:bg-[var(--accent-tint)] border border-[var(--border)] hover:border-[var(--accent)] rounded-full text-xs font-medium text-[var(--text)] transition cursor-pointer shrink-0"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-[var(--border)] bg-[var(--panel)] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="כתוב הודעה, בקש סימולציה או בקש תמונה/אינפוגרפיקה..."
              className="flex-1 bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)] transition"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl transition disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
