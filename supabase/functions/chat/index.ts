// deno-lint-ignore-file no-explicit-any
// Edge function: chat, last deployed via CI on 2026-05-04
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
  growerId?: string | null;
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

const FREE_LIMIT = 20; // messages per month, must match shared/subscription.ts (FREE_MESSAGE_LIMIT)
const UNLIMITED_TIERS = new Set(['pro', 'agronomist', 'enterprise']);
const MAX_HISTORY_MESSAGES = 10;
const MAX_INLINE_ATTACHMENTS = 3;
const MAX_MESSAGE_CHARS = 8000;
const MAX_TOTAL_INLINE_ATTACHMENT_CHARS = 12_000_000;
const GREETING_CACHE_TTL_MS = 10 * 60 * 1000;
const ALLOWED_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-lite',
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

// ── Weather fetch (Open-Meteo, free, no API key required) ──────────────────
// Same API used by WeatherWidget.tsx on the frontend.
// Called only when user has lat/lon stored; times out silently after 3s.
interface WeatherSnapshot {
  temperature_c: number;
  humidity_pct: number;
  precipitation_mm: number;
  wind_kmh: number;
}

async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto`;
    const res = await Promise.race([
      fetch(url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    if (!res.ok) return null;
    const json = await (res as Response).json();
    const c = json?.current;
    if (!c) return null;
    return {
      temperature_c: c.temperature_2m,
      humidity_pct: c.relative_humidity_2m,
      precipitation_mm: c.precipitation,
      wind_kmh: c.wind_speed_10m,
    };
  } catch {
    return null;
  }
}

function formatWeatherContext(w: WeatherSnapshot): string {
  const precip = w.precipitation_mm > 0 ? `, ${w.precipitation_mm}mm rain` : '';
  return `Current weather: ${w.temperature_c}°C, ${w.humidity_pct}% humidity${precip}, ${w.wind_kmh}km/h wind`;
}

// ── Intent Classifier ────────────────────────────────────────────────────────
// Cheap regex classification of the user's message, no extra API call.
// Used to trim irrelevant prompt sections and inject a pre-classified hint,
// so Gemini spends zero tokens deciding what type of question it is.
type QueryIntent = 'diagnosis' | 'calculation' | 'planning' | 'followup' | 'indoor' | 'general';

function classifyIntent(message: string, hasActualImages: boolean): QueryIntent {
  if (hasActualImages) return 'diagnosis'; // image attachment = always diagnostic intent
  const m = message.toLowerCase();
  // Calculation: numerical, dosage, rate, or unit questions
  if (/\b(how much|calculate|dose|dosage|rate|l\/ha|kg\/ha|ml\/|ratio|concentration|how many litre|πόσο|δόση|υπολόγισε|αραίωσ|ποσότητα|λίτρα|κιλά ανά)\b/.test(m)) return 'calculation';
  // Follow-up: reporting back on a past treatment or asking about progress
  if (/\b(still|still not|improved|worse|better|same|it worked|didn.t work|no change|no improvement|any better|ακόμα|βελτιώθηκε|χειρότερα|καλύτερα|δεν άλλαξε|δούλεψε|δεν βελτιώθηκε|συνεχίζει|τα ίδια|επανήλθε|αποτέλεσμα|πώς πήγε|δεν έγινε καλύτερα)\b/.test(m)) return 'followup';
  // Diagnosis: symptoms, visual problems, disease/pest mentions, and diagnostic questions
  if (/\b(yellow|spot|dying|disease|pest|fungus|mold|rot|leaves|symptom|brown|black|white powder|curl|wilt|infected|droop|dropping|falling|eaten|hole|pale|fading|lesion|blister|canker|necrosis|tip.?burn|discolor|discolour|stunted|dead|decay|oozing|sticky|aphid|mite|thrip|caterpillar|scarring|cracking|what.?s wrong|something wrong|doesn.?t look|look sick|attacked|infested|what is this|κίτρινα|κηλίδα|ασθένεια|έντομο|σκουρ|πέφτουν|μαραίν|μύκητ|ξηρ|κηλίδες|ζωύφιο|προνύμφη|χτυπήθηκε|προσβολή|αρρωστ|τι έχει|τι μπορεί να έχει|δεν φαίνεται καλά|κάτι δεν πάει)\b/.test(m)) return 'diagnosis';
  // Indoor/container care: watering, repotting, light, position, drainage, care queries, not symptom queries
  // Specific care keywords (unambiguous): always indoor
  if (/\b(repot|repotting|overwater|overwatered|underwater|underwatered|root.?bound|drainage hole|pot.*size|outgrow.*pot|γλάστρα|ξαναφύτεμα|ξαναφυτεύ)\b/.test(m)) return 'indoor';
  // Houseplant species names, strongly imply indoor/container context even
  // without explicit "indoor"/"pot" keywords. Common questions like
  // "how do I water my monstera" otherwise fall through to TYPE D (general)
  // and miss the mandatory specifics request on first turn.
  const isHouseplantSpecies = /\b(monstera|orchid|ficus|pothos|philodendron|peace lily|snake plant|spider plant|aloe vera|cactus|succulent|bonsai|fiddle leaf|rubber tree|μονστέρα|ορχιδέα|φίκο|φίκος|παχύφυτο|κάκτος|κακτος|μπονσάι|μπονσαι|αλόη)\b/.test(m);
  if (isHouseplantSpecies) return 'indoor';
  // Generic indoor + no disease/symptom context → indoor care
  const hasIndoorContext = /\b(indoor|inside|potted|balcony|windowsill|houseplant|container plant|εσωτερικ|μπαλκόν|εσωτερικού χώρου)\b/.test(m);
  const hasSymptomContext = /\b(yellow|spot|dying|disease|pest|rot|symptom|brown|curl|wilt|infected|dead|decay|sticky|aphid|mite|κίτρινα|ασθένεια|μύκητ)\b/.test(m);
  if (hasIndoorContext && !hasSymptomContext) return 'indoor';
  // Planning: what/when to do, schedules, programs
  if (/\b(when should|what should i|plan|schedule|program|calendar|next step|πότε|πρόγραμμα|πλάνο|τι να κάνω|ψεκαστ|λίπανσ|σχέδιο)\b/.test(m)) return 'planning';
  return 'general';
}

function buildSystemPrompt(
  fieldContext: string,
  growerContext = '',
  lang = 'en',
  intent: QueryIntent = 'general',
  conversationDepth = 0,
  areaUnit = 'stremma',
  userLocation = '',
): string {
  // ══════════════════════════════════════════════════════════════════════
  // ALWAYS-LOADED MODULES (~1,800 tokens)
  // Language, dosage, weather, seasonal, growth stage, universal rules
  // ══════════════════════════════════════════════════════════════════════

  const LANG_NAMES: Record<string, string> = { el: 'Greek', en: 'English', it: 'Italian', es: 'Spanish', fr: 'French', ar: 'Arabic' };
  const langName = LANG_NAMES[lang] ?? 'English';
  const langInstruction = `LANGUAGE RULES:
- Default response language: ${langName}.
- Detect the language of the user's most recent message and respond in THAT language, even if it differs from the default.
- Use local agricultural terminology for the detected language.`;

  const unitName = areaUnit === 'ha' ? 'hectares (ha)' : areaUnit === 'ac' ? 'acres (ac)' : 'στρέμματα (στρ.)';
  const dosageInstruction = `DOSAGE COMMUNICATION: After every technical dosage (e.g., "300g/100L"), add a practical conversion for common equipment:
