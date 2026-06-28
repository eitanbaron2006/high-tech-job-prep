import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, ChatThread } from "../types";
import { User } from "firebase/auth";
import { collection, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import ReactMarkdown from "react-markdown";
import {
  NEW_CHAT_TITLE,
  createChatTitleFromMessage,
  createFreshChatThread,
} from "../lib/chat-thread";
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2, 
  Plus, 
  MessageSquare,
  X
} from "lucide-react";

interface CompanionChatProps {
  user: User | null;
  onClose?: () => void;
  highThinking?: boolean;
}

export default function CompanionChat({ user, onClose, highThinking = false }: CompanionChatProps) {
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Start each chat surface with one active conversation only.
  useEffect(() => {
    createNewThread();
  }, [user]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, loading]);

  const createNewThread = () => {
    const newThread = createFreshChatThread({
      id: "temp_" + Date.now(),
      userId: user?.uid || "guest",
      createdAt: new Date().toISOString(),
    });

    setInput("");
    setActiveThread(newThread);
  };

  const getGuestThreads = (): ChatThread[] => {
    try {
      return JSON.parse(localStorage.getItem("guest_chats") || "[]");
    } catch (e) {
      console.error(e);
      return [];
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
        body: JSON.stringify({ messages: apiMessages, highThinking }),
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

      setActiveThread(finalThread);

      // Save database sync
      if (user && activeThread.id.startsWith("temp_")) {
        try {
          const docRef = await addDoc(collection(db, "chats"), {
            userId: user.uid,
            title: finalThread.title,
            messages: finalMessages,
            createdAt: Timestamp.now().toDate().toISOString(),
          });
          setActiveThread({ ...finalThread, id: docRef.id });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "chats");
        }
      } else if (user) {
        try {
          await updateDoc(doc(db, "chats", activeThread.id), {
            messages: finalMessages,
            title: finalThread.title,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `chats/${activeThread.id}`);
        }
      } else if (!user) {
        const guestThreads = getGuestThreads();
        const existingThreadIndex = guestThreads.findIndex((t) => t.id === activeThread.id);
        const updatedThreadsList =
          existingThreadIndex >= 0
            ? guestThreads.map((t) => (t.id === activeThread.id ? finalThread : t))
            : [finalThread, ...guestThreads];
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
                      ? "companion-chat-bubble-user bg-[var(--accent)] text-white rounded-tl-none"
                      : "bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] rounded-tr-none"
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
                <div className="p-4 bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)] rounded-2xl rounded-tr-none flex items-center gap-2 text-xs font-medium shadow-xs">
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
