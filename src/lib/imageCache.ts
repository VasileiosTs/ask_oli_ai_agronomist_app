/**
 * ImageCache — IndexedDB layer for photo blobs
 * Ported from PlantPal, adapted for Oli.
 * Supabase Storage = source of truth. This = local read cache.
 * Photos load instantly on revisit without network round-trip.
 */

const DB_NAME = 'OliImageCache';
const DB_VERSION = 1;
const STORE = 'images';

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function cacheImage(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('ImageCache: save failed', e);
  }
}

export async function getCachedImage(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch (e) {
    return null;
  }
}

export async function deleteCachedImage(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('ImageCache: delete failed', e);
  }
}

/**
 * Compress an image File to max 1000×1000, JPEG 80%.
 * Ported from PlantPal — reduces payload for slow rural connections.
 */
/**
 * Compress an image File to max 1000×1000, JPEG 80%.
 * L1: Proper error handling with reject + fallback for all failure modes.
 */
export function compressImage(file: File): Promise<{ blob: Blob; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const fallback = () => {
      // If anything fails, try to return the original file as-is
      const fallbackReader = new FileReader();
      fallbackReader.onloadend = () => {
        const b64 = (fallbackReader.result as string)?.split(',')[1];
        if (b64) {
          resolve({ blob: file, base64: b64, mimeType: file.type });
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      fallbackReader.onerror = () => reject(new Error('Failed to read image file'));
      fallbackReader.readAsDataURL(file);
    };

    const reader = new FileReader();
    reader.onloadend = () => {
      const src = reader.result as string;
      if (!src) { fallback(); return; }

      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1000;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { fallback(); return; }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve({ blob: file, base64: src.split(',')[1], mimeType: file.type }); return; }
              const fr = new FileReader();
              fr.onloadend = () => {
                const b64 = (fr.result as string)?.split(',')[1];
                if (b64) {
                  resolve({ blob, base64: b64, mimeType: 'image/jpeg' });
                } else {
                  fallback();
                }
              };
              fr.onerror = () => fallback();
              fr.readAsDataURL(blob);
            },
            'image/jpeg', 0.8
          );
        } catch {
          fallback();
        }
      };
      img.onerror = () => fallback();
      img.src = src;
    };
    reader.onerror = () => fallback();
    reader.readAsDataURL(file);
  });
}