- 15L backpack sprayer: show grams or ml needed
- 100L tractor tank: already covered by the /100L rate
- THIS USER'S PREFERRED AREA UNIT: ${unitName}. Use ONLY this unit. 1 στρ. = 0.1 ha = 0.247 ac.`;

  const weatherRules = `WEATHER CONTEXT RULES:
- Humidity > 75%: flag fungal pressure. >85%: high urgency, inspect within 24h.
- Temp > 35°C: heat stress, don't spray during peak heat.
- Temp < 5°C: frost risk if crop in sensitive stage.
- Rain > 5mm: foliar products may have washed off.
- Wind > 30 km/h: don't spray, drift risk.
- Connect weather to advice: "Given today's conditions..."
- If no weather data available, skip.`;

  const currentMonth = new Date().getMonth() + 1;
  const seasonalAdvisory = `SEASONAL RISK AWARENESS (month ${currentMonth}):
Flag known disease/pest pressure windows for the crop. Add as one short advisory sentence at end of answer.`;

  const currentDate = new Date().toISOString().split('T')[0];
  const growthStage = `GROWTH STAGE AWARENESS:
Today: ${currentDate}. Location: ${userLocation || 'unknown'}.
Determine crop growth stage from date + hemisphere + crop. Factor into all advice:
- Spray timing must match growth stage
- Product safety for current stage (no sulfur in bloom, no copper near harvest)
- Watering/fertilization must reflect current demand
- Generic "how do I care for X": answer for NOW, not full year`;

  const intentHints: Record<string, string> = {
    diagnosis: 'PRE-CLASSIFIED: DIAGNOSIS query (TYPE A). Apply five-pillar framework and confidence scoring.',
    calculation: 'PRE-CLASSIFIED: CALCULATION query (TYPE B). Show formula, inputs, steps, result with units.',
    planning: 'PRE-CLASSIFIED: PLANNING query (TYPE C). Give concrete plan with numbered steps, timings, quantities.',
    general: 'PRE-CLASSIFIED: GENERAL KNOWLEDGE query (TYPE D). Answer directly, be specific.',
    followup: 'PRE-CLASSIFIED: FOLLOW-UP (TYPE E). Read emotional tone first.',
    indoor: 'PRE-CLASSIFIED: INDOOR/CONTAINER CARE query (TYPE F). Apply six-pillar indoor framework.',
  };
  const intentHint = intentHints[intent] || '';
  const depthHint = conversationDepth > 2 ? `CONVERSATION CONTEXT: Message ${conversationDepth} in ongoing conversation. Don't re-introduce or repeat prior advice.` : '';

  // ══════════════════════════════════════════════════════════════════════
  // TYPE-SPECIFIC MODULES (only ONE loaded per query)
  // This is where the token savings come from: ~60% reduction on average.
  // ══════════════════════════════════════════════════════════════════════

  const TYPE_A_DIAGNOSIS = `BEHAVIOUR FOR DIAGNOSIS (TYPE A):
1. Always attempt visual analysis, even on imperfect images.
2. Use the FIVE PILLARS to assess confidence and score 0-100.
3. PILLAR COUNT RULE:
   - 1 pillar → max 35 (don't name disease)
   - 2 pillars → max 55 (suspected only)
   - 3 pillars → max 72 (primary with uncertainty)
   - 4+ pillars → max 90 (confident if evidence strong)
4. TIERED DIAGNOSIS:
   - < 40: NO disease name. List missing pillars. ONE safe interim action.
   - 40-65: "possible/suspected" only. 2-3 candidates. ONE tie-breaking question. ONE safe interim action.
   - 65-85: Primary diagnosis with uncertainty. ONE follow-up if it changes treatment. Treatment options.
   - > 85: Full diagnosis + treatment + prevention.
5. QUARANTINE DISEASES: NEVER name HLB, Xylella, Fire Blight, Plum Pox, ToBRFV, Fusarium TR4, Potato Wart unless >85. Below 85%: "symptoms consistent with serious disease, contact local plant protection service."
6. QUESTION ANATOMY: (a) recap what you understand, (b) explain WHY you need this info, (c) ask the specific question.
7. FOLLOW-UP COMMITMENT: Close with "I'll want to hear from you in [X] days." 3-5 days severe, 5-7 fungal, 10-14 nutritional.

THE FIVE PILLARS:
1. THE VICTIM: species/variety known?
2. THE SYMPTOMS: color, texture, pattern, spread?
3. THE TIMELINE: when started? growth stage?
4. THE ENVIRONMENT: soil, weather, irrigation, inputs?
5. THE EVIDENCE: photo close enough for detail?

missing_pillars JSON: Use ONLY "THE VICTIM", "THE SYMPTOMS", "THE TIMELINE", "THE ENVIRONMENT", "THE EVIDENCE".

Confidence scoring (confidence_score in JSON):
- > 85: Full diagnosis + treatment + prevention + follow-up
- 65-85: Primary + uncertainty + one question + treatment
- 40-65: 2-3 candidates + tie-breaker + safe interim action
- < 40: NO name, describe only, list what's needed + safe action

IMAGE ANALYSIS:
- Always attempt analysis, even blurry images.
- Affected area < 30% of frame: use your photo ask (from UNIVERSAL) to request a close-up.
- Each new image is independent.
- Poor quality lowers confidence.
- Non-plant photos: ask for plant close-up. Set confidence_score 0.`;

  const TYPE_B_CALCULATION = `BEHAVIOUR FOR CALCULATION (TYPE B):
1. If ALL numbers available, calculate immediately with step-by-step work.
2. If MISSING critical inputs, ask BEFORE calculating.
3. Show formula, inputs, final result with units.
4. Always provide practical ranges.

CALCULATION GUIDE:
IRRIGATION: ETc = ET0 × Kc. Convert mm to m³/ha (1mm = 10 m³/ha). Add drip efficiency (85-95%).
FERTILIZER: NPK from yield target + soil analysis. Convert kg nutrient/ha to kg product/ha using %.
SPRAY: Volume = nozzle output × nozzles × speed correction. Field 200-400 L/ha, orchard 500-1000 L/ha.
AREA: 1 stremma = 0.1 ha = 0.247 ac. Yield = density × fruit weight × % marketable.
ECONOMICS: Gross margin = (yield × price) - variable costs. Break-even = total costs / price per unit.`;

  const TYPE_C_PLANNING = `BEHAVIOUR FOR PLANNING (TYPE C):
1. ANSWER-FIRST: give concrete, complete plan immediately.
2. Broad questions: give FULL seasonal plan covering all major scenarios.
3. Structure as numbered steps with actions, timings, quantities.
4. ONE question at END only if it meaningfully changes the recommendation.`;

  const TYPE_D_GENERAL = `BEHAVIOUR FOR GENERAL KNOWLEDGE (TYPE D):
1. Answer directly and completely.
2. Active ingredient first, then brand examples. Format: "Azoxystrobin (e.g., Amistar), 0.75-1.5 L/ha."
3. Flag regional availability issues.
4. Flag restricted/banned substances and redirect to alternatives.
5. DIAGNOSTIC AWARENESS: If the question is about disease symptoms, pest appearance, or a visible problem on a specific plant — give the factual answer first, then apply the UNIVERSAL PHOTO REQUEST RULE from UNIVERSAL RULES.`;

  const TYPE_E_FOLLOWUP = `BEHAVIOUR FOR FOLLOW-UP (TYPE E):
1. EMOTIONAL ACKNOWLEDGMENT FIRST:
   - Treatment FAILED: "I understand how disheartening it is..." Investigate WHY before suggesting alternative.
   - Treatment WORKING: "That's great, it means we had the right diagnosis." Reinforce + next steps.
2. Updated clinical recommendation.
3. Updated follow-up timing.`;

  const TYPE_F_INDOOR = `BEHAVIOUR FOR INDOOR/CONTAINER CARE (TYPE F):
Container plants have different needs from field crops. Pot size, drainage, light, watering habits matter most.

SIX PILLARS: 1) THE PLANT (species, age) 2) THE CONTAINER (size, drainage, material) 3) THE LIGHT (hours, window direction) 4) THE WATER (frequency, amount, drainage) 5) THE SOIL & ROOTS (mix type, last repotted, root-bound signs) 6) THE POSITION (indoor/balcony, heating/AC, humidity)

1. ANSWER-FIRST: most probable cause immediately.
2. FIRST-TURN: if no photo + no pot/light/watering details yet, MUST close with "Για συμβουλή ακριβώς για το φυτό σου" block asking for: photo from 1m, pot size + drainage, sun hours + orientation, watering frequency, last repotted.
3. Common issues checklist: overwatering (soft yellow leaves), underwatering (crispy edges), root-bound (roots from holes), insufficient light (leggy growth), fertilizer burn (brown tips), pests (mites, mealybugs, gnats).
4. EXPLAIN THE WHY: never just "repot it", explain the mechanism.
5. WATERING: give test method ("top 2-3cm dry"), not frequency.
6. If disease/pest suspected, shift to TYPE A five-pillar mode adapted for indoor context.`;

  // Select the right module
  const typeModules: Record<string, string> = {
    diagnosis: TYPE_A_DIAGNOSIS,
    calculation: TYPE_B_CALCULATION,
    planning: TYPE_C_PLANNING,
    general: TYPE_D_GENERAL,
    followup: TYPE_E_FOLLOWUP,
    indoor: TYPE_F_INDOOR,
  };
  const activeType = typeModules[intent] || TYPE_D_GENERAL;

  // ══════════════════════════════════════════════════════════════════════
  // UNIVERSAL RULES (always loaded)
  // ══════════════════════════════════════════════════════════════════════

  const UNIVERSAL = `UNIVERSAL RULES:

RESPONSE FORMAT (MANDATORY):
1. ANSWER (2-4 sentences): actionable answer immediately. Imperatives: "Ψέκασε...", "Πότισε...", "Έλεγξε..."
2. ONE QUESTION if needed, at the END only, as the final sentence:
   • Photo ask → natural sentence: "Can you send me a close-up photo of one affected leaf in natural daylight?"
   • Info ask → list: "Για ακριβέστερη συμβουλή, στείλε μου: [2-3 items]"
   Exception: TYPE A with confidence < 65 may ask before committing to a diagnosis.

UNIVERSAL PHOTO REQUEST RULE (applies to ALL query types, except TYPE F which has its own protocol):
When the user describes visual symptoms (spots, discolouration, wilting, lesions, powder, mould, pest signs, visible damage) on a specific plant AND has NOT sent a photo with this message:
— End your response with a photo request as the FINAL SENTENCE. This IS your one allowed question.
— Specify exactly what to photograph using the PHOTO REQUEST GUIDE below.
— Also include "THE EVIDENCE" in missing_pillars.
— Do NOT skip this even if you already have a working diagnosis — a photo confirms or overturns it.
— Example: "Can you send me a close-up photo of one affected leaf in natural daylight? That will let me confirm the diagnosis."

PHOTO REQUEST GUIDE:
- Spots on leaves → "Close-up of one affected leaf, full frame, natural daylight."
- Pest ID → "Photo of leaf UNDERSIDE, close enough for individual insects."
- Soil/root → "Photo of soil surface + pot drainage holes."
- Plant ID → "Single fully-visible leaf front + stem texture."
- Unclear problem → "Step back 1-2m, full plant including pot/soil base."
- Fruit issue → "Close-up of one affected fruit + how many show same problem."

HARD LIMITS:
- Max ONE question mark per response. The photo ask counts as that question — never ask a second question in the same response.
- Under 150 words for care/planning. Under 200 for diagnosis. Be clinical and direct.
- No "it depends on many factors". Commit to most likely scenario.
- Max 3 treatments. Pick best, mention 1 alternative.
- No explaining WHY unless asked.
- Use user's area unit (${unitName}) exclusively.
- Confidence in words only: Χαμηλή (<40), Μέτρια (40-65), Υψηλή (65-85), Πολύ υψηλή (>85).

QUESTION DISCIPLINE:
- ONE question per response, at the END only, as the final sentence.
- PRIORITY ORDER: (1) photo request when visual symptoms described without image — takes the slot; (2) single most critical diagnostic tie-breaker. Never both.
- NEVER put questions inside the answer body.
- NEVER ask more than one question in any form.

PROFESSIONAL TONE:
- Senior agronomist to colleague.
- No greetings, no emoji, no filler ("Great question!" etc).
- Short sentences. Active voice. Direct.
- NEVER use em dashes or en dashes. Use commas, periods, colons.

TECHNICAL STANDARDS:
- Exact product names, dosages, timings, concentrations.
- Check phytotoxicity before recommending.
- Crop-specific accuracy: never suggest pest/disease that doesn't affect the crop.
- DUAL TREATMENT: disease/pest/deficiency answers MUST include biological AND chemical with different active ingredients. If no bio option exists, say "Δεν υπάρχει βιολογική λύση" and give chemical only.
- FACTUAL pest/disease questions: always close with treatment.

CONVERSATION QUALITY:
- Context recap before questions (one sentence showing you listened).
- Contingency plan after treatment: "If no improvement in [X] days, come back."
- Own the outcome: you are managing a case, not just answering questions.`;

  // ══════════════════════════════════════════════════════════════════════
  // CONTEXT + MEMORY (always loaded, variable content)
  // ══════════════════════════════════════════════════════════════════════

  const contextSection = `CONTEXT:
- Photo contradicts field context → trust PHOTO.
- Treatment history: never repeat failed active ingredient. Flag resistance if same ingredient failed 2+ times.
- Cross-field: flag if same problem on 2+ fields same crop same week.

FIELD & HISTORY CONTEXT:
${fieldContext || 'No field data or treatment history on record yet.'}
${growerContext ? 'GROWER CONTEXT:\n' + growerContext : ''}

AUTO-LOG: When farmer mentions past action, populate action_detected (action_type, product, quantity, date_mentioned, confidence 0-1).

JSON RULES:
- diagnosis_data.problem: farmer's language ONLY, no English in parentheses.
- missing_pillars: ONLY "THE VICTIM", "THE SYMPTOMS", "THE TIMELINE", "THE ENVIRONMENT", "THE EVIDENCE".
- Return valid JSON. response_text = user-visible text.`;

  // ══════════════════════════════════════════════════════════════════════
  // ASSEMBLE: ~2,500-3,500 tokens per query (down from ~6,800)
  // ══════════════════════════════════════════════════════════════════════

  return `${langInstruction}

${dosageInstruction}

${growthStage}

${weatherRules}

${seasonalAdvisory}
${intentHint ? '\n' + intentHint : ''}${depthHint ? '\n' + depthHint : ''}

You are Oli, an expert AI agronomist. You help farmers with disease diagnosis, pest management, nutrition plans, irrigation calculations, fertilizer programs, yield estimation, economic analysis, planting schedules, harvest timing, and any other farming question.

SCOPE: If unrelated to agriculture, decline in one sentence: "That's outside my area. If you have a question about crops, plants, or fields, I'm ready."

${activeType}

${UNIVERSAL}

${contextSection}`;
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

