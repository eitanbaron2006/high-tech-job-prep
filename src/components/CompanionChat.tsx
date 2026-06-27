import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, ChatThread } from "../types";
import { User } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, Timestamp, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Trash2, 
  Loader2, 
  Plus, 
  HelpCircle, 
  BrainCircuit, 
  MessageSquare,
  Sparkles,
  X
} from "lucide-react";

interface CompanionChatProps {
  user: User | null;
  onSelectThread?: (thread: ChatThread) => void;
  onClose?: () => void;
  highThinking?: boolean;
  setHighThinking?: (val: boolean) => void;
}

export default function CompanionChat({ user, onClose, highThinking: propHighThinking, setHighThinking: propSetHighThinking }: CompanionChatProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [localHighThinking, setLocalHighThinking] = useState(false);

  const isHighThinking = propHighThinking !== undefined ? propHighThinking : localHighThinking;
  const toggleHighThinking = () => {
    if (propSetHighThinking) {
      propSetHighThinking(!isHighThinking);
    } else {
      setLocalHighThinking(!isHighThinking);
    }
  };

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load threads from Firestore or use standard LocalStorage if guest
  useEffect(() => {
    if (user) {
      loadFirestoreThreads();
    } else {
      loadGuestThreads();
    }
  }, [user]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, loading]);

  const loadFirestoreThreads = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "chats"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const loaded: ChatThread[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        loaded.push({
          id: docSnap.id,
          userId: d.userId,
          title: d.title,
          messages: d.messages,
          createdAt: d.createdAt,
        });
      });

      setThreads(loaded);
      if (loaded.length > 0) {
        setActiveThread(loaded[0]);
      } else {
        createNewThread(loaded);
      }
    } catch (err) {
      console.error("Error loading chat threads:", err);
      handleFirestoreError(err, OperationType.GET, "chats");
    }
  };

  const loadGuestThreads = () => {
    const saved = localStorage.getItem("guest_chats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setThreads(parsed);
        if (parsed.length > 0) {
          setActiveThread(parsed[0]);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    createNewThread([]);
  };

  const createNewThread = async (currentThreads = threads) => {
    const newThread: ChatThread = {
      id: "temp_" + Date.now(),
      userId: user?.uid || "guest",
      title: "שיחה חדשה לגבי אלגוריתמים",
      messages: [
        {
          sender: "ai",
          text: "שלום! אני אלגו-באדי (AlgoBuddy), המנטור האישי שלך לראיונות אלגוריתמים והכנה להייטק. שאל אותי שאלות לגבי תבניות הקוד, בקש סימולציית ראיון בזמן אמת, או התייעץ איתי על בעיות קשות!",
          createdAt: Date.now(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    if (user) {
      try {
        const docRef = await addDoc(collection(db, "chats"), {
          userId: user.uid,
          title: newThread.title,
          messages: newThread.messages,
          createdAt: Timestamp.now().toDate().toISOString(),
        });
        const savedThread = { ...newThread, id: docRef.id };
        setThreads([savedThread, ...currentThreads]);
        setActiveThread(savedThread);
      } catch (err) {
        console.error("Failed to create thread in Firestore:", err);
        handleFirestoreError(err, OperationType.CREATE, "chats");
      }
    } else {
      const updated = [newThread, ...currentThreads];
      setThreads(updated);
      setActiveThread(newThread);
      localStorage.setItem("guest_chats", JSON.stringify(updated));
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
    if (activeThread.messages.length === 1 && activeThread.title.startsWith("שיחה חדשה")) {
      updatedThread.title = messageText.substring(0, 30) + "...";
    }

    setActiveThread(updatedThread);
    setLoading(true);

    try {
      // Map frontend messages to backend structure
      const apiMessages = updatedMessages.map((m) => ({
        role: m.sender === "ai" ? "assistant" : "user",
        text: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, highThinking: isHighThinking }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsg: ChatMessage = {
        sender: "ai",
        text: data.response,
        createdAt: Date.now(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      const finalThread = { ...updatedThread, messages: finalMessages };

      // Update thread states
      setActiveThread(finalThread);
      const updatedThreadsList = threads.map((t) => (t.id === activeThread.id ? finalThread : t));
      setThreads(updatedThreadsList);

      // Save database sync
      if (user && !activeThread.id.startsWith("temp_")) {
        try {
          await updateDoc(doc(db, "chats", activeThread.id), {
            messages: finalMessages,
            title: finalThread.title,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `chats/${activeThread.id}`);
        }
      } else if (!user) {
        localStorage.setItem("guest_chats", JSON.stringify(updatedThreadsList));
      }
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        sender: "ai",
        text: "מצטער, חלה שגיאה בקבלת התשובה. שים לב שאתה מחובר לאינטרנט או נסה שוב מאוחר יותר. שגיאה: " + error.message,
        createdAt: Date.now(),
      };
      const finalMessages = [...updatedMessages, errorMsg];
      const finalThread = { ...updatedThread, messages: finalMessages };
      setActiveThread(finalThread);
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("האם אתה בטוח שברצונך למחוק שיחה זו?");
    if (!confirmed) return;

    const filtered = threads.filter((t) => t.id !== id);
    setThreads(filtered);

    if (activeThread?.id === id) {
      setActiveThread(filtered.length > 0 ? filtered[0] : null);
    }

    if (user && !id.startsWith("temp_")) {
      try {
        await deleteDoc(doc(db, "chats", id));
      } catch (err) {
        console.error("Failed to delete thread from firestore:", err);
        handleFirestoreError(err, OperationType.DELETE, `chats/${id}`);
      }
    } else if (!user) {
      localStorage.setItem("guest_chats", JSON.stringify(filtered));
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
            className="p-1.5 bg-[var(--accent-tint)] hover:bg-[var(--accent-tint)]/80 text-[var(--accent)] rounded-lg transition cursor-pointer"
            title="שיחה חדשה"
          >
            <Plus size={16} />
          </button>

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
        
        {/* SIDEBAR THREADS LIST */}
        <div className="w-[150px] shrink-0 border-l border-[var(--border)] bg-[var(--accent-tint)]/15 overflow-y-auto hidden sm:block">
          <div className="p-3 space-y-1">
            <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider px-2 mb-2">שיחות קודמות</h4>
            {threads.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveThread(t)}
                className={`group p-2 rounded-lg cursor-pointer text-xs font-medium flex items-center justify-between transition ${
                  activeThread?.id === t.id
                    ? "bg-[var(--accent-tint)] text-[var(--accent)] border-r-3 border-[var(--accent)] font-bold"
                    : "text-[var(--text)] hover:bg-[var(--accent-tint)]/50"
                }`}
              >
                <span className="truncate max-w-[100px]">{t.title}</span>
                <button
                  onClick={(e) => deleteThread(t.id, e)}
                  className="p-1 text-[var(--muted)] hover:text-red-500 rounded transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* MESSAGES CONVERSATION WINDOW */}
        <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
          
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
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
                      ? "bg-[var(--accent)] text-white rounded-tr-none"
                      : "bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] rounded-tl-none"
                  }`}
                  style={{ fontSize: "0.8rem" }}
                >
                  <div className="prose prose-sm max-w-none text-inherit dark:prose-invert" style={{ fontSize: "inherit" }}>
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 max-w-[80%] ml-auto items-center">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)] flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="p-4 bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)] rounded-2xl rounded-tl-none flex items-center gap-2 text-xs font-medium shadow-xs">
                  <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                  <span>חושב על תשובה מעמיקה ומנסח...</span>
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
              placeholder="כתוב הודעה, שאל על קטע קוד או בקש סימולציה..."
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
