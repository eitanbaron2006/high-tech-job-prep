export interface ExplanationItem {
  id: string;
  userId: string;
  selectedText: string;
  explanationText: string;
  audioBase64?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoOperationName?: string;
  createdAt: string;
}

export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  createdAt: number;
}

export interface ChatThread {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface PuzzleItem {
  n: number;
  title: string;
  q: string;
  pattern: string;
  en: string;
  tells: string;
  code: string;
  cx: string;
}
