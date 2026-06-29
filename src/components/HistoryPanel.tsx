import React, { useState, useEffect } from "react";
import { ExplanationItem, ChatThread, GeneratedImage } from "../types";
import { User } from "firebase/auth";
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { fetchUserImages, getGuestImages, deleteGeneratedImage, downloadImage } from "../lib/gallery";
import {
  History,
  Trash2,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  Video as VideoIcon,
  Volume2,
  ExternalLink,
  BookOpen,
  Calendar,
  Loader2,
  Download
} from "lucide-react";

interface HistoryPanelProps {
  user: User | null;
  onOpenExplanation: (item: ExplanationItem) => void;
}

export default function HistoryPanel({ user, onOpenExplanation }: HistoryPanelProps) {
  const [explanations, setExplanations] = useState<ExplanationItem[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"explanations" | "chats" | "images">("explanations");

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      loadGuestLocalHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch explanation history
      let expList: ExplanationItem[] = [];
      try {
        const expQuery = query(
          collection(db, "explanations"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const expSnap = await getDocs(expQuery);
        expSnap.forEach((docSnap) => {
          const d = docSnap.data();
          expList.push({
            id: docSnap.id,
            userId: d.userId,
            selectedText: d.selectedText,
            explanationText: d.explanationText,
            audioBase64: d.audioBase64,
            imageUrl: d.imageUrl,
            videoUrl: d.videoUrl,
            videoOperationName: d.videoOperationName,
            createdAt: d.createdAt,
          });
        });
      } catch (err) {
        console.error("Error loading explanations:", err);
        handleFirestoreError(err, OperationType.GET, "explanations");
      }
      setExplanations(expList);

      // 2. Fetch chat history
      let chatList: ChatThread[] = [];
      try {
        const chatQuery = query(
          collection(db, "chats"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const chatSnap = await getDocs(chatQuery);
        chatSnap.forEach((docSnap) => {
          const d = docSnap.data();
          chatList.push({
            id: docSnap.id,
            userId: d.userId,
            title: d.title,
            messages: d.messages,
            createdAt: d.createdAt,
          });
        });
      } catch (err) {
        console.error("Error loading chats:", err);
        handleFirestoreError(err, OperationType.GET, "chats");
      }
      setChats(chatList);

      // 3. Fetch generated image gallery
      try {
        setImages(await fetchUserImages(user.uid));
      } catch (err) {
        console.error("Error loading images:", err);
        handleFirestoreError(err, OperationType.GET, "images");
      }
    } catch (err) {
      console.error("Error loading history from database:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadGuestLocalHistory = () => {
    const localChats = localStorage.getItem("guest_chats");
    if (localChats) {
      try {
        setChats(JSON.parse(localChats));
      } catch (e) {
        console.error(e);
      }
    }
    // Set empty explanations for guests
    setExplanations([]);
    setImages(getGuestImages());
  };

  const handleDeleteImage = async (item: GeneratedImage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("האם למחוק תמונה זו מהגלריה?")) return;
    setImages((prev) => prev.filter((img) => img.id !== item.id));
    try {
      await deleteGeneratedImage(item, user?.uid || null);
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  const deleteExplanation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("האם למחוק פריט היסטוריה זה?");
    if (!confirmed) return;

    setExplanations(explanations.filter((exp) => exp.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, "explanations", id));
      } catch (err) {
        console.error("Error deleting explanation:", err);
        handleFirestoreError(err, OperationType.DELETE, `explanations/${id}`);
      }
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("he-IL", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl p-6 space-y-6" dir="rtl">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2.5">
          <History className="text-[var(--accent)]" size={24} />
          <div>
            <h3 className="font-extrabold text-lg text-[var(--text)]">היסטוריית הלמידה והשינון שלך</h3>
            <p className="text-xs text-[var(--muted)]">סקור קטעי קוד שהסברת, סרטונים שייצרת, ותרגל שוב את הנאמר.</p>
          </div>
        </div>
        <button 
          onClick={fetchHistory}
          className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-tint)] px-3 py-1.5 rounded-lg transition hover:brightness-95"
        >
          רענן היסטוריה
        </button>
      </div>

      {/* Auth State warning */}
      {!user && (
        <div className="bg-[var(--accent-tint)] border border-[var(--accent)]/20 p-4 rounded-xl text-sm text-[var(--text)] flex items-center gap-3">
          <Calendar className="text-[var(--accent)] shrink-0" size={20} />
          <span>
            <strong>שים לב:</strong> מאחר ואתה לומד כאורח, ההיסטוריה שלך תישמר מקומית בלבד. התחבר עם חשבון גוגל למעלה כדי לשמור את כל חומרי הראיונות, הציורים וההסברים שלך לצמיתות בענן!
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("explanations")}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${
            activeTab === "explanations"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          קטעים שהוסברו והוורדו ({explanations.length})
        </button>
        <button
          onClick={() => setActiveTab("chats")}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${
            activeTab === "chats"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          סימולציות וצ'אטים ({chats.length})
        </button>
        <button
          onClick={() => setActiveTab("images")}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${
            activeTab === "images"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          גלריית תמונות ({images.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--muted)]">
          <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
          <p className="text-sm font-medium">טוען היסטוריה אישית...</p>
        </div>
      ) : activeTab === "explanations" ? (
        explanations.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)] text-sm space-y-2">
            <BookOpen className="mx-auto" size={32} />
            <p className="font-bold text-[var(--text)]">אין עדיין קטעי הסבר בהיסטוריה</p>
            <p>סמן טקסט כלשהו במדריך האלגוריתמים ולחץ על "אני לא מבין 🧠" כדי להתחיל ללמוד!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {explanations.map((exp) => (
              <div
                key={exp.id}
                onClick={() => onOpenExplanation(exp)}
                className="bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] p-4 rounded-xl flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-md transition space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold bg-black/5 text-[var(--muted)] px-2 py-1 rounded">
                      {formatDate(exp.createdAt)}
                    </span>
                    <button
                      onClick={(e) => deleteExplanation(exp.id, e)}
                      className="p-1.5 text-[var(--muted)] hover:text-red-500 rounded-lg hover:bg-black/5 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <h4 className="font-extrabold text-sm text-[var(--text)] line-clamp-1 mb-1">
                    "{exp.selectedText}"
                  </h4>
                  <p className="text-xs text-[var(--muted)] line-clamp-3 leading-relaxed">
                    {exp.explanationText.replace(/[*_#`~[\]()]/g, "")}
                  </p>
                </div>

                {/* Badges of generated items */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    {exp.audioBase64 && (
                      <span className="p-1.5 bg-green-500/10 text-green-600 rounded-full" title="הוקלט קול">
                        <Volume2 size={12} />
                      </span>
                    )}
                    {exp.imageUrl && (
                      <span className="p-1.5 bg-blue-500/10 text-blue-600 rounded-full" title="תרשים ויזואלי מוכן">
                        <ImageIcon size={12} />
                      </span>
                    )}
                    {exp.videoUrl && (
                      <span className="p-1.5 bg-purple-500/10 text-purple-600 rounded-full" title="סרטון וידאו הופק">
                        <VideoIcon size={12} />
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-[var(--accent)] flex items-center gap-1">
                    פתור שוב
                    <ExternalLink size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === "chats" ? (
        chats.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)] text-sm space-y-2">
            <MessageSquare className="mx-auto" size={32} />
            <p className="font-bold text-[var(--text)]">אין עדיין שיחות בהיסטוריה</p>
            <p>פתח את מסך הצ'אט AlgoBuddy למעלה כדי להתחיל לשאול ולבצע סימולציות!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="bg-[var(--bg)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between transition shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[var(--accent-tint)] text-[var(--accent)] rounded-lg flex items-center justify-center shrink-0">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-[var(--text)]">{chat.title}</h4>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {chat.messages.length} הודעות בשיחה · נוצר ב-{formatDate(chat.createdAt)}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-[var(--muted)]">
                  נשמר בהיסטוריה
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        images.length === 0 ? (
          <div className="py-12 text-center text-[var(--muted)] text-sm space-y-2">
            <ImageIcon className="mx-auto" size={32} />
            <p className="font-bold text-[var(--text)]">אין עדיין תמונות בגלריה</p>
            <p>בקש מ-AlgoBuddy בצ'אט "צור לי אינפוגרפיקה על..." וכל תמונה שתיווצר תישמר כאן להורדה.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col shadow-xs hover:border-[var(--accent)] transition"
              >
                <div className="relative">
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full h-36 object-contain bg-white"
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => downloadImage(img.url, `algobuddy-${img.id}.png`)}
                      className="flex items-center gap-1 bg-black/70 hover:bg-black/85 text-white text-[11px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                      title="הורד תמונה"
                    >
                      <Download size={12} />
                      הורד
                    </button>
                    <button
                      onClick={(e) => handleDeleteImage(img, e)}
                      className="bg-black/70 hover:bg-red-600 text-white p-1 rounded-lg cursor-pointer"
                      title="מחק תמונה"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="p-2.5 flex flex-col gap-1">
                  <p className="text-[11px] text-[var(--text)] line-clamp-2 leading-snug">{img.prompt}</p>
                  <span className="text-[10px] text-[var(--muted)]">{formatDate(img.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

    </div>
  );
}
