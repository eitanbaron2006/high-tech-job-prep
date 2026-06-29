import {
  ref as storageRef,
  uploadString,
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
import { db, storage } from "../firebase";
import { GeneratedImage } from "../types";

const GUEST_KEY = "guest_images";

export const getGuestImages = (): GeneratedImage[] => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
  } catch {
    return [];
  }
};

const setGuestImages = (images: GeneratedImage[]) => {
  // Keep guest storage from growing unbounded (data URLs are heavy).
  localStorage.setItem(GUEST_KEY, JSON.stringify(images.slice(0, 30)));
};

/**
 * Persists a generated image. Logged-in users get the image uploaded to
 * Firebase Storage with a Firestore record; guests are stored locally.
 */
export async function saveGeneratedImage(
  userId: string | null,
  dataUrl: string,
  prompt: string
): Promise<GeneratedImage> {
  const createdAt = new Date().toISOString();

  if (!userId) {
    const item: GeneratedImage = {
      id: "local_" + Date.now(),
      userId: "guest",
      url: dataUrl,
      prompt,
      createdAt,
    };
    setGuestImages([item, ...getGuestImages()]);
    return item;
  }

  const path = `generated-images/${userId}/${Date.now()}.png`;
  const fileRef = storageRef(storage, path);
  await uploadString(fileRef, dataUrl, "data_url");
  const url = await getDownloadURL(fileRef);

  const docRef = await addDoc(collection(db, "images"), {
    userId,
    prompt,
    url,
    storagePath: path,
    createdAt,
  });

  return { id: docRef.id, userId, url, prompt, storagePath: path, createdAt };
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
      createdAt: data.createdAt,
    });
  });
  return images;
}

export async function deleteGeneratedImage(
  item: GeneratedImage,
  userId: string | null
): Promise<void> {
  if (!userId) {
    setGuestImages(getGuestImages().filter((i) => i.id !== item.id));
    return;
  }
  await deleteDoc(doc(db, "images", item.id));
  if (item.storagePath) {
    try {
      await deleteObject(storageRef(storage, item.storagePath));
    } catch (err) {
      // Storage object may already be gone — the Firestore record is what matters.
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