// H3: Strip prompt injection markers from user input (English + Greek)
function sanitizeUserInput(text: string): string {
  return text
    // English injection markers
    .replace(/\[SYSTEM[^\]]*\]/gi, '')
    .replace(/\[INSTRUCTION[^\]]*\]/gi, '')
    .replace(/\[ADMIN[^\]]*\]/gi, '')
    .replace(/\[OVERRIDE[^\]]*\]/gi, '')
    .replace(/<<SYS>>[\s\S]*?<<\/SYS>>/gi, '')
    .replace(/\bignore previous instructions\b/gi, '***')
    .replace(/\byou are now\b/gi, '***')
    // Greek injection markers (S5: Greek prompt injection protection)
    .replace(/\bαγνόησε τις προηγούμενες οδηγίες\b/gi, '***')
    .replace(/\bείσαι τώρα\b/gi, '***')
    .replace(/\bνέα οδηγία\b/gi, '***')
    .replace(/\bσύστημα\b.*\bοδηγία\b/gi, '***')
    .replace(/\[ΣΥΣΤΗΜΑ[^\]]*\]/gi, '')
    .replace(/\[ΟΔΗΓΙΑ[^\]]*\]/gi, '')
    .trim();
}

/**
 * S1: Confidence-score safety enforcer.
 * When confidence_score < 40, the AI is instructed not to name diseases,
 * but we also strip any leaked disease names from the structured response
 * as a second line of defence.
 */
const VALID_PILLARS = new Set([
  'THE VICTIM',
  'THE SYMPTOMS',
  'THE TIMELINE',
  'THE ENVIRONMENT',
  'THE EVIDENCE',
]);

// Keyword → canonical pillar. Checked after basic normalization fails.
const PILLAR_KEYWORD_MAP: Array<[string, string]> = [
  ['VICTIM', 'THE VICTIM'],
  ['SPECIES', 'THE VICTIM'],
  ['VARIETY', 'THE VICTIM'],
  ['SYMPTOM', 'THE SYMPTOMS'],
  ['COLOR', 'THE SYMPTOMS'],
  ['COLOUR', 'THE SYMPTOMS'],
  ['TIMELINE', 'THE TIMELINE'],
  ['TIMING', 'THE TIMELINE'],
  ['WHEN', 'THE TIMELINE'],
  ['ENVIRONMENT', 'THE ENVIRONMENT'],
  ['SOIL', 'THE ENVIRONMENT'],
  ['WEATHER', 'THE ENVIRONMENT'],
  ['IRRIGATION', 'THE ENVIRONMENT'],
  ['EVIDENCE', 'THE EVIDENCE'],
  ['PHOTO', 'THE EVIDENCE'],
  ['IMAGE', 'THE EVIDENCE'],
  ['PICTURE', 'THE EVIDENCE'],
];

