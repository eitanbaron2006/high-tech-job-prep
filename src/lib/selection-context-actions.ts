export type SelectionContextActionId =
  | "explain"
  | "copy"
  | "pasteToChat"
  | "translate"
  | "summarize"
  | "python"
  | "practice"
  | "diagram";

export type SelectionContextAction = {
  id: SelectionContextActionId;
  label: string;
  hint: string;
  group: "default" | "ai" | "practice";
  targetLanguage?: "English" | "Hebrew";
};

const HEBREW_RE = /[\u0590-\u05FF]/;

const ALGORITHM_RE =
  /(?:אלגוריתם|תבנית|שאלה|פתרון|סיבוכיות|מערך|מחרוזת|מצביע|חלון|גיבוב|גרף|עץ|ערימה|מחסנית|תור|רקורסיה|דינמי|חיפוש|מיון|לולאה|קלט|פלט|leetcode|array|string|algorithm|pattern|two pointers|pointer|sliding window|hash|graph|tree|heap|stack|queue|binary search|dynamic programming|recursion|sort|complexity|input|output|def |for |while )/i;

export const containsHebrew = (text: string): boolean => HEBREW_RE.test(text);

export const looksAlgorithmic = (text: string): boolean => ALGORITHM_RE.test(text);

export const buildSelectionContextActions = (selectedText: string): SelectionContextAction[] => {
  const isHebrew = containsHebrew(selectedText);
  const actions: SelectionContextAction[] = [
    { id: "explain", label: "אני לא מבין", hint: "הסבר AI", group: "ai" },
    { id: "copy", label: "העתק", hint: "ללוח", group: "default" },
    { id: "pasteToChat", label: "הדבק לצ'אט", hint: "כטיוטה", group: "default" },
    {
      id: "translate",
      label: isHebrew ? "תרגם לאנגלית" : "תרגם לעברית",
      hint: "בצ'אט",
      group: "ai",
      targetLanguage: isHebrew ? "English" : "Hebrew",
    },
    { id: "summarize", label: "סכם בקצרה", hint: "עיקרי הדברים", group: "ai" },
  ];

  if (looksAlgorithmic(selectedText)) {
    actions.push({
      id: "python",
      label: "יישם בפייתון",
      hint: "קוד + סיבוכיות",
      group: "ai",
    });
  }

  actions.push(
    { id: "practice", label: "צור שאלת תרגול", hint: "עם פתרון", group: "practice" },
    { id: "diagram", label: "צור תרשים", hint: "תמונה", group: "practice" }
  );

  return actions;
};

export const buildSelectionPrompt = (
  actionId: Exclude<SelectionContextActionId, "copy" | "pasteToChat" | "explain">,
  selectedText: string
): string => {
  const quoted = `"""${selectedText}"""`;

  switch (actionId) {
    case "translate":
      return containsHebrew(selectedText)
        ? `Translate the following Hebrew text into clear, natural English. Keep algorithm names such as Two Pointers, BFS/DFS, Hash Map, and Python terms accurate:\n\n${quoted}`
        : `תרגם את הטקסט הבא לעברית ברורה וטבעית. שמור שמות אלגוריתמים ומונחי Python בצורה מדויקת:\n\n${quoted}`;
    case "summarize":
      return `סכם בעברית את הקטע הבא בצורה קצרה, פרקטית וממוקדת לראיון עבודה. כלול 3-5 נקודות עיקריות:\n\n${quoted}`;
    case "python":
      return `כתוב יישום מלא וברור בפייתון עבור האלגוריתם או השאלה הבאים. כלול הסבר קצר, קוד Python תקין, דוגמת קלט/פלט, וסיבוכיות זמן וזיכרון:\n\n${quoted}`;
    case "practice":
      return `צור שאלת תרגול חדשה בעברית שמבוססת על הקטע הבא. כלול ניסוח שאלה, דוגמאות קלט/פלט, רמזים, פתרון בפייתון, וסיבוכיות:\n\n${quoted}`;
    case "diagram":
      return `צור לי תמונה / אינפוגרפיקה בעברית שמסבירה את הקטע הבא בצורה ויזואלית, עם כותרות קצרות, תרשים זרימה, דוגמה קטנה, ויישום Python קצר:\n\n${quoted}`;
  }
};
