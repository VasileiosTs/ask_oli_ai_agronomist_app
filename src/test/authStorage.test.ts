import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasValidStoredAuthSession, readStoredAuthSession } from '../lib/authStorage';

const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
const validSession = {
  access_token: 'token',
  expires_at: futureExpiry,
  user: { id: 'user-id' },
};

describe('auth storage helpers', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size; },
    });
  });

  it('reads the current oli-auth session key', () => {
    localStorage.setItem('oli-auth', JSON.stringify(validSession));

    expect(hasValidStoredAuthSession()).toBe(true);
    expect(readStoredAuthSession<typeof validSession>()).toEqual(validSession);
  });

  it('migrates a legacy Supabase auth key into oli-auth', () => {
    localStorage.setItem('sb-example-auth-token', JSON.stringify(validSession));

    expect(hasValidStoredAuthSession()).toBe(true);
    expect(localStorage.getItem('oli-auth')).toEqual(JSON.stringify(validSession));
  });
});