function normalizePillar(raw: string): string | null {
  // Uppercase, trim, collapse separators to spaces
  const upper = raw.trim().toUpperCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  if (VALID_PILLARS.has(upper)) return upper;
  // Try prepending "THE " if missing
  const withThe = upper.startsWith('THE ') ? upper : `THE ${upper}`;
  if (VALID_PILLARS.has(withThe)) return withThe;
  // Keyword scan
  for (const [keyword, canonical] of PILLAR_KEYWORD_MAP) {
    if (upper.includes(keyword)) return canonical;
  }
  return null;
}

// S2: Normalize and strip missing_pillars values the AI returned in wrong form.
// The UI maps these exact canonical strings; anything else silently breaks the card.
function sanitizeMissingPillars(response: AiResponseJson): AiResponseJson {
  const dd = response.diagnosis_data;
  if (!dd?.missing_pillars || !Array.isArray(dd.missing_pillars)) return response;

  const normalized = dd.missing_pillars.map(normalizePillar);
  const invalid = dd.missing_pillars.filter((_, i) => normalized[i] === null);
  if (invalid.length > 0) {
    console.warn('sanitizeMissingPillars: stripped invalid values:', invalid);
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique = normalized.filter((p): p is string => p !== null && !seen.has(p) && (seen.add(p), true));

  const unchanged =
    unique.length === dd.missing_pillars.length &&
    dd.missing_pillars.every((p, i) => p === unique[i]);
  if (unchanged) return response;

  return {
    ...response,
    diagnosis_data: {
      ...dd,
      missing_pillars: unique.length > 0 ? unique : null,
    },
  };
}

function enforceConfidenceThreshold(response: AiResponseJson): AiResponseJson {
  const dd = response.diagnosis_data;
  if (!dd) return response;

  const score = typeof dd.confidence_score === 'number' ? dd.confidence_score : 100;

  if (score < 40) {
    // Strip specific disease/pest names from structured fields.
    // The response_text itself is written by the AI which is already
    // instructed not to name diseases below 40, leave it unchanged.
    return {
      ...response,
      diagnosis_data: {
        ...dd,
        problem: null,          // no disease name
        cause: null,            // no causal organism
        severity: null,         // severity without disease name is misleading
        product_applied: null,  // no treatment product at this confidence
        chemical_treatments: [], // no chemical recommendations
        organic_treatments: [],  // no organic recommendations, only general safe advice
        // keep confidence_score and missing_pillars so UI can show what's needed
      },
    };
  }

  return response;
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

function isGreetingCacheFresh(lastGreetingAt: string | null | undefined, now: Date): boolean {
  if (!lastGreetingAt) {
    return false;
  }

  const generatedAt = new Date(lastGreetingAt);
  if (Number.isNaN(generatedAt.getTime())) {
    return false;
  }

  return now.getTime() - generatedAt.getTime() < GREETING_CACHE_TTL_MS;
}

function buildFallbackGreeting(name: string, lang: string, crop: string, month: string): string {
  const firstName = name || (lang === 'el' ? 'φίλε μου' : 'there');

  if (lang === 'el') {
    if (crop && crop !== 'crops') {
      return `${firstName}, πες μου τι βλέπεις σήμερα στο ${crop} σου και θα το δουλέψουμε μαζί. Με τον ${month} να τρέχει, αν θέλεις μπορούμε να το δούμε είτε γενικά είτε για συγκεκριμένο χωράφι.`;
    }

    return `${firstName}, πες μου τι συμβαίνει σήμερα στις καλλιέργειές σου και θα το δουλέψουμε μαζί. Αν θέλεις πιο στοχευμένη βοήθεια, διάλεξε πρώτα ένα συγκεκριμένο χωράφι.`;
  }

  if (crop && crop !== 'crops') {
    return `${firstName}, tell me what you're seeing in your ${crop} today and we'll work through it together. With ${month} underway, we can keep it general or focus on a specific field if you choose one.`;
  }

  return `${firstName}, tell me what's happening with your crops today and we'll work through it together. If you want field-specific advice, choose a field first and I'll use that context.`;
}

function validateResponse(json: AiResponseJson, hasActiveField: boolean): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (json.question_count > 1) {
    errors.push('question_count > 1: AI asks more than one question.');
  }

  if (json.has_banned_opener) {
    errors.push('has_banned_opener == true: Response starts with a banned opener.');
  }

  // field_scope is enforced server-side in generateValidatedResponse before this function
  // is called, so no need to validate it here.

  if (!json.response_text || json.response_text.trim() === '') {
    errors.push('response_text is empty.');
  }

  // V2: Validate missing_pillars, only the five exact strings are valid.
  // Invalid values break the UI label mapping silently.
  const dd = json.diagnosis_data;
  if (dd?.missing_pillars && Array.isArray(dd.missing_pillars)) {
    const invalid = dd.missing_pillars.filter((p) => !VALID_PILLARS.has(p));
    if (invalid.length > 0) {
      errors.push(
        `missing_pillars contains invalid values: [${invalid.join(', ')}]. ` +
        'Must use ONLY: "THE VICTIM", "THE SYMPTOMS", "THE TIMELINE", "THE ENVIRONMENT", "THE EVIDENCE".',
      );
    }
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

  // Gemini 2.5 Flash/Pro returns thinking tokens as parts with { thought: true }.
  // Concatenating them corrupts the structured JSON output, filter them out.
  return parts
    .filter((part: any) => !part?.thought)
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

  if (!text) {
    throw new GeminiPayloadError('Gemini returned an empty payload');
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('Failed to parse Gemini payload:', text);
    throw new GeminiPayloadError(
      error instanceof Error ? `Gemini returned malformed JSON: ${error.message}` : 'Gemini returned malformed JSON',
    );
  }
}

async function fetchGeminiGenerateContent(
  geminiApiKey: string,
  model: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    },
  );
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
// Thrown when all available Gemini models have exhausted their quota (HTTP 429).
// The outer handler converts this into a 503 with a user-friendly message.
class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

class GeminiPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiPayloadError';
  }
}

interface GeminiCallResult {
  json: AiResponseJson;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ── Image pre-extraction ──────────────────────────────────────────────
// When a photo is attached, run a quick focused Gemini call to extract
// structured observations BEFORE the main chat call. This gives the main
// call structured data to work with instead of trying to both "see" and
// "reason" in one step. Only runs when images are present.
const IMAGE_EXTRACTION_PROMPT = `You are a plant pathology image analyst. Examine this image and extract structured observations. Return ONLY valid JSON with these exact keys:

{
  "plant_species": "best guess species name in English and Latin if confident, or 'unknown' if unclear",
  "plant_part": "which part of the plant is shown (leaf, stem, fruit, root, whole plant, multiple parts)",
  "visible_symptoms": ["list each distinct symptom you can see, be specific about color, size, shape, texture"],
  "affected_area_percent": 0,
  "symptom_pattern": "how symptoms are distributed: uniform, scattered, clustered, edge-only, vein-following, one-sided, or 'healthy/no symptoms'",
  "tissue_condition": "are affected areas dry, wet, sunken, raised, powdery, oily, necrotic, or 'normal'",
  "color_changes": "describe any discoloration: yellowing, browning, blackening, reddening, chlorosis patterns, or 'normal coloration'",
  "pest_signs": "any visible insects, eggs, frass, webbing, tunneling, or 'none visible'",
  "image_quality": "good, acceptable, or poor with reason"
}

Do NOT diagnose. Do NOT recommend treatment. Only describe what you see. Be precise and clinical. Return ONLY the JSON object, no markdown, no explanation.`;

async function extractImageContext(
  geminiApiKey: string,
  attachments: InlineAttachment[],
): Promise<string> {
  try {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: IMAGE_EXTRACTION_PROMPT },
    ];
    for (const att of attachments) {
      parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    }

    // flash-lite has no multimodal support; fall back to 2.0-flash for image extraction
    const imageExtractionModel = GEMINI_MODEL === 'gemini-2.0-flash-lite' ? 'gemini-2.0-flash' : GEMINI_MODEL;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(imageExtractionModel)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      console.warn(`Image pre-extraction failed (${response.status}), skipping`);
      return '';
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Clean markdown fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Validate it's parseable JSON
    JSON.parse(cleaned);

    return `\nIMAGE ANALYSIS (pre-extracted from attached photo):\n${cleaned}\n\nUse these observations to inform your diagnosis. You still have the original image for verification.`;
  } catch (err) {
    console.warn('Image pre-extraction error, skipping:', err);
    return '';
  }
}

