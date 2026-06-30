import type { ChatMessage, ChatThread } from "../types.ts";

export const ALGO_BUDDY_WELCOME_MESSAGE =
  "שלום! אני אלגו-באדי (AlgoBuddy), המנטור האישי שלך לראיונות אלגוריתמים והכנה להייטק. שאל אותי שאלות לגבי תבניות הקוד, בקש סימולציית ראיון בזמן אמת, או התייעץ איתי על בעיות קשות!";

export const NEW_CHAT_TITLE = "שיחה חדשה לגבי אלגוריתמים";

export const createChatTitleFromMessage = (message: string): string => {
  const cleanMessage = message.trim();
  return cleanMessage.length > 30 ? `${cleanMessage.substring(0, 30)}...` : cleanMessage;
};

export const getActiveChatStorageKey = (userId: string | null | undefined): string =>
  `algobuddy_active_chat_${userId || "guest"}`;

export const LEGACY_GUEST_CHAT_HISTORY_KEY = "guest_chats";

export const getChatHistoryStorageKey = (userId: string | null | undefined): string =>
  `algobuddy_chat_history_${userId || "guest"}`;

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

export const resolveInitialChatThread = ({
  storedThread,
  userId,
  now,
}: {
  storedThread: ChatThread | null;
  userId: string;
  now: Date;
}): ChatThread => {
  if (storedThread?.userId === userId) {
    return storedThread;
  }

  return createFreshChatThread({
    id: "temp_" + now.getTime(),
    userId,
    createdAt: now.toISOString(),
  });
};

export const sanitizeChatMessagesForStorage = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((message) => {
    const sanitized: ChatMessage = {
      sender: message.sender,
      text: message.text,
      createdAt: message.createdAt,
    };

    if (message.imageUrl && !message.imageUrl.startsWith("data:")) {
      sanitized.imageUrl = message.imageUrl;
    }

    if (message.localImageKey !== undefined) {
      sanitized.localImageKey = message.localImageKey;
    }

    if (message.imagePrompt !== undefined) {
      sanitized.imagePrompt = message.imagePrompt;
    }

    return sanitized;
  });

export const normalizeChatThreadForHistory = (thread: ChatThread): ChatThread => ({
  ...thread,
  messages: sanitizeChatMessagesForStorage(thread.messages),
});

export const mergeChatThreads = (...groups: ChatThread[][]): ChatThread[] => {
  const byId = new Map<string, ChatThread>();

  for (const thread of groups.flat()) {
    if (!byId.has(thread.id)) {
      byId.set(thread.id, thread);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const upsertChatThread = (
  threads: ChatThread[],
  thread: ChatThread,
  previousId?: string
): ChatThread[] => {
  const normalized = normalizeChatThreadForHistory(thread);
  return [
    normalized,
    ...threads.filter((item) => item.id !== normalized.id && item.id !== previousId),
  ].slice(0, 50);
};
