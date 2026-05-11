import { getAccessTokenWithFallback, supabasePublicKey, supabaseUrl } from './supabase';

export interface InlineAttachment {
  mimeType: string;
  data: string;
}

export interface ChatFunctionMessage {
  role: string;
  content: string;
  attachments?: InlineAttachment[];
}

export interface ChatFunctionRequest {
  messages: ChatFunctionMessage[];
  fieldContext: string;
  hasActiveField: boolean;
  fieldId?: string | null;
  growerId?: string | null;
  conversationId?: string | null;
  userMessageId?: string | null;
  attachmentPaths?: string[];
  timezone?: string;
  lang?: string;
}

export interface ActionDetectedPayload {
  action_type: string;
  product?: string | null;
  quantity?: string | null;
  date_mentioned?: string | null;
  confidence: number;
}

export interface ChatFunctionMetadata {
  diagnosis_data?: Record<string, unknown> | null;
  crop_mentioned?: string | null;
  intent?: string;
  field_scope?: string;
  question_count?: number;
  has_banned_opener?: boolean;
  action_detected?: ActionDetectedPayload | null;
  [key: string]: unknown;
}

export interface ChatFunctionDonePayload {
  conversationId: string | null;
  assistantMessageId: string | null;
  assistantText: string;
  messageCountMonth: number | null;
  metadata?: ChatFunctionMetadata;
  userMessageId?: string | null;
  fieldId?: string | null;
}

type StreamCallbacks = {
  onToken?: (text: string) => void;
  signal?: AbortSignal;
};

function createStreamError(message: string, status?: number, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

export function parseSseEvent(rawEvent: string): { event: string; data: string } | null {
  const lines = rawEvent.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
}

export async function readErrorPayload(response: Response): Promise<{ message: string; code?: string }> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        return {
          message: payload.error,
          code: typeof payload.code === 'string' ? payload.code : undefined,
        };
      }
    } catch (error) {
      console.error('Failed to parse chat function error JSON:', error);
    }
  }

  const text = await response.text();
  return { message: text || `Chat request failed with status ${response.status}` };
}

export async function streamChatCompletion(
  request: ChatFunctionRequest,
  callbacks: StreamCallbacks = {}
): Promise<ChatFunctionDonePayload> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw createStreamError('Supabase environment variables are missing.');
  }

  const accessToken = await getAccessTokenWithFallback();

  if (!accessToken) {
    throw createStreamError('You need to sign in to use chat.', 401);
  }

  try {
    // Use raw fetch for SSE streaming — supabase.functions.invoke buffers the
    // entire response body before returning, which breaks real-time token streaming.
    const functionUrl = `${supabaseUrl}/functions/v1/chat`;
    const streamResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabasePublicKey,
      },
      body: JSON.stringify(request),
      signal: callbacks.signal && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([AbortSignal.timeout(70000), callbacks.signal])
        : callbacks.signal ?? AbortSignal.timeout(70000),
    });

    if (!streamResponse.ok) {
      const { message, code } = await readErrorPayload(streamResponse);
      throw createStreamError(message, streamResponse.status, code);
    }

    if (!streamResponse.body) {
      throw createStreamError('Chat function did not return a readable stream.');
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload: ChatFunctionDonePayload | null = null;
    let metaConversationId: string | null = null;
    let metaUserMessageId: string | null = null;

    const handleEvent = (rawEvent: string) => {
      const parsed = parseSseEvent(rawEvent);
      if (!parsed) {
        return;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(parsed.data) as Record<string, unknown>;
      } catch {
        console.warn('Failed to parse SSE data:', parsed.data);
        return;
      }

      if (parsed.event === 'meta') {
        metaConversationId = typeof payload.conversationId === 'string' ? payload.conversationId : null;
        metaUserMessageId = typeof payload.userMessageId === 'string' ? payload.userMessageId : null;
        return;
      }

      if (parsed.event === 'token') {
        const token = typeof payload.text === 'string' ? payload.text : '';
        if (token) {
          callbacks.onToken?.(token);
        }
        return;
      }

      if (parsed.event === 'error') {
        const message = typeof payload.message === 'string' ? payload.message : 'Unknown chat streaming error';
        const code = typeof payload.code === 'string' ? payload.code : undefined;
        // Map known codes to HTTP-equivalent status so Chat.tsx catch block
        // shows the right UI (503 → capacity message, etc.)
        const status = code === 'ai_quota' ? 503 : undefined;
        throw createStreamError(message, status, code);
      }

      if (parsed.event === 'done') {
        donePayload = {
          conversationId: typeof payload.conversationId === 'string' ? payload.conversationId : metaConversationId,
          assistantMessageId: typeof payload.assistantMessageId === 'string' ? payload.assistantMessageId : null,
          assistantText: typeof payload.assistantText === 'string' ? payload.assistantText : '',
          messageCountMonth: typeof payload.messageCountMonth === 'number' ? payload.messageCountMonth : null,
          metadata: (payload.metadata as ChatFunctionMetadata | undefined) ?? undefined,
          userMessageId: typeof payload.userMessageId === 'string' ? payload.userMessageId : metaUserMessageId,
          fieldId: typeof payload.fieldId === 'string' ? payload.fieldId : null,
        };
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex).trim();
        buffer = buffer.slice(separatorIndex + 2);

        if (rawEvent) {
          handleEvent(rawEvent);
        }

        separatorIndex = buffer.indexOf('\n\n');
      }

      if (done) {
        const remaining = buffer.trim();
        if (remaining) {
          handleEvent(remaining);
        }
        break;
      }
    }

    if (!donePayload) {
      throw createStreamError('Chat stream ended before a completion payload was received.');
    }

    return donePayload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createStreamError('Chat request timed out.');
    }
    throw error;
  }
}

// ── Guest chat (unauthenticated, single message, no streaming) ──

export interface GuestChatResponse {
  assistantText: string;
  metadata?: ChatFunctionMetadata;
}

export async function guestChatCompletion(
  message: string,
  lang?: string,
  attachment?: InlineAttachment,
): Promise<GuestChatResponse> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw createStreamError('Supabase environment variables are missing.');
  }

  const functionUrl = `${supabaseUrl}/functions/v1/chat`;
  const userMessage = attachment
    ? { role: 'user', content: message, attachments: [attachment] }
    : { role: 'user', content: message };

  const fetchPayload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabasePublicKey,
    },
    body: JSON.stringify({
      mode: 'guest',
      messages: [userMessage],
      lang,
    }),
  };

  // Retry once on cold-start 500/503 to survive Deno isolate warm-up
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 2000));
    }
    const response = await fetch(functionUrl, {
      ...fetchPayload,
      signal: AbortSignal.timeout(40000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        assistantText: typeof data.assistantText === 'string' ? data.assistantText : '',
        metadata: data.metadata as ChatFunctionMetadata | undefined,
      };
    }

    // Only retry on server errors (500, 503); surface other errors immediately
    if (response.status !== 500 && response.status !== 503) {
      const { message: errorMessage, code } = await readErrorPayload(response);
      throw createStreamError(errorMessage, response.status, code);
    }

    if (attempt === 1) {
      const { message: errorMessage, code } = await readErrorPayload(response);
      throw createStreamError(errorMessage, response.status, code);
    }
  }

  // Should never reach here
  throw createStreamError('Unexpected error in guest chat');
}
