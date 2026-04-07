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
  confidence_score: number | null;
  missing_pillars: string[] | null;
  product_applied: string | null;
  product_category: string | null;
  dosage: string | null;
  application_method: string | null;
  organic_treatments: string[] | null;
  chemical_treatments: string[] | null;
}

interface ActionDetected {
  action_type: string;
  product: string | null;
  quantity: string | null;
  date_mentioned: string | null;
  confidence: number;
}

interface AiResponseJson {
  response_text: string;
  intent: 'diagnosis' | 'advice' | 'followup' | 'general' | 'unclear';
  crop_mentioned: string | null;
  field_scope: 'specific' | 'general';
  question_count: number;
  has_banned_opener: boolean;
  diagnosis_data: DiagnosisData | null;
  action_detected: ActionDetected | null;
}

interface ExtractionResult {
  crop_type: string | null;
  field_mention: string | null;
  confidence: number | null;
  problem: string | null;
  location_hint: string | null;
  intervention_hint: string | null;
}

interface FieldContextRow {
  id: string;
  user_id: string;
  name: string;
  crop_type: string | null;
  location: string | null;
  size_ha: number | null;
  soil_type: string | null;
  irrigation_type: string | null;
  growing_medium: string | null;
  last_diagnosis: string | null;
  last_intervention_at: string | null;
  crop_count: number | null;
  intervention_count: number | null;
  pending_follow_up_count: number | null;
  conversation_count: number | null;
  recent_diagnoses: string[] | null;
}

interface InterventionContextRow {
  id: string;
  field_id: string | null;
  diagnosis: string | null;
  problem: string | null;
  product_applied: string | null;
  product: string | null;
  dosage: string | null;
  application_method: string | null;
  outcome: string | null;
  outcome_score: number | null;
  follow_up_at: string | null;
  applied_at: string | null;
  date: string | null;
}

