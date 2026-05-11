const CURRENT_AUTH_STORAGE_KEY = 'oli-auth';

type StoredSession = {
  access_token?: string;
  expires_at?: number;
  user?: { id?: string };
};

// Supabase can store the session in two shapes:
//   1. Top-level: { access_token, expires_at, user, ... }       ← standard
//   2. Nested:    { currentSession: { access_token, ... }, ... } ← post-refresh in some SDK versions
// We normalise to the top-level shape so downstream checks are consistent.
function normaliseSession(raw: unknown): StoredSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // Shape 1 — top-level access_token
  if (typeof obj.access_token === 'string' && obj.access_token) {
    return obj as StoredSession;
  }

  // Shape 2 — nested currentSession
  const nested = obj.currentSession;
  if (nested && typeof nested === 'object') {
    const n = nested as Record<string, unknown>;
    if (typeof n.access_token === 'string' && n.access_token) {
      return n as StoredSession;
    }
  }

  return null;
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const session = normaliseSession(parsed);
    if (!session?.access_token || !session?.user?.id) return null;
    return session;
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
