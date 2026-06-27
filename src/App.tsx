import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sun, 
  Moon, 
  BookOpen, 
  MessageSquare, 
  History, 
  LogIn, 
  LogOut, 
  Menu, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Sparkles, 
  Copy, 
  Check, 
  ArrowLeft,
  Briefcase,
  Layers,
  Search,
  Code2,
  GitMerge,
  Maximize2,
  Brain,
  Puzzle,
  Lock,
  HelpCircle,
  Trophy,
  PlayCircle,
  GraduationCap,
  CheckSquare,
  FileText,
  Video,
  Home
} from "lucide-react";
import { auth, loginWithGoogle, logout } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { puzzlesData } from "./puzzlesData";
import { ExplanationItem, ChatThread } from "./types";
import ExplainDialog from "./components/ExplainDialog";
import CompanionChat from "./components/CompanionChat";
import HistoryPanel from "./components/HistoryPanel";

const DEFAULT_PATTERNS = [
  { id: "two-pointers", name: "שני מצביעים", desc: "Two Pointers - מעבר יעיל משני קצוות המערך" },
  { id: "sliding-window", name: "חלון מחליק", desc: "Sliding Window - מעקב אחר תת-מערך רציף דינמי" },
  { id: "hash-map", name: "מפת גיבוב", desc: "Hash Map - בדיקת שייכות ושמירת זוגות מפתח-ערך ב-O(1)" },
  { id: "bfs-dfs", name: "סריקת גרפים ועצים", desc: "BFS / DFS - מעבר שכבתי או לעומק של מבני נתונים" },
  { id: "dp", name: "תכנון דינמי", desc: "Dynamic Programming - שמירת פתרונות של תת-בעיות" },
  { id: "heap", name: "ערימה / תור עדיפויות", desc: "Heap / Priority Queue - שליפת מינימום/מקסימום ב-O(1)" },
  { id: "binary-search", name: "חיפוש בינארי על התשובה", desc: "Binary Search on Answer - צמצום טווח האפשרויות בחצי" },
  { id: "monotonic-stack", name: "מחסנית מונוטונית", desc: "Monotonic Stack - מציאת האיבר הבא הגדול/הקטן ביותר" }
];