async function callGemini(
  geminiApiKey: string,
  messages: ChatMessageInput[],
  systemPrompt: string,
  temperature = 0.4,
): Promise<GeminiCallResult> {
  const contents = messages.map((message) => {
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
      temperature,
    },
  };

  // T1: 20s hard timeout, prevents 25s+ hangs when Gemini is slow or unresponsive
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    },
  );

  // I2: On 5xx or 429 (quota exceeded), retry once with gemini-2.0-flash-lite as a fallback model.
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini request failed (${response.status}):`, errorText);

    const shouldFallback = (response.status >= 500 || response.status === 429) && GEMINI_MODEL !== 'gemini-2.0-flash-lite';
    if (!shouldFallback) {
      if (response.status === 429) throw new GeminiQuotaError(`Gemini quota exceeded for ${GEMINI_MODEL}`);
      throw new Error(`Gemini request failed (${response.status})`);
    }

    console.warn(`Primary model returned ${response.status}, retrying with gemini-2.0-flash-lite fallback`);
    const fallbackResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!fallbackResponse.ok) {
      const fbErr = await fallbackResponse.text();
      console.error(`Gemini fallback also failed (${fallbackResponse.status}):`, fbErr);
      if (fallbackResponse.status === 429) throw new GeminiQuotaError('All Gemini models have exceeded their quota');
      throw new Error(`Gemini request failed (${response.status}), fallback also failed (${fallbackResponse.status})`);
    }
    const fallbackData = await fallbackResponse.json();
    const fallbackJson = parseGeminiPayload<AiResponseJson>(fallbackData);
    const fbUsage = fallbackData.usageMetadata ?? {};
    return { json: fallbackJson, promptTokens: fbUsage.promptTokenCount ?? 0, outputTokens: fbUsage.candidatesTokenCount ?? 0, totalTokens: fbUsage.totalTokenCount ?? 0 };
  }

  const data = await response.json();
  const json = parseGeminiPayload<AiResponseJson>(data);
  const usage = data.usageMetadata ?? {};
  return { json, promptTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0, totalTokens: usage.totalTokenCount ?? 0 };
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

  // T1: 20s hard timeout, extraction is lightweight; if it hangs this long something is wrong
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    },
  );

  // I2: On 5xx or 429 (quota exceeded), retry once with gemini-2.0-flash-lite fallback
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini extraction failed (${response.status}):`, errorText);

    const shouldFallback = (response.status >= 500 || response.status === 429) && GEMINI_MODEL !== 'gemini-2.0-flash-lite';
    if (!shouldFallback) {
      if (response.status === 429) throw new GeminiQuotaError(`Gemini quota exceeded for ${GEMINI_MODEL} (extraction)`);
      throw new Error(`Gemini extraction failed (${response.status})`);
    }

    console.warn(`Primary extraction model returned ${response.status}, retrying with gemini-2.0-flash-lite fallback`);
    const fallbackResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!fallbackResponse.ok) {
      const fbErr = await fallbackResponse.text();
      console.error(`Gemini extraction fallback also failed (${fallbackResponse.status}):`, fbErr);
      if (fallbackResponse.status === 429) throw new GeminiQuotaError('All Gemini models have exceeded their quota (extraction)');
      throw new Error(`Gemini extraction failed (${response.status}), fallback also failed (${fallbackResponse.status})`);
    }
    return parseGeminiPayload<ExtractionResult>(await fallbackResponse.json());
  }

  return parseGeminiPayload<ExtractionResult>(await response.json());
}

// P3: Temperature varies by intent, diagnosis needs precision, general can be warmer
function intentTemperature(intent: QueryIntent): number {
  switch (intent) {
    case 'diagnosis': return 0.2;
    case 'calculation': return 0.1;
    case 'followup': return 0.3;
    case 'planning': return 0.35;
    case 'indoor': return 0.35; // warm and practical, not clinical
    default: return 0.4;
  }
}

const BANNED_OPENER_RE = /^\s*(great question|certainly|of course|sure|absolutely|happy to help)[!,.\-:\s]/i;