interface MemorySnapshotRow {
  id: string;
  field_id: string | null;
  summary: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

interface ConversationRow {
  id: string;
  field_id: string | null;
  title: string;
}

interface ChatRequestBody {
  mode?: 'chat' | 'extract' | 'greeting' | 'guest';
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
  timezone?: string;
  lang?: string;
}

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

const FREE_LIMIT = 20; // messages per month — must match shared/subscription.ts (FREE_MESSAGE_LIMIT)
const UNLIMITED_TIERS = new Set(['pro', 'agronomist', 'enterprise']);
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
  return `You are Oli, an expert AI agronomist with deep knowledge of agronomy, plant science, soil science, irrigation, nutrition, crop economics, and agricultural mathematics. You help farmers with EVERYTHING agriculture-related: disease diagnosis, pest management, nutrition plans, irrigation calculations, fertilizer programs, yield estimation, economic analysis, planting schedules, harvest timing, and any other farming question.

QUESTION TYPE DETECTION — read the farmer's message and classify it:
A) DIAGNOSIS query — farmer describes symptoms, disease, pest, or sends a photo
B) CALCULATION query — farmer asks for a number: water needs, fertilizer dose, spray volume, area, yield, economics
C) PLANNING query — farmer asks what to do, when to do it, how to plan a program
D) GENERAL KNOWLEDGE — farmer asks about a crop, practice, product, or concept
E) FOLLOW-UP — farmer responds to a previous question or update

BEHAVIOUR BY QUESTION TYPE:

For TYPE A (DIAGNOSIS):
1. Always attempt visual analysis, even on imperfect images.
2. Use the FIVE PILLARS to assess confidence (see below) and score 0–100.
3. Apply TIERED DIAGNOSIS RULES based on your confidence score:
   - confidence_score < 40: Do NOT name any specific disease or pest. Say "I can see something is wrong but I need clearer information to give you a reliable diagnosis." List exactly what you need (missing pillars). Do NOT guess a disease name — a wrong diagnosis is worse than no diagnosis.
   - confidence_score 40–65: Name disease(s) as "possible" or "suspected" only. Give 2–3 candidates. Ask ONE question to break the tie. Suggest only safe, broad-spectrum interim actions.
   - confidence_score 65–85: Give your primary diagnosis with appropriate uncertainty language ("this looks like…"). Ask ONE follow-up question if it would change the treatment. Provide treatment options.
   - confidence_score > 85: Full confident diagnosis + complete treatment plan + prevention.
4. QUARANTINE DISEASES RULE: NEVER name HLB (citrus greening), Xylella fastidiosa, Fire Blight, Plum Pox Virus, or other regulated quarantine organisms unless confidence_score > 85. These are notifiable diseases — a false alarm causes panic, inspections, and permanent trust loss. If you suspect them below 85%, say "some symptoms are consistent with serious disease — please contact your local plant protection service for official testing."
5. Never ask two questions in one response for diagnosis.

For TYPE B (CALCULATION):
1. If you have ALL the numbers needed, calculate immediately and show your work step-by-step.
2. If you are MISSING critical inputs (field size, crop type, soil type, climate zone, irrigation method), ask for them BEFORE calculating — do not guess. List exactly what you need and why.
3. Show the formula, the inputs you used, and the final result clearly.
4. Always provide units (m³/ha, kg/ha, L/ha, etc.) and practical ranges.
5. Example calculations you handle: drip irrigation water needs, sprinkler rates, fertilizer NPK programs, spray tank mixing, yield potential, cost-per-ha, ROI on inputs.

For TYPE C (PLANNING):
1. Provide a concrete plan with specific actions, timings, and quantities.
2. If you need to know the crop stage, location, or season to give accurate timing, ask ONE question.
3. Structure plans as numbered steps with timeframes.

For TYPE D (GENERAL KNOWLEDGE):
1. Answer directly and completely. No follow-up needed unless the farmer's question is ambiguous.
2. Be specific — cite exact products, rates, mechanisms, and research where relevant.

For TYPE E (FOLLOW-UP):
1. Acknowledge what the farmer told you, then update your recommendation accordingly.
2. If they report a treatment is working, reinforce it. If not working, pivot to an alternative.

UNIVERSAL RULES (apply to all types):
- Never open with: "Great question!", "Certainly!", "Of course!", "Sure!", or any filler.
- Use the farmer's language (detect from their message). Respond in the same language as their most recent message.
- Be warm but direct. You are a trusted advisor, not a chatbot.
- Be specific: exact product names, dosages, timings, concentrations.
- Always check for phytotoxicity before recommending any product.
- If you don't know something, say so and suggest consulting a local expert or extension service.
- Never give advice that could cause crop damage or regulatory violations.
- For diseases/pests/deficiencies, always populate both organic_treatments AND chemical_treatments.
- Crop-specific accuracy is critical: never suggest a pest or disease that doesn't affect the stated crop.

AGRICULTURAL CALCULATIONS — GUIDE:
You are fully capable of solving these (and more). Always show your reasoning:

IRRIGATION / WATER NEEDS:
- Formula: Water need (mm/day) = ETc = ET₀ × Kc
- ET₀ from weather data or use regional averages by month/crop
- Kc (crop coefficient) varies by growth stage
- Convert mm to m³/ha: 1 mm = 10 m³/ha
- Drip irrigation: add efficiency factor (typically 85-95%)
- Example: "5 ha olive grove, April, drip irrigation" → calculate ET₀ for region, apply Kc for olives in flowering stage, calculate daily and weekly water volume in m³

FERTILIZER CALCULATIONS:
- NPK programs based on yield target, soil analysis, crop uptake
- Convert kg nutrient/ha to kg product/ha using nutrient content %
- Tank mixing: check compatibility, calculate L or kg per 100L or per ha
- Example: "I need 120 kg N/ha using urea (46% N)" → 120/0.46 = 261 kg urea/ha

SPRAY VOLUME:
- Volume (L/ha) = nozzle output (L/min) × nozzles per boom × speed correction
- Typical field crops: 200-400 L/ha; orchards: 500-1000 L/ha TRV-adjusted

AREA & YIELD:
- Area conversions: 1 stremma = 0.1 ha; 1 acre = 0.405 ha
- Yield potential from density × average fruit weight × % marketable

ECONOMICS:
- Gross margin = (yield × price) - variable costs
- Break-even yield = total costs / price per unit

DIAGNOSTIC WORKFLOW — THE FIVE PILLARS:
For every diagnosis query, assess confidence across:
1. THE VICTIM — Plant species/variety known? (Spot on tomato ≠ spot on olive)
2. THE SYMPTOMS — Color, texture, pattern, spread direction?
3. THE TIMELINE — When did it start? Growth stage? Season?
4. THE ENVIRONMENT — Soil type, recent weather, irrigation method, recent inputs?
5. THE EVIDENCE — For photos: close enough to see detail?

Confidence scoring (set confidence_score in your JSON response):
- > 85: Full confident diagnosis + complete treatment plan + prevention
- 65–85: Primary diagnosis with uncertainty language + one follow-up question + treatment options
- 40–65: 2–3 candidate diagnoses ("possible/suspected") + one tie-breaking question + safe interim action only
- < 40: NO disease name — describe what you observe + list exactly what information you need

IMAGE ANALYSIS RULES:
- ALWAYS attempt visual analysis, even on blurry or partial images.
- If the affected area is < 30% of frame, ask for a close-up with specific instructions ("please send a photo of just the leaf showing the spots, filling the frame").
- Each new image is independent — do not assume it is the same plant as a previous message.
- Poor image quality lowers your confidence_score; reflect this honestly.

CONTEXT INDEPENDENCE:
- If the farmer uploads a photo that contradicts field context, trust the PHOTO.
- Field context is background info, not a constraint.

MEMORY & TREATMENT HISTORY:
- Use treatment history to give smarter, non-repetitive advice.
- If a treatment didn't work (outcome: same/worse), recommend a DIFFERENT approach.
- Reference past interventions naturally: "Since the copper didn't fully resolve it last time..."
- Flag repeated issues as potential systemic problems.
- FIELD MEMORY LOG: chronological record of past AI exchanges — use it for continuity.
- SAME CROP — OTHER FIELDS: spot cross-field patterns (regional pressure, shared problem).

FIELD & HISTORY CONTEXT:
${fieldContext || 'No field data or treatment history on record yet.'}
${growerContext ? `GROWER CONTEXT:\n${growerContext}` : ''}

AUTO-LOG DETECTION:
When the farmer mentions a past action (e.g., "I sprayed copper yesterday", "applied urea last week"), populate action_detected:
- action_type: spray | fertilization | irrigation | observation | harvest
- product: product name if mentioned, null otherwise
- quantity: dosage/amount if mentioned, null otherwise
- date_mentioned: relative or absolute date, null if not mentioned
- confidence: 0.0–1.0 (only PAST actions the farmer actually performed; set < 0.5 for uncertain)

RESPONSE FORMAT:
Return valid JSON. response_text is what the user sees.
For calculations: show formula → inputs → step-by-step → result with units.
For diagnosis: thorough explanation of problem + cause + treatment — do NOT truncate.
For simple questions: be concise.`;
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
          confidence_score: { type: 'INTEGER', nullable: true },
          missing_pillars: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
          product_applied: { type: 'STRING', nullable: true },
          product_category: { type: 'STRING', nullable: true },
          dosage: { type: 'STRING', nullable: true },
          application_method: { type: 'STRING', nullable: true },
          organic_treatments: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
          chemical_treatments: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        },
      },
      action_detected: {
        type: 'OBJECT',
        nullable: true,
        properties: {
          action_type: { type: 'STRING', enum: ['spray', 'fertilization', 'irrigation', 'observation', 'harvest'] },
          product: { type: 'STRING', nullable: true },
          quantity: { type: 'STRING', nullable: true },
          date_mentioned: { type: 'STRING', nullable: true },
          confidence: { type: 'NUMBER' },
        },
        required: ['action_type', 'confidence'],
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

  // Attach trailing whitespace to each word so chunk boundaries are lossless.
  // Concatenating all chunks exactly reconstructs the original text.
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    const nextLineEmpty = !isLastLine && lines[i + 1].trim() === '';

    if (!line.trim()) {
      // Empty line = paragraph break
      if (current) { chunks.push(current); current = ''; }
      chunks.push('\n\n');
      continue;
    }

    const words = line.split(' ');
    for (let wi = 0; wi < words.length; wi++) {
      const isLastWord = wi === words.length - 1;
      // Add '\n' after last word only when next line is non-empty (e.g. list items)
      // Paragraph breaks are handled by the '\n\n' chunk above
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
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini request failed (${response.status}):`, errorText);
    throw new Error(`Gemini request failed (${response.status})`);
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
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini extraction failed (${response.status}):`, errorText);
    throw new Error(`Gemini extraction failed (${response.status})`);
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

  if (aiResponse.action_detected) {
    metadata.action_detected = aiResponse.action_detected;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function formatFieldContextBlock(field: FieldContextRow): string {
  const parts = [
    `Field: ${field.name}`,
    `Crop: ${field.crop_type || 'N/A'}`,
    field.size_ha != null ? `Size: ${field.size_ha}ha` : null,
    field.soil_type ? `Soil: ${field.soil_type}` : null,
    field.irrigation_type ? `Irrigation: ${field.irrigation_type}` : null,
    field.growing_medium ? `Medium: ${field.growing_medium}` : null,
    `Last issue: ${field.last_diagnosis || 'None'}`,
    field.intervention_count ? `Interventions: ${field.intervention_count}` : null,
    field.pending_follow_up_count ? `Pending follow-ups: ${field.pending_follow_up_count}` : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

function formatInterventionContext(item: InterventionContextRow, fieldName?: string): string {
  const date = item.applied_at?.split('T')[0] || item.date || '?';
  const problem = item.diagnosis || item.problem || 'Unknown issue';
  const treatment = item.product_applied || item.product || 'No product recorded';
  const dosage = item.dosage ? ` ${item.dosage}` : '';
  const method = item.application_method ? ` (${item.application_method})` : '';
  const fieldPrefix = fieldName ? `${fieldName} | ` : '';

  let status: string;
  if (item.outcome) {
    status = `Outcome: ${item.outcome}`;
    if (item.outcome_score) {
      status += ` (${item.outcome_score}/5)`;
    }
  } else if (item.follow_up_at) {
    status = `Pending follow-up (${item.follow_up_at.split('T')[0]})`;
  } else {
    status = 'No follow-up set';
  }

  return `- ${fieldPrefix}${date}: ${problem} -> ${treatment}${dosage}${method} -> ${status}`;
}

async function fetchFieldContextRows(supabaseAdmin: any, appUserId: string): Promise<FieldContextRow[]> {
  const { data, error } = await supabaseAdmin
    .from('field_context_view')
    .select('*')
    .eq('user_id', appUserId)
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data as FieldContextRow[];
}

async function fetchContextInterventions(
  supabaseAdmin: any,
  appUserId: string,
  fieldId?: string | null,
  limit = 5,
): Promise<InterventionContextRow[]> {
  const columns =
    'id, field_id, diagnosis, problem, product_applied, product, dosage, ' +
    'application_method, outcome, outcome_score, follow_up_at, applied_at, date';

  let query = supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fieldId) {
    query = query.eq('field_id', fieldId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return [];
  }

  const interventions = data as InterventionContextRow[];
  if (!fieldId || interventions.length >= limit) {
    return interventions;
  }

  const { data: backfill } = await supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .neq('field_id', fieldId)
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit - interventions.length);

  if (Array.isArray(backfill)) {
    const seen = new Set(interventions.map((item) => item.id));
    for (const item of backfill as InterventionContextRow[]) {
      if (!seen.has(item.id)) {
        interventions.push(item);
      }
    }
  }

  return interventions;
}

async function fetchPendingFollowUps(
  supabaseAdmin: any,
  appUserId: string,
  fieldId?: string | null,
  limit = 5,
): Promise<InterventionContextRow[]> {
  const columns =
    'id, field_id, diagnosis, problem, product_applied, product, dosage, ' +
    'application_method, outcome, outcome_score, follow_up_at, applied_at, date';

  let query = supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .is('outcome', null)
    .not('follow_up_at', 'is', null)
    .order('follow_up_at', { ascending: true })
    .limit(limit);

  if (fieldId) {
    query = query.eq('field_id', fieldId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return [];
  }

  const followUps = data as InterventionContextRow[];
  if (!fieldId || followUps.length >= limit) {
    return followUps;
  }

  const { data: backfill } = await supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .is('outcome', null)
    .not('follow_up_at', 'is', null)
    .neq('field_id', fieldId)
    .order('follow_up_at', { ascending: true })
    .limit(limit - followUps.length);

  if (Array.isArray(backfill)) {
    const seen = new Set(followUps.map((item) => item.id));
    for (const item of backfill as InterventionContextRow[]) {
      if (!seen.has(item.id)) {
        followUps.push(item);
      }
    }
  }

  return followUps;
}

async function fetchRecentMemorySnapshots(
  supabaseAdmin: any,
  appUserId: string,
  fieldId?: string | null,
  limit = 5,
): Promise<MemorySnapshotRow[]> {
  let query = supabaseAdmin
    .from('memory_snapshots')
    .select('id, field_id, summary, snapshot, created_at')
    .eq('user_id', appUserId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fieldId) {
    query = query.eq('field_id', fieldId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data as MemorySnapshotRow[];
}

/**
 * Fetch recent interventions from sibling fields that share the same crop_type.
 * Used to build cross-field context for Gap 2 (same-crop awareness).
 */
async function fetchSameCropInterventions(
  supabaseAdmin: any,
  appUserId: string,
  excludeFieldId: string,
  cropType: string,
  limit = 3,
): Promise<{ fieldName: string; item: InterventionContextRow }[]> {
  // Find sibling field IDs with same crop_type
  const { data: siblingFields, error: siblingError } = await supabaseAdmin
    .from('fields')
    .select('id, name')
    .eq('user_id', appUserId)
    .ilike('crop_type', cropType)
    .neq('id', excludeFieldId)
    .limit(5);

  if (siblingError || !Array.isArray(siblingFields) || siblingFields.length === 0) {
    return [];
  }

  const siblingIds = siblingFields.map((f: { id: string; name: string }) => f.id);
  const siblingMap = new Map<string, string>(
    siblingFields.map((f: { id: string; name: string }) => [f.id, f.name]),
  );

  const columns =
    'id, field_id, diagnosis, problem, product_applied, product, dosage, ' +
    'application_method, outcome, outcome_score, follow_up_at, applied_at, date';

  const { data, error } = await supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .in('field_id', siblingIds)
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as InterventionContextRow[]).map((item) => ({
    fieldName: siblingMap.get(item.field_id ?? '') ?? 'Other field',
    item,
  }));
}

function estimateGrowthStage(cropType: string | null, plantedAt: string | null): string | null {
  if (!cropType || !plantedAt) return null;
  const daysSincePlanting = Math.floor((Date.now() - new Date(plantedAt).getTime()) / 86400000);
  if (daysSincePlanting < 0) return null;
  // Simplified stage estimation for AI context
  if (daysSincePlanting <= 14) return `Germination (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 60) return `Vegetative growth (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 90) return `Flowering (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 130) return `Fruiting (day ${daysSincePlanting})`;
  return `Maturity (day ${daysSincePlanting})`;
}

async function assembleServerFieldContext(
  supabaseAdmin: any,
  appUserId: string,
  fields: FieldContextRow[],
  activeFieldId?: string | null,
  fallbackFieldContext = '',
) {
  const [interventions, pendingFollowUps, recentSnapshots, cropsResult] = await Promise.all([
    fetchContextInterventions(supabaseAdmin, appUserId, activeFieldId),
    fetchPendingFollowUps(supabaseAdmin, appUserId, activeFieldId),
    fetchRecentMemorySnapshots(supabaseAdmin, appUserId, activeFieldId, 5),
    activeFieldId
      ? supabaseAdmin.from('crops').select('planted_at, name').eq('field_id', activeFieldId).limit(1)
      : Promise.resolve({ data: null }),
  ]);
  const plantedAt = cropsResult?.data?.[0]?.planted_at ?? null;

  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const sections: string[] = [];
  const activeField =
    (activeFieldId ? fields.find((field) => field.id === activeFieldId) : null) ??
    (fields.length === 1 ? fields[0] : null);

  if (activeField) {
    let fieldBlock = formatFieldContextBlock(activeField);
    const stage = estimateGrowthStage(activeField.crop_type, plantedAt);
    if (stage) fieldBlock += ` | Growth stage: ${stage}`;
    sections.push(`ACTIVE FIELD:\n${fieldBlock}`);

    if (Array.isArray(activeField.recent_diagnoses) && activeField.recent_diagnoses.length > 0) {
      sections.push(`RECENT DIAGNOSES:\n- ${activeField.recent_diagnoses.join('\n- ')}`);
    }
  } else if (fields.length > 1) {
    sections.push(
      `USER HAS ${fields.length} FIELDS:\n${fields.map((field) => formatFieldContextBlock(field)).join('\n')}\n(No specific field selected for this conversation.)`,
    );
  } else if (fields.length === 1) {
    sections.push(`USER FIELD:\n${formatFieldContextBlock(fields[0])}`);
  }

  if (interventions.length > 0) {
    const lines = interventions.map((item) =>
      formatInterventionContext(
        item,
        !activeFieldId && item.field_id ? fieldMap.get(item.field_id)?.name : undefined,
      ),
    );
    sections.push(`TREATMENT HISTORY (last ${interventions.length}):\n${lines.join('\n')}`);
  }

  if (pendingFollowUps.length > 0) {
    const lines = pendingFollowUps.map((item) => {
      const problem = item.diagnosis || item.problem || 'treatment';
      const product = item.product_applied || item.product || '';
      const date = item.applied_at?.split('T')[0] || item.date || '?';
      const dueDate = item.follow_up_at?.split('T')[0] || '?';
      const fieldLabel =
        !activeFieldId && item.field_id ? `${fieldMap.get(item.field_id)?.name || 'Field'} | ` : '';

      return `- ${fieldLabel}${problem}${product ? ` (${product})` : ''} from ${date} -> check due ${dueDate}`;
    });

    sections.push(`PENDING FOLLOW-UPS (${pendingFollowUps.length}):\n${lines.join('\n')}`);
  }

  // Gap 1: Rolling field memory log — last 5 AI exchanges for this field
  const snapshotsWithSummary = recentSnapshots.filter((s) => s.summary);
  if (snapshotsWithSummary.length > 0) {
    const logLines = snapshotsWithSummary.map((s) => {
      const date = s.created_at.split('T')[0];
      return `- ${date}: ${s.summary}`;
    });
    sections.push(`FIELD MEMORY LOG (last ${snapshotsWithSummary.length} exchanges):\n${logLines.join('\n')}`);
  }

  // Gap 2: Same-crop cross-field context — show what happened on sibling fields
  if (activeField?.crop_type && activeField.id && fields.length > 1) {
    const sameCropRows = await fetchSameCropInterventions(
      supabaseAdmin,
      appUserId,
      activeField.id,
      activeField.crop_type,
      3,
    );
    if (sameCropRows.length > 0) {
      const lines = sameCropRows.map(({ fieldName, item }) =>
        formatInterventionContext(item, fieldName),
      );
      sections.push(
        `SAME CROP (${activeField.crop_type}) — OTHER FIELDS:\n${lines.join('\n')}\n` +
        `(Use this to spot patterns across all your ${activeField.crop_type} fields.)`,
      );
    }
  }

  const fieldContext = sections.length > 0
    ? sections.join('\n\n')
    : fallbackFieldContext || 'No field data or treatment history on record yet.';

  return {
    fieldContext,
    activeFieldId: activeField?.id ?? activeFieldId ?? null,
    activeFieldName: activeField?.name ?? null,
    hasActiveField: Boolean(activeField?.id ?? activeFieldId),
    recentInterventions: interventions,
    pendingFollowUps,
  };
}

async function fetchOwnedConversation(
  supabaseAdmin: any,
  appUserId: string,
  conversationId?: string | null,
): Promise<ConversationRow | null> {
  if (!conversationId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, field_id, title')
    .eq('id', conversationId)
    .eq('user_id', appUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ConversationRow;
}

function buildInitialConversationTitle(rawText: string): string {
  const cleaned = rawText
    .replace(/^\[The user attached[^\]]*\]\n?/i, '')
    .trim();

  if (!cleaned) {
    return 'New conversation';
  }

  return cleaned.slice(0, 80);
}

async function createConversation(
  supabaseAdmin: any,
  appUserId: string,
  fieldId: string | null,
  latestMessageText: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      user_id: appUserId,
      field_id: fieldId,
      title: buildInitialConversationTitle(latestMessageText),
    })
    .select('id, field_id, title')
    .single();

  if (error || !data?.id) {
    console.error('Failed to create conversation:', error?.message ?? 'Conversation insert returned no id');
    return null;
  }

  return data.id as string;
}

async function updateConversationFieldLink(
  supabaseAdmin: any,
  appUserId: string,
  conversationId: string | null | undefined,
  fieldId: string | null,
) {
  if (!conversationId || !fieldId) {
    return;
  }

  await supabaseAdmin
    .from('conversations')
    .update({ field_id: fieldId })
    .eq('id', conversationId)
    .eq('user_id', appUserId);
}

async function mergeMessageMetadata(
  supabaseAdmin: any,
  appUserId: string,
  messageId: string,
  patch: Record<string, unknown>,
  fieldId?: string | null,
  conversationId?: string | null,
) {
  const { data: existing } = await supabaseAdmin
    .from('chat_messages')
    .select('metadata')
    .eq('id', messageId)
    .eq('user_id', appUserId)
    .maybeSingle();

  const updateData: Record<string, unknown> = {};

  if (Object.keys(patch).length > 0) {
    updateData.metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      ...patch,
    };
  }

  if (typeof fieldId !== 'undefined') {
    updateData.field_id = fieldId;
  }

  if (typeof conversationId !== 'undefined') {
    updateData.conversation_id = conversationId;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await supabaseAdmin
    .from('chat_messages')
    .update(updateData)
    .eq('id', messageId)
    .eq('user_id', appUserId);
}

async function cleanupFailedChatAttempt(
  supabaseAdmin: any,
  appUserId: string,
  userMessageId: string | null,
  conversationId: string | null,
  conversationCreatedByFunction: boolean,
) {
  if (userMessageId) {
    await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('id', userMessageId)
      .eq('user_id', appUserId);
  }

  if (!conversationCreatedByFunction || !conversationId) {
    return;
  }

  const { count } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', appUserId);

  if ((count ?? 0) > 0) {
    return;
  }

  await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', appUserId);
}

function buildSnapshotSummary(aiResponse: AiResponseJson): string | null {
  const diagnosis = aiResponse.diagnosis_data?.problem || aiResponse.crop_mentioned || null;
  const severity = aiResponse.diagnosis_data?.severity || null;
  const product =
    aiResponse.diagnosis_data?.product_applied ||
    aiResponse.diagnosis_data?.chemical_treatments?.[0] ||
    aiResponse.diagnosis_data?.organic_treatments?.[0] ||
    null;

  if (!diagnosis && !product) {
    return null;
  }

  return [
    diagnosis || 'Agronomy follow-up',
    severity ? `severity ${severity}` : null,
    product ? `suggested ${product}` : null,
  ].filter(Boolean).join(' | ');
}

async function persistFieldMemorySnapshot(
  supabaseAdmin: any,
  appUserId: string,
  fieldId: string | null,
  userMessageId: string,
  assistantMessageId: string,
  aiResponse: AiResponseJson,
  assistantText: string,
  recentInterventions: InterventionContextRow[],
  pendingFollowUps: InterventionContextRow[],
) {
  if (!fieldId) {
    return null;
  }

  const summary = buildSnapshotSummary(aiResponse);
  const snapshot = {
    intent: aiResponse.intent,
    crop_mentioned: aiResponse.crop_mentioned,
    field_scope: aiResponse.field_scope,
    diagnosis_data: aiResponse.diagnosis_data,
    assistant_text_excerpt: assistantText.slice(0, 600),
    recent_interventions: recentInterventions.slice(0, 3).map((item) => ({
      id: item.id,
      diagnosis: item.diagnosis || item.problem,
      product: item.product_applied || item.product,
      outcome: item.outcome,
      applied_at: item.applied_at || item.date,
    })),
    pending_follow_ups: pendingFollowUps.slice(0, 3).map((item) => ({
      id: item.id,
      diagnosis: item.diagnosis || item.problem,
      due_at: item.follow_up_at,
    })),
  };

  const { data, error } = await supabaseAdmin
    .from('memory_snapshots')
    .insert({
      user_id: appUserId,
      field_id: fieldId,
      summary,
      snapshot,
      source_message_ids: [userMessageId, assistantMessageId],
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to persist memory snapshot', error);
    return null;
  }

  return data.id as string;
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

async function resolveSingleFieldByHint(
  supabaseAdmin: any,
  appUserId: string,
  hint: string,
  minConfidence = 0.35,
) {
  const candidates = await resolveFieldCandidates(supabaseAdmin, appUserId, hint);
  if (candidates.length === 0) {
    return null;
  }

  const [bestCandidate, secondCandidate] = candidates;
  const bestConfidence = typeof bestCandidate.confidence === 'number' ? bestCandidate.confidence : null;
  const secondConfidence = typeof secondCandidate?.confidence === 'number' ? secondCandidate.confidence : null;

  if (bestConfidence != null && bestConfidence >= minConfidence) {
    if (secondConfidence == null || bestConfidence - secondConfidence >= 0.08) {
      return bestCandidate;
    }
  }

  if (candidates.length === 1) {
    return bestCandidate;
  }

  return null;
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
    }
    // No auto-field creation — users must create fields manually.
    // Auto-created "tomato Field" etc. polluted user accounts.
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

// ── Guest mode rate limiting (in-memory, per-isolate) ──
const _guestRateMap = new Map<string, { count: number; resetAt: number }>();
const GUEST_RATE_LIMIT = 1;
const GUEST_RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours per IP
const GUEST_MAX_IPS = 10_000;

function checkGuestRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _guestRateMap.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= GUEST_RATE_LIMIT) return false;
    entry.count++;
    return true;
  }
  // Evict oldest if at capacity
  if (_guestRateMap.size >= GUEST_MAX_IPS) {
    const firstKey = _guestRateMap.keys().next().value;
    if (firstKey) _guestRateMap.delete(firstKey);
  }
  _guestRateMap.set(ip, { count: 1, resetAt: now + GUEST_RATE_WINDOW_MS });
  return true;
}

async function handleGuestChat(
  geminiApiKey: string,
  body: ChatRequestBody,
): Promise<Response> {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const latestMessage = messages[messages.length - 1];
  if (!latestMessage || latestMessage.role !== 'user' || !latestMessage.content?.trim()) {
    return jsonResponse({ error: 'Guest mode requires a user message' }, 400);
  }

  const sanitized = sanitizeUserInput(latestMessage.content.trim());
  if (sanitized.length > 2000) {
    return jsonResponse({ error: 'Message too long' }, 400);
  }

  // Validate any inline attachments (max 1 for guest, images only)
  const rawAttachments = Array.isArray(latestMessage.attachments) ? latestMessage.attachments : [];
  const validAttachments: InlineAttachment[] = rawAttachments
    .filter((a) => ALLOWED_INLINE_ATTACHMENT_MIME_TYPES.has(a.mimeType) && typeof a.data === 'string' && a.data.length > 0)
    .slice(0, 1); // guest: max 1 image

  const systemPrompt = buildSystemPrompt('No field data or treatment history on record yet.');
  const guestMessages: ChatMessageInput[] = [{
    role: 'user',
    content: sanitized,
    attachments: validAttachments.length > 0 ? validAttachments : undefined,
  }];

  const aiResponse = await callGemini(geminiApiKey, guestMessages, systemPrompt);
  const assistantText = cleanAssistantText(aiResponse.response_text);
  const metadata = buildAssistantMetadata(aiResponse);

  return jsonResponse({
    assistantText,
    metadata,
  });
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

    // ── Guest mode: parse body early to check mode before auth ──
    const rawBody = await req.text();
    let body: ChatRequestBody;
    try {
      body = JSON.parse(rawBody) as ChatRequestBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (body.mode === 'guest') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('cf-connecting-ip')
        || 'unknown';
      if (!checkGuestRateLimit(clientIp)) {
        return jsonResponse({ error: 'Guest rate limit exceeded. Sign up for free to continue.' }, 429);
      }
      return await handleGuestChat(geminiApiKey, body);
    }

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

    // body already parsed above (before auth check, to support guest mode)
    const mode = body.mode === 'extract' ? 'extract' : body.mode === 'greeting' ? 'greeting' : 'chat';

    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id, name, location, language, primary_crop, tier, message_count_month, message_reset_date')
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
    const resetDate = appUser.message_reset_date ? new Date(appUser.message_reset_date) : null;
    const sameMonth = sameCalendarMonth(resetDate, now);
    const currentCount = sameMonth ? appUser.message_count_month ?? 0 : 0;

    // Burst rate limiting should happen before we consume monthly quota or upload
    // any more state for this request.
    const { data: lastMsg } = await supabaseAdmin
      .from('chat_messages')
      .select('created_at')
      .eq('user_id', appUser.id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsg) {
      const elapsed = Date.now() - new Date(lastMsg.created_at).getTime();
      if (elapsed < 2000) {
        return jsonResponse(
          {
            error: 'Please wait a moment before sending another message',
            code: 'burst_rate_limit',
          },
          429,
        );
      }
    }

    // For pro users skip the limit. For free users the limit check AND increment
    // happen atomically inside the SQL function (FOR UPDATE lock) so two
    // concurrent requests can never both slip past the quota.
    let nextMessageCount: number;
    if (!UNLIMITED_TIERS.has(appUser.tier ?? 'free')) {
      const { data: countResult } = await supabaseAdmin.rpc('increment_message_count', {
        p_user_id: appUser.id,
        p_now: now.toISOString(),
        p_limit: FREE_LIMIT,
      });
      // -1 means the function detected limit exceeded (inside the lock)
      if (countResult === -1) {
        return jsonResponse(
          {
            error: 'Monthly message limit reached',
            code: 'monthly_limit',
            limit: FREE_LIMIT,
          },
          429,
        );
      }
      nextMessageCount = typeof countResult === 'number' ? countResult : currentCount + 1;
    } else {
      // Pro users: just increment, no limit
      const { data: countResult } = await supabaseAdmin.rpc('increment_message_count', {
        p_user_id: appUser.id,
        p_now: now.toISOString(),
        p_limit: 999999,
      });
      nextMessageCount = typeof countResult === 'number' ? countResult : currentCount + 1;
    }

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

    const growerContext = [
      appUser.name ? `Grower name: ${appUser.name}` : '',
      appUser.location ? `Location: ${appUser.location}` : '',
      appUser.primary_crop ? `Primary crop(s): ${appUser.primary_crop}` : '',
    ].filter(Boolean).join('\n');

    try {
      if (!effectiveFieldId) {
        try {
          extractionResult = await callGeminiExtraction(geminiApiKey, latestUserMessage.content);

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
        } catch (error) {
          console.error('Server-side field extraction failed', error);
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

      aiResponse = await generateValidatedResponse(
        geminiApiKey,
        requestMessages,
        serverContext.fieldContext,
        serverContext.hasActiveField,
        growerContext,
      );
      assistantText = aiResponse.response_text;
      assistantMetadata = buildAssistantMetadata(aiResponse);

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

          const confidenceScore = aiResponse.diagnosis_data?.confidence_score ?? null;
          const { data: insertedAssistantMessage, error: insertAssistantMessageError } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              conversation_id: effectiveConversationId,
              user_id: appUser.id,
              field_id: finalFieldId,
              role: 'assistant',
              content: assistantText,
              ai_model_version: GEMINI_MODEL,
              metadata: {
                ...finalAssistantMetadata,
                model: GEMINI_MODEL,
                confidence_score: confidenceScore,
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
