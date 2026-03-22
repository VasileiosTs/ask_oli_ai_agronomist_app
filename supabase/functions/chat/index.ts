// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface InlineAttachment {
  mimeType: string;
  data: string;
}

interface ChatMessageInput {
  role: string;
  content: string;
  attachments?: InlineAttachment[];
}

interface DiagnosisData {
  problem: string | null;
  cause: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  product_applied: string | null;
  product_category: string | null;
  dosage: string | null;
  application_method: string | null;
  organic_treatments: string[] | null;
  chemical_treatments: string[] | null;
}

interface AiResponseJson {
  response_text: string;
  intent: 'diagnosis' | 'advice' | 'followup' | 'general' | 'unclear';
  crop_mentioned: string | null;
  field_scope: 'specific' | 'general';
  question_count: number;
  has_banned_opener: boolean;
  diagnosis_data: DiagnosisData | null;
}

interface ExtractionResult {
  crop_type: string | null;
  field_mention: string | null;
  confidence: number | null;
  problem: string | null;
  location_hint: string | null;
  intervention_hint: string | null;
}

interface ChatRequestBody {
  mode?: 'chat' | 'extract' | 'greeting';
  messages?: ChatMessageInput[];
  message?: string;
  messageId?: string | null;
  fieldContext?: string;
  hasActiveField?: boolean;
  attachmentPaths?: string[];
  imageUrls?: string[];
  conversationId?: string | null;
  fieldId?: string | null;
  userMessageId?: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_LIMIT = 20;
const MAX_HISTORY_MESSAGES = 10;
const MAX_INLINE_ATTACHMENTS = 3;
const MAX_MESSAGE_CHARS = 8000;
const MAX_TOTAL_INLINE_ATTACHMENT_CHARS = 12_000_000;
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const ALLOWED_INLINE_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function buildSystemPrompt(fieldContext: string, growerContext = ''): string {
  return `You are Oli, an expert AI agronomist. You help farmers diagnose crop problems, plan interventions, and optimise yields.
BEHAVIOUR RULES (follow strictly):
1. Answer the question FIRST. Never ask a clarifying question before giving an answer.
2. Ask AT MOST ONE question per response, and only if essential.
3. Be specific. Give exact product names, dosages, and timings when relevant.
4. Always check for phytotoxicity before recommending any product.
5. If photos or documents are attached, describe what you see before giving advice.
6. Never open with: "Great question!", "Certainly!", "Of course!", "Sure!", or any filler.
7. Use the farmer's language (detect from message). Default to English.
8. Be warm but professional. You are a trusted advisor, not a chatbot.
9. If you don't know something, say so clearly and suggest they consult a local expert.
10. Never give advice that could cause crop damage or regulatory violations.
11. When diagnosing diseases, pests or deficiencies, always populate both organic_treatments AND chemical_treatments as separate arrays.
12. CRITICAL: Pest, disease and deficiency advice must be agronomically accurate for the specific crop stated. Never suggest a pest or disease that does not affect that crop (e.g. spider mites affect citrus and vegetables, NOT olive trees — olive trees are affected by δάκος, πυρηνοτρήτης, κυκλοκόνιο etc.). If unsure whether a condition affects a crop, say so.
FIELD CONTEXT:
${fieldContext || 'No field data on record yet. Ask the user about their crop if relevant.'}
${growerContext ? `GROWER CONTEXT:\n${growerContext}` : ''}
RESPONSE FORMAT (internal JSON — extract response_text for display):
Return valid JSON matching the validator schema. response_text is what the user sees.
Keep response_text conversational, warm, and under 200 words unless a detailed protocol is needed.`;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

function cleanAssistantText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^\s*(great question|certainly|of course|sure)[!,.:\-\s]+/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function validateResponse(json: AiResponseJson, hasActiveField: boolean): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (json.question_count > 1) {
    errors.push('question_count > 1: AI asks more than one question.');
  }

  if (json.has_banned_opener) {
    errors.push('has_banned_opener == true: Response starts with a banned opener.');
  }

  if (hasActiveField && json.field_scope !== 'specific') {
    errors.push("field_scope must be 'specific' when an active field exists.");
  }

  if (!json.response_text || json.response_text.trim() === '') {
    errors.push('response_text is empty.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part: any) => part?.text ?? '')
    .join('')
    .trim();
}

function parseGeminiPayload<T>(payload: any): T {
  const text = extractGeminiText(payload)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(text) as T;
}

function buildResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      response_text: { type: 'STRING' },
      intent: { type: 'STRING', enum: ['diagnosis', 'advice', 'followup', 'general', 'unclear'] },
      crop_mentioned: { type: 'STRING', nullable: true },
      field_scope: { type: 'STRING', enum: ['specific', 'general'] },
      question_count: { type: 'INTEGER' },
      has_banned_opener: { type: 'BOOLEAN' },
      diagnosis_data: {
        type: 'OBJECT',
        nullable: true,
        properties: {
          problem: { type: 'STRING', nullable: true },
          cause: { type: 'STRING', nullable: true },
          severity: { type: 'STRING', enum: ['low', 'medium', 'high'], nullable: true },
          product_applied: { type: 'STRING', nullable: true },
          product_category: { type: 'STRING', nullable: true },
          dosage: { type: 'STRING', nullable: true },
          application_method: { type: 'STRING', nullable: true },
          organic_treatments: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
          chemical_treatments: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        },
      },
    },
    required: ['response_text', 'intent', 'field_scope', 'question_count', 'has_banned_opener'],
  };
}

