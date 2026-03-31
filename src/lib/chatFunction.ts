import { supabase, supabasePublicKey, supabaseUrl } from './supabase';

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
  conversationId?: string | null;
  userMessageId?: string | null;
  attachmentPaths?: string[];
  timezone?: string;
  lang?: string;
}

export interface ChatFunctionMetadata {
  diagnosis_data?: Record<string, unknown> | null;
  crop_mentioned?: string | null;
  intent?: string;
  field_scope?: string;
  question_count?: number;
  has_banned_opener?: boolean;
  [key: string]: unknown;
}

export interface ChatFunctionDonePayload {
  assistantMessageId: string | null;
  assistantText: string;
  messageCountMonth: number | null;
  metadata?: ChatFunctionMetadata;
  userMessageId?: string | null;
}

type StreamCallbacks = {
  onToken?: (text: string) => void;
};

function createStreamError(message: string, status?: number) {
  return Object.assign(new Error(message), { status });
}

function parseSseEvent(rawEvent: string): { event: string; data: string } | null {
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

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        return payload.error;
      }
    } catch (error) {
      console.error('Failed to parse chat function error JSON:', error);
    }
  }

  const text = await response.text();
  return text || `Chat request failed with status ${response.status}`;
}

export async function streamChatCompletion(
  request: ChatFunctionRequest,
  callbacks: StreamCallbacks = {}
): Promise<ChatFunctionDonePayload> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw createStreamError('Supabase environment variables are missing.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
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
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabasePublicKey,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(70000),
    });

    if (!streamResponse.ok) {
      const errorMessage = await readErrorMessage(streamResponse);
      throw createStreamError(errorMessage, streamResponse.status);
    }

    if (!streamResponse.body) {
      throw createStreamError('Chat function did not return a readable stream.');
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload: ChatFunctionDonePayload | null = null;

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

      if (parsed.event === 'token') {
        const token = typeof payload.text === 'string' ? payload.text : '';
        if (token) {
          callbacks.onToken?.(token);
        }
        return;
      }

      if (parsed.event === 'error') {
        const message = typeof payload.message === 'string' ? payload.message : 'Unknown chat streaming error';
        throw createStreamError(message);
      }

      if (parsed.event === 'done') {
        donePayload = {
          assistantMessageId: typeof payload.assistantMessageId === 'string' ? payload.assistantMessageId : null,
          assistantText: typeof payload.assistantText === 'string' ? payload.assistantText : '',
          messageCountMonth: typeof payload.messageCountMonth === 'number' ? payload.messageCountMonth : null,
          metadata: (payload.metadata as ChatFunctionMetadata | undefined) ?? undefined,
          userMessageId: typeof payload.userMessageId === 'string' ? payload.userMessageId : null,
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
): Promise<GuestChatResponse> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw createStreamError('Supabase environment variables are missing.');
  }

  const functionUrl = `${supabaseUrl}/functions/v1/chat`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabasePublicKey,
    },
    body: JSON.stringify({
      mode: 'guest',
      messages: [{ role: 'user', content: message }],
      lang,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    throw createStreamError(errorMessage, response.status);
  }

  const data = await response.json();
  return {
    assistantText: typeof data.assistantText === 'string' ? data.assistantText : '',
    metadata: data.metadata as ChatFunctionMetadata | undefined,
  };
}
