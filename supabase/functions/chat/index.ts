// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  applyExtractedFieldContext,
  assembleServerFieldContext,
  cleanupFailedChatAttempt,
  createConversation,
  fetchFieldContextRows,
  fetchOwnedConversation,
  mergeMessageMetadata,
  persistFieldMemorySnapshot,
  resolveSingleFieldByHint,
  updateConversationFieldLink,
} from './lib/fieldContext.ts';
import {
  buildAssistantMetadata,
  callGeminiExtraction,
  generateValidatedResponse,
  splitIntoChunks,
} from './lib/gemini.ts';
import {
  logAiUsageEvent,
  logOperationalEvent,
  maybeLogGeminiErrorRateAlert,
  type GeminiUsage,
} from './lib/monitoring.ts';
import {
  assertBurstRateLimit,
  assertMonthlyUsageAllowed,
  getCurrentMonthlyMessageCount,
  incrementMonthlyMessageCount,
} from './lib/rateLimit.ts';
import type {
  AiResponseJson,
  AppUserRow,
  ChatRequestBody,
  ChatMessageInput,
  ExtractionResult,
} from './lib/types.ts';

// C1: Restrict CORS to production domain (was wildcard *)
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://codex-ask-oli-app.vercel.app';

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get('Origin') || '';
  // Allow the configured production domain and localhost for dev
  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const MAX_HISTORY_MESSAGES = 10;
const MAX_INLINE_ATTACHMENTS = 3;
const MAX_MESSAGE_CHARS = 8000;
const MAX_TOTAL_INLINE_ATTACHMENT_CHARS = 12_000_000;
const ALLOWED_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];
const _rawGeminiModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_MODEL = ALLOWED_GEMINI_MODELS.includes(_rawGeminiModel) ? _rawGeminiModel : 'gemini-2.5-flash';
const ALLOWED_INLINE_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function buildSystemPrompt(fieldContext: string, growerContext = ''): string {
  return `You are Oli, an expert AI agronomist. You help farmers diagnose crop problems, identify plants, plan interventions, and optimise yields. You also answer general agriculture questions about any plant or topic.

BEHAVIOUR RULES (follow strictly):
1. Answer the question FIRST. Never ask a clarifying question before giving an answer.
2. Ask AT MOST ONE question per response, and only if essential.
3. Be specific. Give exact product names, dosages, and timings when relevant.
4. Always check for phytotoxicity before recommending any product.
5. If photos or documents are attached, carefully analyze EVERYTHING visible in the image — leaf color, spots, texture, shape, soil, pests. Describe what you observe in detail before giving advice.
6. Never open with: "Great question!", "Certainly!", "Of course!", "Sure!", or any filler.
7. Use the farmer's language (detect from their message). If unclear, respond in the same language as their most recent message.
8. Be warm but professional. You are a trusted advisor, not a chatbot.
9. If you don't know something, say so clearly and suggest they consult a local expert.
10. Never give advice that could cause crop damage or regulatory violations.
11. When diagnosing diseases, pests or deficiencies, always populate both organic_treatments AND chemical_treatments as separate arrays.
12. CRITICAL: Pest, disease and deficiency advice must be agronomically accurate for the specific crop stated. Never suggest a pest or disease that does not affect that crop. If unsure whether a condition affects a crop, say so.

IMAGE ANALYSIS RULES:
- ALWAYS attempt to identify the plant and any issues visible, even if the image is blurry, partial, or low quality.
- If you can identify the plant with reasonable confidence, state it. If confidence is low, say so but STILL provide your best assessment rather than rejecting.
- NEVER refuse to analyze an image of a plant. Even if you are uncertain, provide observations and a "low confidence" note.
- Treat EVERY image as a genuine plant photo unless it is clearly not a plant at all (e.g. a car, a person).
- Do NOT assume the plant is the same as a previously discussed plant unless the user says so. Each new image should be analyzed independently.

CONTEXT INDEPENDENCE:
- Each conversation starts fresh. Do NOT carry assumptions from field context if the user's message or photo clearly shows a different plant.
- If the user uploads a lemon leaf photo but field context says "olive tree", trust the PHOTO over the field context.
- Field context is background information, not a constraint.

MEMORY & TREATMENT HISTORY:
- The farmer's treatment history is provided below. USE IT to give smarter advice.
- If the farmer reports a problem you've seen before in their history, reference it naturally.
- If a recent treatment did not work, suggest a different approach instead of repeating it.
- If a treatment worked before, you can recommend it again for a similar issue.
- If there is a pending follow-up, ask about it naturally.
- Never dump the raw history back to the farmer. Weave it into the advice.
- If the history shows repeated issues on the same field, flag a possible systemic pattern.

FIELD & HISTORY CONTEXT:
${fieldContext || 'No field data or treatment history on record yet.'}
${growerContext ? `GROWER CONTEXT:\n${growerContext}` : ''}

RESPONSE FORMAT (internal JSON — extract response_text for display):
Return valid JSON matching the validator schema. response_text is what the user sees.
Keep response_text conversational, warm, and thorough. For diagnosis responses, use as many words as needed to fully explain the problem, cause, and treatment — do NOT truncate. For simple questions, keep it concise.`;
}

