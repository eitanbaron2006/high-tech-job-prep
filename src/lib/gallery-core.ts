import type { ChatThread, GeneratedImage } from "../types.ts";

export const LEGACY_GUEST_IMAGES_KEY = "guest_images";

export const getLocalImagesStorageKey = (userId: string | null | undefined): string =>
  `algobuddy_images_${userId || "guest"}`;

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
    if (!byId.has(image.id)) {
      byId.set(image.id, image);
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
      .filter((message) => Boolean(message.imageUrl))
      .map((message) => ({
        id: `chat_${thread.id}_${message.createdAt}`,
        userId: thread.userId,
        url: message.imageUrl!,
        prompt: message.imagePrompt || message.text,
        createdAt: new Date(message.createdAt).toISOString(),
        localOnly: message.imageUrl!.startsWith("data:"),
      }))
  );

export const setLocalImages = (
  userId: string | null | undefined,
  images: GeneratedImage[]
) => {
  const limited = images.slice(0, 30);
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
  uploadImage: (path: string, blob: Blob, metadata: ImageUploadMetadata) => Promise<void>;
  getImageDownloadUrl: (path: string) => Promise<string>;
  addImageDoc: (data: Omit<GeneratedImage, "id" | "localOnly">) => Promise<{ id: string }>;
};

const createLocalImageItem = (
  userId: string | null,
  dataUrl: string,
  prompt: string,
  createdAt: string,
  now: number
): GeneratedImage => ({
  id: "local_" + now,
  userId: userId || "guest",
  url: dataUrl,
  prompt,
  createdAt,
  localOnly: true,
});

export async function saveGeneratedImageWithDeps(
  userId: string | null,
  dataUrl: string,
  prompt: string,
  deps: GalleryDeps
): Promise<GeneratedImage> {
  const now = deps.now();
  const createdAt = new Date(now).toISOString();

  if (!userId) {
    const item = createLocalImageItem(null, dataUrl, prompt, createdAt, now);
    deps.setLocalImages(null, [item, ...deps.getLocalImages(null)]);
    return item;
  }

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
      createdAt,
    });

    return { id: docRef.id, userId, url, prompt, storagePath: path, createdAt };
  } catch (err) {
    const item = createLocalImageItem(userId, dataUrl, prompt, createdAt, now);
    deps.setLocalImages(userId, [item, ...deps.getLocalImages(userId)]);
    const reason = shouldUseLocalImageFallback(err) ? "storage" : "cloud";
    console.warn(`[gallery] ${reason} image save failed; saved locally instead:`, err);
    return item;
  }
}