function buildExtractionSchema() {
  return {
    type: 'OBJECT',
    properties: {
      crop_type: { type: 'STRING', nullable: true },
      field_mention: { type: 'STRING', nullable: true },
      confidence: { type: 'NUMBER', nullable: true },
      problem: { type: 'STRING', nullable: true },
      location_hint: { type: 'STRING', nullable: true },
      intervention_hint: { type: 'STRING', nullable: true },
    },
    required: ['crop_type', 'field_mention', 'confidence', 'problem', 'location_hint', 'intervention_hint'],
  };
}

function splitIntoChunks(text: string, targetSize = 64): string[] {
  if (!text.trim()) return [];

  // Split into lines first to preserve paragraph breaks and markdown structure
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    const lineWithBreak = isLast ? line : line + '\n';

    if (!line.trim()) {
      // Empty line = paragraph break — flush current and emit \n\n
      if (current) { chunks.push(current); current = ''; }
      chunks.push('\n\n');
      continue;
    }

    // Split long lines into word chunks, preserving the trailing newline on the last word
    const words = line.split(' ');
    for (let wi = 0; wi < words.length; wi++) {
      const word = wi === words.length - 1 && !isLast ? words[wi] + '\n' : words[wi];
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > targetSize && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function callGemini(
  geminiApiKey: string,
  messages: ChatMessageInput[],
  systemPrompt: string,
  extraInstruction?: string,
): Promise<AiResponseJson> {
  const contents = messages.map((message, index) => {
    const parts: Array<{ text?: string; inlineData?: InlineAttachment }> = [{ text: message.content }];

    if (Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }
    }

    if (extraInstruction && index === messages.length - 1 && parts[0]?.text) {
      parts[0].text = `${parts[0].text}\n\n[SYSTEM REPAIR INSTRUCTION: ${extraInstruction}]`;
    }

    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(),
      temperature: 0.4,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const parsed = parseGeminiPayload<AiResponseJson>(data);

  return {
    ...parsed,
    response_text: cleanAssistantText(parsed.response_text),
  };
}

async function callGeminiExtraction(geminiApiKey: string, message: string): Promise<ExtractionResult> {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Extract agronomic context from the following farmer message. Return JSON only with these exact keys: crop_type, field_mention, confidence, problem, location_hint, intervention_hint. Confidence must be a number from 0.0 to 1.0.\n\n' +
              `Message:\n"""${message}"""`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildExtractionSchema(),
      temperature: 0.1,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return parseGeminiPayload<ExtractionResult>(data);
}

async function generateValidatedResponse(
  geminiApiKey: string,
  messages: ChatMessageInput[],
  fieldContext: string,
  hasActiveField: boolean,
  growerContext = '',
): Promise<AiResponseJson> {
  const systemPrompt = buildSystemPrompt(fieldContext, growerContext);
  let json = await callGemini(geminiApiKey, messages, systemPrompt);
  const validation = validateResponse(json, hasActiveField);

  if (!validation.valid) {
    const repairInstruction = `Your previous response failed validation with these errors: ${validation.errors.join(' ')}. Please correct them and return a valid JSON.`;
    json = await callGemini(geminiApiKey, messages, systemPrompt, repairInstruction);
  }

  return {
    ...json,
    response_text: cleanAssistantText(json.response_text),
  };
}

function buildAssistantMetadata(aiResponse: AiResponseJson): Record<string, unknown> | null {
  const metadata: Record<string, unknown> = {
    intent: aiResponse.intent,
    field_scope: aiResponse.field_scope,
    question_count: aiResponse.question_count,
    has_banned_opener: aiResponse.has_banned_opener,
  };

  if (aiResponse.crop_mentioned) {
    metadata.crop_mentioned = aiResponse.crop_mentioned;
  }

  if (aiResponse.diagnosis_data) {
    metadata.diagnosis_data = aiResponse.diagnosis_data;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function sameCalendarMonth(a: Date | null, b: Date): boolean {
  if (!a) {
    return false;
  }

  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

async function resolveFieldCandidates(supabaseAdmin: any, appUserId: string, fieldMention: string) {
  const trimmedMention = fieldMention.trim();
  if (!trimmedMention) {
    return [];
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('resolve_field', {
    p_user_id: appUserId,
    p_mention: trimmedMention,
  });

  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    return rpcData.map((field: any) => ({
      id: field.field_id,
      name: field.field_name,
      confidence: typeof field.confidence === 'number' ? field.confidence : null,
    }));
  }

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('fields')
    .select('id, name')
    .eq('user_id', appUserId)
    .ilike('name', `%${trimmedMention}%`)
    .limit(3);

  if (fallbackError || !Array.isArray(fallbackData)) {
    return [];
  }

  return fallbackData.map((field) => ({
    id: field.id,
    name: field.name,
    confidence: null,
  }));
}

async function applyExtractedFieldContext(
  supabaseAdmin: any,
  appUserId: string,
  messageId: string | null | undefined,
  extracted: ExtractionResult,
) {
  let action: 'none' | 'auto_set' | 'disambiguate' = 'none';
  let targetFieldId: string | undefined;
  let disambiguateFields: Array<{ id: string; name: string; confidence: number | null }> = [];

  const metadata: Record<string, unknown> = {};
  if (extracted.intervention_hint) {
    metadata.intervention_hint = extracted.intervention_hint;
  }

  const confidence = typeof extracted.confidence === 'number' ? extracted.confidence : 0;

  if (extracted.field_mention) {
    const matchedFields = await resolveFieldCandidates(supabaseAdmin, appUserId, extracted.field_mention);

    if (matchedFields.length > 0) {
      if (confidence > 0.7) {
        targetFieldId = matchedFields[0].id;
        action = 'auto_set';
      } else if (confidence >= 0.4) {
        disambiguateFields = matchedFields;
        action = 'disambiguate';
      }
    } else if (extracted.crop_type) {
      const { data: createdField, error: createFieldError } = await supabaseAdmin
        .from('fields')
        .insert({
          user_id: appUserId,
          name: `${extracted.crop_type} Field`,
          crop_type: extracted.crop_type,
          source: 'auto_detected',
        })
        .select('id, name')
        .single();

      if (!createFieldError && createdField) {
        targetFieldId = createdField.id;
        action = 'auto_set';
      }
    }
  } else if (extracted.crop_type) {
    const { data: createdField, error: createFieldError } = await supabaseAdmin
      .from('fields')
      .insert({
        user_id: appUserId,
        name: `${extracted.crop_type} Field`,
        crop_type: extracted.crop_type,
        source: 'auto_detected',
      })
      .select('id, name')
      .single();

    if (!createFieldError && createdField) {
      targetFieldId = createdField.id;
      action = 'auto_set';
    }
  }

  if (messageId) {
    const { data: existingMessage } = await supabaseAdmin
      .from('chat_messages')
      .select('metadata')
      .eq('id', messageId)
      .eq('user_id', appUserId)
      .maybeSingle();

    const updateData: Record<string, unknown> = {};

    if (Object.keys(metadata).length > 0) {
      updateData.metadata = {
        ...((existingMessage?.metadata as Record<string, unknown> | null) ?? {}),
        ...metadata,
      };
    }

    if (targetFieldId) {
      updateData.field_id = targetFieldId;
    }

    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin
        .from('chat_messages')
        .update(updateData)
        .eq('id', messageId)
        .eq('user_id', appUserId);
    }
  }

  return {
    action,
    targetFieldId: targetFieldId ?? null,
    disambiguateFields,
    extracted,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
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

    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id, name, location, primary_crop, tier, message_count_month, message_reset_date')
      .eq('auth_id', user.id)
      .single();

    if (appUserError || !appUser) {
      return jsonResponse({ error: 'App user profile not found' }, 404);
    }

    if (mode === 'extract') {
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        return jsonResponse({ error: 'Extraction mode requires a message' }, 400);
      }

      const extracted = await callGeminiExtraction(geminiApiKey, message);
      const result = await applyExtractedFieldContext(supabaseAdmin, appUser.id, body.messageId ?? null, extracted);
      return jsonResponse(result);
    }

    if (mode === 'greeting') {
      const now = new Date();
      const month = now.toLocaleString('el-GR', { month: 'long' });
      const hour = now.getUTCHours() + 2; // rough Greece time
      const timeOfDay = hour < 12 ? 'πρωί' : hour < 18 ? 'απόγευμα' : 'βράδυ';
      const crop = appUser.primary_crop || 'καλλιέργεια';
      const location = appUser.location || '';
      const name = appUser.name ? appUser.name.split(' ')[0] : '';

      const greetingPrompt = `You are Oli, an expert AI agronomist for Mediterranean smallholder farmers.

Generate a single short greeting message (1-2 sentences max) for a farmer.
Farmer profile:
- Name: ${name || 'farmer'}
- Crop(s): ${crop}
- Location: ${location || 'Greece'}
- Current month: ${month}
- Time of day: ${timeOfDay}

Rules:
1. Be warm and specific — mention their actual crop and something genuinely relevant to THIS month
2. Reference a real seasonal concern, task, or observation relevant to their crop in ${month}
3. NEVER invent problems that don't apply to their crop (e.g. spider mites don't affect olive trees)
4. Keep it to 1-2 sentences, conversational, no bullet points
5. Use Greek if the name sounds Greek or location is in Greece, otherwise English
6. Do not start with "Γεια" or "Hello" — be direct and practical
7. End with an implicit or explicit invitation to ask a question

Return ONLY the greeting text, nothing else.`;

      const payload = {
        systemInstruction: { parts: [{ text: 'You are Oli, an AI agronomist.' }] },
        contents: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
      };

      const greetingRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
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

    const latestUserMessage =
      [...requestMessages].reverse().find((message) => message.role !== 'assistant') ?? requestMessages[requestMessages.length - 1];

    const now = new Date();
    const resetDate = appUser.message_reset_date ? new Date(appUser.message_reset_date) : null;
    const sameMonth = sameCalendarMonth(resetDate, now);
    const currentCount = sameMonth ? appUser.message_count_month ?? 0 : 0;

    if (!sameMonth) {
      await supabaseAdmin
        .from('users')
        .update({
          message_count_month: 0,
          message_reset_date: now.toISOString(),
        })
        .eq('id', appUser.id);
    }

    if ((appUser.tier ?? 'free') !== 'pro' && currentCount >= FREE_LIMIT) {
      return jsonResponse(
        {
          error: 'Monthly message limit reached',
          limit: FREE_LIMIT,
        },
        429,
      );
    }

    const attachmentPaths = (Array.isArray(body.attachmentPaths) ? body.attachmentPaths : body.imageUrls ?? [])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .filter((value) => value.startsWith(`${user.id}/`));

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

    let userMessageId: string;

    if (body.userMessageId) {
      const userMessageUpdate: Record<string, unknown> = {
        conversation_id: body.conversationId ?? null,
        field_id: body.fieldId ?? null,
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
        return jsonResponse(
          {
            error: 'Failed to update the existing user message',
            details: updateUserMessageError?.message,
          },
          500,
        );
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
          conversation_id: body.conversationId ?? null,
          user_id: appUser.id,
          field_id: body.fieldId ?? null,
          role: 'user',
          content: latestUserMessage.content,
          metadata: userMetadata,
          image_urls: attachmentPaths,
        })
        .select('id')
        .single();

      if (insertUserMessageError || !insertedUserMessage) {
        return jsonResponse(
          {
            error: 'Failed to save user message',
            details: insertUserMessageError?.message,
          },
          500,
        );
      }

      userMessageId = insertedUserMessage.id;
    }

    const growerContext = [
      appUser.name ? `Grower name: ${appUser.name}` : '',
      appUser.location ? `Location: ${appUser.location}` : '',
      appUser.primary_crop ? `Primary crop(s): ${appUser.primary_crop}` : '',
    ].filter(Boolean).join('\n');

    const aiResponse = await generateValidatedResponse(
      geminiApiKey,
      requestMessages,
      body.fieldContext ?? '',
      Boolean(body.hasActiveField),
      growerContext,
    );
    const assistantText = aiResponse.response_text;
    const assistantMetadata = buildAssistantMetadata(aiResponse);

    if (!assistantText) {
      return jsonResponse({ error: 'Gemini returned an empty response' }, 502);
    }

    const encoder = new TextEncoder();
    const chunks = splitIntoChunks(assistantText);
    const nextMessageCount = currentCount + 1;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          sendEvent('meta', {
            conversationId: body.conversationId ?? null,
            userMessageId,
          });

          for (const chunk of chunks) {
            sendEvent('token', { text: chunk });
            await new Promise((resolve) => setTimeout(resolve, 12));
          }

          const { data: insertedAssistantMessage, error: insertAssistantMessageError } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              conversation_id: body.conversationId ?? null,
              user_id: appUser.id,
              field_id: body.fieldId ?? null,
              role: 'assistant',
              content: assistantText,
              metadata: {
                ...(assistantMetadata ?? {}),
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

          await supabaseAdmin
            .from('users')
            .update({
              message_count_month: nextMessageCount,
              message_reset_date: now.toISOString(),
              last_active_at: now.toISOString(),
            })
            .eq('id', appUser.id);

          // Set conversation title from first user message if not already set
          if (body.conversationId) {
            const { data: convo } = await supabaseAdmin
              .from('conversations')
              .select('title')
              .eq('id', body.conversationId)
              .single();
            if (convo && (!convo.title || convo.title === 'New conversation')) {
              const rawText = latestUserMessage.content
                .replace(/^\[The user attached[^\]]*\]\n?/i, '')
                .trim();
              const title = rawText.slice(0, 60) + (rawText.length > 60 ? '…' : '');
              await supabaseAdmin
                .from('conversations')
                .update({ title })
                .eq('id', body.conversationId);
            }
          }

          sendEvent('done', {
            assistantMessageId: insertedAssistantMessage.id,
            assistantText,
            messageCountMonth: nextMessageCount,
            metadata: assistantMetadata,
            userMessageId,
          });
          controller.close();
        } catch (error) {
          console.error('chat function stream error', error);
          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Unknown streaming error',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      },
    });
  } catch (error) {
    console.error('chat function error', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});