// Store request-scoped CORS headers
let _reqCorsHeaders: Record<string, string> = {};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ..._reqCorsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// H3: Strip prompt injection markers from user input
function sanitizeUserInput(text: string): string {
  return text
    .replace(/\[SYSTEM[^\]]*\]/gi, '')
    .replace(/\[INSTRUCTION[^\]]*\]/gi, '')
    .replace(/\[ADMIN[^\]]*\]/gi, '')
    .replace(/\[OVERRIDE[^\]]*\]/gi, '')
    .replace(/<<SYS>>[\s\S]*?<<\/SYS>>/gi, '')
    .replace(/\bignore previous instructions\b/gi, '***')
    .replace(/\byou are now\b/gi, '***')
    .trim();
}

// H2: Safe error message that doesn't leak internals
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only return safe, generic messages
    if (error.message.includes('Gemini')) return 'AI service temporarily unavailable';
    if (error.message.includes('Missing required')) return 'Server configuration error';
  }
  return 'An unexpected error occurred';
}

Deno.serve(async (req) => {
  // Set request-scoped CORS headers
  _reqCorsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: _reqCorsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = requiredEnv('GEMINI_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) {
      return jsonResponse({ error: 'Invalid Authorization header' }, 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as ChatRequestBody;
    const mode = body.mode === 'extract' ? 'extract' : body.mode === 'greeting' ? 'greeting' : 'chat';

    const { data: rawAppUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id, name, location, language, primary_crop, tier, message_count_month, message_reset_date')
      .eq('auth_id', user.id)
      .single();

    if (appUserError || !rawAppUser) {
      return jsonResponse({ error: 'App user profile not found' }, 404);
    }

    const appUser = rawAppUser as AppUserRow;

    if (mode === 'extract') {
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        return jsonResponse({ error: 'Extraction mode requires a message' }, 400);
      }

      const { extraction, usage } = await callGeminiExtraction(geminiApiKey, GEMINI_MODEL, message);
      await logOperationalEvent(supabaseAdmin, {
        userId: appUser.id,
        source: 'chat',
        eventType: 'gemini_request',
        message: 'Gemini extraction completed',
        metadata: { model: GEMINI_MODEL, requestKind: 'extract' },
      });
      await logAiUsageEvent(supabaseAdmin, {
        userId: appUser.id,
        model: GEMINI_MODEL,
        requestKind: 'extract',
        usage,
        metadata: { messageId: body.messageId ?? null },
      });
      const result = await applyExtractedFieldContext(supabaseAdmin, appUser.id, body.messageId ?? null, extraction);
      return jsonResponse(result);
    }

    if (mode === 'greeting') {
      const userLang = appUser.language || body.lang || 'en';
      const userTz = body.timezone || 'UTC';
      const now = new Date();
      const locale = userLang === 'el' ? 'el-GR' : 'en-GB';
      const month = now.toLocaleString(locale, { month: 'long', timeZone: userTz });
      const hour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: userTz }));
      const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const crop = appUser.primary_crop || 'crops';
      const location = appUser.location || '';
      const name = appUser.name ? appUser.name.split(' ')[0] : '';

      const greetingPrompt = `You are Oli, an expert AI agronomist.

Generate a single short greeting message (1-2 sentences max) for a farmer.
Farmer profile:
- Name: ${name || 'farmer'}
- Crop(s): ${crop}
- Location: ${location || 'their region'}
- Current month: ${month}
- Time of day: ${timeOfDay}
- Language preference: ${userLang === 'el' ? 'Greek' : 'English'}

Rules:
1. Be warm and specific — mention their actual crop and something genuinely relevant to THIS month
2. Reference a real seasonal concern, task, or observation relevant to their crop in ${month}
3. NEVER invent problems that don't apply to their crop
4. Keep it to 1-2 sentences, conversational, no bullet points
5. Respond in the language preference specified above
6. Do not start with generic greetings — be direct and practical
7. End with an implicit or explicit invitation to ask a question

Return ONLY the greeting text, nothing else.`;

      const payload = {
        systemInstruction: { parts: [{ text: 'You are Oli, an AI agronomist.' }] },
        contents: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
      };

      const greetingRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey }, body: JSON.stringify(payload) }
      );

      if (!greetingRes.ok) {
        return jsonResponse({ error: 'Greeting generation failed' }, 502);
      }

      const greetingData = await greetingRes.json();
      const greetingText = greetingData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      return jsonResponse({ greeting: greetingText });
    }

    const requestMessages = Array.isArray(body.messages)
      ? body.messages.filter((message) => typeof message?.content === 'string' && message.content.trim() !== '')
      : [];

    if (requestMessages.length === 0) {
      return jsonResponse({ error: 'Request must include at least one message' }, 400);
    }

    if (requestMessages.length > MAX_HISTORY_MESSAGES) {
      return jsonResponse({ error: `Request may include at most ${MAX_HISTORY_MESSAGES} messages` }, 400);
    }

    const totalInlineAttachmentChars = requestMessages.reduce((sum, message) => {
      if (!Array.isArray(message.attachments)) {
        return sum;
      }

      return sum + message.attachments.reduce((attachmentSum, attachment) => {
        return attachmentSum + (typeof attachment?.data === 'string' ? attachment.data.length : 0);
      }, 0);
    }, 0);

    if (totalInlineAttachmentChars > MAX_TOTAL_INLINE_ATTACHMENT_CHARS) {
      return jsonResponse({ error: 'Attached files are too large for real-time chat processing' }, 413);
    }

    for (const message of requestMessages) {
      if (message.content.length > MAX_MESSAGE_CHARS) {
        return jsonResponse({ error: `Messages must be ${MAX_MESSAGE_CHARS} characters or less` }, 400);
      }

      if (!Array.isArray(message.attachments)) {
        continue;
      }

      if (message.attachments.length > MAX_INLINE_ATTACHMENTS) {
        return jsonResponse({ error: `At most ${MAX_INLINE_ATTACHMENTS} attachments are allowed per request` }, 400);
      }

      for (const attachment of message.attachments) {
        if (!attachment || typeof attachment.data !== 'string' || typeof attachment.mimeType !== 'string') {
          return jsonResponse({ error: 'Malformed attachment payload' }, 400);
        }

        if (!ALLOWED_INLINE_ATTACHMENT_MIME_TYPES.has(attachment.mimeType)) {
          return jsonResponse({ error: `Unsupported attachment type: ${attachment.mimeType}` }, 400);
        }
      }
    }

    // H3: Sanitize user input to strip prompt injection markers
    for (const message of requestMessages) {
      if (message.role !== 'assistant') {
        message.content = sanitizeUserInput(message.content);
      }
    }

    const latestUserMessage =
      [...requestMessages].reverse().find((message) => message.role !== 'assistant') ?? requestMessages[requestMessages.length - 1];

    const now = new Date();
    const currentCount = getCurrentMonthlyMessageCount(appUser, now);

    try {
      await assertBurstRateLimit(supabaseAdmin, appUser.id);
      assertMonthlyUsageAllowed(appUser, currentCount);
    } catch (error) {
      const status = typeof (error as { status?: unknown }).status === 'number'
        ? Number((error as { status?: unknown }).status)
        : 429;
      const code = typeof (error as { code?: unknown }).code === 'string'
        ? String((error as { code?: unknown }).code)
        : 'rate_limit';
      const limit = typeof (error as { limit?: unknown }).limit === 'number'
        ? Number((error as { limit?: unknown }).limit)
        : undefined;

      return jsonResponse(
        {
          error: error instanceof Error ? error.message : 'Rate limit exceeded',
          code,
          ...(typeof limit === 'number' ? { limit } : {}),
        },
        status,
      );
    }

    const nextMessageCount = currentCount + 1;
    await incrementMonthlyMessageCount(supabaseAdmin, appUser.id, nextMessageCount, now);

    const attachmentPaths = (Array.isArray(body.attachmentPaths) ? body.attachmentPaths : body.imageUrls ?? [])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .filter((value) => value.startsWith(`${user.id}/`));

    const ownedConversation = body.conversationId
      ? await fetchOwnedConversation(supabaseAdmin, appUser.id, body.conversationId)
      : null;

    if (body.conversationId && !ownedConversation) {
      return jsonResponse({ error: 'Invalid conversation for this user' }, 403);
    }

    if (body.fieldId) {
      const { data: fieldRecord, error: fieldError } = await supabaseAdmin
        .from('fields')
        .select('id')
        .eq('id', body.fieldId)
        .eq('user_id', appUser.id)
        .maybeSingle();

      if (fieldError || !fieldRecord) {
        return jsonResponse({ error: 'Invalid field for this user' }, 403);
      }
    }

    const fields = await fetchFieldContextRows(supabaseAdmin, appUser.id);
    let effectiveConversationId = ownedConversation?.id ?? body.conversationId ?? null;
    let effectiveFieldId: string | null = body.fieldId ?? ownedConversation?.field_id ?? null;
    let fieldResolutionSource = body.fieldId
      ? 'request'
      : ownedConversation?.field_id
        ? 'conversation'
        : 'none';

    if (!effectiveFieldId && fields.length === 1) {
      effectiveFieldId = fields[0].id;
      fieldResolutionSource = 'single_field_default';
    }

    let userMessageId: string | null = null;
    let conversationCreatedByFunction = false;
    let extractionResult: ExtractionResult | null = null;
    let serverContext: Awaited<ReturnType<typeof assembleServerFieldContext>>;
    let aiResponse: AiResponseJson;
    let assistantText = '';
    let assistantMetadata: Record<string, unknown> = {};
    let geminiUsage: GeminiUsage | null = null;

    const growerContext = [
      appUser.name ? `Grower name: ${appUser.name}` : '',
      appUser.location ? `Location: ${appUser.location}` : '',
      appUser.primary_crop ? `Primary crop(s): ${appUser.primary_crop}` : '',
    ].filter(Boolean).join('\n');

    try {
      if (!effectiveFieldId) {
        try {
          await logOperationalEvent(supabaseAdmin, {
            userId: appUser.id,
            source: 'chat',
            eventType: 'gemini_request',
            message: 'Gemini field extraction started',
            metadata: {
              model: GEMINI_MODEL,
              requestKind: 'extract',
            },
          });

          const extractionCall = await callGeminiExtraction(
            geminiApiKey,
            GEMINI_MODEL,
            latestUserMessage.content,
          );
          extractionResult = extractionCall.extraction;
          geminiUsage = extractionCall.usage;

          let resolvedField = extractionResult.field_mention
            ? await resolveSingleFieldByHint(
                supabaseAdmin,
                appUser.id,
                extractionResult.field_mention,
                typeof extractionResult.confidence === 'number' && extractionResult.confidence >= 0.7 ? 0.25 : 0.45,
              )
            : null;

          if (!resolvedField && extractionResult.crop_type) {
            resolvedField = await resolveSingleFieldByHint(
              supabaseAdmin,
              appUser.id,
              extractionResult.crop_type,
              fields.length === 1 ? 0.15 : 0.55,
            );
          }

          if (resolvedField) {
            effectiveFieldId = resolvedField.id;
            fieldResolutionSource = 'message_extract';
          }

          await logOperationalEvent(supabaseAdmin, {
            userId: appUser.id,
            source: 'chat',
            eventType: 'gemini_response',
            message: 'Gemini field extraction completed',
            metadata: {
              model: GEMINI_MODEL,
              requestKind: 'extract',
              resolvedFieldId: effectiveFieldId,
            },
          });

          await logAiUsageEvent(supabaseAdmin, {
            userId: appUser.id,
            conversationId: effectiveConversationId,
            model: GEMINI_MODEL,
            requestKind: 'extract',
            usage: extractionCall.usage,
            metadata: {
              messageId: userMessageId,
              resolvedFieldId: effectiveFieldId,
            },
          });
        } catch (error) {
          console.error('Server-side field extraction failed', error);
          await logOperationalEvent(supabaseAdmin, {
            userId: appUser.id,
            source: 'chat',
            eventType: 'gemini_api',
            severity: 'error',
            message: 'Server-side field extraction failed',
            metadata: {
              model: GEMINI_MODEL,
              requestKind: 'extract',
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      if (!effectiveConversationId) {
        const createdConversationId = await createConversation(
          supabaseAdmin,
          appUser.id,
          effectiveFieldId,
          latestUserMessage.content,
        );

        if (!createdConversationId) {
          return jsonResponse({ error: 'Failed to create conversation' }, 500);
        }

        effectiveConversationId = createdConversationId;
        conversationCreatedByFunction = true;
      }

      if (!effectiveConversationId) {
        return jsonResponse({ error: 'Conversation setup failed' }, 500);
      }

      if (body.userMessageId) {
        const userMessageUpdate: Record<string, unknown> = {
          conversation_id: effectiveConversationId,
          field_id: effectiveFieldId,
        };

        if (attachmentPaths.length > 0) {
          userMessageUpdate.image_urls = attachmentPaths;
        }

        const { data: updatedUserMessage, error: updateUserMessageError } = await supabaseAdmin
          .from('chat_messages')
          .update(userMessageUpdate)
          .eq('id', body.userMessageId)
          .eq('user_id', appUser.id)
          .select('id')
          .single();

        if (updateUserMessageError || !updatedUserMessage) {
          console.error('Failed to update user message:', updateUserMessageError?.message);
          await cleanupFailedChatAttempt(
            supabaseAdmin,
            appUser.id,
            null,
            effectiveConversationId,
            conversationCreatedByFunction,
          );
          return jsonResponse({ error: 'Failed to process your message' }, 500);
        }

        userMessageId = updatedUserMessage.id;
      } else {
        const userMetadata =
          attachmentPaths.length > 0
            ? {
                attachments: attachmentPaths,
                source: 'edge-function',
              }
            : {
                source: 'edge-function',
              };

        const { data: insertedUserMessage, error: insertUserMessageError } = await supabaseAdmin
          .from('chat_messages')
          .insert({
            conversation_id: effectiveConversationId,
            user_id: appUser.id,
            field_id: effectiveFieldId,
            role: 'user',
            content: latestUserMessage.content,
            metadata: userMetadata,
            image_urls: attachmentPaths,
          })
          .select('id')
          .single();

        if (insertUserMessageError || !insertedUserMessage) {
          console.error('Failed to insert user message:', insertUserMessageError?.message);
          await cleanupFailedChatAttempt(
            supabaseAdmin,
            appUser.id,
            null,
            effectiveConversationId,
            conversationCreatedByFunction,
          );
          return jsonResponse({ error: 'Failed to save your message' }, 500);
        }

        userMessageId = insertedUserMessage.id;
      }

      const userMessageMetadata: Record<string, unknown> = {
        field_context_source: 'backend',
        field_resolution_source: fieldResolutionSource,
      };

      if (extractionResult) {
        userMessageMetadata.extracted_context = extractionResult;
      }

      if (effectiveFieldId) {
        userMessageMetadata.resolved_field_id = effectiveFieldId;
        await updateConversationFieldLink(supabaseAdmin, appUser.id, effectiveConversationId, effectiveFieldId);
      }

      await mergeMessageMetadata(
        supabaseAdmin,
        appUser.id,
        userMessageId,
        userMessageMetadata,
        effectiveFieldId,
        effectiveConversationId,
      );

      await supabaseAdmin
        .from('users')
        .update({
          last_active_at: now.toISOString(),
        })
        .eq('id', appUser.id);

      serverContext = await assembleServerFieldContext(
        supabaseAdmin,
        appUser.id,
        fields,
        effectiveFieldId,
        body.fieldContext ?? '',
      );

      effectiveFieldId = serverContext.activeFieldId;

      if (effectiveFieldId) {
        await updateConversationFieldLink(supabaseAdmin, appUser.id, effectiveConversationId, effectiveFieldId);
        await mergeMessageMetadata(
          supabaseAdmin,
          appUser.id,
          userMessageId,
          {
            resolved_field_id: effectiveFieldId,
            resolved_field_name: serverContext.activeFieldName,
            field_context_source: 'backend',
            field_resolution_source: fieldResolutionSource,
          },
          effectiveFieldId,
          effectiveConversationId,
        );
      }

      await logOperationalEvent(supabaseAdmin, {
        userId: appUser.id,
        source: 'chat',
        eventType: 'gemini_request',
        message: 'Gemini response generation started',
        metadata: {
          model: GEMINI_MODEL,
          requestKind: 'chat',
        },
      });

      const responseGeneration = await generateValidatedResponse(
        geminiApiKey,
        GEMINI_MODEL,
        requestMessages,
        serverContext.fieldContext,
        serverContext.hasActiveField,
        buildSystemPrompt,
        growerContext,
      );
      aiResponse = responseGeneration.aiResponse;
      geminiUsage = responseGeneration.usage;
      assistantText = aiResponse.response_text;
      assistantMetadata = buildAssistantMetadata(aiResponse);

      await logOperationalEvent(supabaseAdmin, {
        userId: appUser.id,
        source: 'chat',
        eventType: 'gemini_response',
        message: 'Gemini response generated',
        metadata: {
          model: GEMINI_MODEL,
          requestKind: 'chat',
          repaired: responseGeneration.repaired,
        },
      });

      await logAiUsageEvent(supabaseAdmin, {
        userId: appUser.id,
        conversationId: effectiveConversationId,
        model: GEMINI_MODEL,
        requestKind: 'chat',
        usage: geminiUsage,
        metadata: {
          repaired: responseGeneration.repaired,
          fieldId: effectiveFieldId,
        },
      });

      if (!assistantText) {
        await cleanupFailedChatAttempt(
          supabaseAdmin,
          appUser.id,
          userMessageId,
          effectiveConversationId,
          conversationCreatedByFunction,
        );
        return jsonResponse({ error: 'Gemini returned an empty response' }, 502);
      }
    } catch (error) {
      console.error('Chat preprocessing failed', error);
      await logOperationalEvent(supabaseAdmin, {
        userId: appUser.id,
        source: 'chat',
        eventType: 'gemini_api',
        severity: 'error',
        message: 'Chat preprocessing failed',
        metadata: {
          model: GEMINI_MODEL,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await maybeLogGeminiErrorRateAlert(supabaseAdmin, {
        userId: appUser.id,
        model: GEMINI_MODEL,
      });
      await cleanupFailedChatAttempt(
        supabaseAdmin,
        appUser.id,
        userMessageId,
        effectiveConversationId,
        conversationCreatedByFunction,
      );
      return jsonResponse({ error: 'Failed to process your message' }, 500);
    }

    if (!userMessageId) {
      return jsonResponse({ error: 'Failed to save your message' }, 500);
    }

    const encoder = new TextEncoder();
    const chunks = splitIntoChunks(assistantText);
    let finalFieldId = effectiveFieldId;
    let finalFieldName = serverContext.activeFieldName;

    if (!finalFieldId && aiResponse.crop_mentioned) {
      const resolvedFromAi = await resolveSingleFieldByHint(
        supabaseAdmin,
        appUser.id,
        aiResponse.crop_mentioned,
        fields.length === 1 ? 0.15 : 0.55,
      );

      if (resolvedFromAi) {
        finalFieldId = resolvedFromAi.id;
        finalFieldName = resolvedFromAi.name;
        fieldResolutionSource = 'ai_crop_match';

        await updateConversationFieldLink(supabaseAdmin, appUser.id, effectiveConversationId, finalFieldId);
        await mergeMessageMetadata(
          supabaseAdmin,
          appUser.id,
          userMessageId,
          {
            resolved_field_id: finalFieldId,
            resolved_field_name: finalFieldName,
            field_context_source: 'backend',
            field_resolution_source: fieldResolutionSource,
          },
          finalFieldId,
          effectiveConversationId,
        );
      }
    }

    const finalAssistantMetadata = {
      ...(assistantMetadata ?? {}),
      field_context_source: 'backend',
      field_resolution_source: fieldResolutionSource,
      ...(finalFieldId ? { resolved_field_id: finalFieldId } : {}),
      ...(finalFieldName ? { resolved_field_name: finalFieldName } : {}),
    };

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          sendEvent('meta', {
            conversationId: effectiveConversationId,
            userMessageId,
          });

          for (const chunk of chunks) {
            sendEvent('token', { text: chunk });
            await new Promise((resolve) => setTimeout(resolve, 12));
          }

          const { data: insertedAssistantMessage, error: insertAssistantMessageError } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              conversation_id: effectiveConversationId,
              user_id: appUser.id,
              field_id: finalFieldId,
              role: 'assistant',
              content: assistantText,
              metadata: {
                ...finalAssistantMetadata,
                model: GEMINI_MODEL,
                source: 'edge-function',
                reply_to_message_id: userMessageId,
              },
            })
            .select('id')
            .single();

          if (insertAssistantMessageError || !insertedAssistantMessage) {
            throw insertAssistantMessageError ?? new Error('Failed to insert assistant message');
          }

          // C3: Message count already incremented before Gemini call (atomic, no TOCTOU race)

          await persistFieldMemorySnapshot(
            supabaseAdmin,
            appUser.id,
            finalFieldId,
            userMessageId,
            insertedAssistantMessage.id,
            aiResponse,
            assistantText,
            serverContext.recentInterventions,
            serverContext.pendingFollowUps,
          );

          // Set conversation title — use AI-detected crop + problem for meaningful labels
          if (effectiveConversationId) {
            // C4: Owner check — only update conversations belonging to this user
            const { data: convo } = await supabaseAdmin
              .from('conversations')
              .select('title')
              .eq('id', effectiveConversationId)
              .eq('user_id', appUser.id)
              .single();
            if (convo && (!convo.title || convo.title === 'New conversation')) {
              let title = '';

              // Build a meaningful title from AI response metadata
              const crop = aiResponse.crop_mentioned || '';
              const problem = aiResponse.diagnosis_data?.problem || '';

              if (crop && problem) {
                title = `${crop} — ${problem}`;
              } else if (crop) {
                title = crop;
              } else if (problem) {
                title = problem;
              }

              // Fallback to cleaned user message text
              if (!title) {
                const rawText = latestUserMessage.content
                  .replace(/^\[The user attached[^\]]*\]\n?/i, '')
                  .trim();
                title = rawText.slice(0, 60) + (rawText.length > 60 ? '…' : '');
              }

              // Add month/year suffix for easy scanning
              const now = new Date();
              const monthStr = now.toLocaleString('en', { month: 'short', year: 'numeric' });
              title = `${title.slice(0, 50)} – ${monthStr}`;

              await supabaseAdmin
                .from('conversations')
                .update({ title })
                .eq('id', effectiveConversationId)
                .eq('user_id', appUser.id)
                .or('title.is.null,title.eq.New conversation');
            }
          }

          sendEvent('done', {
            conversationId: effectiveConversationId,
            assistantMessageId: insertedAssistantMessage.id,
            assistantText,
            messageCountMonth: nextMessageCount,
            metadata: finalAssistantMetadata,
            userMessageId,
            fieldId: finalFieldId,
          });
          controller.close();
        } catch (error) {
          console.error('chat function stream error', error);
          await logOperationalEvent(supabaseAdmin, {
            userId: appUser.id,
            source: 'chat',
            eventType: 'stream_failure',
            severity: 'error',
            message: 'Chat SSE stream failed',
            metadata: {
              model: GEMINI_MODEL,
              conversationId: effectiveConversationId,
              userMessageId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          // H2: Don't leak internal error details to client
          sendEvent('error', {
            message: 'An error occurred while processing your request',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ..._reqCorsHeaders,
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      },
    });
  } catch (error) {
    console.error('chat function error', error);
    // H2: Sanitized error message — never leak internal details
    return jsonResponse(
      {
        error: safeErrorMessage(error),
      },
      500,
    );
  }
});
