import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  getAccessTokenWithFallback: vi.fn(),
  supabasePublicKey: 'test-publishable-key',
  supabaseUrl: 'https://example.supabase.co',
}));

import { parseSseEvent, readErrorPayload } from '../lib/chatFunction';

describe('chatFunction SSE helpers', () => {
  it('parses named SSE events with multiline data', () => {
    const parsed = parseSseEvent('event: token\ndata: {"text":"hello"}\ndata: {"more":true}');
    expect(parsed).toEqual({
      event: 'token',
      data: '{"text":"hello"}\n{"more":true}',
    });
  });

  it('returns null when an SSE payload has no data lines', () => {
    expect(parseSseEvent('event: token')).toBeNull();
  });

  it('reads structured JSON error payloads', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Monthly message limit reached', code: 'monthly_limit' }),
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
      },
    );

    await expect(readErrorPayload(response)).resolves.toEqual({
      message: 'Monthly message limit reached',
      code: 'monthly_limit',
    });
  });

  it('falls back to plain text when the response is not JSON', async () => {
    const response = new Response('Temporary upstream error', {
      status: 502,
      headers: { 'content-type': 'text/plain' },
    });

    await expect(readErrorPayload(response)).resolves.toEqual({
      message: 'Temporary upstream error',
    });
  });
});
