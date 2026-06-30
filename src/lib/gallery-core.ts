import type { ChatThread, GeneratedImage } from "../types.ts";

export const LEGACY_GUEST_IMAGES_KEY = "guest_images";
export const LOCAL_IMAGE_URL_PREFIX = "local-image://";

export const getLocalImagesStorageKey = (userId: string | null | undefined): string =>
  `algobuddy_images_${userId || "guest"}`;

export const createLocalImageKey = (userId: string | null | undefined, now: number): string =>
  `${userId || "guest"}_${now}`;

export const toLocalImageUrl = (localImageKey: string): string =>
  `${LOCAL_IMAGE_URL_PREFIX}${localImageKey}`;

export const getLocalImageKeyFromUrl = (url: string | undefined): string | null => {
  if (!url?.startsWith(LOCAL_IMAGE_URL_PREFIX)) return null;
  return url.slice(LOCAL_IMAGE_URL_PREFIX.length);
};

const readImagesFromKey = (key: string): GeneratedImage[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

export const mergeGeneratedImages = (...groups: GeneratedImage[][]): GeneratedImage[] => {
  const byId = new Map<string, GeneratedImage>();

  for (const image of groups.flat()) {
    const key = image.localImageKey || image.id;
    if (!byId.has(key)) {
      byId.set(key, image);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getLocalImages = (userId: string | null | undefined): GeneratedImage[] => {
  const primary = readImagesFromKey(getLocalImagesStorageKey(userId));
  const legacyGuest = userId ? [] : readImagesFromKey(LEGACY_GUEST_IMAGES_KEY);
  return mergeGeneratedImages(primary, legacyGuest);
};

export const getGuestImages = (): GeneratedImage[] => {
  return getLocalImages(null);
};

export const getGeneratedImagesFromChatThreads = (threads: ChatThread[]): GeneratedImage[] =>
  threads.flatMap((thread) =>
    thread.messages
      .filter((message) => Boolean(message.imageUrl || message.localImageKey))
      .map((message) => {
        const localImageKey =
          message.localImageKey || getLocalImageKeyFromUrl(message.imageUrl) || undefined;
        const url = message.imageUrl || (localImageKey ? toLocalImageUrl(localImageKey) : "");

        return {
          id: `chat_${thread.id}_${message.createdAt}`,
          userId: thread.userId,
          url,
          prompt: message.imagePrompt || message.text,
          localImageKey,
          createdAt: new Date(message.createdAt).toISOString(),
          localOnly: url.startsWith("data:") || Boolean(localImageKey),
        };
      })
  );

export const serializeGeneratedImageForLocalStorage = (
  image: GeneratedImage
): GeneratedImage => {
  if (!image.url.startsWith("data:")) return image;
  if (!image.localImageKey) {
    const { url, ...withoutUrl } = image;
    return { ...withoutUrl, url: "" };
  }
  return {
    ...image,
    url: toLocalImageUrl(image.localImageKey),
  };
};

export const setLocalImages = (
  userId: string | null | undefined,
  images: GeneratedImage[]
) => {
  const limited = images.slice(0, 30).map(serializeGeneratedImageForLocalStorage);
  localStorage.setItem(getLocalImagesStorageKey(userId), JSON.stringify(limited));
  if (!userId) {
    localStorage.setItem(LEGACY_GUEST_IMAGES_KEY, JSON.stringify(limited));
  }
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const isFirebaseStorageRetryLimitError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "storage/retry-limit-exceeded";

const shouldUseLocalImageFallback = (error: unknown): boolean => {
  if (isFirebaseStorageRetryLimitError(error)) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("storage/")
  );
};

export type ImageUploadMetadata = {
  contentType: string;
};

export type GalleryDeps = {
  now: () => number;
  getLocalImages: (userId: string | null) => GeneratedImage[];
  setLocalImages: (userId: string | null, images: GeneratedImage[]) => void;
  saveLocalImageData?: (key: string, dataUrl: string) => Promise<void>;
  uploadImage: (path: string, blob: Blob, metadata: ImageUploadMetadata) => Promise<void>;
  getImageDownloadUrl: (path: string) => Promise<string>;
  addImageDoc: (data: Omit<GeneratedImage, "id" | "localOnly">) => Promise<{ id: string }>;
};

const createLocalImageItem = (
  userId: string | null,
  dataUrl: string,
  prompt: string,
  createdAt: string,
  now: number,
  localImageKey = createLocalImageKey(userId, now)
): GeneratedImage => ({
  id: "local_" + now,
  userId: userId || "guest",
  url: dataUrl,
  prompt,
  localImageKey,
  createdAt,
  localOnly: true,
});

const persistLocalImageItem = async (
  userId: string | null,
  item: GeneratedImage,
  dataUrl: string,
  deps: GalleryDeps
): Promise<void> => {
  if (item.localImageKey) {
    try {
      await deps.saveLocalImageData?.(item.localImageKey, dataUrl);
    } catch (err) {
      console.warn("[gallery] failed to save local image data:", err);
    }
  }

  deps.setLocalImages(userId, [
    serializeGeneratedImageForLocalStorage(item),
    ...deps.getLocalImages(userId),
  ]);
};

export async function saveGeneratedImageWithDeps(
  userId: string | null,
  dataUrl: string,
  prompt: string,
  deps: GalleryDeps,
  localImageKey?: string
): Promise<GeneratedImage> {
  const now = deps.now();
  const createdAt = new Date(now).toISOString();

  if (!userId) {
    const item = createLocalImageItem(null, dataUrl, prompt, createdAt, now, localImageKey);
    await persistLocalImageItem(null, item, dataUrl, deps);
    return item;
  }

  const localItem = createLocalImageItem(userId, dataUrl, prompt, createdAt, now, localImageKey);
  await persistLocalImageItem(userId, localItem, dataUrl, deps);

  const path = `generated-images/${userId}/${now}.png`;
  const blob = await dataUrlToBlob(dataUrl);
  const contentType = blob.type || "image/png";

  try {
    await deps.uploadImage(path, blob, { contentType });
    const url = await deps.getImageDownloadUrl(path);

    const docRef = await deps.addImageDoc({
      userId,
      prompt,
      url,
      storagePath: path,
      localImageKey: localItem.localImageKey,
      createdAt,
    });

    return {
      id: docRef.id,
      userId,
      url,
      prompt,
      storagePath: path,
      localImageKey: localItem.localImageKey,
      createdAt,
    };
  } catch (err) {
    const reason = shouldUseLocalImageFallback(err) ? "storage" : "cloud";
    console.warn(`[gallery] ${reason} image save failed; saved locally instead:`, err);
    return localItem;
  }
}