const getDailyRecommendation = () => {
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const today = new Date().getDay();
  const dayName = days[today];
  
  const recommendations = [
    { pattern: "שני מצביעים (Two Pointers)", task: "לתרגל את שאלת כיווץ המערך וסכימת שני מספרים" },
    { pattern: "חלון מחליק (Sliding Window)", task: "להבין את ההבדל בין חלון דינמי לחלון בגודל קבוע" },
    { pattern: "מפת גיבוב (Hash Map)", task: "לפתור שאלות מציאת כפילויות ב-O(1)" },
    { pattern: "סריקת גרפים ועצים (BFS/DFS)", task: "לתרגל חיפוש מסלול קצר ביותר בגרף שכבתי" },
    { pattern: "תכנון דינמי (Dynamic Programming)", task: "להבין את אלגוריתם קדיין (Kadane) למציאת תת-מערך מקסימלי" },
    { pattern: "ערימה / תור עדיפויות (Heap / Priority Queue)", task: "ללמוד איך למצוא את ה-K האיברים הגדולים ביותר" },
    { pattern: "חיפוש בינארי על התשובה", task: "להבין איך לבצע חיפוש בינארי על טווח ערכים (התשובה)" },
    { pattern: "מחסנית מונוטונית (Monotonic Stack)", task: "להבין מתי משתמשים במחסנית ששומרת על סדר עולה/יורד" }
  ];
  
  const rec = recommendations[today % recommendations.length];
  return {
    day: dayName,
    pattern: rec.pattern,
    task: rec.task
  };
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = useState<"home" | "guide" | "history">("guide");
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [completedPatterns, setCompletedPatterns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("completed_patterns");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("completed_patterns", JSON.stringify(completedPatterns));
  }, [completedPatterns]);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);

  const getYouTubeEmbedUrl = (url: string) => {
    try {
      let videoId = "";
      if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1].split("?")[0];
      } else if (url.includes("youtube.com/watch")) {
        const urlParams = new URLSearchParams(new URL(url).search);
        videoId = urlParams.get("v") || "";
      } else if (url.includes("youtube.com/embed/")) {
        videoId = url.split("youtube.com/embed/")[1].split("?")[0];
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch (e) {
      return null;
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState("intro");

  // Selection states
  const [selectedText, setSelectedText] = useState("");
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [contextTitle, setContextTitle] = useState("מדריך אלגוריתמים לראיונות");

  // History action restore states
  const [historyExplainItem, setHistoryExplainItem] = useState<ExplanationItem | null>(null);

  // Copy code helpers
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  // Puzzle open states
  const [openPuzzles, setOpenPuzzles] = useState<Record<number, boolean>>({});

  // Expanded FAQ state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Active section scroll tracking
  const sectionsRef = {
    intro: useRef<HTMLDivElement>(null),
    complexity: useRef<HTMLDivElement>(null),
    "two-pointers": useRef<HTMLDivElement>(null),
    "sliding-window": useRef<HTMLDivElement>(null),
    "hash-map": useRef<HTMLDivElement>(null),
    "bfs-dfs": useRef<HTMLDivElement>(null),
    dp: useRef<HTMLDivElement>(null),
    heap: useRef<HTMLDivElement>(null),
    "binary-search": useRef<HTMLDivElement>(null),
    "monotonic-stack": useRef<HTMLDivElement>(null),
    puzzles: useRef<HTMLDivElement>(null),
    tips: useRef<HTMLDivElement>(null)
  };

  useEffect(() => {
    // Sync Firebase user state
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
    });
    return () => unsubscribe();
  }, []);

  // Set dark mode attribute on mount and state change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Document selection change listener to trigger "אני לא מבין"
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelectionCoords(null);
        return;
      }
      const text = sel.toString().trim();
      
      // We only offer explain for sentences/phrases of reasonable length
      if (text.length > 6 && text.length < 1500) {
        setSelectedText(text);
        
        // Try to identify which section the user selected in
        let anchorParent = sel.anchorNode?.parentElement;
        let matchedSection = "מדריך אלגוריתמים לראיונות";
        while (anchorParent) {
          if (anchorParent.tagName === "SECTION" && anchorParent.id) {
            matchedSection = anchorParent.querySelector("h2")?.textContent || anchorParent.id;
            break;
          }
          anchorParent = anchorParent.parentElement;
        }
        setContextTitle(matchedSection);

        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectionCoords({
            x: rect.left + window.scrollX + rect.width / 2,
            y: rect.top + window.scrollY - 46
          });
        } catch (e) {
          // Fallback if coordinate bounding box fails in standard browser context
          setSelectionCoords({
            x: window.innerWidth / 2,
            y: window.scrollY + 200
          });
        }
      }
    };

    document.addEventListener("mouseup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
    };
  }, []);

  // Set active section on scroll 
  useEffect(() => {
    if (activeTab !== "guide") return;

    const handleScroll = () => {
      const y = window.scrollY + 120;
      let active = "intro";
      Object.entries(sectionsRef).forEach(([id, ref]) => {
        if (ref.current) {
          const top = ref.current.getBoundingClientRect().top + window.scrollY;
          if (top <= y) {
            active = id;
          }
        }
      });
      setActiveNavSection(active);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeTab]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedTextId(id);
      setTimeout(() => setCopiedTextId(null), 1500);
    });
  };

  const togglePuzzle = (num: number) => {
    setOpenPuzzles(prev => ({ ...prev, [num]: !prev[num] }));
  };

  const scrollToSection = (id: keyof typeof sectionsRef) => {
    setActiveTab("guide");
    setSidebarOpen(false);
    setTimeout(() => {
      sectionsRef[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Nav sections up/down buttons
  const orderedSections: Array<keyof typeof sectionsRef> = [
    "intro", "complexity", "two-pointers", "sliding-window", "hash-map",
    "bfs-dfs", "dp", "heap", "binary-search", "monotonic-stack", "puzzles", "tips"
  ];

  const scrollRelative = (direction: "up" | "down") => {
    const currentIdx = orderedSections.indexOf(activeNavSection as any);
    if (currentIdx === -1) return;
    
    let targetIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    targetIdx = Math.max(0, Math.min(orderedSections.length - 1, targetIdx));
    
    scrollToSection(orderedSections[targetIdx]);
  };

  if (!user || activeTab === "home") {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300 flex flex-col" dir="rtl">
        {/* Public Header */}
        <header className="sticky top-0 bg-[var(--panel)]/95 backdrop-blur-md border-b border-[var(--border)] z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent)] text-white font-black flex items-center justify-center text-base shadow-sm shrink-0">
                אל
              </div>
              <div className="flex flex-col justify-center select-none text-right gap-0.5">
                <h1 className="font-extrabold text-sm sm:text-base leading-none text-[var(--text)] m-0 p-0">אלגוריתמים לראיונות</h1>
                <p className="text-[10px] text-[var(--muted)] leading-none m-0 p-0">מדריך הכנה אינטראקטיבי להייטק</p>
              </div>
            </div>

            {/* Navigation links in public header */}
            <nav className="hidden md:flex items-center gap-6">
              <a
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
              >
                בית
              </a>
              <a
                onClick={() => scrollToId("features-section")}
                className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
              >
                מה בפלטפורמה
              </a>
              <a
                onClick={() => scrollToId("patterns")}
                className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
              >
                תבניות הליבה
              </a>
              <a
                onClick={() => scrollToId("faq-section")}
                className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
              >
                שאלות נפוצות
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <button 
                className="theme-btn" 
                onClick={toggleTheme}
                aria-label="החלף עיצוב"
              >
                <span className="text-sm">{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}</span>
                <span className="hidden sm:inline">{theme === "dark" ? "מצב בהיר" : "מצב כהה"}</span>
              </button>

              {user ? (
                <>
                  <button
                    onClick={() => { setActiveTab("guide"); setSidebarOpen(false); }}
                    className="flex items-center gap-1.5 bg-[var(--accent)] text-white font-extrabold text-xs sm:text-sm py-2 px-4 rounded-xl hover:brightness-105 active:scale-95 transition cursor-pointer shadow-sm"
                  >
                    <BookOpen size={14} />
                    <span>מדריך הכנה</span>
                  </button>
                  <div className="flex items-center gap-2 border-r border-[var(--border)] pr-2 sm:pr-3 mr-1 shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] font-black flex items-center justify-center border border-[var(--accent)]/30 shrink-0 select-none text-xs">
                        {user.displayName?.charAt(0) || "U"}
                      </div>
                      <div className="hidden md:block text-right overflow-hidden leading-none">
                        <p className="text-xs font-black truncate text-[var(--text)] m-0 p-0">{user.displayName}</p>
                      </div>
                    </div>
                    <button 
                      onClick={logout}
                      className="p-1.5 hover:bg-red-500/10 text-[var(--muted)] hover:text-red-500 rounded-lg transition cursor-pointer shrink-0"
                      title="התנתק"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="flex items-center gap-1.5 bg-[var(--accent)] text-white font-extrabold text-xs sm:text-sm py-2 px-4 rounded-xl hover:brightness-105 active:scale-95 transition cursor-pointer shadow-sm"
                >
                  <LogIn size={14} />
                  <span>התחבר עם Google</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Landing Page Content */}
        <main className="max-w-5xl mx-auto px-4 py-12 sm:py-16 space-y-20 text-right flex-1">
          {/* HERO SECTION */}
          <div className="text-center space-y-6 max-w-3xl mx-auto py-8 flex flex-col items-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] text-xs font-black tracking-wide border border-[var(--accent)]/10">
              <Sparkles size={12} className="text-[var(--accent)] animate-pulse" />
              הכנה מעשית חכמה לראיונות הייטק
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-[var(--text)] tracking-tight leading-tight text-center">
              אל תשנן שאלות. <br />
              למד <span className="text-[var(--accent)] relative inline-block">לזהות תבניות<span className="absolute bottom-1 left-0 w-full h-1 bg-[var(--accent)]/20 rounded"></span></span>
            </h1>
            <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed font-medium text-center">
              מדריך הכנה אינטראקטיבי מוביל המשלב ניתוח מעשי של 8 תבניות קוד מרכזיות, 16 חידות זיהוי מקוריות, וליווי צמוד של בינה מלאכותית מבוססת קול ותמונות.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full">
              {user ? (
                <button
                  onClick={() => { setActiveTab("guide"); setSidebarOpen(false); }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--accent)] hover:brightness-105 text-white font-black text-sm py-3 px-8 rounded-xl shadow-md cursor-pointer transition active:scale-95"
                >
                  <BookOpen size={16} />
                  המשך ללמוד במדריך
                </button>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--accent)] hover:brightness-105 text-white font-black text-sm py-3 px-8 rounded-xl shadow-md cursor-pointer transition active:scale-95"
                >
                  <LogIn size={16} />
                  התחל ללמוד עכשיו בחינם
                </button>
              )}
              <a
                href="#patterns"
                className="w-full sm:w-auto text-center border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] font-extrabold text-sm py-3 px-8 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                ראה את תבניות הליבה ⬇
              </a>
            </div>

            <div className="flex items-center justify-center gap-8 pt-8 border-t border-[var(--border)]/60 w-full max-w-md mx-auto">
              <div className="text-center">
                <div className="text-2xl font-black text-[var(--accent)]">8</div>
                <div className="text-[10px] text-[var(--muted)] font-bold">תבניות ליבה</div>
              </div>
              <div className="text-center border-r border-[var(--border)] pr-8">
                <div className="text-2xl font-black text-[var(--accent)]">16</div>
                <div className="text-[10px] text-[var(--muted)] font-bold">חידות זיהוי</div>
              </div>
              <div className="text-center border-r border-[var(--border)] pr-8">
                <div className="text-2xl font-black text-[var(--accent)]">24</div>
                <div className="text-[10px] text-[var(--muted)] font-bold">שאלות LeetCode</div>
              </div>
            </div>
          </div>

          {/* FEATURES GRID */}
          <div id="features-section" className="scroll-mt-20 space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center gap-2.5">
              <Brain size={24} className="text-[var(--accent)]" />
              <span>מה מחכה לך בפלטפורמה האינטראקטיבית?</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <h3 className="font-extrabold text-base text-[var(--text)]">המדריך המלא ותבניות קוד</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  קרא חומר עיוני מקיף, ניתוחי סיבוכיות Big-O מפורטים, ו-24 שאלות ראיון פתורות במלואן עם קוד תקין מוכן להרצה בשפות תכנות פופולריות.
                </p>
              </div>

              <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-extrabold text-base text-[var(--text)]">עוזר למידה אינטראקטיבי AI</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  נתקלת בקטע לא ברור? סמן כל מילה או שורה במדריך ולחץ <strong>"אני לא מבין 🧠"</strong>. העוזר ייצר עבורך הסבר פשוט, קולי וחזותי מותאם אישית!
                </p>
              </div>

              <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                  <Puzzle size={20} />
                </div>
                <h3 className="font-extrabold text-base text-[var(--text)]">16 חידות "זהה את התבנית"</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  הלב של שיטת הלימוד: שאלות אלגוריתמיות אמיתיות שמוצגות ללא כותרת הנושא. תרגל את היכולת הקריטית ביותר בראיון — להבין איזו גישה מתאימה לבעיה.
                </p>
              </div>

              <div className="bg-[var(--panel)] border border-[var(--border)] p-6 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <h3 className="font-extrabold text-base text-[var(--text)]">כרטיסיות שינון ומעקב התקדמות</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  עקוב אחר המוכנות שלך לראיונות בעזרת tracker אינטראקטיבי, ושמור את כל הסברי ה-AI המותאמים אישית לכרטיסיות שינון נוחות לחזרה מהירה.
                </p>
              </div>
            </div>
          </div>

          {/* 8 PATTERNS PREVIEW SECTION */}
          <div id="patterns" className="scroll-mt-20 space-y-6 pt-4">
            <div className="text-right space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text)] flex items-center gap-2.5">
                {!user && <Lock size={22} className="text-[var(--accent)]" />}
                <span>8 תבניות הליבה לראיונות {user ? "(לחץ על תבנית כדי להתחיל ללמוד)" : "(התחבר כדי לפתוח)"}</span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                אלו הן שמונה התבניות האלגוריתמיות המכסות מעל 85% מכלל שאלות הראיונות בחברות המובילות.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEFAULT_PATTERNS.map((pat) => (
                <div
                  key={pat.id}
                  onClick={() => {
                    if (user) {
                      scrollToSection(pat.id as any);
                    } else {
                      loginWithGoogle();
                    }
                  }}
                  className="bg-[var(--panel)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border border-[var(--border)] p-5 rounded-2xl transition cursor-pointer flex flex-col justify-between min-h-[160px] text-right group relative overflow-hidden shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-black text-[var(--accent)]">תבנית {pat.name}</div>
                    <p className="text-[11px] text-[var(--muted)] line-clamp-3 leading-snug m-0">{pat.desc}</p>
                  </div>
                  <div className="text-[10px] font-black text-[var(--accent)] flex items-center gap-1.5 mt-auto">
                    <span>קרא והתאמן במדריך</span>
                    {!user && <Lock size={12} className="text-[var(--accent)]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ SECTION */}
          <div id="faq-section" className="scroll-mt-20 space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center gap-2.5">
              <HelpCircle size={22} className="text-[var(--accent)]" />
              <span>שאלות נפוצות</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-[var(--text)]">למי האתר מיועד?</h4>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  האתר נועד לבוגרי מדעי המחשב, מהנדסי תוכנה שמחפשים עבודה, ולכל מי שרוצה להתכונן בצורה חכמה ומרוכזת לראיונות אלגוריתמים (Coding interviews).
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-[var(--text)]">מה מייחד את האתר מ-LeetCode?</h4>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  במקום לפתור מאות שאלות באקראי ולשנן פתרונות, אנו מלמדים אותך את שמונת הדפוסים הבסיסיים ומאמנים אותך לזהות איזה דפוס מתאים לכל בעיה חדשה.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-[var(--text)]">האם עוזר ה-AI דורש הרשמה?</h4>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  כן, כדי שנוכל לשמור את שיחות הצ'אט שלך וליצור עבורך כרטיסיות שינון אישיות בהיסטוריה, נדרשת הרשמה פשוטה ומהירה באמצעות Google.
                </p>
              </div>
            </div>
          </div>

          {/* BOTTOM CTA */}
          <div className="p-8 sm:p-12 rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent-tint)] text-center space-y-6 max-w-3xl mx-auto shadow-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-sm">
              <Trophy size={24} />
            </div>
            <h2 className="text-2xl font-black text-[var(--text)] leading-tight text-center">התחל את ההכנה המעשית שלך עוד היום</h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] max-w-lg mx-auto text-center">
              אלפי מועמדים כבר מבינים ששליטה בתבניות אלגוריתמיות היא הדרך המהירה והבטוחה ביותר לעבור בהצלחה את שלבי הסינון הטכניים.
            </p>
            {user ? (
              <button
                onClick={() => { setActiveTab("guide"); setSidebarOpen(false); }}
                className="inline-flex items-center gap-2 bg-[var(--accent)] hover:brightness-105 text-white font-black text-sm py-3 px-8 rounded-xl shadow-md cursor-pointer transition active:scale-95"
              >
                <BookOpen size={16} />
                המשך ללמוד במדריך
              </button>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-2 bg-[var(--accent)] hover:brightness-105 text-white font-black text-sm py-3 px-8 rounded-xl shadow-md cursor-pointer transition active:scale-95"
              >
                <LogIn size={16} />
                התחבר עם Google והתחל מיד
              </button>
            )}
          </div>
        </main>

        {/* Public Footer */}
        <footer className="text-center text-xs text-[var(--muted)] border-t border-[var(--border)] pt-8 pb-12">
          מדריך אלגוריתמים לראיונות הייטק · בנוי לזיהוי מהיר של תבניות
          <br />
          <span className="text-[10px] mt-1 block">כל הזכויות שמורות © {new Date().getFullYear()}</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300 flex flex-col" dir="rtl">
      
      {/* FLOATING IN-CONTEXT TRIGGER BUTTON */}
      {selectionCoords && activeTab === "guide" && (
        <button
          style={{
            position: "absolute",
            top: `${selectionCoords.y}px`,
            left: `${selectionCoords.x}px`,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
          onClick={() => {
            setHistoryExplainItem(null); // Fresh explain
            setIsExplainOpen(true);
            setSelectionCoords(null);
          }}
          className="bg-[var(--accent)] text-white text-xs font-black px-4 py-2 rounded-full flex items-center gap-1.5 shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer"
        >
          <Sparkles size={13} className="animate-pulse" />
          <span>אני לא מבין 🧠</span>
        </button>
      )}

      {/* GLOBAL STICKY HEADER FOR LOGGED-IN USERS */}
      <header className="sticky top-0 bg-[var(--panel)]/95 backdrop-blur-md border-b border-[var(--border)] z-50 select-none w-full">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4 relative">
          <div className="flex items-center gap-3">
            {activeTab === "guide" && (
              <button 
                className="menu-btn shrink-0" 
                onClick={() => setSidebarOpen(true)}
                aria-label="פתח תפריט"
              >
                ☰
              </button>
            )}
            
            {/* Brand Logo & Name */}
            <div 
              onClick={() => { setActiveTab("guide"); setSidebarOpen(false); }}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all z-20"
              title="חזור למדריך"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0">
                אל
              </div>
              <div className="flex flex-col justify-center select-none text-right gap-0.5">
                <h1 className="font-extrabold text-xs sm:text-sm leading-none text-[var(--text)] m-0 p-0">אלגוריתמים לראיונות</h1>
                <p className="text-[9px] text-[var(--muted)] leading-none m-0 p-0">מדריך הכנה אינטראקטיבי</p>
              </div>
            </div>

          </div>

          {/* Center Navigation Links */}
          <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6 z-10">
            <a
              onClick={() => { setActiveTab("home"); setSidebarOpen(false); }}
              className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
            >
              דף הבית
            </a>
            
            {activeTab === "guide" ? (
              <a
                onClick={() => { setActiveTab("history"); setSidebarOpen(false); }}
                className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
              >
                היסטוריה
              </a>
            ) : (
              <a
                onClick={() => { setActiveTab("guide"); setSidebarOpen(false); }}
                className="text-xs sm:text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer hover:underline decoration-2 underline-offset-4"
              >
                מדריך הכנה
              </a>
            )}
          </nav>
 
          {/* Left action area */}
          <div className="flex items-center gap-2 sm:gap-3 mr-auto z-20">
            {/* Theme Toggle Button */}
            <button 
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer shrink-0" 
              onClick={toggleTheme}
              aria-label="החלף עיצוב"
              title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Connected User Profile - NO EMAIL */}
            {user && (
              <div className="flex items-center gap-2 border-r border-[var(--border)] pr-2 sm:pr-3 mr-1 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] font-black flex items-center justify-center border border-[var(--accent)]/30 shrink-0 select-none text-xs">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                  <div className="hidden md:block text-right overflow-hidden leading-none">
                    <p className="text-xs font-black truncate text-[var(--text)] m-0 p-0">{user.displayName}</p>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="p-1.5 hover:bg-red-500/10 text-[var(--muted)] hover:text-red-500 rounded-lg transition cursor-pointer shrink-0"
                  title="התנתק"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main body with layout class */}
      <div className="layout flex-1 flex" dir="rtl">
        
        {/* ============ SIDEBAR (Only shown in guide tab) ============ */}
        {activeTab === "guide" && (
          <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} id="sidebar">
 
            {/* MAIN NAVIGATION SCROLL */}
            <div className="nav-scroll">
              <nav>
                <div className="nav-group">
                  <div className="gtitle">התחלה</div>
                  <button 
                    onClick={() => scrollToSection("intro")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "intro" ? "active" : ""}`}
                  >
                    סקירה כללית
                  </button>
                  <button 
                    onClick={() => scrollToSection("complexity")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "complexity" ? "active" : ""}`}
                  >
                    סיבוכיות — המדריך למתחיל
                  </button>
                </div>

                <div className="nav-group">
                  <div className="gtitle">8 התבניות הנפוצות</div>
                  <button 
                    onClick={() => scrollToSection("two-pointers")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "two-pointers" ? "active" : ""}`}
                  >
                    1 · שני מצביעים
                  </button>
                  <button 
                    onClick={() => scrollToSection("sliding-window")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "sliding-window" ? "active" : ""}`}
                  >
                    2 · חלון מחליק
                  </button>
                  <button 
                    onClick={() => scrollToSection("hash-map")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "hash-map" ? "active" : ""}`}
                  >
                    3 · מפת גיבוב
                  </button>
                  <button 
                    onClick={() => scrollToSection("bfs-dfs")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "bfs-dfs" ? "active" : ""}`}
                  >
                    4 · סריקת גרפים ועצים
                  </button>
                  <button 
                    onClick={() => scrollToSection("dp")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "dp" ? "active" : ""}`}
                  >
                    5 · תכנון דינמי
                  </button>
                  <button 
                    onClick={() => scrollToSection("heap")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "heap" ? "active" : ""}`}
                  >
                    6 · ערימה / תור עדיפויות
                  </button>
                  <button 
                    onClick={() => scrollToSection("binary-search")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "binary-search" ? "active" : ""}`}
                  >
                    7 · חיפוש בינארי על התשובה
                  </button>
                  <button 
                    onClick={() => scrollToSection("monotonic-stack")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "monotonic-stack" ? "active" : ""}`}
                  >
                    8 · מחסנית מונוטונית
                  </button>
                </div>

                <div className="nav-group">
                  <div className="gtitle">אימון ושינון</div>
                  <button 
                    onClick={() => scrollToSection("puzzles")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "puzzles" ? "active" : ""}`}
                  >
                    זהה את התבנית · 16 חידות
                  </button>
                  <button 
                    onClick={() => scrollToSection("tips")} 
                    className={`nav text-right w-full block transition cursor-pointer ${activeTab === "guide" && activeNavSection === "tips" ? "active" : ""}`}
                  >
                    טיפים אחרונים לראיון
                  </button>
                </div>
              </nav>
            </div>

            {/* High thinking mode toggle */}
            <div className="px-5 py-2.5 border-t border-[var(--border)] shrink-0 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none justify-start">
                <input 
                  type="checkbox" 
                  checked={highThinking}
                  onChange={() => setHighThinking(!highThinking)}
                  className="accent-[var(--accent)] cursor-pointer w-4 h-4 shrink-0"
                />
                <span className="text-xs font-black flex items-center gap-1.5 text-[var(--text)] whitespace-nowrap">
                  <Brain size={14} className="text-[var(--accent)] shrink-0" />
                  מצב חשיבה גבוהה (Gemini Pro)
                </span>
              </label>
            </div>

            {/* PDF Full download button remains */}
            <div className="dl-wrap shrink-0">
              <a className="dl-btn text-center cursor-pointer font-bold" href="מדריך_אלגוריתמים_מלא.pdf" download>
                ⬇ הורד PDF מלא לשינון
              </a>
            </div>
          </aside>
        )}

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && activeTab === "guide" && (
          <div 
            className="overlay show" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ============ MAIN CONTENT AREA ============ */}
        <main className="content">
          
          {/* CONDITIONAL TAB RENDER WITH TRANSITIONS */}
          <AnimatePresence mode="wait">

          {activeTab === "guide" && (
            <motion.div
              key="guide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              
              {/* HERO */}
              <div ref={sectionsRef.intro} id="intro" style={{ scrollMarginTop: "0" }}>
                <div className="hero">
                  <div className="kick font-bold">הכנה מהירה וחכמה לראיונות הייטק</div>
                  <h1 className="font-extrabold">מדריך הכנה לראיונות <span className="hl">אלגוריתמים</span></h1>
                  <p>
                    ברוכים הבאים למרכז ההכנה האינטראקטיבי שלך. המדריך נועד לעזור לך לזהות דפוסי אלגוריתמים נפוצים בראיונות אמת ולפתור שאלות ביעילות, תוך ליווי של עוזר למידה מבוסס בינה מלאכותית לקבלת הסברים מותאמים אישית בקול ותמונות.
                  </p>
                  <div className="stats">
                    <div className="stat">
                      <div className="num">8</div>
                      <div className="lbl">תבניות ליבה</div>
                    </div>
                    <div className="stat">
                      <div className="num">16</div>
                      <div className="lbl">חידות זיהוי</div>
                    </div>
                    <div className="stat">
                      <div className="num">24</div>
                      <div className="lbl">שאלות פתורות</div>
                    </div>
                  </div>
                </div>
                <p className="section-intro">
                  המדריך בנוי בשלושה חלקים: קודם <strong>מבינים סיבוכיות</strong> (כדי שכל ניתוח Big-O יהיה ברור), אחר כך <strong>לומדים את 8 התבניות</strong> עם שאלות פתורות, ולבסוף <strong>מתאמנים על זיהוי</strong> עם חידות בלי שם האלגוריתם. השתמש בתפריט הצד או הציפה כדי להפעיל את תומך ה-AI!
                </p>

                {/* DYNAMIC RECOMMENDATION OF THE DAY */}
                {(() => {
                  const rec = getDailyRecommendation();
                  return (
                    <div id="rec-section" className="scroll-mt-20 p-5 rounded-xl border border-[var(--accent)] bg-[var(--accent-tint)] text-right flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm mb-8">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-black text-[var(--accent)] uppercase tracking-wider">
                          <Sparkles size={14} className="animate-pulse" />
                          <span>המלצת הלימוד של יום {rec.day}</span>
                        </div>
                        <h3 className="text-base font-bold text-[var(--text)]">היום מתמקדים בתבנית: {rec.pattern}</h3>
                        <p className="text-xs text-[var(--text)] opacity-80 m-0">משימה מומלצת: {rec.task}.</p>
                      </div>
                      <button
                        onClick={() => {
                          const recToSectionMap: Record<number, string> = {
                            0: "two-pointers",
                            1: "sliding-window",
                            2: "hash-map",
                            3: "bfs-dfs",
                            4: "dp",
                            5: "heap",
                            6: "binary-search",
                            7: "monotonic-stack"
                          };
                          const todayIndex = new Date().getDay() % 8;
                          const sectionId = recToSectionMap[todayIndex];
                          scrollToSection(sectionId as any);
                        }}
                        className="bg-[var(--accent)] hover:brightness-105 text-white text-xs font-black px-4 py-2 rounded-lg transition shrink-0 cursor-pointer shadow-sm"
                      >
                        התחל ללמוד עכשיו
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* COMPLEXITY SECTION */}
              <div ref={sectionsRef.complexity} id="complexity" className="scroll-margin-top mt-12">
                <h2 className="section-title">
                  סיבוכיות — המדריך למתחיל <span className="en">Time &amp; Space Complexity</span>
                </h2>
                <p className="section-intro">לפני שצוללים לתבניות — צריך להבין את השפה שבה מודדים יעילות. הסבר מאפס, בלי להניח ידע מוקדם.</p>

                <h3 className="sub">מה זה בכלל "סיבוכיות"?</h3>
                <p>כשאומרים שאלגוריתם "יעיל" — לעומת מה? קוד שעובד מצוין על 10 פריטים עלול לקרוס על מיליון. <strong>סיבוכיות מתארת איך זמן הריצה (או הזיכרון) גדל ככל שהקלט גדל.</strong></p>
                <div className="analogy">
                  <b>אנלוגיה:</b> לחפש חבר בבניין. לדפוק על כל דלת = ככל שיש יותר דירות, החיפוש ארוך יותר. לוח שמות בכניסה שמפנה ישר לדירה = אותו זמן בלי קשר לגודל. שני אלגוריתמים, סיבוכיות שונה לחלוטין.
                </div>
                <p>הנקודה: לא מודדים שניות (תלוי במחשב), אלא שואלים — <strong>אם הקלט יוכפל, מה יקרה לזמן?</strong> יישאר אותו דבר? יוכפל? יתחלף פי-ארבע?</p>

                <h3 className="sub">סימון Big-O ושני הכללים</h3>
                <p>הסימון נכתב <code className="inl">O(...)</code>, כש-<code className="inl">n</code> מייצג את גודל הקלט. שני כללי אצבע:</p>
                <div className="keypoint">
                  <b>כלל 1 — מתעלמים מקבועים:</b> <code className="inl">2n</code> או <code className="inl">100n</code> שניהם <code className="inl">O(n)</code>. מעניינת הצורה (קו ישר), לא השיפוע.
                  <br />
                  <b>כלל 2 — שומרים את הדומיננטי:</b> <code className="inl">n² + n</code> נכתב <code className="inl">O(n²)</code>. כשהקלט עצום, ה-<code className="inl">n²</code> מגמד את השאר.
                </div>

                <h3 className="sub">רמות הסיבוכיות הנפוצות</h3>
                <div className="overflow-x-auto my-4">
                  <table>
                    <thead>
                      <tr>
                        <th>סימון</th>
                        <th>שם</th>
                        <th>מה זה אומר</th>
                        <th>פעולות ל-n=מיליון</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="mono g">O(1)</td>
                        <td>קבוע</td>
                        <td>זמן קבוע ללא קשר לקלט</td>
                        <td className="mono g">1</td>
                      </tr>
                      <tr>
                        <td className="mono g">O(log n)</td>
                        <td>לוגריתמי</td>
                        <td>חוצים את הבעיה בכל צעד</td>
                        <td className="mono g">~20</td>
                      </tr>
                      <tr>
                        <td className="mono y">O(n)</td>
                        <td>לינארי</td>
                        <td>עוברים על כל פריט פעם אחת</td>
                        <td className="mono y">1,000,000</td>
                      </tr>
                      <tr>
                        <td className="mono y">O(n log n)</td>
                        <td>לינארי-לוגריתמי</td>
                        <td>מיון יעיל, "חלק וכבוש"</td>
                        <td className="mono y">~20 מיליון</td>
                      </tr>
                      <tr>
                        <td className="mono o">O(n²)</td>
                        <td>ריבועי</td>
                        <td>לולאה בתוך לולאה</td>
                        <td className="mono o">טריליון</td>
                      </tr>
                      <tr>
                        <td className="mono r">O(2ⁿ)</td>
                        <td>מעריכי</td>
                        <td>כל צירוף אפשרי</td>
                        <td className="mono r">אסטרונומי</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="warn font-medium">
                  <b>ההבדל המטורף:</b> למיליון פריטים, <code className="inl">O(n)</code> עושה מיליון פעולות (חלקיק שנייה). <code className="inl">O(n²)</code> עושה טריליון — שעות או ימים. אותה בעיה, תהום ביניהן. לכן שיפרנו שוב ושוב מ-O(n²) ל-O(n).
                </div>

                <h3 className="sub">איך מחשבים בפועל</h3>
                <p><strong>ספור לולאות:</strong> לולאה אחת = <code className="inl">O(n)</code>, לולאה בתוך לולאה = <code className="inl">O(n²)</code>. <strong>חיתוך לחצי</strong> מוסיף <code className="inl">log n</code>. <strong>פעולות עוקבות</strong> — מחברים ושומרים את הגדולה. <strong>פעולות מקוננות</strong> — מכפילים.</p>
                
                <div className="codewrap">
                  <button 
                    className="copy-btn"
                    onClick={() => copyCode(`def example(arr):              # n = len(arr)
    total = 0                     # O(1)
    for x in arr: total += x      # O(n)
    for i in arr:                  # לולאה...
        for j in arr: print(i, j)  # ...בתוך לולאה = O(n²)
    return total`, "ex-code")}
                  >
                    {copiedTextId === "ex-code" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                  <pre>
                    <span className="k">def</span> <span className="f">example</span>(arr):              <span className="c"># n = len(arr)</span>{"\n"}
                    {"    "}total = <span className="n">0</span>                     <span className="c"># O(1)</span>{"\n"}
                    {"    "}<span className="k">for</span> x <span className="k">in</span> arr: total += x      <span className="c"># O(n)</span>{"\n"}
                    {"    "}<span className="k">for</span> i <span className="k">in</span> arr:                  <span className="c"># לולאה...</span>{"\n"}
                    {"        "}<span className="k">for</span> j <span className="k">in</span> arr: print(i, j)  <span className="c"># ...בתוך לולאה = O(n²)</span>{"\n"}
                    {"    "}<span className="k">return</span> total{"\n"}
                    <span className="c"># סה"כ: O(1)+O(n)+O(n²) = O(n²) — הדומיננטי מנצח</span>
                  </pre>
                </div>

                <h3 className="sub">סיבוכיות זיכרון והטרייד-אוף</h3>
                <p>אותו סימון, אבל ל<strong>זיכרון נוסף</strong>. כמה משתנים בודדים = <code className="inl">O(1)</code>; מערך חדש בגודל הקלט = <code className="inl">O(n)</code>.</p>
                <div className="keypoint">
                  <b>הטרייד-אוף הקלאסי:</b> אפשר "לקנות" זמן בעזרת זיכרון. ב-Two Sum (בהמשך) נשתמש ב-hash map (זיכרון O(n)) כדי לחתוך זמן מ-O(n²) ל-O(n). מראיינים אוהבים שתזהה את זה.
                </div>
              </div>

              {/* 8 PATTERNS SECTIONS */}
              <div className="mt-16 space-y-16">
                
                {/* 1. TWO POINTERS */}
                <div ref={sectionsRef["two-pointers"]} id="two-pointers" className="scroll-margin-top">
                  <h2 className="section-title">8 התבניות הנפוצות</h2>
                  
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">01</div>
                      <div>
                        <h3>שני מצביעים</h3>
                        <div className="en">Two Pointers</div>
                      </div>
                    </div>
                    
                    <div className="topic-body">
                      
                      {/* Interactive Visual Explanation Diagram */}
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <GitMerge size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">מצביע שמאל & מצביע ימין</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">נסגרים בהדרגה אל עבר האמצע</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">כיצד זה חוסך זמן?</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            במקום לבצע לולאה מקוננת O(n²) הבודקת את כל השילובים האפשריים, אנו מתחילים משני הקצוות. אם המערך ממוין, המזלג מאפשר לנו לדעת בוודאות באיזה צעד להקטין או להגדיל את הסכום, ומקצר את הסריקה ל-O(n) בלבד!
                          </p>
                        </div>
                      </div>

                      <p className="blurb">שני אינדקסים שרצים על אותו מבנה נתונים, בדרך כלל אחד מכל קצה שמתקדמים זה לעבר זה. במקום שתי לולאות מקוננות (<code className="inl">O(n²)</code>) — מעבר אחד (<code className="inl">O(n)</code>).</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> השוואת מחרוזות, מיזוג נתונים ממוינים, בדיקת פלינדרום, איתור זוגות שמקיימים תנאי.</div>
                      <div className="box signal"><b>מתי לזהות:</b> המערך <b>ממוין</b> (או שאפשר למיין), ומחפשים זוג/שלישייה שמקיימים תנאי על הסכום — או השוואת קצוות אל המרכז.</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>מערך <b>ממוין</b> ו-target. החזר אינדקסים של שני מספרים שמסתכמים ל-target.</span></div>
                        <div className="a">
                          <p>מצביע בהתחלה ובסוף. סכום גדול מדי → מקטינים בהזזת הימני שמאלה. קטן מדי → מגדילים בהזזת השמאלי ימינה.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def two_sum(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo < hi:
        s = nums[lo] + nums[hi]
        if s == target: return [lo, hi]
        elif s < target: lo += 1
        else: hi -= 1`, "tp-q1")}>
                              {copiedTextId === "tp-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">two_sum</span>(nums, target):{"\n"}
                              {"    "}lo, hi = <span className="n">0</span>, len(nums) - <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">while</span> lo &lt; hi:{"\n"}
                              {"        "}s = nums[lo] + nums[hi]{"\n"}
                              {"        "}<span className="k">if</span> s == target: <span className="k">return</span> [lo, hi]{"\n"}
                              {"        "}<span className="k">elif</span> s &lt; target: lo += <span className="n">1</span>{"\n"}
                              {"        "}<span className="k">else</span>: hi -= <span className="n">1</span>
                            </pre>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <span className="complexity">זמן O(n) · זיכרון O(1)</span>
                            <button
                              onClick={() => setActiveVideo({ url: "https://youtu.be/KLlXCFG5Tk0", title: "Two Sum (שני מצביעים) - הסבר מלא" })}
                              className="flex items-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] hover:brightness-105 border border-[var(--accent)]/20 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                              <PlayCircle size={14} />
                              <span>סרטון הסבר 🎥</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q2</span><span>בדוק אם מחרוזת היא פלינדרום, תוך התעלמות מתווים לא-אלפאנומריים ומאותיות גדולות/קטנות.</span></div>
                        <div className="a">
                          <p>מצביע מכל קצה, מדלגים על תווים לא-רלוונטיים ומשווים אות מול אות אל המרכז.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def is_palindrome(s):
    lo, hi = 0, len(s) - 1
    while lo < hi:
        while lo < hi and not s[lo].isalnum(): lo += 1
        while lo < hi and not s[hi].isalnum(): hi -= 1
        if s[lo].lower() != s[hi].lower(): return False
        lo += 1; hi -= 1
    return True`, "tp-q2")}>
                              {copiedTextId === "tp-q2" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">is_palindrome</span>(s):{"\n"}
                              {"    "}lo, hi = <span className="n">0</span>, len(s) - <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">while</span> lo &lt; hi:{"\n"}
                              {"        "}<span className="k">while</span> lo &lt; hi <span className="k">and not</span> s[lo].isalnum(): lo += <span className="n">1</span>{"\n"}
                              {"        "}<span className="k">while</span> lo &lt; hi <span className="k">and not</span> s[hi].isalnum(): hi -= <span className="n">1</span>{"\n"}
                              {"        "}<span className="k">if</span> s[lo].lower() != s[hi].lower(): <span className="k">return</span> <span className="k">False</span>{"\n"}
                              {"        "}lo += <span className="n">1</span>; hi -= <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">return</span> <span className="k">True</span>
                            </pre>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <span className="complexity">זמן O(n) · זיכרון O(1)</span>
                            <button
                              onClick={() => setActiveVideo({ url: "https://youtu.be/g0NpK9_Hn78", title: "Valid Palindrome - הסבר מלא" })}
                              className="flex items-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] hover:brightness-105 border border-[var(--accent)]/20 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                              <PlayCircle size={14} />
                              <span>סרטון הסבר 🎥</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q3</span><span>מצא את כל השלישיות הייחודיות במערך שמסתכמות בדיוק ל-0 (בעיית 3Sum).</span></div>
                        <div className="a">
                          <p>ממיינים את המערך ורצים עם לולאה על כל איבר. עבור כל איבר, משתמשים בשני מצביעים על שאר המערך כדי למצוא זוג שמשלים אותו ל-0. נזהרים מכפילויות על ידי דילוג על איברים זהים.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def three_sum(nums):
    nums.sort()
    res = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i-1]: continue
        lo, hi = i + 1, len(nums) - 1
        while lo < hi:
            s = nums[i] + nums[lo] + nums[hi]
            if s == 0:
                res.append([nums[i], nums[lo], nums[hi]])
                while lo < hi and nums[lo] == nums[lo+1]: lo += 1
                while lo < hi and nums[hi] == nums[hi-1]: hi -= 1
                lo += 1; hi -= 1
            elif s < 0: lo += 1
            else: hi -= 1
    return res`, "tp-q3")}>
                              {copiedTextId === "tp-q3" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">three_sum</span>(nums):{"\n"}
                              {"    "}nums.sort(){"\n"}
                              {"    "}res = []{"\n"}
                              {"    "}<span className="k">for</span> i <span className="k">in</span> range(len(nums) - <span className="n">2</span>):{"\n"}
                              {"        "}<span className="k">if</span> i &gt; <span className="n">0</span> <span className="k">and</span> nums[i] == nums[i-<span className="n">1</span>]: <span className="k">continue</span>{"\n"}
                              {"        "}lo, hi = i + <span className="n">1</span>, len(nums) - <span className="n">1</span>{"\n"}
                              {"        "}<span className="k">while</span> lo &lt; hi:{"\n"}
                              {"            "}s = nums[i] + nums[lo] + nums[hi]{"\n"}
                              {"            "}<span className="k">if</span> s == <span className="n">0</span>:{"\n"}
                              {"                "}res.append([nums[i], nums[lo], nums[hi]]){"\n"}
                              {"                "}<span className="k">while</span> lo &lt; hi <span className="k">and</span> nums[lo] == nums[lo+<span className="n">1</span>]: lo += <span className="n">1</span>{"\n"}
                              {"                "}<span className="k">while</span> lo &lt; hi <span className="k">and</span> nums[hi] == nums[hi-<span className="n">1</span>]: hi -= <span className="n">1</span>{"\n"}
                              {"                "}lo += <span className="n">1</span>; hi -= <span className="n">1</span>{"\n"}
                              {"            "}<span className="k">elif</span> s &lt; <span className="n">0</span>: lo += <span className="n">1</span>{"\n"}
                              {"            "}<span className="k">else</span>: hi -= <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">return</span> res
                            </pre>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <span className="complexity">זמן O(n²) · זיכרון O(log n) או O(n)</span>
                            <button
                              onClick={() => setActiveVideo({ url: "https://youtu.be/jzZsG8n2R9A?si=Lfvw5s-kTc78VeXe", title: "3Sum (סכום של שלושה) - הסבר מלא" })}
                              className="flex items-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] hover:brightness-105 border border-[var(--accent)]/20 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                              <PlayCircle size={14} />
                              <span>סרטון הסבר 🎥</span>
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* 2. SLIDING WINDOW */}
                <div ref={sectionsRef["sliding-window"]} id="sliding-window" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">02</div>
                      <div>
                        <h3>חלון מחליק</h3>
                        <div className="en">Sliding Window</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      {/* Diagram */}
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Maximize2 size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">חלון תחום [L ... R]</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">זז ימינה ומעדכן את המחסום משמאל</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">מתי נשתמש?</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            השימוש העיקרי הוא עבור בעיות תתי-מערכים או תתי-מחרוזות רציפות. במקום לבדוק שוב ושוב את כל האפשרויות, החלון גדל ימינה; כשהתנאי מופר, אנו פשוט מכווצים את החלון משמאל מבלי להתחיל את הלולאה מחדש!
                          </p>
                        </div>
                      </div>

                      <p className="blurb">בן הדוד של קדיין. מחזיקים "חלון" רציף עם שני קצוות, מרחיבים ימינה ומכווצים שמאלה לפי הצורך. כל איבר נכנס ויוצא לכל היותר פעם אחת → <code className="inl">O(n)</code>.</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> ניתוח זרמי נתונים, עיבוד אותות, מציאת קטע רציף אופטימלי, ובעיות "הכי ארוך/קצר שמקיים תנאי".</div>
                      <div className="box signal"><b>מתי לזהות:</b> "רציף" + "הכי ארוך/קצר/בדיוק K" על מערך או מחרוזת.</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>אורך תת-המחרוזת הארוכה ביותר ללא תווים חוזרים.</span></div>
                        <div className="a">
                          <p>מרחיבים ימינה עם set של תווים בחלון. תו שכבר קיים → מכווצים משמאל עד שיוצא.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def longest_unique(s):
    seen = set(); lo = 0; best = 0
    for hi in range(len(s)):
        while s[hi] in seen:
            seen.remove(s[lo]); lo += 1
        seen.add(s[hi])
        best = max(best, hi - lo + 1)
    return best`, "sw-q1")}>
                              {copiedTextId === "sw-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">longest_unique</span>(s):{"\n"}
                              {"    "}seen = set(); lo = <span className="n">0</span>; best = <span className="n">0</span>{"\n"}
                              {"    "}<span className="k">for</span> hi <span className="k">in</span> range(len(s)):{"\n"}
                              {"        "}<span className="k">while</span> s[hi] <span className="k">in</span> seen:{"\n"}
                              {"            "}seen.remove(s[lo]); lo += <span className="n">1</span>{"\n"}
                              {"        "}seen.add(s[hi]){"\n"}
                              {"        "}best = max(best, hi - lo + <span className="n">1</span>){"\n"}
                              {"    "}<span className="k">return</span> best
                            </pre>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <span className="complexity">זמן O(n) · זיכרון O(min(n,אלפבית))</span>
                            <button
                              onClick={() => setActiveVideo({ url: "https://youtu.be/wiGpI14cmaY", title: "Longest Substring Without Repeating Characters - הסבר מלא" })}
                              className="flex items-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] hover:brightness-105 border border-[var(--accent)]/20 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                              <PlayCircle size={14} />
                              <span>סרטון הסבר 🎥</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. HASH MAP */}
                <div ref={sectionsRef["hash-map"]} id="hash-map" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">03</div>
                      <div>
                        <h3>מפת גיבוב</h3>
                        <div className="en">Hash Map / Hash Set</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Search size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">מפתח 🔑 תואם לערך 📦</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">שליפה מהירה ב-O(1)</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">אינטואיציית זיכרון:</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            המפתח ללמידה מהירה הוא החלפת "זמן בזיכרון". במקום להריץ חיפוש O(n) בכל פעם, אנו מייצרים מפה המשמשת כמראה זכרון מהיר. חיפוש בקבוצה הופך לפעולה קבועה ללא קשר לגודל המערך!
                          </p>
                        </div>
                      </div>

                      <p className="blurb">חיפוש, הוספה ומחיקה ב-<code className="inl">O(1)</code> ממוצע. הרעיון: "להחליף זמן בזיכרון" — לשמור מה שכבר ראינו כדי להימנע מסריקה חוזרת.</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> ספירת תדירויות, deduplication, אינדוקס וחיפוש מהיר, caching, זיהוי קבוצות.</div>
                      <div className="box signal"><b>מתי לזהות:</b> "האם ראיתי כבר X?", "כמה פעמים מופיע Y?", או כשפתרון נאיבי דורש לולאה בתוך לולאה כדי לחפש.</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>מערך (לא ממוין) ו-target. החזר אינדקסים של שני מספרים שסכומם target.</span></div>
                        <div className="a">
                          <p>במעבר יחיד, לכל מספר בודקים אם המשלים שלו כבר נראה. שומרים ערך → אינדקס.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []`, "hm-q1")}>
                              {copiedTextId === "hm-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">two_sum</span>(nums, target):{"\n"}
                              {"    "}seen = {"{}"}{"\n"}
                              {"    "}<span className="k">for</span> i, n <span className="k">in</span> enumerate(nums):{"\n"}
                              {"        "}<span className="k">if</span> target - n <span className="k">in</span> seen:{"\n"}
                              {"            "}<span className="k">return</span> [seen[target - n], i]{"\n"}
                              {"        "}seen[n] = i{"\n"}
                              {"    "}<span className="k">return</span> []
                            </pre>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <span className="complexity">זמן O(n) · זיכרון O(n)</span>
                            <button
                              onClick={() => setActiveVideo({ url: "https://youtu.be/KLlXCFG5Tk0", title: "Two Sum (מפת גיבוב) - הסבר מלא" })}
                              className="flex items-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] hover:brightness-105 border border-[var(--accent)]/20 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                            >
                              <PlayCircle size={14} />
                              <span>סרטון הסבר 🎥</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. BFS / DFS */}
                <div ref={sectionsRef["bfs-dfs"]} id="bfs-dfs" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">04</div>
                      <div>
                        <h3>סריקת גרפים ועצים</h3>
                        <div className="en">BFS / DFS</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Layers size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">סריקה לרוחב (תור) / סריקה לעומק</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">צלילה פנימה או סריקה שכבתית</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">איך נבדיל ביניהם?</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            במידה ואנחנו מחפשים <strong>מרחק קצר ביותר</strong> ברשת שאינה ממושקלת (למשל, מספר מינימלי של היכרויות), <strong>BFS</strong> עם Queue הוא הפתרון המדויק. אם אנחנו מעוניינים לבקר בכל פינה במבוך או למפות איים שלמים, <strong>DFS</strong> הרקורסיבי הוא מושלם ומהיר ליישום!
                          </p>
                        </div>
                      </div>

                      <p className="blurb"><b>DFS</b> צולל לעומק (רקורסיה/stack). <b>BFS</b> סורק שכבה-שכבה עם תור, ולכן מוצא <b>מסלול קצר ביותר</b> ללא משקלים. חובה אבסולוטית.</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> רשתות חברתיות, ניווט ומפות, crawling, ניתוח תלויות, מטריצות (כל תא = צומת).</div>
                      <div className="box signal"><b>מתי לזהות:</b> "מסלול קצר ביותר ללא משקלים" → BFS. "רכיבי קשירות / ספירת איים" → DFS. מטריצה עם תאים סמוכים = גרף.</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>מטריצה של '1' (יבשה) ו-'0' (מים). ספור כמה "איים" יש.</span></div>
                        <div className="a">
                          <p>כשנתקלים ביבשה לא מבוקרת — מגדילים מונה ומפעילים DFS ש"מטביע" את כל היבשה המחוברת.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def num_islands(grid):
    rows, cols = len(grid), len(grid[0]); count = 0
    def dfs(r, c):
        if r<0 or c<0 or r>=rows or c>=cols or grid[r][c]!='1': return
        grid[r][c] = '0'
        dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1)
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1': count += 1; dfs(r, c)
    return count`, "bfs-q1")}>
                              {copiedTextId === "bfs-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">num_islands</span>(grid):{"\n"}
                              {"    "}rows, cols = len(grid), len(grid[<span className="n">0</span>]); count = <span className="n">0</span>{"\n"}
                              {"    "}<span className="k">def</span> <span className="f">dfs</span>(r, c):{"\n"}
                              {"        "}<span className="k">if</span> r&lt;<span className="n">0</span> <span className="k">or</span> c&lt;<span className="n">0</span> <span className="k">or</span> r&gt;=rows <span className="k">or</span> c&gt;=cols <span className="k">or</span> grid[r][c]!=<span className="s">'1'</span>: <span className="k">return</span>{"\n"}
                              {"        "}grid[r][c] = <span className="s">'0'</span>{"\n"}
                              {"        "}dfs(r+<span className="n">1</span>,c); dfs(r-<span className="n">1</span>,c); dfs(r,c+<span className="n">1</span>); dfs(r,c-<span className="n">1</span>){"\n"}
                              {"    "}<span className="k">for</span> r <span className="k">in</span> range(rows):{"\n"}
                              {"        "}<span className="k">for</span> c <span className="k">in</span> range(cols):{"\n"}
                              {"            "}<span className="k">if</span> grid[r][c] == <span className="s">'1'</span>: count += <span className="n">1</span>; dfs(r, c){"\n"}
                              {"    "}<span className="k">return</span> count
                            </pre>
                          </div>
                          <span className="complexity">זמן O(שורות · עמודות)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. DYNAMIC PROGRAMMING */}
                <div ref={sectionsRef.dp} id="dp" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">05</div>
                      <div>
                        <h3>תכנון דינמי</h3>
                        <div className="en">Dynamic Programming</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Code2 size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">מזעור פתרונות חופפים</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">שמירת תוצאות ביניים בטבלה</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">איך להצליח בזה?</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            אל תיבהל מתכנון דינמי! השלב הראשון הוא תמיד כתיבת פתרון רקורסיבי (Top-Down) ולאחר מכן הוספת מנגנון שמירת ערכים (Memoization). ברגע שמבינים את היחסים בין הצעדים, קל לתרגם אותם לטבלה מהירה (Bottom-Up) שחוסכת עבודה מיותרת!
                          </p>
                        </div>
                      </div>

                      <p className="blurb">פירוק לתת-בעיות חופפות ושמירת תוצאות כדי לא לחשב פעמיים. קדיין הוא ה-DP הפשוט ביותר. שני סגנונות: Top-Down (memoization) ו-Bottom-Up (טבלה).</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> אופטימיזציה של משאבים, תזמון, השוואת מחרוזות/DNA, המלצות, מסחר (קדיין).</div>
                      <div className="box signal"><b>מתי לזהות:</b> "כמה דרכים יש ל...", "המקסימום/מינימום של...", או כשרקורסיה נאיבית מחשבת אותה תת-בעיה שוב ושוב.</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>עולים 1 או 2 מדרגות בכל פעם. בכמה דרכים מגיעים למדרגה ה-n?</span></div>
                        <div className="a">
                          <p><code className="inl">ways(n) = ways(n-1) + ways(n-2)</code> — פיבונאצ'י! שומרים שני ערכים אחרונים.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def climb_stairs(n):
    a, b = 1, 1
    for _ in range(n):
        a, b = b, a + b
    return a`, "dp-q1")}>
                              {copiedTextId === "dp-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">climb_stairs</span>(n):{"\n"}
                              {"    "}a, b = <span className="n">1</span>, <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">for</span> _ <span className="k">in</span> range(n):{"\n"}
                              {"        "}a, b = b, a + b{"\n"}
                              {"    "}<span className="k">return</span> a
                            </pre>
                          </div>
                          <span className="complexity">זמן O(n) · זיכרון O(1)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. HEAP */}
                <div ref={sectionsRef.heap} id="heap" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">06</div>
                      <div>
                        <h3>ערימה / תור עדיפויות</h3>
                        <div className="en">Heap / Priority Queue</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Briefcase size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">מבנה עץ אופטימלי</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">ראש העץ הוא תמיד הקיצון</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">הסבר פשוט:</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            כאשר אנו צריכים לשלוף שוב ושוב את הערך המינימלי או המקסימלי במערכת דינמית בה נכנסים נתונים כל הזמן, מיון מחדש של המערך ייקח O(n log n). ערימה פותרת זאת ב-O(log n) בלבד!
                          </p>
                        </div>
                      </div>

                      <p className="blurb">שליפת האיבר הקטן/גדול ביותר ב-<code className="inl">O(log n)</code> בלי למיין הכל. בפייתון <code className="inl">heapq</code> הוא min-heap (לערימת מקס מכניסים ערכים שליליים).</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> תורי משימות לפי עדיפות, schedulers, K החשובים בזרם, מיזוג מקורות ממוינים, Dijkstra.</div>
                      <div className="box signal"><b>מתי לזהות:</b> "K הכי גדולים/קטנים/נפוצים", "החציון בזרם", או "תמיד צריך את המינימום/מקסימום הנוכחי".</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>מצא את האיבר ה-K בגודלו במערך לא ממוין.</span></div>
                        <div className="a">
                          <p>min-heap בגודל K. אם הוא גדל מעבר ל-K, מסירים את המינימום. השורש הוא ה-K בגודלו.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`import heapq
def find_kth_largest(nums, k):
    heap = []
    for n in nums:
        heapq.heappush(heap, n)
        if len(heap) > k: heapq.heappop(heap)
    return heap[0]`, "hp-q1")}>
                              {copiedTextId === "hp-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">import</span> heapq{"\n"}
                              <span className="k">def</span> <span className="f">find_kth_largest</span>(nums, k):{"\n"}
                              {"    "}heap = []{"\n"}
                              {"    "}<span className="k">for</span> n <span className="k">in</span> nums:{"\n"}
                              {"        "}heapq.heappush(heap, n){"\n"}
                              {"        "}<span className="k">if</span> len(heap) &gt; k: heapq.heappop(heap){"\n"}
                              {"    "}<span className="k">return</span> heap[<span className="n">0</span>]
                            </pre>
                          </div>
                          <span className="complexity">זמן O(n log k) · זיכרון O(k)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. BINARY SEARCH */}
                <div ref={sectionsRef["binary-search"]} id="binary-search" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">07</div>
                      <div>
                        <h3>חיפוש בינארי על התשובה</h3>
                        <div className="en">Binary Search on the Answer</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Search size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">חיתוך טווח בחצי Log(N)</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">פונקציה מונוטונית למציאת התשובה</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">מתי נבחר בזה?</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            החיפוש הבינארי הסטנדרטי מוכר לכולם, אך הטוויסט המקצועי הוא <strong>חיפוש בינארי על טווח התשובות</strong>. לדוגמה: קביעת מהירות האכילה המינימלית או קיבולת ספינה. אנו מחפשים בינארית בתוך הטווח האפשרי, ובודקים האם הערך הנוכחי חוקי!
                          </p>
                        </div>
                      </div>

                      <p className="blurb">חיפוש בינארי חוצה מערך ממוין ב-<code className="inl">O(log n)</code>. הטוויסט: מחפשים את <b>התשובה עצמה</b> בטווח מספרים, כל עוד יש פונקציה מונוטונית שאומרת "האם זה אפשרי?".</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> תכנון קיבולת ("מה המהירות/הגודל המינימלי לעמוד בדדליין"), אופטימיזציה, rate limiting.</div>
                      <div className="box signal"><b>מתי לזהות:</b> "מצא את ה<b>מינימום/מקסימום</b> ש<b>עדיין מקיים</b> תנאי", והתנאי מונוטוני.</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>חיפוש בינארי קלאסי: מצא target במערך ממוין, או -1.</span></div>
                        <div className="a">
                          <p>התבנית הבסיסית. חוצים באמצע ומחליטים לאיזה חצי להמשיך. שווה לדעת בעל-פה.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target: return mid
        elif nums[mid] < target: lo = mid + 1
        else: hi = mid - 1
    return -1`, "bs-q1")}>
                              {copiedTextId === "bs-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">binary_search</span>(nums, target):{"\n"}
                              {"    "}lo, hi = <span className="n">0</span>, len(nums) - <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">while</span> lo &lt;= hi:{"\n"}
                              {"        "}mid = (lo + hi) // <span className="n">2</span>{"\n"}
                              {"        "}<span className="k">if</span> nums[mid] == target: <span className="k">return</span> mid{"\n"}
                              {"        "}<span className="k">elif</span> nums[mid] &lt; target: lo = mid + <span className="n">1</span>{"\n"}
                              {"        "}<span className="k">else</span>: hi = mid - <span className="n">1</span>{"\n"}
                              {"    "}<span className="k">return</span> -<span className="n">1</span>
                            </pre>
                          </div>
                          <span className="complexity">זמן O(log n) · זיכרון O(1)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8. MONOTONIC STACK */}
                <div ref={sectionsRef["monotonic-stack"]} id="monotonic-stack" className="scroll-margin-top">
                  <div className="topic">
                    <div className="topic-head">
                      <div className="num">08</div>
                      <div>
                        <h3>מחסנית מונוטונית</h3>
                        <div className="en">Monotonic Stack</div>
                      </div>
                    </div>
                    <div className="topic-body">
                      
                      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-black/5 flex flex-col md:flex-row items-center gap-5">
                        <div className="w-full md:w-1/3 bg-[var(--accent-tint)] p-4 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--accent)]/30">
                          <Layers size={32} className="text-[var(--accent)] mb-1" />
                          <span className="text-xs font-black text-[var(--accent)]">מחסנית יורדת / עולה בקפידה</span>
                          <span className="text-[10px] text-[var(--muted)] mt-0.5">ניקז וחישוב מהיר בצעד יחיד</span>
                        </div>
                        <div className="flex-1 text-sm space-y-2">
                          <p className="font-extrabold text-xs">מתי נזהה?</p>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            מחסנית מונוטונית היא אחד הכלים היפים והפחות מוכרים. אנו משתמשים בה בכל פעם שאנו רוצים למצוא את "האיבר הבא שגדול ממני" או לבצע חישובים רציפים של גבהים (כמו עמודות היסטוגרמה).
                          </p>
                        </div>
                      </div>

                      <p className="blurb">stack שאיבריו בסדר עולה/יורד עקבי. כשמגיע איבר שמפר את הסדר — מקפיצים ומעבדים. כל איבר נכנס ויוצא פעם אחת → בעיות <code className="inl">O(n²)</code> נפתרות ב-<code className="inl">O(n)</code>.</p>
                      <div className="box practical"><b>שימוש פרקטי:</b> "האירוע הבא שגדול/קטן ממני", ניתוח מחירי מניות, עיבוד טווחים בהיסטוגרמות.</div>
                      <div className="box signal"><b>מתי לזהות:</b> "האיבר הבא שגדול/קטן", "כמה ימים עד ש...", או כשנאיבי הוא "לכל איבר תסרוק קדימה".</div>

                      <div className="qa">
                        <div className="q"><span className="ql">Q1</span><span>בדוק אם מחרוזת סוגריים <code className="inl">()[]{}</code> תקינה ומאוזנת.</span></div>
                        <div className="a">
                          <p>סוגר פותח נדחף; סוגר סוגר חייב להתאים לראש. בסוף — מחסנית ריקה = איזון.</p>
                          <div className="codewrap">
                            <button className="copy-btn" onClick={() => copyCode(`def is_valid(s):
    pairs = {')':'(', ']':'[', '}':'{'}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]: return False
        else: stack.append(ch)
    return not stack`, "ms-q1")}>
                              {copiedTextId === "ms-q1" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                            <pre>
                              <span className="k">def</span> <span className="f">is_valid</span>(s):{"\n"}
                              {"    "}pairs = {"{')':'(', ']':'[', '}':'{'}"}{"\n"}
                              {"    "}stack = []{"\n"}
                              {"    "}<span className="k">for</span> ch <span className="k">in</span> s:{"\n"}
                              {"        "}<span className="k">if</span> ch <span className="k">in</span> pairs:{"\n"}
                              {"            "}<span className="k">if not</span> stack <span className="k">or</span> stack.pop() != pairs[ch]: <span className="k">return</span> <span className="k">False</span>{"\n"}
                              {"        "}<span className="k">else</span>: stack.append(ch){"\n"}
                              {"    "}<span className="k">return not</span> stack
                            </pre>
                          </div>
                          <span className="complexity">זמן O(n) · זיכרון O(n)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* PUZZLES SECTION (DYNAMIC RENDERING WITH DISCOVER ANIMATIONS) */}
              <div ref={sectionsRef.puzzles} id="puzzles" className="scroll-margin-top mt-16">
                <h2 className="section-title">
                  זהה את התבנית <span className="en">Pattern Recognition</span>
                </h2>
                <p className="section-intro">
                  16 חידות מעורבבות, בלי שם האלגוריתם. קרא, נחש איזו תבנית מסתתרת, ואז לחץ "חשוף תשובה". <strong>זו המיומנות האמיתית בראיון</strong> — לזהות את המנגנון מתוך סיפור.
                </p>

                <div className="grid grid-cols-1 gap-6 mt-6">
                  {puzzlesData.map((p) => (
                    <div key={p.n} className="puzzle border border-[var(--border)] bg-[var(--panel)] rounded-xl overflow-hidden shadow-xs">
                      <div className="puzzle-head bg-black/5 dark:bg-black/30 border-b border-[var(--border)] px-5 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-white font-extrabold flex items-center justify-center text-sm">
                            {p.n}
                          </span>
                          <span className="font-extrabold text-sm text-[var(--text)]">{p.title}</span>
                        </div>
                        <button
                          onClick={() => togglePuzzle(p.n)}
                          className="px-3 py-1.5 bg-[var(--accent-tint)] hover:brightness-95 text-[var(--accent)] font-bold text-xs rounded-lg transition cursor-pointer"
                        >
                          {openPuzzles[p.n] ? "סגור תשובה" : "🔍 חשוף תשובה"}
                        </button>
                      </div>

                      <div className="p-5">
                        <p className="text-sm text-[var(--text)] leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: p.q }} />

                        <AnimatePresence>
                          {openPuzzles[p.n] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-4 bg-[var(--accent-tint)] border border-dashed border-[var(--accent)] rounded-xl p-4 space-y-3"
                            >
                              <div>
                                <span className="text-[10px] bg-[var(--accent)] text-white font-black px-2.5 py-1 rounded-full uppercase">
                                  התבנית
                                </span>
                                <h4 className="font-extrabold text-base mt-1.5 text-[var(--text)]">
                                  {p.pattern} <span className="en font-bold text-[var(--accent)]">({p.en})</span>
                                </h4>
                              </div>

                              <p className="text-xs text-[var(--text)] leading-relaxed" dangerouslySetInnerHTML={{ __html: `<b>סימני זיהוי:</b> ${p.tells}` }} />

                              <div className="codewrap relative">
                                <button
                                  className="copy-btn"
                                  onClick={() => copyCode(p.code, `pz-${p.n}`)}
                                >
                                  {copiedTextId === `pz-${p.n}` ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                                </button>
                                <pre className="text-xs p-3 bg-black/95 text-gray-200 rounded-lg overflow-x-auto font-mono">
                                  {p.code}
                                </pre>
                              </div>

                              <span className="complexity inline-block text-xs font-bold text-[var(--accent)]">
                                {p.cx}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIPS SECTION */}
              <div ref={sectionsRef.tips} id="tips" className="scroll-margin-top mt-16">
                <h2 className="section-title">טיפים אחרונים לראיון</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="box practical font-medium">
                    <b>1. נתח סיבוכיות בקול רם.</b> "הנאיבי O(n²), עם hash map יורדים ל-O(n)" — משפט כזה שווה זהב בראיון.
                  </div>
                  <div className="box practical font-medium">
                    <b>2. חשוב בקול רם.</b> התחל מכוח גס, הסבר מה חסר ביעילות שלו, ואז שפר עם תבניות.
                  </div>
                  <div className="box practical font-medium">
                    <b>3. שאל שאלות הבהרה.</b> האם המערך ממוין? האם יש כפילויות? מה טווח הקלט? מה מחזירים במקרה קצה?
                  </div>
                  <div className="box practical font-medium">
                    <b>4. בדוק מקרי קצה.</b> מערך ריק, איבר בודד, ערכים שליליים, או כפילויות של איברים.
                  </div>
                </div>

                <div className="box signal mt-4 font-medium">
                  <b>הקשר ישראלי:</b> בחברות הטק הגדולות בישראל (גוגל, מטא, אמזון ת"א, מיקרוסופט) LeetCode הוא הסטנדרט המנצח. בסטארטאפים תמצא לעיתים שילוב מעשי של System Design בסיסי או פתרון בעיה קרובה למוצר.
                </div>

                <p className="text-center font-extrabold text-sm text-[var(--muted)] mt-12">
                  בהצלחה בראיון 💪 · זכור: זיהוי התבנית מנצח שינון פתרונות!
                </p>
              </div>

              {/* FAQ SECTION */}
              <div id="faq-section" className="scroll-mt-20 bg-[var(--panel)] border border-[var(--border)] p-6 rounded-xl shadow-sm space-y-4 text-right mt-16">
                <div>
                  <h2 className="text-lg font-extrabold text-[var(--text)] flex items-center gap-2">
                    <span>❓</span>
                    <span>שאלות נפוצות</span>
                  </h2>
                  <p className="text-xs text-[var(--muted)]">כל מה שרצית לדעת על שיטת 8 התבניות ותהליך ההכנה</p>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    {
                      q: "למה להתמקד ב-8 תבניות במקום לפתור מאות שאלות ב-LeetCode?",
                      a: "זיהוי תבניות הוא המפתח להצלחה. בראיונות עבודה לחץ הזמן משמעותי; אם תלמד לזהות את הבעיה כתבנית של 'חלון מחליק' או 'שני מצביעים' תוך דקה, כבר עברת 80% מהדרך לפתרון. במקום לשנן מאות פתרונות ספציפיים, אתה לומד את עקרונות העל ומיישם אותם על כל שאלה חדשה."
                    },
                    {
                      q: "כמה זמן מומלץ להקדיש לכל תבנית?",
                      a: "מומלץ להקדיש כיומיים-שלושה לכל תבנית. קרא את ההסבר התיאורטי לעומק, עבור על 3 השאלות הפתורות המצורפות, ואז נסה לכתוב את הפתרון בעצמך ללא עזרה. לאחר מכן, נסה לפתור את החידות התואמות כדי לוודא שאתה שולט בזיהוי."
                    },
                    {
                      q: "האם המדריך תומך בכל שפות התכנות?",
                      a: "כן! במדריך יש קוד מלא ופתרונות ב-JavaScript/TypeScript, אך העקרונות, מבני הנתונים והלוגיקה זהים לחלוטין בכל שפה אחרת כמו Python, Java, C++, C# או Go."
                    },
                    {
                      q: "איך כלי ה-AI 'אני לא מבין' יכול לעזור לי?",
                      a: "פשוט מאוד: בזמן קריאת המדריך, סמן עם העכבר או האצבע כל קטע קוד או הסבר שאינו ברור לך לחלוטין. מיד יופיע כפתור צף 'אני לא מבין 🧠'. לחיצה עליו תפתח עוזר חכם שיסביר לך את הקטע הספציפי בצורה מופשטת ומותאמת אישית."
                    },
                    {
                      q: "האם יש אפשרות ללמוד במצב לא מקוון (Offline)?",
                      a: "בוודאי. ניתן להוריד את המדריך המלא כקובץ PDF מעוצב ומסודר ישירות מתפריט הצד או מכרטיסיית 'לאן להמשיך', כך שתוכל ללמוד ולשנן גם ללא חיבור פעיל לאינטרנט."
                    }
                  ].map((faq, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div 
                        key={idx} 
                        className="border border-[var(--border)] rounded-lg overflow-hidden bg-black/[0.01] dark:bg-white/[0.01] transition-all"
                      >
                        <button
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                          className="w-full text-right p-4 flex items-center justify-between gap-4 font-bold text-sm text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <span>{faq.q}</span>
                          <span className={`text-xs transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}>
                            ▼
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 pt-0 text-xs text-[var(--muted)] leading-relaxed border-t border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02]">
                                {faq.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QUICK LINKS SECTION */}
              <div id="links-section" className="scroll-mt-20 space-y-4 mt-16">
                <h2 className="text-base font-extrabold text-[var(--text)] border-b border-[var(--border)] pb-2 text-right">
                  🧭 לאן תרצה להמשיך עכשיו?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1 */}
                  <div className="bg-[var(--panel)] border border-[var(--border)] p-5 rounded-xl flex flex-col justify-between transition-all hover:shadow-md hover:border-[var(--accent)] text-right group">
                    <div className="space-y-2">
                      <div className="text-xl">📚</div>
                      <h3 className="font-extrabold text-sm text-[var(--text)] m-0">המדריך המלא ותבניות קוד</h3>
                      <p className="text-xs text-[var(--muted)] leading-relaxed m-0">
                        קרא את החומר העיוני, הסברים מפורטים, ניתוחי סיבוכיות Big-O ואת כל 24 השאלות הפתורות במלואן עם קוד תקין מוכן להרצה.
                      </p>
                    </div>
                    <button
                      onClick={() => scrollToSection("intro")}
                      className="mt-4 w-full bg-black/5 hover:bg-[var(--accent)] hover:text-white dark:bg-white/5 text-[var(--text)] text-xs font-extrabold py-2 px-3 rounded-lg transition cursor-pointer text-center"
                    >
                      חזור לראש המדריך
                    </button>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-[var(--panel)] border border-[var(--border)] p-5 rounded-xl flex flex-col justify-between transition-all hover:shadow-md hover:border-[var(--accent)] text-right group">
                    <div className="space-y-2">
                      <div className="text-xl">🧩</div>
                      <h3 className="font-extrabold text-sm text-[var(--text)] m-0">16 חידות "זהה את התבנית"</h3>
                      <p className="text-xs text-[var(--muted)] leading-relaxed m-0">
                        השלב החשוב ביותר בהכנה! בחן את עצמך מול 16 חידות אלגוריתמיות אמיתיות ללא שם הנושא, ובדוק אם הצלחת לזהות נכון את הגישה.
                      </p>
                    </div>
                    <button
                      onClick={() => scrollToSection("puzzles")}
                      className="mt-4 w-full bg-black/5 hover:bg-[var(--accent)] hover:text-white dark:bg-white/5 text-[var(--text)] text-xs font-extrabold py-2 px-3 rounded-lg transition cursor-pointer text-center"
                    >
                      תרגל את החידות
                    </button>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-[var(--panel)] border border-[var(--border)] p-5 rounded-xl flex flex-col justify-between transition-all hover:shadow-md hover:border-[var(--accent)] text-right group">
                    <div className="space-y-2">
                      <div className="text-xl">💬</div>
                      <h3 className="font-extrabold text-sm text-[var(--text)] m-0">צ'אט תמיכה מלווה בבינה מלאכותית</h3>
                      <p className="text-xs text-[var(--muted)] leading-relaxed m-0">
                        שאל שאלות, קבל הסברים מעמיקים מהעוזר שלנו, והעשר את ההבנה שלך לגבי כל נושא באלגוריתמים ומבני נתונים.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsFloatingChatOpen(true)}
                      className="mt-4 w-full bg-black/5 hover:bg-[var(--accent)] hover:text-white dark:bg-white/5 text-[var(--text)] text-xs font-extrabold py-2 px-3 rounded-lg transition cursor-pointer text-center"
                    >
                      פתח צ'אט תמיכה
                    </button>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-[var(--panel)] border border-[var(--border)] p-5 rounded-xl flex flex-col justify-between transition-all hover:shadow-md hover:border-[var(--accent)] text-right group">
                    <div className="space-y-2">
                      <div className="text-xl">⏰</div>
                      <h3 className="font-extrabold text-sm text-[var(--text)] m-0">שינון וכרטיסיות היסטוריה</h3>
                      <p className="text-xs text-[var(--muted)] leading-relaxed m-0">
                        שמור את ההסברים הקוליים והחזותיים שיצרת בעזרת כפתור "אני לא מבין 🧠" וחזור עליהם כדי להבטיח שהכל מובן ב-100%.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("history")}
                      className="mt-4 w-full bg-black/5 hover:bg-[var(--accent)] hover:text-white dark:bg-white/5 text-[var(--text)] text-xs font-extrabold py-2 px-3 rounded-lg transition cursor-pointer text-center"
                    >
                      מעבר להיסטוריית שינון
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-4"
            >
              <HistoryPanel 
                user={user} 
                onOpenExplanation={(item) => {
                  setHistoryExplainItem(item);
                  setSelectedText(item.selectedText);
                  setIsExplainOpen(true);
                }}
                onOpenChat={(thread) => {
                  setIsFloatingChatOpen(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* FOOTER */}
        <footer className="mt-16 text-center text-xs text-[var(--muted)] border-t border-[var(--border)] pt-8 pb-12">
          מדריך אלגוריתמים לראיונות הייטק · בנוי לזיהוי מהיר של תבניות
          <br />
          <span className="text-[10px] mt-1 block">כל הקוד תקין ומוכן להרצה — אך תרגל כל פתרון בעצמך לפחות פעם אחת לפני הראיון.</span>
        </footer>

      </main>
    </div>

    {/* FLOATING UP/DOWN SECTION NAVIGATION FOR EASY SCROLLING */}
    {activeTab === "guide" && (
      <div className="section-nav">
        <button 
          id="secUp" 
          onClick={() => scrollRelative("up")}
          title="לסעיף הקודם" 
          aria-label="לסעיף הקודם"
        >
          <ChevronUp size={20} />
        </button>
        <button 
          id="secDown" 
          onClick={() => scrollRelative("down")}
          title="לסעיף הבא" 
          aria-label="לסעיף הבא"
        >
          <ChevronDown size={20} />
        </button>
      </div>
    )}

    {/* INTELLIGENT AI EXPLAIN DIALOG ("אני לא מבין") */}
    <ExplainDialog
      isOpen={isExplainOpen}
      onClose={() => {
        setIsExplainOpen(false);
        setHistoryExplainItem(null);
      }}
      selectedText={selectedText}
      contextTitle={contextTitle}
      user={user}
      existingItem={historyExplainItem}
    />

    {/* FLOATING SUPPORT CHAT BOT / WIDGET & PROGRESS TRACKER */}
    {user && (
      <>
        {/* FLOATING PROGRESS TRACKER ICON BUTTON */}
        <button
          onClick={() => {
            setIsProgressOpen(!isProgressOpen);
            setIsFloatingChatOpen(false);
          }}
          className="fixed bottom-6 z-[9999] bg-[var(--accent)] hover:brightness-110 hover:scale-110 active:scale-95 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all border border-white/10 right-6 lg:right-[calc(300px+1.5rem)]"
          title="מעקב התקדמות אישי"
        >
          <Trophy size={22} className={isProgressOpen ? "rotate-12 transition-all duration-200" : "transition-all duration-200"} />
        </button>

        {/* FLOATING CHAT ICON BUTTON */}
        <button
          onClick={() => {
            setIsFloatingChatOpen(!isFloatingChatOpen);
            setIsProgressOpen(false);
          }}
          className="fixed bottom-6 left-6 z-[9999] bg-[var(--accent)] hover:scale-110 active:scale-95 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all border border-white/10"
          title="עוזר למידה AI אישי"
        >
          <MessageSquare size={24} fill="currentColor" className={isFloatingChatOpen ? "rotate-90 transition-all duration-200 text-white" : "transition-all duration-200 text-white"} />
        </button>

        {/* EXPANDED FLOATING CHAT WINDOW */}
        <AnimatePresence>
          {isFloatingChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-24 left-6 z-[9999] w-[480px] max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100vh-120px)] rounded-2xl shadow-2xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden flex flex-col"
            >
              <CompanionChat 
                user={user} 
                onClose={() => setIsFloatingChatOpen(false)} 
                highThinking={highThinking}
                setHighThinking={setHighThinking}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* EXPANDED FLOATING PROGRESS TRACKER WINDOW */}
        <AnimatePresence>
          {isProgressOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-24 z-[9999] w-[500px] max-w-[calc(100vw-32px)] rounded-2xl shadow-2xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden flex flex-col p-6 text-right right-6 lg:right-[calc(300px+1.5rem)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-4">
                <div className="flex items-center gap-2 text-amber-500 font-bold">
                  <Trophy size={18} />
                  <span className="text-sm font-black">מעקב התקדמות אישי</span>
                </div>
                <button
                  onClick={() => setIsProgressOpen(false)}
                  className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-[var(--muted)] m-0 mb-4 leading-relaxed">
                סמן את תבניות הליבה שאתה מרגיש איתן בנוח ושלמדת במדריך, כדי לעקוב אחר מוכנותך.
              </p>

              {/* Progress bar */}
              <div className="space-y-2 mb-4">
                <div className="w-full bg-black/5 dark:bg-white/5 h-3.5 rounded-full overflow-hidden border border-[var(--border)]">
                  <div 
                    className="bg-[var(--accent)] h-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.round((Object.values(completedPatterns).filter(Boolean).length / 8) * 100)}%` }}
                  />
                </div>
                <div className="text-xs font-bold text-[var(--accent)] flex justify-between">
                  <span>{Object.values(completedPatterns).filter(Boolean).length} מתוך 8 תבניות הושלמו</span>
                  <span>{Math.round((Object.values(completedPatterns).filter(Boolean).length / 8) * 100)}% מוכנות</span>
                </div>
              </div>

              {/* Scrollable grid of patterns inside dialog */}
              <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[300px] pr-1">
                {DEFAULT_PATTERNS.map((pat) => {
                  const isCompleted = !!completedPatterns[pat.id];
                  return (
                    <div
                      key={pat.id}
                      onClick={() => {
                        setCompletedPatterns(prev => ({
                          ...prev,
                          [pat.id]: !prev[pat.id]
                        }));
                      }}
                      className={`p-3 border rounded-lg text-right flex items-center justify-between gap-3 transition cursor-pointer select-none ${
                        isCompleted
                          ? "bg-[var(--accent-tint)] border-[var(--accent)] text-[var(--accent)]"
                          : "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border-[var(--border)] text-[var(--text)]"
                      }`}
                    >
                      <div className="overflow-hidden space-y-0.5 animate-none">
                        <p className="text-xs font-extrabold m-0 truncate">{pat.name}</p>
                        <p className="text-[10px] text-[var(--muted)] m-0 truncate opacity-85 leading-none">{pat.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        isCompleted
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)] bg-white dark:bg-black"
                      }`}>
                        {isCompleted && <span className="text-xs font-bold">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )}

    {/* VIDEO EXPLANATION MODAL */}
    <AnimatePresence>
      {activeVideo && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveVideo(null)}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-black/5">
              <div className="flex items-center gap-2 text-[var(--accent)] font-bold">
                <PlayCircle size={18} />
                <span className="text-sm font-black">{activeVideo.title}</span>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Video container */}
            <div className="relative w-full aspect-video bg-black">
              {(() => {
                const embedUrl = getYouTubeEmbedUrl(activeVideo.url);
                if (embedUrl) {
                  return (
                    <iframe
                      src={embedUrl}
                      title={activeVideo.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  );
                } else {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 font-bold">
                      לא ניתן לטעון את הסרטון בתוך האפליקציה. אנא צפה בו ביוטיוב.
                    </div>
                  );
                }
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-black/5 text-right text-xs text-[var(--muted)] border-t border-[var(--border)]">
              מקור הסרטון מ-YouTube · פלטפורמת ההכנה מעניקה נגן צף לנוחיות המשתמשים.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

  </div>
);
}