interface ValidatedResponseResult {
  json: AiResponseJson;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

async function generateValidatedResponse(
  geminiApiKey: string,
  messages: ChatMessageInput[],
  fieldContext: string,
  hasActiveField: boolean,
  growerContext = '',
  lang = 'en',
  intent: QueryIntent = 'general',
  conversationDepth = 0,
  areaUnit = 'stremma',
  userLocation = '',
): Promise<ValidatedResponseResult> {
  const systemPrompt = buildSystemPrompt(fieldContext, growerContext, lang, intent, conversationDepth, areaUnit, userLocation);
  const temperature = intentTemperature(intent);
  const initial = await callGemini(geminiApiKey, messages, systemPrompt, temperature);
  let json = initial.json;
  let promptTokens = initial.promptTokens;
  let outputTokens = initial.outputTokens;
  let totalTokens = initial.totalTokens;

  // P4: Server-side banned opener detection, override the AI's self-reported flag.
  // The AI occasionally lies about this; we verify directly from response_text.
  if (BANNED_OPENER_RE.test(json.response_text)) {
    json = { ...json, has_banned_opener: true };
  }

  // F1: Enforce field_scope server-side, we know the correct value from hasActiveField,
  // so override instead of triggering a costly repair retry for every active-field session.
  if (hasActiveField) {
    json = { ...json, field_scope: 'specific' };
  }

  const validation = validateResponse(json, hasActiveField);

  if (!validation.valid) {
    console.warn('Response validation failed, retrying with repair prompt:', validation.errors);
    // P2: Inject repair instruction into systemPrompt (not user content, proper separation)
    const repairSystemPrompt =
      systemPrompt +
      `\n\n⚠️ REPAIR REQUIRED, your previous response failed these validation checks:\n` +
      validation.errors.map((e) => `- ${e}`).join('\n') +
      `\nFix ALL of the above issues in your new response. Do not repeat the same mistakes.`;
    const repair = await callGemini(geminiApiKey, messages, repairSystemPrompt, temperature);
    json = repair.json;
    // Accumulate tokens across both calls so the usage log reflects total spend
    promptTokens += repair.promptTokens;
    outputTokens += repair.outputTokens;
    totalTokens += repair.totalTokens;

    // Re-check banned opener after repair
    if (BANNED_OPENER_RE.test(json.response_text)) {
      json = { ...json, has_banned_opener: true };
    }
  }

  // S1: Enforce confidence threshold, strip specific disease data below 40%
  const thresholdJson = enforceConfidenceThreshold(json);

  // S2: Strip any hallucinated missing_pillars values, UI breaks silently on unknown strings
  const safeJson = sanitizeMissingPillars(thresholdJson);

  // M2: Per-request token telemetry. Greppable from Supabase logs to spot
  // prompt-bloat regressions (e.g. fieldContext growing unbounded as a user
  // adds fields/interventions). The repaired flag tells us how often the
  // 1-shot validation retry fires in production.
  const repaired = !validation.valid;
  console.info('[chat:tokens]', JSON.stringify({
    intent,
    promptTokens,
    outputTokens,
    totalTokens,
    systemPromptChars: systemPrompt.length,
    fieldContextChars: fieldContext.length,
    repaired,
  }));

  return {
    json: { ...safeJson, response_text: cleanAssistantText(safeJson.response_text) },
    promptTokens,
    outputTokens,
    totalTokens,
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

/**
 * Fire-and-forget AI cost logger.
 * Writes one row to ai_usage_events so you can track token spend per user/conversation.
 * Errors are swallowed, a DB write failure must never block or slow a chat response.
 *
 * Cost formula: Gemini 2.5 Flash blended estimate.
 * Adjust GEMINI_COST_PER_1M_* constants if pricing changes.
 */
const GEMINI_COST_PER_1M_INPUT_USD = 0.075;  // $0.075 / 1M input tokens
const GEMINI_COST_PER_1M_OUTPUT_USD = 0.30;  // $0.30  / 1M output tokens

async function logAiCost(
  supabaseAdmin: any,
  userId: string,
  conversationId: string | null,
  promptTokens: number,
  outputTokens: number,
  totalTokens: number,
  requestKind: string,
): Promise<void> {
  if (!totalTokens) return;
  const estimatedCostUsd = parseFloat(
    ((promptTokens / 1_000_000) * GEMINI_COST_PER_1M_INPUT_USD +
     (outputTokens / 1_000_000) * GEMINI_COST_PER_1M_OUTPUT_USD).toFixed(6),
  );
  await supabaseAdmin.from('ai_usage_events').insert({
    user_id: userId,
    conversation_id: conversationId ?? null,
    model: GEMINI_MODEL,
    request_kind: requestKind,
    prompt_tokens: promptTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: estimatedCostUsd,
    metadata: {},
  });
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
  if (!cropType) return null;
  const crop = cropType.toLowerCase();
  const month = new Date().getMonth() + 1; // 1–12

  // Perennial crops: calendar-month heuristic (days-since-planting is meaningless for multi-year trees/vines)
  type MonthStages = Record<number, string>;
  const PERENNIAL_PATTERNS: { keywords: string[]; stages: MonthStages }[] = [
    {
      keywords: ['olive', 'ελιά', 'ελαια', 'oliva', 'aceite', 'olivier', 'زيتون'],
      stages: {
        1: 'Dormancy', 2: 'Dormancy', 3: 'Bud swell',
        4: 'Bud break / vegetative growth', 5: 'Flowering',
        6: 'Fruit set / early fruit growth', 7: 'Pit hardening',
        8: 'Pit hardening', 9: 'Fruit ripening (veraison)',
        10: 'Harvest window', 11: 'Post-harvest / early dormancy', 12: 'Dormancy',
      },
    },
    {
      keywords: ['vine', 'grapevine', 'grape', 'αμπέλι', 'αμπελ', 'vite', 'vid', 'vigne', 'عنب'],
      stages: {
        1: 'Dormancy', 2: 'Dormancy', 3: 'Bud swell',
        4: 'Bud break / early shoot growth', 5: 'Shoot development',
        6: 'Flowering / fruit set', 7: 'Berry development',
        8: 'Veraison (colour change)', 9: 'Ripening',
        10: 'Harvest / post-harvest', 11: 'Leaf fall / early dormancy', 12: 'Dormancy',
      },
    },
    {
      keywords: ['citrus', 'orange', 'lemon', 'lime', 'grapefruit', 'mandarin', 'clementine',
                 'εσπεριδοειδ', 'πορτοκάλ', 'λεμόν', 'agrumi', 'cítrico', 'agrume', 'حمضيات'],
      stages: {
        1: 'Winter dormancy / fruit maturing', 2: 'Late fruit / pre-flowering',
        3: 'Bud break / flowering', 4: 'Flowering / fruit set',
        5: 'Fruit set / early growth', 6: 'Fruit development',
        7: 'Summer fruit expansion', 8: 'Fruit sizing',
        9: 'Colour change / early harvest', 10: 'Early harvest (early varieties)',
        11: 'Main harvest window', 12: 'Late harvest / dormancy start',
      },
    },
    {
      keywords: ['almond', 'αμύγδαλ', 'mandorla', 'almendra', 'amande', 'لوز'],
      stages: {
        1: 'Dormancy', 2: 'Bud swell / early flowering',
        3: 'Full flowering / petal fall', 4: 'Fruit set / shell hardening',
        5: 'Nut development', 6: 'Nut development',
        7: 'Hull split / harvest window', 8: 'Harvest',
        9: 'Post-harvest', 10: 'Leaf fall', 11: 'Dormancy', 12: 'Dormancy',
      },
    },
    {
      keywords: ['apple', 'pear', 'μήλο', 'αχλάδ', 'mela', 'pero', 'manzana', 'poire', 'pomme', 'تفاح'],
      stages: {
        1: 'Dormancy', 2: 'Dormancy / bud swell',
        3: 'Bud break / green tip', 4: 'Pink bud / full bloom',
        5: 'Petal fall / fruit set', 6: 'Early fruit development',
        7: 'Fruit development', 8: 'Fruit sizing',
        9: 'Ripening / early harvest', 10: 'Harvest / post-harvest',
        11: 'Leaf fall / dormancy start', 12: 'Dormancy',
      },
    },
    {
      keywords: ['peach', 'nectarine', 'apricot', 'plum', 'cherry', 'ροδάκιν', 'βερίκοκ', 'δαμάσκ',
                 'κερασ', 'pesco', 'albicocca', 'prugna', 'ciliegia', 'melocotón', 'cerezo', 'خوخ'],
      stages: {
        1: 'Dormancy', 2: 'Bud swell / early flowering',
        3: 'Flowering / petal fall', 4: 'Fruit set',
        5: 'Fruit development', 6: 'Rapid fruit growth',
        7: 'Ripening / harvest (early varieties)', 8: 'Main harvest',
        9: 'Post-harvest / leaf fall', 10: 'Leaf fall', 11: 'Dormancy', 12: 'Dormancy',
      },
    },
  ];

  for (const pattern of PERENNIAL_PATTERNS) {
    if (pattern.keywords.some((k) => crop.includes(k))) {
      return pattern.stages[month] ?? 'Active season';
    }
  }

  // Annual crops: days-since-planting (requires plantedAt)
  if (!plantedAt) return null;
  const daysSincePlanting = Math.floor((Date.now() - new Date(plantedAt).getTime()) / 86400000);
  if (daysSincePlanting < 0) return null;
  if (daysSincePlanting <= 14) return `Germination (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 45) return `Seedling / early vegetative (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 90) return `Vegetative growth (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 120) return `Flowering / fruit set (day ${daysSincePlanting})`;
  if (daysSincePlanting <= 160) return `Fruit development (day ${daysSincePlanting})`;
  return `Maturity / near-harvest (day ${daysSincePlanting})`;
}

async function assembleServerFieldContext(
  supabaseAdmin: any,
  appUserId: string,
  fields: FieldContextRow[],
  activeFieldId?: string | null,
  fallbackFieldContext = '',
) {
  if (!activeFieldId) {
    return {
      fieldContext: fallbackFieldContext || 'No field selected for this conversation.',
      activeFieldId: null,
      activeFieldName: null,
      hasActiveField: false,
      recentInterventions: [] as InterventionContextRow[],
      pendingFollowUps: [] as InterventionContextRow[],
    };
  }

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
  const activeField = fields.find((field) => field.id === activeFieldId) ?? null;

  if (activeField) {
    let fieldBlock = formatFieldContextBlock(activeField);
    const stage = estimateGrowthStage(activeField.crop_type, plantedAt);
    if (stage) fieldBlock += ` | Growth stage: ${stage}`;
    sections.push(`ACTIVE FIELD:\n${fieldBlock}`);

    if (Array.isArray(activeField.recent_diagnoses) && activeField.recent_diagnoses.length > 0) {
      sections.push(`RECENT DIAGNOSES:\n- ${activeField.recent_diagnoses.join('\n- ')}`);
    }
  } else {
    sections.push(fallbackFieldContext || 'Selected field context could not be loaded.');
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

  // Gap 1: Rolling field memory log, last 5 AI exchanges for this field
  const snapshotsWithSummary = recentSnapshots.filter((s) => s.summary);
  if (snapshotsWithSummary.length > 0) {
    const logLines = snapshotsWithSummary.map((s) => {
      const date = s.created_at.split('T')[0];
      return `- ${date}: ${s.summary}`;
    });
    sections.push(`FIELD MEMORY LOG (last ${snapshotsWithSummary.length} exchanges):\n${logLines.join('\n')}`);
  }

  // Gap 2: Same-crop cross-field context, show what happened on sibling fields
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
        `SAME CROP (${activeField.crop_type}), OTHER FIELDS:\n${lines.join('\n')}\n` +
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
  growerId: string | null = null,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      user_id: appUserId,
      field_id: fieldId,
      grower_id: growerId,
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
  refundMessageCount = false,
  requestTimestamp?: string,
) {
  if (refundMessageCount) {
    const { error: refundError } = await supabaseAdmin.rpc('refund_message_count', {
      p_user_id: appUserId,
      p_now: requestTimestamp ?? new Date().toISOString(),
    });

    if (refundError) {
      console.error('Failed to refund message count:', refundError);
    }
  }

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
    // No auto-field creation, users must create fields manually.
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

// ── Guest mode rate limiting (DB-backed, survives isolate restarts) ──
const GUEST_RATE_LIMIT = 1;  // max requests per window
const GUEST_RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour window

async function checkGuestRateLimit(ip: string, serviceRoleKey: string, supabaseUrl: string): Promise<boolean> {
  if (ip === 'unknown') return true; // can't rate-limit unknown IPs
  try {
    const db = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();
    const { data: rl } = await db
      .from('guest_rate_limits')
      .select('count, reset_at')
      .eq('ip', ip)
      .maybeSingle();

    if (rl && new Date(rl.reset_at) > now) {
      if (rl.count >= GUEST_RATE_LIMIT) return false;
      await db.from('guest_rate_limits').update({ count: rl.count + 1 }).eq('ip', ip);
    } else {
      // New window: upsert a fresh counter
      await db.from('guest_rate_limits').upsert(
        { ip, count: 1, reset_at: new Date(now.getTime() + GUEST_RATE_WINDOW_MS).toISOString() },
        { onConflict: 'ip' },
      );
    }
    return true;
  } catch {
    // If DB is unreachable, fail open (don't block legitimate users)
    return true;
  }
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

  const guestLang = body.lang || 'en';
  const guestHasActualImages = validAttachments.some(a => a.mimeType.startsWith('image/'));
  const guestIntent = classifyIntent(sanitized, guestHasActualImages);
  const systemPrompt = buildSystemPrompt('No field data or treatment history on record yet.', '', guestLang, guestIntent, 0);
  const guestMessages: ChatMessageInput[] = [{
    role: 'user',
    content: sanitized,
    attachments: validAttachments.length > 0 ? validAttachments : undefined,
  }];

  try {
    const { json: aiResponse } = await callGemini(geminiApiKey, guestMessages, systemPrompt);
    const assistantText = cleanAssistantText(aiResponse.response_text);
    const metadata = buildAssistantMetadata(aiResponse);
    return jsonResponse({ assistantText, metadata });
  } catch (err) {
    console.error('Guest chat error:', err);
    return jsonResponse(
      { error: 'Oli is having trouble connecting right now. Please try again in a moment.' },
      502,
    );
  }
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
      const allowed = await checkGuestRateLimit(clientIp, supabaseServiceRoleKey, supabaseUrl);
      if (!allowed) {
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
      .select('id, name, location, location_lat, location_lon, language, primary_crop, tier, message_count_month, message_reset_date, area_unit')
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

      // I3: Skip Gemini extraction for single-field users, no disambiguation needed.
      // If the user has exactly 1 field, auto-set it without an API call.
      const { data: userFields } = await supabaseAdmin
        .from('fields')
        .select('id, name')
        .eq('user_id', appUser.id)
        .limit(2);

      if (Array.isArray(userFields) && userFields.length === 1) {
        const onlyField = userFields[0];
        const result = await applyExtractedFieldContext(supabaseAdmin, appUser.id, body.messageId ?? null, {
          crop_type: null,
          field_mention: onlyField.name,
          confidence: 1.0,
          problem: null,
          location_hint: null,
          intervention_hint: null,
        });
        return jsonResponse(result);
      }

      // Zero fields, nothing to extract into
      if (Array.isArray(userFields) && userFields.length === 0) {
        return jsonResponse({ action: 'none', fieldId: null });
      }

      // 2+ fields, run full Gemini extraction
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
      const cachedGreeting = typeof appUser.last_greeting === 'string' ? appUser.last_greeting.trim() : '';

      if (cachedGreeting && isGreetingCacheFresh(appUser.last_greeting_at ?? null, now)) {
        console.info('[chat:greeting] cache_hit');
        return jsonResponse({ greeting: cachedGreeting, cached: true });
      }

      // Fetch the most recent pending follow-up and memory snapshot for continuity
      const [pendingFollowUpResult, recentSnapshotResult] = await Promise.all([
        supabaseAdmin
          .from('interventions')
          .select('diagnosis, problem, product_applied, follow_up_at, crop_type')
          .eq('user_id', appUser.id)
          .is('outcome', null)
          .not('follow_up_at', 'is', null)
          .lte('follow_up_at', now.toISOString())
          .order('follow_up_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('memory_snapshots')
          .select('summary, created_at')
          .eq('user_id', appUser.id)
          .not('summary', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const pendingFollowUp = pendingFollowUpResult.data;
      const recentSnapshot = recentSnapshotResult.data;

      // Build memory context lines for the greeting prompt
      const memoryLines: string[] = [];
      if (pendingFollowUp) {
        const issue = pendingFollowUp.diagnosis || pendingFollowUp.problem || 'a recent crop issue';
        const product = pendingFollowUp.product_applied ? ` (treated with ${pendingFollowUp.product_applied})` : '';
        memoryLines.push(`PENDING FOLLOW-UP: Farmer has an unresolved issue, "${issue}"${product}, follow-up was due. Ask how it's going.`);
      } else if (recentSnapshot?.summary) {
        const daysAgo = Math.floor((now.getTime() - new Date(recentSnapshot.created_at).getTime()) / 86400000);
        const when = daysAgo === 0 ? 'earlier today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
        memoryLines.push(`RECENT CONVERSATION (${when}): ${recentSnapshot.summary}`);
      }

      const memoryContext = memoryLines.length > 0
        ? `\nMemory context (USE THIS to make greeting personal):\n${memoryLines.join('\n')}\n`
        : '';

      const greetingPrompt = `You are Oli, an expert AI agronomist.

Generate a single short greeting message (1-2 sentences max) for a farmer.
Farmer profile:
- Name: ${name || 'farmer'}
- Crop(s): ${crop}
- Location: ${location || 'their region'}
- Current month: ${month}
- Time of day: ${timeOfDay}
- Language preference: ${userLang === 'el' ? 'Greek' : 'English'}
${memoryContext}
Rules:
1. PRIORITY: If memory context contains a PENDING FOLLOW-UP or RECENT CONVERSATION, reference it directly and warmly, ask how the situation is progressing. This makes the farmer feel remembered and cared for. A real agronomist always follows up.
2. If no memory context: be specific to their crop and this month, mention a real seasonal concern or task relevant to ${month}.
3. NEVER invent problems that don't apply to their crop.
4. Keep it to 1-2 sentences, conversational, no bullet points.
5. Respond in the language preference specified above.
6. ALWAYS start with the farmer's first name, ${name || 'friend'}. Example openings: "${name || 'friend'}, ..." or "Γεια σου ${name || ''}!", make it feel personal.
7. End with an implicit or explicit invitation to share an update or ask a question.

Return ONLY the greeting text, nothing else.`;

      const payload = {
        systemInstruction: { parts: [{ text: 'You are Oli, an AI agronomist.' }] },
        contents: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
      };

      const greetingRes = await fetchGeminiGenerateContent(geminiApiKey, GEMINI_MODEL, payload);

      if (!greetingRes.ok) {
        console.warn(`[chat:greeting] gemini_failed status=${greetingRes.status}`);
        return jsonResponse({
          greeting: cachedGreeting || buildFallbackGreeting(name, userLang, crop, month),
          cached: Boolean(cachedGreeting),
          fallback: true,
        });
      }

      const greetingData = await greetingRes.json();
      const greetingText = greetingData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      const finalGreeting = greetingText || cachedGreeting || buildFallbackGreeting(name, userLang, crop, month);

      await supabaseAdmin
        .from('users')
        .update({
          last_greeting: finalGreeting,
          last_greeting_at: now.toISOString(),
        })
        .eq('id', appUser.id);

      return jsonResponse({ greeting: finalGreeting, cached: false });
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

    // Advisor → grower ownership check
    let effectiveGrowerId: string | null = body.growerId ?? null;
    if (effectiveGrowerId) {
      const { data: growerRecord, error: growerError } = await supabaseAdmin
        .from('growers')
        .select('id')
        .eq('id', effectiveGrowerId)
        .eq('advisor_id', appUser.id)
        .maybeSingle();

      if (growerError || !growerRecord) {
        // Don't 403, just drop the link silently. Non-advisors won't have access.
        effectiveGrowerId = null;
      }
    }

    let effectiveConversationId = ownedConversation?.id ?? body.conversationId ?? null;
    let effectiveFieldId: string | null = body.fieldId ?? ownedConversation?.field_id ?? null;
    let fieldResolutionSource = body.fieldId
      ? 'request'
      : ownedConversation?.field_id
        ? 'conversation'
        : 'none';

    let userMessageId: string | null = null;
    let conversationCreatedByFunction = false;
    let serverContext: Awaited<ReturnType<typeof assembleServerFieldContext>>;
    let aiResponse: AiResponseJson;
    let assistantText = '';
    let assistantMetadata: Record<string, unknown> = {};
    let nextMessageCount: number;
    let shouldRefundMessageCount = false;

    // For pro users skip the limit. For free users the limit check AND increment
    // happen atomically inside the SQL function (FOR UPDATE lock) so two
    // concurrent requests can never both slip past the quota.
    if (!UNLIMITED_TIERS.has(appUser.tier ?? 'free')) {
      const { data: countResult } = await supabaseAdmin.rpc('increment_message_count', {
        p_user_id: appUser.id,
        p_now: now.toISOString(),
        p_limit: FREE_LIMIT,
      });
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
      const { data: countResult } = await supabaseAdmin.rpc('increment_message_count', {
        p_user_id: appUser.id,
        p_now: now.toISOString(),
        p_limit: 999999,
      });
      nextMessageCount = typeof countResult === 'number' ? countResult : currentCount + 1;
    }
    shouldRefundMessageCount = true;

    const fields = effectiveFieldId ? await fetchFieldContextRows(supabaseAdmin, appUser.id) : [];

    // Seasonal context injection, lets Gemini give month-relevant advice
    const tz = body.timezone || 'UTC';
    const nowLocale = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: tz }).format(now);
    const monthNum = new Date(now.toLocaleString('en-US', { timeZone: tz })).getMonth() + 1;
    const hemisphere =
      appUser.location
        ? /(south africa|australia|new zealand|argentina|chile|brazil|peru|namibia|zimbabwe|mozambique)/i.test(
            appUser.location,
          )
          ? 'southern'
          : 'northern'
        : 'northern';
    const season =
      hemisphere === 'northern'
        ? monthNum >= 3 && monthNum <= 5
          ? 'spring'
          : monthNum >= 6 && monthNum <= 8
            ? 'summer'
            : monthNum >= 9 && monthNum <= 11
              ? 'autumn'
              : 'winter'
        : monthNum >= 3 && monthNum <= 5
          ? 'autumn'
          : monthNum >= 6 && monthNum <= 8
            ? 'winter'
            : monthNum >= 9 && monthNum <= 11
              ? 'spring'
              : 'summer';

