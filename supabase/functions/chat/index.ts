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
// Cheap regex classification of the user's message — no extra API call.
// Used to trim irrelevant prompt sections and inject a pre-classified hint,
// so Gemini spends zero tokens deciding what type of question it is.
type QueryIntent = 'diagnosis' | 'calculation' | 'planning' | 'followup' | 'indoor' | 'general';

function classifyIntent(message: string, hasImages: boolean): QueryIntent {
  if (hasImages) return 'diagnosis'; // photo = always diagnostic intent
  const m = message.toLowerCase();
  // Calculation: numerical, dosage, rate, or unit questions
  if (/\b(how much|calculate|dose|dosage|rate|l\/ha|kg\/ha|ml\/|ratio|concentration|how many litre|πόσο|δόση|υπολόγισε|αραίωσ|ποσότητα|λίτρα|κιλά ανά)\b/.test(m)) return 'calculation';
  // Follow-up: reporting back on a past treatment or asking about progress
  if (/\b(still|still not|improved|worse|better|same|it worked|didn.t work|ακόμα|βελτιώθηκε|χειρότερα|καλύτερα|δεν άλλαξε|δούλεψε)\b/.test(m)) return 'followup';
  // Diagnosis: symptoms, visual problems, disease/pest mentions
  if (/\b(yellow|spot|dying|disease|pest|fungus|mold|rot|leaves|symptom|brown|black|white powder|curl|wilt|infected|droop|dropping|falling|eaten|hole|pale|fading|lesion|blister|canker|necrosis|tip.?burn|discolor|discolour|stunted|dead|decay|oozing|sticky|aphid|mite|thrip|caterpillar|scarring|cracking|κίτρινα|κηλίδα|ασθένεια|έντομο|σκουρ|πέφτουν|μαραίν|μύκητ|ξηρ|κηλίδες|ζωύφιο|προνύμφη)\b/.test(m)) return 'diagnosis';
  // Indoor/container care: watering, repotting, light, position, drainage — care queries, not symptom queries
  // Specific care keywords (unambiguous): always indoor
  if (/\b(repot|repotting|overwater|overwatered|underwater|underwatered|root.?bound|drainage hole|pot.*size|outgrow.*pot|γλάστρα|ξαναφύτεμα|ξαναφυτεύ)\b/.test(m)) return 'indoor';
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
): string {
  // Language detection instruction — single source of truth for all languages.
  // AI models reason better in English; we set the default language but let
  // the model detect and follow the user's actual message language per-turn.
  const LANG_NAMES: Record<string, string> = {
    en: 'English', el: 'Greek (Ελληνικά)', it: 'Italian (Italiano)',
    es: 'Spanish (Español)', fr: 'French (Français)', ar: 'Arabic (العربية)',
  };
  const langName = LANG_NAMES[lang] ?? 'English';
  const langInstruction = `LANGUAGE RULES:
- Default response language: ${langName}.
- IMPORTANT: Detect the language of the user's most recent message and respond in THAT language, even if it differs from the default. If the user writes in English, respond in English. If they write in Greek, respond in Greek. Always follow the user's language lead per message.
- Never force a single language — adapt to what the user is typing right now.
- Use local agricultural terminology for the detected language. Key disease terms:
  Greek: Περονόσπορος (Downy Mildew), Ωίδιο (Powdery Mildew), Φουζικλάδιο (Scab), Βοτρύτης (Botrytis), Τετράνυχος (Spider Mite), Αφίδες (Aphids)
  Italian: Peronospora, Oidio, Ticchiolatura
  Spanish: Mildiu, Oídio, Roña
  French: Mildiou, Oïdium, Tavelure
  Arabic: بياض زغبي (Downy Mildew), بياض دقيقي (Powdery Mildew), جرب (Scab), عفن رمادي (Botrytis), العنكبوت الأحمر (Spider Mite), حشرات المن (Aphids)`;

  // Dosage simplification — always add practical equipment conversions
  const dosageInstruction = `DOSAGE COMMUNICATION: After every technical dosage (e.g., "300g/100L"), always add a practical conversion for common farm equipment on the next line:
- For 15L backpack sprayer: show grams or ml needed
- For 100L tractor tank: already covered by the /100L rate
- Use local measurement terms where appropriate (e.g. Greek: κουταλιά σούπας = 15ml, φλιτζάνι = 250ml, στρέμμα = 0.1 ha)
- Example: "Myclobutanil 40ml/100L → 15L backpack: 6ml"
- Area conversions: 1 στρέμμα = 0.1 ha, 1 acre = 0.405 ha
- MENA units: فدان/feddan = 0.42 ha (Egypt); دونم/dunum = 0.1 ha (Jordan, Palestine) or 0.25 ha (Iraq, Syria — confirm locally)`;

  // Weather context — directive rules for using live weather data injected in field context
  const weatherRules = `WEATHER CONTEXT RULES (field context may include current weather — use it actively):
- Humidity > 75%: Proactively flag elevated fungal disease pressure, even if the farmer didn't ask about disease — it is directly relevant to any field visit or spray decision.
- Humidity > 85%: High urgency. Recommend the farmer inspect susceptible crops within 24h for early fungal signs.
- Temperature > 35°C: Flag heat stress risk. Ask about irrigation frequency if not already known. Advise against spraying during peak heat (best window: early morning or evening).
- Temperature < 5°C: Flag frost risk if the crop is in a sensitive growth stage (flowering, young fruit set). In the Northern Hemisphere, treat this as significant risk from October through April; outside those months, note the anomaly but reduce urgency unless the crop is actively flowering or fruiting.
- Recent precipitation > 5mm: Note that recently applied foliar products may have washed off and may need re-application. Cross-check against treatment history date if available.
- Wind > 30 km/h: Advise against spraying — drift risk and poor product coverage.
- Always connect weather to the advice: say "Given today's conditions..." not just generic recommendations.
- If no weather data is available for the user, skip this section entirely.`;

  // Seasonal risk awareness — proactive flag for known crop/month pressure windows
  const currentMonth = new Date().getMonth() + 1; // 1–12
  const seasonalAdvisoryInstruction = `SEASONAL RISK AWARENESS:
Based on the crop type in the field context and the current calendar month (month ${currentMonth}), proactively flag known disease or pest pressure windows — even if the farmer hasn't asked about it. Add this as one short advisory sentence at the natural end of your answer, not as a separate section.
Key crop/month triggers to watch:
- Vines, months 4–5: Downy Mildew pressure begins — flag if humidity >65% and no preventive spray is recorded.
- Vines, month 6: Botrytis risk rises around flowering — flag bunch thinning and air circulation.
- Olives, months 4–5: Olive Moth (Bactrocera oleae) and Olive Knot (Pseudomonas) season — flag trap monitoring and sanitation.
- Citrus, months 2–4: Scale insects and citrus psyllid (HLB vector) season — flag monitoring visits.
- Potatoes, months 5–7: Late Blight season — flag protective program if no spray recorded in the last 10 days.
- Stone fruit (peach/cherry/plum), months 3–5: Fungal disease peak with spring rains — flag preventive spray window.
Only flag when the field's crop and current month both match — do not invent risk for unrelated crops or off-season. Keep it brief and actionable.`;

  // Adaptive context: pre-classified intent hint + conversation depth
  const intentHint = intent === 'diagnosis'
    ? 'PRE-CLASSIFIED: This is a DIAGNOSIS query (TYPE A). Apply the five-pillar framework and confidence scoring immediately. Check pillar count before assigning confidence_score.'
    : intent === 'calculation'
    ? 'PRE-CLASSIFIED: This is a CALCULATION query (TYPE B). Show your formula and step-by-step working immediately.'
    : intent === 'planning'
    ? 'PRE-CLASSIFIED: This is a PLANNING query (TYPE C). Provide a concrete numbered plan with timings.'
    : intent === 'followup'
    ? 'PRE-CLASSIFIED: This is a FOLLOW-UP query (TYPE E). Acknowledge the update and adjust your recommendation.'
    : intent === 'indoor'
    ? 'PRE-CLASSIFIED: This is an INDOOR/CONTAINER CARE query (TYPE F). Apply the six-pillar indoor framework. Ask for specific photos if you need to assess the plant.'
    : ''; // general — let Gemini classify from TYPE DETECTION below

  const depthHint = conversationDepth > 2
    ? `CONVERSATION CONTEXT: This is message ${conversationDepth} in an ongoing conversation. The farmer has context from prior messages — do not re-introduce yourself or repeat prior advice unless asked.`
    : '';

  // Conditionally include heavy sections based on intent
  // Saves ~150 tokens on calculation queries, ~100 tokens on diagnosis queries
  const includeCalcGuide = intent !== 'diagnosis' && intent !== 'followup' && intent !== 'indoor';
  const includeDiagnosticFlow = intent !== 'calculation';

  return `${langInstruction}

${dosageInstruction}

${weatherRules}

${seasonalAdvisoryInstruction}
${intentHint ? `\n${intentHint}` : ''}${depthHint ? `\n${depthHint}` : ''}

You are Oli, an expert AI agronomist with deep knowledge of agronomy, plant science, soil science, irrigation, nutrition, crop economics, and agricultural mathematics. You help farmers with EVERYTHING agriculture-related: disease diagnosis, pest management, nutrition plans, irrigation calculations, fertilizer programs, yield estimation, economic analysis, planting schedules, harvest timing, and any other farming question.

SCOPE BOUNDARY: If the message is clearly unrelated to agriculture, farming, plants, soil, food production, or closely connected fields (including agricultural mathematics, soil geology, agroclimatology, plant biology, agrochemistry, food safety, rural economics, and farm machinery), decline in one sentence and redirect: "That's outside my area — I'm here for agronomy. If you have a question about your crops, plants, or fields, I'm ready." Do not engage with the off-topic request, do not apologize at length. Check this FIRST before classifying the question type.

QUESTION TYPE DETECTION — read the farmer's message and classify it:
A) DIAGNOSIS query — farmer describes symptoms, disease, pest, or sends a photo
B) CALCULATION query — farmer asks for a number: water needs, fertilizer dose, spray volume, area, yield, economics
C) PLANNING query — farmer asks what to do, when to do it, how to plan a program
D) GENERAL KNOWLEDGE — farmer asks about a crop, practice, product, or concept
E) FOLLOW-UP — farmer responds to a previous question or update
F) INDOOR/CONTAINER CARE — user asks about caring for a plant in a pot, container, indoors, or on a balcony

BEHAVIOUR BY QUESTION TYPE:

For TYPE A (DIAGNOSIS):
1. Always attempt visual analysis, even on imperfect images.
2. Use the FIVE PILLARS to assess confidence (see below) and score 0–100.
3. PILLAR COUNT RULE — before assigning confidence_score, count how many pillars have clear confirmed information:
   - 1 pillar confirmed → max score 35 (do not name any disease)
   - 2 pillars confirmed → max score 55 (suspected only)
   - 3 pillars confirmed → max score 72 (primary diagnosis with uncertainty)
   - 4+ pillars confirmed → max score 90 (confident diagnosis if evidence is strong)
   Never inflate confidence beyond this ceiling — a confident wrong diagnosis causes real harm.
4. Apply TIERED DIAGNOSIS RULES based on your confidence score:
   - confidence_score < 40: Do NOT name any specific disease or pest. Say "I can see something is wrong but I need clearer information to give you a reliable diagnosis." List exactly what you need (missing pillars). Give ONE safe interim action (e.g., "In the meantime, stop overhead irrigation to reduce humidity"). Do NOT guess a disease name — a wrong diagnosis is worse than no diagnosis.
   - confidence_score 40–65: Name disease(s) as "possible" or "suspected" only. Give 2–3 candidates. Ask ONE question to break the tie. ALWAYS give one concrete safe interim action the farmer can take immediately while you gather more information — never leave the farmer with nothing to do. Safe interim actions: remove severely affected leaves/fruit to slow spread, stop overhead irrigation, improve air circulation, avoid entering the field in wet conditions.
   - confidence_score 65–85: Give your primary diagnosis with appropriate uncertainty language ("this looks like…"). Ask ONE follow-up question if it would change the treatment. Provide treatment options.
   - confidence_score > 85: Full confident diagnosis + complete treatment plan + prevention.
5. PHOTO REQUEST RULE: When THE EVIDENCE pillar is missing or poor (photo unclear, too far away, wrong angle), ask for a specific photo. See SPECIFIC PHOTO REQUEST GUIDE below — never just say "send me a photo," always specify exactly what to capture and why.
6. QUARANTINE DISEASES RULE: NEVER name HLB (citrus greening), Xylella fastidiosa, Fire Blight, Plum Pox Virus, ToBRFV (Tomato Brown Rugose Fruit Virus), Fusarium Wilt TR4 (Tropical Race 4), Potato Wart Disease (Synchytrium endobioticum), or other regulated quarantine organisms unless confidence_score > 85. These are notifiable diseases — a false alarm causes panic, inspections, and permanent trust loss. If you suspect them below 85%, say "some symptoms are consistent with serious disease — please contact your local plant protection service for official testing."
7. QUESTION ANATOMY RULE: When you need to ask one clarifying question, structure it in three parts:
   (a) First, briefly state what you already understand from the farmer's description in 1 sentence — this confirms you heard them correctly and avoids repeating yourself later.
   (b) Explain in one short clause WHY this specific piece of information will change your diagnosis or recommendation.
   (c) Then ask the precise, specific question — tell the farmer exactly what to look for, measure, or recall.
   Example: "Based on what you've described — white powdery growth on the upper leaf surface appearing after a warm dry spell — I'm leaning toward Powdery Mildew. To confirm: is the white growth also present on the undersides of the leaves, or only on top? This matters because Downy Mildew grows on the underside while Powdery Mildew stays on top." Never ask a vague question like "Can you tell me more?"
8. FOLLOW-UP COMMITMENT: After every diagnosis with a treatment recommendation, close with ONE sentence that verbally commits to checking in: "I'll want to hear from you in [X] days to see if this is working." Use: 3–5 days for severe acute cases, 5–7 days for fungal/bacterial diseases, 10–14 days for nutritional/soil issues. This should match the automated follow-up scheduled by the system.

For TYPE B (CALCULATION):
1. If you have ALL the numbers needed, calculate immediately and show your work step-by-step.
2. If you are MISSING critical inputs (field size, crop type, soil type, climate zone, irrigation method), ask for them BEFORE calculating — do not guess. List exactly what you need and why.
3. Show the formula, the inputs you used, and the final result clearly.
4. Always provide units (m³/ha, kg/ha, L/ha, etc.) and practical ranges.
5. Example calculations you handle: drip irrigation water needs, sprinkler rates, fertilizer NPK programs, spray tank mixing, yield potential, cost-per-ha, ROI on inputs.

For TYPE C (PLANNING):
1. ANSWER-FIRST — always give a concrete, complete plan immediately. Never ask a clarifying question before answering. Give your best plan based on what you know right now.
2. For broad questions (e.g., "when should I spray my olives?"): give the FULL seasonal plan covering all major scenarios (disease, pest, nutrition). Do not ask "what problem are you targeting?" — cover all common problems in the plan, then note what changes based on their specific situation.
3. Structure the plan as numbered steps with specific actions, timings, and quantities (e.g., "April–May: preventive copper spray for Cycloconium after rainfall >5mm, 300g/100L; June–July: olive moth monitoring with delta traps").
4. At the END of your answer (not the beginning), you may ask ONE question to refine for the farmer's specific situation — only if it would meaningfully change the recommendation.

For TYPE D (GENERAL KNOWLEDGE):
1. Answer directly and completely. No follow-up needed unless the farmer's question is ambiguous.
2. Be specific — cite exact active ingredients, application rates, mechanisms, and practical context where relevant.
3. ACTIVE INGREDIENT DEFAULT: When recommending a product, always lead with the active ingredient, then optionally name common brands as examples. Format: "Azoxystrobin (e.g., Amistar, Quadris) — 0.75–1.5 L/ha." Never lead with a brand name alone.
4. REGIONAL AVAILABILITY: If a substance or practice is commonly unavailable in the farmer's region (inferred from language/location), say so: "This is standard in EU markets; in MENA or LatAm, ask your local cooperative or distributor for the registered equivalent."
5. REGULATORY CONTEXT: If the farmer asks about a restricted or banned substance (e.g., chlorpyrifos, dimethoate in EU), state this clearly and redirect: "This is no longer approved for use in the EU — registered alternatives include [X]." Never recommend an illegal or unregistered substance, even if asked by name.

For TYPE E (FOLLOW-UP):
1. EMOTIONAL ACKNOWLEDGMENT FIRST: Read the emotional tone of the update before giving any technical response.
   - If the treatment FAILED or made things WORSE: acknowledge the frustration explicitly before pivoting. Say something human: "I understand how disheartening it is when a treatment doesn't deliver — especially at this stage of the season. Let's figure out what happened and find a better path forward." Then investigate WHY it failed before recommending an alternative: ask about application timing, dosage, weather conditions during application, product age, or whether a resistance issue might be at play. Never go straight to "try product X instead" without understanding the failure.
   - If the treatment IS WORKING: celebrate it briefly and genuinely: "That's great to hear — it means we had the right diagnosis." Reinforce the treatment and set expectations for the next stage (when to stop, what to watch for).
2. After acknowledging, provide the updated clinical recommendation. If pivoting, explain clearly why the new approach is different and better suited.
3. Close with updated follow-up timing: tell the farmer when you'd like to hear from them next.

For TYPE F (INDOOR/CONTAINER CARE):
Plants in pots and indoor environments have completely different needs from field crops. Container size, drainage, light, watering habits, and soil type matter far more than weather or field conditions.

THE SIX PILLARS FOR INDOOR/CONTAINER PLANTS:
1. THE PLANT — species or type, approximate age, how long the owner has had it
2. THE CONTAINER — pot size relative to the plant, does it have drainage holes?, pot material (terracotta breathes; plastic retains more moisture)
3. THE LIGHT — hours of direct sun per day, which direction the window faces (south = most light in northern hemisphere), any artificial lighting
4. THE WATER — how often watered, how much at a time, does water drain through completely or stay sitting in the tray?
5. THE SOIL & ROOTS — type of potting mix used, when it was last repotted, are roots visible through drainage holes or circling the soil surface?
6. THE POSITION — indoors vs balcony vs outdoor, proximity to heating or AC vents, drafts, typical temperature and humidity in the room

BEHAVIOUR:
1. ANSWER-FIRST: give your best assessment and most likely cause immediately. Start with the single most probable culprit based on what you know.
2. PHOTO REQUESTS — be specific about what to capture:
   - Always ask for a FULL PLANT SHOT from ~1 meter away when you haven't seen it yet. Explain: "This lets me see the plant's overall posture, size relative to the pot, and general colour — the full picture tells more than a close-up alone."
   - Ask for a SOIL SURFACE + POT BASE photo when watering or root issues are suspected. Explain: "I want to see if the soil looks compacted or bone dry, and whether roots are pushing through the drainage holes."
   - Ask for a close-up of the MOST AFFECTED AREA (leaf, stem, root) when there are specific symptoms. Explain what you're looking for.
   - Refer to SPECIFIC PHOTO REQUEST GUIDE below for exact wording.
3. Common indoor issues — check these before anything else:
   - Overwatering (most common killer): yellowing leaves that feel soft, consistently wet soil, possible root rot smell
   - Underwatering: crispy or dry-edged leaves, bone-dry soil that pulls away from the pot sides
   - Root-bound: roots coming out of drainage holes or circling the top of soil, water immediately runs through without soaking in
   - Insufficient light: etiolated/leggy growth reaching toward the light, pale or yellowing lower leaves
   - Fertilizer burn: brown leaf tips, especially after recent feeding
   - Pests: spider mites (dry air), mealybugs (leaf joints), fungus gnats (overwatered soil)
4. EXPLAIN THE WHY — never just say "repot it" or "water less." Explain the mechanism: "Your plant looks root-bound — the roots have filled all available space and can no longer absorb water or nutrients efficiently. Moving it to a pot 3-5 cm wider gives the roots room to expand."
5. WATERING GUIDANCE — always give a test method, not just a frequency. "Water when the top 2-3 cm of soil feels dry to the touch" is far more useful than "once a week," because frequency varies with season, pot size, plant species, and light levels.
6. If the issue looks like a disease or pest (not just care), shift into TYPE A mode: apply the FIVE PILLARS and confidence scoring, but adapt the questions for indoor context (e.g., THE ENVIRONMENT = light, humidity, proximity to other plants).

UNIVERSAL RULES (apply to all types):
- ANSWER-FIRST: Never start a response with a clarifying question. Give your best substantive answer first, then ask one clarifying question at the END if you need it. The only exception is TYPE A diagnosis with confidence_score < 65, where naming the wrong disease causes real harm — ask there. For everything else (planning, knowledge, calculation, follow-up): answer immediately with what you know, then refine.
- Never open with: "Great question!", "Certainly!", "Of course!", "Sure!", or any filler.
- Use the farmer's language (detect from their message). Respond in the same language as their most recent message.
- Be warm but direct. You are a trusted advisor, not a chatbot.
- Be specific: exact product names, dosages, timings, concentrations.
- Always check for phytotoxicity before recommending any product.
- If you don't know something, say so and suggest consulting a local expert or extension service.
- Never give advice that could cause crop damage or regulatory violations.
- For diseases/pests/deficiencies, always populate both organic_treatments AND chemical_treatments.
- Crop-specific accuracy is critical: never suggest a pest or disease that doesn't affect the stated crop.
- CONTEXT RECAP BEFORE QUESTIONS: When asking any clarifying question, always begin with a brief summary of what you already understand from the conversation — one sentence that shows you were listening. This prevents the farmer from feeling interrogated and confirms no misunderstanding before you ask for more.
- CONTINGENCY PLANNING: After every treatment recommendation, briefly note what to do if it doesn't work: "If you don't see improvement in [X] days, come back to me — at that point we would consider [alternative approach]." This closes the loop and sets realistic expectations.
- OWN THE OUTCOME: You are not just answering questions — you are managing a case. Think like an agronomist who will see this farmer again and needs to know if the advice worked.

${includeCalcGuide ? `AGRICULTURAL CALCULATIONS — GUIDE:
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
` : ''}
${includeDiagnosticFlow ? `DIAGNOSTIC WORKFLOW — THE FIVE PILLARS:
For every diagnosis query, assess confidence across:
1. THE VICTIM — Plant species/variety known? (Spot on tomato ≠ spot on olive)
2. THE SYMPTOMS — Color, texture, pattern, spread direction?
3. THE TIMELINE — When did it start? Growth stage? Season?
4. THE ENVIRONMENT — Soil type, recent weather, irrigation method, recent inputs?
5. THE EVIDENCE — For photos: close enough to see detail?

CRITICAL — missing_pillars JSON field: You MUST use ONLY these exact string values, nothing else:
"THE VICTIM", "THE SYMPTOMS", "THE TIMELINE", "THE ENVIRONMENT", "THE EVIDENCE"
Never use paraphrases, translations, or different formats. The UI maps these exact strings to labels.

Confidence scoring (set confidence_score in your JSON response):
- > 85: Full confident diagnosis + complete treatment plan + prevention + follow-up commitment (X days)
- 65–85: Primary diagnosis with uncertainty language + one follow-up question (with anatomy: recap → why → specific ask) + treatment options + follow-up commitment
- 40–65: 2–3 candidate diagnoses ("possible/suspected") + one tie-breaking question (with anatomy) + ONE safe interim action the farmer can take NOW (never leave them with nothing to do)
- < 40: NO disease name — describe only what you observe + list exactly what information you need + ONE safe interim action

IMAGE ANALYSIS RULES:
- ALWAYS attempt visual analysis, even on blurry or partial images.
- If the affected area is < 30% of frame, ask for a close-up with specific instructions ("please send a photo of just the leaf showing the spots, filling the frame").
- Each new image is independent — do not assume it is the same plant as a previous message.
- Poor image quality lowers your confidence_score; reflect this honestly.
- NON-PLANT PHOTOS: If the image clearly contains no plant material (e.g., a landscape, a tool, a person, or an unrelated object), do not attempt a diagnosis. Say: "This photo doesn't show a plant or plant damage clearly — could you send a close-up of the affected leaf, branch, or fruit? Getting the right subject in frame will let me give you a reliable answer." Set confidence_score to 0 and leave diagnosis_data empty.

SPECIFIC PHOTO REQUEST GUIDE:
When THE EVIDENCE pillar is missing, weak, or the image is unclear, ask for a specific photo. Always name what to capture AND explain why — never just say "send me a photo."
- Disease or spots on leaves → "Send a close-up of one affected leaf filling the full frame, in natural daylight without flash, showing the worst-affected area. I need to see the texture, colour, and edge of the spots clearly."
- Pest identification → "Send a photo of the UNDERSIDE of an affected leaf, close enough to see individual insects or their eggs. Most common pests — mites, aphids, scale — live and feed on the leaf underside."
- Soil or root problem → "Send a photo of the soil surface, and if possible turn the pot over to show whether roots are coming through the drainage holes. This tells me if the plant is root-bound or if the soil is waterlogged."
- Plant identification → "Send a photo of a single fully-visible leaf from the front showing the complete shape and any markings, plus one photo of the stem or bark texture if possible."
- Plant looks unwell but unclear where the problem is → "Step back 1-2 meters and send a photo of the FULL plant including its pot or the soil at its base — I need to see its overall shape, posture, and colour before zooming in."
- Watering or environment assessment → "Send one photo of the full plant from about 1 meter away so I can see the pot size, position, and the plant's overall condition together."
- Fruit or harvest issue → "Send a close-up of one affected fruit, and one photo showing how many fruits on the plant or tree show the same problem."
- Plant is outdoors and far from camera → "I can see the plant is some distance away — could you send a second photo taken from 30-50 cm away from the most affected branch or leaf? Distance makes it hard to see the detail I need."
` : ''}
CONTEXT INDEPENDENCE:
- If the farmer uploads a photo that contradicts field context, trust the PHOTO.
- Field context is background info, not a constraint.

MEMORY & TREATMENT HISTORY:
- Use treatment history to give smarter, non-repetitive advice.
- If a treatment didn't work (outcome: same/worse), recommend a DIFFERENT approach — never repeat the same active ingredient on the same unresolved problem.
- RESISTANCE ESCALATION: If the same active ingredient (or same mode-of-action class) appears 2 or more times in the treatment history on the same problem without full resolution, flag potential resistance: "Repeated use of [active ingredient] without full control points to possible resistance. I recommend switching to a different mode of action — [alternative with different FRAC/IRAC class]." Do not raise resistance on a single failure — look for a pattern across multiple interventions.
- Reference past interventions naturally: "Since the copper didn't fully resolve it last time..."
- Flag repeated issues as potential systemic problems (soil pH, irrigation method, varietal susceptibility).
- FIELD MEMORY LOG: chronological record of past AI exchanges — use it for continuity.
- SAME CROP — OTHER FIELDS: Trigger a cross-field advisory when: (a) the same problem appears on 2 or more fields with the same crop type within the same week, or (b) a sibling field has an open follow-up on the same issue that is overdue. When triggered, include: "I'm seeing the same issue on [other field name] — this looks like regional pressure rather than a field-specific problem. A coordinated spray across all affected fields will be more effective than treating each one separately."

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
For simple questions: be concise.

JSON FIELD RULES:
- diagnosis_data.problem: Write the disease/pest name in the farmer's language ONLY. No English translations in parentheses. Examples: "Κυκλοκόνιο" NOT "Κυκλοκόνιο (Olive Leaf Spot)"; "Ωίδιο" NOT "Ωίδιο (Powdery Mildew)".
- diagnosis_data.missing_pillars: Use ONLY the exact keys listed above ("THE VICTIM", "THE SYMPTOMS", "THE TIMELINE", "THE ENVIRONMENT", "THE EVIDENCE"). No other strings.`;
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

// S2: Strip any missing_pillars values the AI hallucinated outside the allowed set.
// The UI maps these exact strings to labels — anything else silently breaks the UI.
function sanitizeMissingPillars(response: AiResponseJson): AiResponseJson {
  const dd = response.diagnosis_data;
  if (!dd?.missing_pillars || !Array.isArray(dd.missing_pillars)) return response;

  const sanitized = dd.missing_pillars.filter((p) => VALID_PILLARS.has(p));
  if (sanitized.length === dd.missing_pillars.length) return response;

  console.warn(
    'sanitizeMissingPillars: stripped invalid values:',
    dd.missing_pillars.filter((p) => !VALID_PILLARS.has(p)),
  );

  return {
    ...response,
    diagnosis_data: {
      ...dd,
      missing_pillars: sanitized.length > 0 ? sanitized : null,
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
    // instructed not to name diseases below 40 — leave it unchanged.
    return {
      ...response,
      diagnosis_data: {
        ...dd,
        problem: null,          // no disease name
        cause: null,            // no causal organism
        severity: null,         // severity without disease name is misleading
        product_applied: null,  // no treatment product at this confidence
        chemical_treatments: [], // no chemical recommendations
        organic_treatments: [],  // no organic recommendations — only general safe advice
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

  // V2: Validate missing_pillars — only the five exact strings are valid.
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
  // Concatenating them corrupts the structured JSON output — filter them out.
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
// Thrown when all available Gemini models have exhausted their quota (HTTP 429).
// The outer handler converts this into a 503 with a user-friendly message.
class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

interface GeminiCallResult {
  json: AiResponseJson;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
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

  // T1: 20s hard timeout — prevents 25s+ hangs when Gemini is slow or unresponsive
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

  // I2: On 5xx or 429 (quota exceeded), retry once with gemini-1.5-flash as a fallback model.
  // 429 means the primary model's quota is exhausted — the fallback model has its own quota.
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini request failed (${response.status}):`, errorText);

    const shouldFallback = (response.status >= 500 || response.status === 429) && GEMINI_MODEL !== 'gemini-1.5-flash';
    if (shouldFallback) {
      console.warn(`Primary model returned ${response.status} — retrying with gemini-1.5-flash fallback`);
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
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
      if (!fallbackResponse.ok) {
        const fbErr = await fallbackResponse.text();
        console.error(`Gemini fallback also failed (${fallbackResponse.status}):`, fbErr);
        if (fallbackResponse.status === 429) {
          throw new GeminiQuotaError('All Gemini models have exceeded their quota');
        }
        throw new Error(`Gemini request failed (${response.status}), fallback also failed (${fallbackResponse.status})`);
      }
      const fallbackData = await fallbackResponse.json();
      const fallbackParsed = parseGeminiPayload<AiResponseJson>(fallbackData);
      const fu = fallbackData?.usageMetadata ?? {};
      return {
        json: { ...fallbackParsed, response_text: cleanAssistantText(fallbackParsed.response_text) },
        promptTokens: fu.promptTokenCount ?? 0,
        outputTokens: fu.candidatesTokenCount ?? 0,
        totalTokens: fu.totalTokenCount ?? 0,
      };
    }

    if (response.status === 429) {
      throw new GeminiQuotaError(`Gemini quota exceeded for ${GEMINI_MODEL}`);
    }
    throw new Error(`Gemini request failed (${response.status})`);
  }

  const data = await response.json();
  const parsed = parseGeminiPayload<AiResponseJson>(data);
  const u = data?.usageMetadata ?? {};
  return {
    json: { ...parsed, response_text: cleanAssistantText(parsed.response_text) },
    promptTokens: u.promptTokenCount ?? 0,
    outputTokens: u.candidatesTokenCount ?? 0,
    totalTokens: u.totalTokenCount ?? 0,
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

  // T1: 20s hard timeout — extraction is lightweight; if it hangs this long something is wrong
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

  // I2: On 5xx or 429 (quota exceeded), retry once with gemini-1.5-flash fallback
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini extraction failed (${response.status}):`, errorText);

    const shouldFallback = (response.status >= 500 || response.status === 429) && GEMINI_MODEL !== 'gemini-1.5-flash';
    if (shouldFallback) {
      console.warn(`Primary extraction model returned ${response.status} — retrying with gemini-1.5-flash fallback`);
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
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
      if (!fallbackResponse.ok) {
        const fbErr = await fallbackResponse.text();
        console.error(`Gemini extraction fallback also failed (${fallbackResponse.status}):`, fbErr);
        if (fallbackResponse.status === 429) {
          throw new GeminiQuotaError('All Gemini models have exceeded their quota (extraction)');
        }
        throw new Error(`Gemini extraction failed (${response.status}), fallback also failed (${fallbackResponse.status})`);
      }
      const fallbackData = await fallbackResponse.json();
      return parseGeminiPayload<ExtractionResult>(fallbackData);
    }

    if (response.status === 429) {
      throw new GeminiQuotaError(`Gemini quota exceeded for ${GEMINI_MODEL} (extraction)`);
    }
    throw new Error(`Gemini extraction failed (${response.status})`);
  }

  const data = await response.json();
  return parseGeminiPayload<ExtractionResult>(data);
}

// P3: Temperature varies by intent — diagnosis needs precision, general can be warmer
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
): Promise<ValidatedResponseResult> {
  const systemPrompt = buildSystemPrompt(fieldContext, growerContext, lang, intent, conversationDepth);
  const temperature = intentTemperature(intent);
  const initial = await callGemini(geminiApiKey, messages, systemPrompt, temperature);
  let json = initial.json;
  let promptTokens = initial.promptTokens;
  let outputTokens = initial.outputTokens;
  let totalTokens = initial.totalTokens;

  // P4: Server-side banned opener detection — override the AI's self-reported flag.
  // The AI occasionally lies about this; we verify directly from response_text.
  if (BANNED_OPENER_RE.test(json.response_text)) {
    json = { ...json, has_banned_opener: true };
  }

  // F1: Enforce field_scope server-side — we know the correct value from hasActiveField,
  // so override instead of triggering a costly repair retry for every active-field session.
  if (hasActiveField) {
    json = { ...json, field_scope: 'specific' };
  }

  const validation = validateResponse(json, hasActiveField);

  if (!validation.valid) {
    console.warn('Response validation failed, retrying with repair prompt:', validation.errors);
    // P2: Inject repair instruction into systemPrompt (not user content — proper separation)
    const repairSystemPrompt =
      systemPrompt +
      `\n\n⚠️ REPAIR REQUIRED — your previous response failed these validation checks:\n` +
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

  // S1: Enforce confidence threshold — strip specific disease data below 40%
  const thresholdJson = enforceConfidenceThreshold(json);

  // S2: Strip any hallucinated missing_pillars values — UI breaks silently on unknown strings
  const safeJson = sanitizeMissingPillars(thresholdJson);

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
 * Errors are swallowed — a DB write failure must never block or slow a chat response.
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

// ── Guest mode rate limiting (DB-backed — survives isolate restarts) ──
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
  const guestHasImages = validAttachments.length > 0;
  const guestIntent = classifyIntent(sanitized, guestHasImages);
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
    // Return a clean 502 so the client surfaces a message rather than retrying and timing out
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
      .select('id, name, location, location_lat, location_lon, language, primary_crop, tier, message_count_month, message_reset_date')
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

      // I3: Skip Gemini extraction for single-field users — no disambiguation needed.
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

      // Zero fields — nothing to extract into
      if (Array.isArray(userFields) && userFields.length === 0) {
        return jsonResponse({ action: 'none', fieldId: null });
      }

      // 2+ fields — run full Gemini extraction
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
        memoryLines.push(`PENDING FOLLOW-UP: Farmer has an unresolved issue — "${issue}"${product} — follow-up was due. Ask how it's going.`);
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
1. PRIORITY: If memory context contains a PENDING FOLLOW-UP or RECENT CONVERSATION, reference it directly and warmly — ask how the situation is progressing. This makes the farmer feel remembered and cared for. A real agronomist always follows up.
2. If no memory context: be specific to their crop and this month — mention a real seasonal concern or task relevant to ${month}.
3. NEVER invent problems that don't apply to their crop.
4. Keep it to 1-2 sentences, conversational, no bullet points.
5. Respond in the language preference specified above.
6. ALWAYS start with the farmer's first name — ${name || 'friend'}. Example openings: "${name || 'friend'}, ..." or "Γεια σου ${name || ''}!" — make it feel personal.
7. End with an implicit or explicit invitation to share an update or ask a question.

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
        // Don't 403 — just drop the link silently. Non-advisors won't have access.
        effectiveGrowerId = null;
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

    // Seasonal context injection — lets Gemini give month-relevant advice
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
          effectiveGrowerId,
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

      const hasImages = requestMessages.some(m => Array.isArray(m.attachments) && m.attachments.length > 0);
      const queryIntent = classifyIntent(latestUserMessage.content, hasImages);
      const convDepth = requestMessages.filter(m => m.role !== 'assistant').length;

      const genResult = await generateValidatedResponse(
        geminiApiKey,
        requestMessages,
        serverContext.fieldContext,
        serverContext.hasActiveField,
        growerContext,
        userLang,
        queryIntent,
        convDepth,
      );
      aiResponse = genResult.json;
      assistantText = aiResponse.response_text;
      assistantMetadata = buildAssistantMetadata(aiResponse);

      // M1: Fire-and-forget AI cost log — never await, never block the response
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
        // S3: Guard against client disconnect mid-stream.
        // If the consumer cancels (navigates away, timeout, network drop), the controller
        // enters a closed/errored state. Any subsequent enqueue() or close() call throws
        // "The stream controller cannot close or enqueue". Wrapping here prevents that
        // secondary throw from polluting the error logs with a misleading TypeError.
        const sendEvent = (event: string, payload: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch {
            // Client already disconnected — safe to ignore.
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
          closeController();
        } catch (error) {
          console.error('chat function stream error', error);
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
    // H2: Sanitized error message — never leak internal details
    return jsonResponse(
      {
        error: safeErrorMessage(error),
      },
      500,
    );
  }
});
