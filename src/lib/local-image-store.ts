import type { ChatMessage, ChatThread, GeneratedImage } from "../types.ts";
import { getLocalImageKeyFromUrl, toLocalImageUrl } from "./gallery-core.ts";

const DB_NAME = "algobuddy-local-images";
const STORE_NAME = "images";
const DB_VERSION = 1;

type LocalImageRecord = {
  key: string;
  dataUrl: string;
  updatedAt: number;
};

const hasIndexedDb = (): boolean => typeof indexedDB !== "undefined";

const openImageDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open image database"));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openImageDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = action(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

export const saveLocalImageData = async (key: string, dataUrl: string): Promise<void> => {
  await withStore("readwrite", (store) =>
    store.put({
      key,
      dataUrl,
      updatedAt: Date.now(),
    } satisfies LocalImageRecord)
  );
};

export const getLocalImageData = async (key: string): Promise<string | null> => {
  try {
    const record = await withStore<LocalImageRecord | undefined>("readonly", (store) =>
      store.get(key)
    );
    return record?.dataUrl || null;
  } catch {
    return null;
  }
};

export const deleteLocalImageData = async (key: string): Promise<void> => {
  await withStore("readwrite", (store) => store.delete(key));
};

export const hydrateGeneratedImages = async (
  images: GeneratedImage[]
): Promise<GeneratedImage[]> =>
  Promise.all(
    images.map(async (image) => {
      if (image.url && !getLocalImageKeyFromUrl(image.url)) return image;

      const localImageKey = image.localImageKey || getLocalImageKeyFromUrl(image.url) || undefined;
      if (!localImageKey) return image;

      const dataUrl = await getLocalImageData(localImageKey);
      return {
        ...image,
        localImageKey,
        url: dataUrl || toLocalImageUrl(localImageKey),
      };
    })
  );

const hydrateChatMessageImage = async (message: ChatMessage): Promise<ChatMessage> => {
  if (message.imageUrl && !getLocalImageKeyFromUrl(message.imageUrl)) return message;

  const localImageKey =
    message.localImageKey || getLocalImageKeyFromUrl(message.imageUrl) || undefined;
  if (!localImageKey) return message;

  const dataUrl = await getLocalImageData(localImageKey);
  return {
    ...message,
    localImageKey,
    imageUrl: dataUrl || toLocalImageUrl(localImageKey),
  };
};

export const hydrateChatThreadImages = async (thread: ChatThread): Promise<ChatThread> => ({
  ...thread,
  messages: await Promise.all(thread.messages.map(hydrateChatMessageImage)),
});

export const hydrateChatThreadsImages = async (
  threads: ChatThread[]
): Promise<ChatThread[]> => Promise.all(threads.map(hydrateChatThreadImages));
