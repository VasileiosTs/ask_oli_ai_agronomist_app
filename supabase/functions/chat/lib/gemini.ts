import {
  extractGeminiUsage,
  mergeGeminiUsage,
  type GeminiUsage,
} from './monitoring.ts';
import type {
  AiResponseJson,
  ChatMessageInput,
  ExtractionResult,
  InlineAttachment,
} from './types.ts';

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

export function splitIntoChunks(text: string, targetSize = 64): string[] {
  if (!text.trim()) return [];

  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    const nextLineEmpty = !isLastLine && lines[i + 1].trim() === '';

    if (!line.trim()) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push('\n\n');
      continue;
    }

    const words = line.split(' ');
    for (let wi = 0; wi < words.length; wi++) {
      const isLastWord = wi === words.length - 1;
      const suffix = isLastWord
        ? (isLastLine || nextLineEmpty ? '' : '\n')
        : ' ';
      const wordWithSuffix = words[wi] + suffix;

      if (!current) {
        current = wordWithSuffix;
      } else if ((current + wordWithSuffix).length > targetSize) {
        chunks.push(current);
        current = wordWithSuffix;
      } else {
        current += wordWithSuffix;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/** Fallback model used when the primary model returns a 5xx error. */
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-flash';

async function postGeminiJson(
  geminiApiKey: string,
  model: string,
  payload: Record<string, unknown>,
  errorPrefix: string,
) {
  const tryFetch = async (m: string) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify(payload),
      },
    );

  let response = await tryFetch(model);

  // On server-side errors (5xx), retry once with the fallback model.
  if (response.status >= 500 && model !== GEMINI_FALLBACK_MODEL) {
    console.warn(`[gemini] ${model} returned ${response.status} — retrying with ${GEMINI_FALLBACK_MODEL}`);
    response = await tryFetch(GEMINI_FALLBACK_MODEL);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${errorPrefix} (${response.status}):`, errorText);
    throw new Error(`${errorPrefix} (${response.status})`);
  }

  return await response.json();
}

async function callGemini(
  geminiApiKey: string,
  model: string,
  messages: ChatMessageInput[],
  systemPrompt: string,
  extraInstruction?: string,
): Promise<{ aiResponse: AiResponseJson; usage: GeminiUsage | null }> {
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

  const data = await postGeminiJson(geminiApiKey, model, payload, 'Gemini request failed');
  const parsed = parseGeminiPayload<AiResponseJson>(data);

  return {
    aiResponse: {
      ...parsed,
      response_text: cleanAssistantText(parsed.response_text),
    },
    usage: extractGeminiUsage(data),
  };
}

export async function callGeminiExtraction(
  geminiApiKey: string,
  model: string,
  message: string,
): Promise<{ extraction: ExtractionResult; usage: GeminiUsage | null }> {
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

  const data = await postGeminiJson(geminiApiKey, model, payload, 'Gemini extraction failed');
  return {
    extraction: parseGeminiPayload<ExtractionResult>(data),
    usage: extractGeminiUsage(data),
  };
}

export async function generateValidatedResponse(
  geminiApiKey: string,
  model: string,
  messages: ChatMessageInput[],
  fieldContext: string,
  hasActiveField: boolean,
  buildSystemPrompt: (fieldContext: string, growerContext?: string) => string,
  growerContext = '',
): Promise<{ aiResponse: AiResponseJson; usage: GeminiUsage | null; repaired: boolean }> {
  const systemPrompt = buildSystemPrompt(fieldContext, growerContext);
  const initial = await callGemini(geminiApiKey, model, messages, systemPrompt);
  const validation = validateResponse(initial.aiResponse, hasActiveField);

  if (validation.valid) {
    return {
      aiResponse: initial.aiResponse,
      usage: initial.usage,
      repaired: false,
    };
  }

  const repairInstruction =
    `Your previous response failed validation with these errors: ${validation.errors.join(' ')}. ` +
    'Please correct them and return a valid JSON.';

  const repaired = await callGemini(
    geminiApiKey,
    model,
    messages,
    systemPrompt,
    repairInstruction,
  );

  return {
    aiResponse: repaired.aiResponse,
    usage: mergeGeminiUsage(initial.usage, repaired.usage),
    repaired: true,
  };
}

export function buildAssistantMetadata(aiResponse: AiResponseJson): Record<string, unknown> | null {
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
