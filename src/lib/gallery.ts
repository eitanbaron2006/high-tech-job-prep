import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, storage } from "../firebase.ts";
import type { GeneratedImage } from "../types.ts";
import {
  dataUrlToBlob,
  createLocalImageKey,
  getGeneratedImagesFromChatThreads,
  getGuestImages,
  getLocalImages,
  getLocalImagesStorageKey,
  isFirebaseStorageRetryLimitError,
  mergeGeneratedImages,
  saveGeneratedImageWithDeps,
  setLocalImages,
} from "./gallery-core.ts";
import { deleteLocalImageData, saveLocalImageData } from "./local-image-store.ts";

export {
  dataUrlToBlob,
  createLocalImageKey,
  getGeneratedImagesFromChatThreads,
  getGuestImages,
  getLocalImages,
  getLocalImagesStorageKey,
  isFirebaseStorageRetryLimitError,
  mergeGeneratedImages,
  saveGeneratedImageWithDeps,
};

/**
 * Persists a generated image. Logged-in users get the image uploaded to
 * Firebase Storage with a Firestore record; failed cloud saves fall back to
 * local per-user storage so the gallery still works on this device.
 */
export async function saveGeneratedImage(
  userId: string | null,
  dataUrl: string,
  prompt: string,
  localImageKey?: string
): Promise<GeneratedImage> {
  return saveGeneratedImageWithDeps(userId, dataUrl, prompt, {
    now: () => Date.now(),
    getLocalImages,
    setLocalImages,
    saveLocalImageData,
    uploadImage: async (path, blob, metadata) => {
      await uploadBytes(storageRef(storage, path), blob, metadata);
    },
    getImageDownloadUrl: async (path) => getDownloadURL(storageRef(storage, path)),
    addImageDoc: async (data) => addDoc(collection(db, "images"), data),
  }, localImageKey);
}

export async function fetchUserImages(userId: string): Promise<GeneratedImage[]> {
  const q = query(
    collection(db, "images"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  const images: GeneratedImage[] = [];
  snap.forEach((d) => {
    const data = d.data();
    images.push({
      id: d.id,
      userId: data.userId,
      url: data.url,
      prompt: data.prompt,
      storagePath: data.storagePath,
      localImageKey: data.localImageKey,
      createdAt: data.createdAt,
    });
  });
  return images;
}

export async function deleteGeneratedImage(
  item: GeneratedImage,
  userId: string | null
): Promise<void> {
  if (!userId || item.localOnly || item.id.startsWith("local_")) {
    setLocalImages(userId, getLocalImages(userId).filter((i) => i.id !== item.id));
    if (item.localImageKey) {
      await deleteLocalImageData(item.localImageKey).catch((err) => {
        console.warn("[gallery] failed to delete local image data:", err);
      });
    }
    return;
  }
  await deleteDoc(doc(db, "images", item.id));
  if (item.localImageKey) {
    await deleteLocalImageData(item.localImageKey).catch((err) => {
      console.warn("[gallery] failed to delete local image data:", err);
    });
  }
  if (item.storagePath) {
    try {
      await deleteObject(storageRef(storage, item.storagePath));
    } catch (err) {
      // Storage object may already be gone; the Firestore record is what matters.
      console.warn("[gallery] failed to delete storage object:", err);
    }
  }
}

/** Downloads an image url to the user's device (works cross-origin via blob). */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in a new tab so the user can save manually.
    window.open(url, "_blank");
  }
}
