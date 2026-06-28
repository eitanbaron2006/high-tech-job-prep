import type { ChatThread } from "../types.ts";

export const ALGO_BUDDY_WELCOME_MESSAGE =
  "שלום! אני אלגו-באדי (AlgoBuddy), המנטור האישי שלך לראיונות אלגוריתמים והכנה להייטק. שאל אותי שאלות לגבי תבניות הקוד, בקש סימולציית ראיון בזמן אמת, או התייעץ איתי על בעיות קשות!";

export const NEW_CHAT_TITLE = "שיחה חדשה לגבי אלגוריתמים";

export const createChatTitleFromMessage = (message: string): string => {
  const cleanMessage = message.trim();
  return cleanMessage.length > 30 ? `${cleanMessage.substring(0, 30)}...` : cleanMessage;
};

export const createFreshChatThread = ({
  id,
  userId,
  createdAt,
}: {
  id: string;
  userId: string;
  createdAt: string;
}): ChatThread => ({
  id,
  userId,
  title: NEW_CHAT_TITLE,
  messages: [
    {
      sender: "ai",
      text: ALGO_BUDDY_WELCOME_MESSAGE,
      createdAt: Date.now(),
    },
  ],
  createdAt,
});
