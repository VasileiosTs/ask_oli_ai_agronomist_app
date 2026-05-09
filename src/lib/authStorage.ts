const CURRENT_AUTH_STORAGE_KEY = 'oli-auth';

type StoredSession = {
  access_token?: string;
  expires_at?: number;
  user?: { id?: string };
};

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession | null;
    if (!parsed?.access_token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStoredAuthSessionRaw(): string | null {
  if (typeof localStorage === 'undefined') return null;

  const currentRaw = localStorage.getItem(CURRENT_AUTH_STORAGE_KEY);
  if (parseStoredSession(currentRaw)) {
    return currentRaw;
  }

  const storageKeys = new Set(Object.keys(localStorage));
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key) storageKeys.add(key);
  }

  const legacyKey = Array.from(storageKeys).find(
    (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
  );
  if (!legacyKey) return null;

  const legacyRaw = localStorage.getItem(legacyKey);
  if (!parseStoredSession(legacyRaw)) {
    return null;
  }

  localStorage.setItem(CURRENT_AUTH_STORAGE_KEY, legacyRaw!);
  return legacyRaw;
}

export function readStoredAuthSession<T = StoredSession>(): T | null {
  const raw = readStoredAuthSessionRaw();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function hasValidStoredAuthSession(): boolean {
  const session = readStoredAuthSession<StoredSession>();
  if (!session?.expires_at) return false;
  return session.expires_at > Date.now() / 1000 + 60;
}