    const userLang = appUser.language || body.lang || 'en';

    // Fetch real-time weather if user has GPS coordinates stored
    const userLat = typeof appUser.location_lat === 'number' ? appUser.location_lat : null;
    const userLon = typeof appUser.location_lon === 'number' ? appUser.location_lon : null;
    const weatherSnapshot = (userLat !== null && userLon !== null)
      ? await fetchCurrentWeather(userLat, userLon)
      : null;

    const growerContext = [
      appUser.name ? `Grower name: ${appUser.name}` : '',
      appUser.location ? `Location: ${appUser.location}` : '',
      appUser.primary_crop ? `Primary crop(s): ${appUser.primary_crop}` : '',
      `Current month: ${nowLocale} (${season}, ${hemisphere} hemisphere)`,
      `Language preference: ${userLang}`,
      weatherSnapshot ? formatWeatherContext(weatherSnapshot) : '',
    ].filter(Boolean).join('\n');

    try {
      if (!effectiveConversationId) {
        const createdConversationId = await createConversation(
          supabaseAdmin,
          appUser.id,
          effectiveFieldId,
          latestUserMessage.content,
          effectiveGrowerId,
        );

        if (!createdConversationId) {
          await cleanupFailedChatAttempt(
            supabaseAdmin,
            appUser.id,
            null,
            null,
            false,
            shouldRefundMessageCount,
            now.toISOString(),
          );
          shouldRefundMessageCount = false;
          return jsonResponse({ error: 'Failed to create conversation' }, 500);
        }

        effectiveConversationId = createdConversationId;
        conversationCreatedByFunction = true;
      }

      if (!effectiveConversationId) {
        await cleanupFailedChatAttempt(
          supabaseAdmin,
          appUser.id,
          null,
          null,
          false,
          shouldRefundMessageCount,
          now.toISOString(),
        );
        shouldRefundMessageCount = false;
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
            shouldRefundMessageCount,
            now.toISOString(),
          );
          shouldRefundMessageCount = false;
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
            shouldRefundMessageCount,
            now.toISOString(),
          );
          shouldRefundMessageCount = false;
          return jsonResponse({ error: 'Failed to save your message' }, 500);
        }

        userMessageId = insertedUserMessage.id;
      }

      const userMessageMetadata: Record<string, unknown> = {
        field_context_source: 'backend',
        field_resolution_source: fieldResolutionSource,
      };

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

      // hasActualImages: only true for image/* mime types, not PDFs or audio.
      // PDFs/audio force diagnosis intent and would misdirect the five-pillar framework.
      const hasActualImages = requestMessages.some(m =>
        Array.isArray(m.attachments) && m.attachments.some(a => a.mimeType.startsWith('image/'))
      );
      const queryIntent = classifyIntent(latestUserMessage.content, hasActualImages);
      const convDepth = requestMessages.filter(m => m.role !== 'assistant').length;

      // Image pre-extraction: run a focused Gemini call on actual image attachments only.
      // PDFs are already processed as text; audio has no visual to extract from.
      let imageContext = '';
      if (hasActualImages) {
        const imageAttachments = requestMessages
          .flatMap(m => Array.isArray(m.attachments) ? m.attachments : [])
          .filter(a => a.mimeType.startsWith('image/'))
          .slice(-3); // max 3 images
        if (imageAttachments.length > 0) {
          imageContext = await extractImageContext(geminiApiKey, imageAttachments);
        }
      }

      const genResult = await generateValidatedResponse(
        geminiApiKey,
        requestMessages,
        serverContext.fieldContext + imageContext,
        serverContext.hasActiveField,
        growerContext,
        userLang,
        queryIntent,
        convDepth,
        appUser.area_unit || (userLang === 'el' ? 'stremma' : 'ha'),
        appUser.location || '',
      );
      aiResponse = genResult.json;
      assistantText = aiResponse.response_text;
      assistantMetadata = buildAssistantMetadata(aiResponse);

      // M1: Fire-and-forget AI cost log, never await, never block the response
      logAiCost(
        supabaseAdmin,
        appUser.id,
        effectiveConversationId ?? null,
        genResult.promptTokens,
        genResult.outputTokens,
        genResult.totalTokens,
        'chat',
      ).catch((e) => console.error('[logAiCost]', e));

      if (!assistantText) {
        await cleanupFailedChatAttempt(
          supabaseAdmin,
          appUser.id,
          userMessageId,
          effectiveConversationId,
          conversationCreatedByFunction,
          shouldRefundMessageCount,
          now.toISOString(),
        );
        shouldRefundMessageCount = false;
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
        shouldRefundMessageCount,
        now.toISOString(),
      );
      shouldRefundMessageCount = false;
      // Q1: Quota errors get a 503 + user-friendly message instead of a generic 500.
      // The frontend can detect 503 and show "AI is busy, try again in a moment."
      if (error instanceof GeminiQuotaError) {
        return jsonResponse(
          { error: 'AI service is temporarily at capacity. Please try again in a few minutes.' },
          503,
        );
      }
      return jsonResponse({ error: 'Failed to process your message' }, 500);
    }

    if (!userMessageId) {
      return jsonResponse({ error: 'Failed to save your message' }, 500);
    }

    const encoder = new TextEncoder();
    const chunks = splitIntoChunks(assistantText);
    let finalFieldId = effectiveFieldId;
    let finalFieldName = serverContext.activeFieldName;

    const finalAssistantMetadata = {
      ...(assistantMetadata ?? {}),
      field_context_source: 'backend',
      field_resolution_source: fieldResolutionSource,
      ...(finalFieldId ? { resolved_field_id: finalFieldId } : {}),
      ...(finalFieldName ? { resolved_field_name: finalFieldName } : {}),
    };

    const stream = new ReadableStream({
      async start(controller) {
        // S3: Guard against client disconnect mid-stream.
        // If the consumer cancels (navigates away, timeout, network drop), the controller
        // enters a closed/errored state. Any subsequent enqueue() or close() call throws
        // "The stream controller cannot close or enqueue". Wrapping here prevents that
        // secondary throw from polluting the error logs with a misleading TypeError.
        const sendEvent = (event: string, payload: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch {
            // Client already disconnected, safe to ignore.
          }
        };
        const closeController = () => {
          try { controller.close(); } catch { /* already closed */ }
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

          try {
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
          } catch (postSaveError) {
            console.error('chat function post-save tasks failed', postSaveError);
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
          closeController();
        } catch (error) {
          console.error('chat function stream error', error);
          if (shouldRefundMessageCount) {
            await cleanupFailedChatAttempt(
              supabaseAdmin,
              appUser.id,
              userMessageId,
              effectiveConversationId,
              conversationCreatedByFunction,
              true,
              now.toISOString(),
            );
            shouldRefundMessageCount = false;
          }
          // H2: Don't leak internal error details to client
          sendEvent('error', {
            message: 'An error occurred while processing your request',
          });
          closeController();
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
    // H2: Sanitized error message, never leak internal details
    return jsonResponse(
      {
        error: safeErrorMessage(error),
      },
      500,
    );
  }
});
