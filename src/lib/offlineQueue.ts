/**
 * Offline message queue — persists unsent messages in IndexedDB.
 * When the user sends a message while offline, it's stored here.
 * When connectivity returns, drain() replays each message through
 * the provided send function, then clears the queue.
 */

const DB_NAME = 'oli-offline-queue';
const STORE_NAME = 'messages';
const DB_VERSION = 1;

export interface QueuedMessage {
  id: string;
  text: string;
  attachment?: { mimeType: string; data: string; previewUrl: string } | null;
  enqueuedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueMessage(msg: QueuedMessage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(msg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingMessages(): Promise<QueuedMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as QueuedMessage[]).sort((a, b) => a.enqueuedAt - b.enqueuedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function removeMessage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Drain the offline queue. For each queued message, call sendFn.
 * On success, remove from queue. On error, leave in queue for next retry.
 * Returns the number of messages successfully sent.
 */
export async function drainQueue(
  sendFn: (msg: QueuedMessage) => Promise<void>,
): Promise<number> {
  const messages = await getPendingMessages();
  let sent = 0;
  for (const msg of messages) {
    try {
      await sendFn(msg);
      await removeMessage(msg.id);
      sent++;
    } catch {
      // Leave failed messages for next drain attempt
      break;
    }
  }
  return sent;
}
