# Oli — AI Agronomist for the World's Smallholder Farmers

> **"Every farmer who uses Oli builds the dataset that makes every future farmer's advice better."**

**App:** https://codex-ask-oli-app.vercel.app  
**Stage:** Pre-launch · Beachhead: Greece (all crops) · Vision: Global  
**Stack:** React 19 + TypeScript · Supabase (Postgres + Edge Functions + Auth) · Google Gemini 2.5 · Vercel

---

## The Problem

There are **500 million smallholder farmers** worldwide. They grow 70% of the world's food. They have no access to affordable agronomic expertise.

A certified agronomist costs €50–150/visit in Southern Europe. In sub-Saharan Africa, India, and Latin America there may be one agronomist per 1,000 farmers. A crop disease left undiagnosed for 48 hours can destroy an entire season's income.

Today's "solution": show a sick leaf to a neighbor and hope they've seen it before. Post a photo on a Facebook farming group and wait for conflicting opinions. Google the symptoms and land on a generic gardening blog.

Enterprise agtech (Trimble, John Deere Ops Center, Climate Corp) costs $10,000+/year and requires farm machinery integration. It is built for the 1% of large commercial farms. The other 500 million farmers are invisible to Silicon Valley.

**No one has built ChatGPT for farming. Until now.**

---

## Mission

Make expert agronomic guidance as accessible as a text message — for every farmer, on every crop, in every language, on any device.

---

## Vision

Oli becomes the agricultural intelligence layer for the world's smallholder farms. The consumer app is the acquisition engine. The outcome data it generates is the durable, defensible asset: a corpus of verified treatment outcomes across every crop, every disease, every climate — that no one else will ever have.

---

## What Oli Does

Oli is a **chat-first AI agronomist** — instant, expert-level crop guidance through a simple conversation, in the farmer's language, on any crop, on any device.

**Core loop:**
Photo or description of a problem → diagnosis in seconds → treatment protocol with exact dosages → follow-up 7 days later to record whether it worked → data moat grows.

### What a farmer can do today

| Task | How |
|------|-----|
| Diagnose crop disease from a photo | Attach photo, describe symptoms — Oli identifies the problem and cause |
| Get treatment plans | Organic and chemical options, exact product names, dosages, application method |
| Log what they applied | One-tap intervention logging directly in the chat thread |
| Track field history | Fields, crops, seasons, past problems — remembered across every conversation |
| Get follow-up care | Oli checks back in 7 days: "Did you apply? How is it looking?" |
| Share a diagnosis | Public shareable link with OG card for cooperatives, agronomists, forums |
| Talk in any language | Greek, English, Italian, Spanish, French, Arabic — auto-detected from message |
| Send voice or audio | Audio files processed as messages |
| Upload any file type | Photos, PDFs, audio — same interface, no separate app |
| Generate field reports | Agronomist-ready PDF reports of field history and interventions |
| Manage multiple clients | Agronomist tier: manage multiple farmer profiles under one account |

---

## The Agent Architecture

Oli is not a simple chatbot. Every message flows through a multi-stage AI agent pipeline.

### Authenticated request pipeline

```
1.  JWT verification → Supabase user identity
2.  Monthly message count check vs FREE_LIMIT (atomic RPC, no race conditions)
3.  Attachment resolution: storage paths → signed URLs → base64 inline
4.  Field context assembly: active field name, crop, soil type, GPS, last problem,
    past interventions, recent memory log — injected as structured context
5.  Image pre-extraction (if photo attached):
      → dedicated Gemini call extracts structured observations first
        (affected area %, symptom description, pest signs, visible damage)
      → these observations feed the main diagnosis call as structured input
        rather than forcing the main model to "see" and "reason" simultaneously
6.  Intent classification (hybrid rule + LLM):
      diagnosis / calculation / planning / followup / indoor / general
      → routes to the correct system prompt module
7.  System prompt assembly (modular, token-optimised):
      language instruction + dosage units + growth stage + weather rules +
      seasonal advisory + intent module (TYPE A–F) + universal rules + field context
8.  Gemini 2.5 Flash call with JSON responseSchema (structured output enforced at API level)
      → response_text (user-visible prose, paragraph-structured)
      → diagnosis_data (problem, cause, severity, confidence_score, missing_pillars,
         organic_treatments[], chemical_treatments[], product_applied, dosage,
         application_method, action_type)
      → intent, field_scope, crop_mentioned, action_detected
9.  Response validation:
      → banned opener check (strips AI-sounding greetings)
      → JSON repair on malformed structured output
      → word limit enforcement per intent type
10. SSE streaming: meta event (structured data) → token chunks → done event
11. DB writes (async, non-blocking):
      → save assistant message with full metadata
      → update monthly message count
      → if diagnosis with intervention detected: schedule follow_up_at = now + 7 days
      → set vio_step = 1 (VIO loop opened)
12. Post-save tasks (fire-and-forget):
      → field memory snapshot update (rolling log of problems + outcomes per field)
      → conversation title generation
```

### Guest pipeline (no auth)

```
1. IP-based rate limit: 1 question/IP/24h (DB-backed, survives edge function cold starts)
2. Message and attachment validation
3. Simplified Gemini call (no field context, no DB writes)
4. Full JSON response (no SSE streaming — guests get complete response)
```

### Intent modules (TYPE A–F)

| Type | Intent | Behaviour |
|------|--------|-----------|
| **A** | Diagnosis | Five-Pillar confidence scoring (0–100). Tiered diagnosis: <40 = no disease named, 40–65 = suspected, 65–85 = primary + uncertainty, >85 = full + treatment |
| **B** | Calculation | Step-by-step formula: ETc, NPK, spray volume, area conversion, gross margin |
| **C** | Planning | Full seasonal plan, numbered steps, actions + timings + quantities |
| **D** | General | Direct answer, active ingredient first, paragraph-structured prose |
| **E** | Follow-up | Emotional acknowledgment first, updated clinical recommendation |
| **F** | Indoor/Container | Six-pillar indoor framework: plant, container, light, water, soil, position |

### Five-Pillar Diagnostic (TYPE A)

Confidence is scored 0–100 across five pillars: THE VICTIM (crop/variety) · THE SYMPTOMS (color, texture, pattern) · THE TIMELINE (when, growth stage) · THE ENVIRONMENT (soil, weather, irrigation) · THE EVIDENCE (photo quality).

Confidence thresholds determine what Oli can say:
- `< 40` — hard block: describe symptoms only, do not name disease, ask for missing pillars
- `40–65` — "possible/suspected", 2-3 candidates, one safe interim action
- `65–85` — primary diagnosis with uncertainty language, one follow-up question
- `> 85` — full diagnosis, complete treatment protocol, prevention, follow-up commitment
- Quarantine diseases (HLB, Xylella, Fire Blight, Plum Pox, ToBRFV, Fusarium TR4) — require >85 to name; below: "consult your local plant protection service"

---

## The Data Moat — VIO Loop (Verified Intervention Outcomes)

This is the core thesis and the long-term defensibility of the business.

Every time Oli recommends a treatment and a farmer follows up with the result (better / same / worse / not_applied), we record a **Verified Intervention Outcome**: crop × disease × product × dosage × region × climate × outcome.

```
Diagnosis made
    ↓ farmer applies treatment
vio_step 1: "Did you apply?" (7 days later, push + email)
    ↓ confirmed
vio_step 2: "Any improvement?" (7 days later, push + email)
    ↓ outcome recorded
vio_step 3: loop closed — outcome stored with full context
```

No one in agriculture has this data at scale. Extension services have fragments. Agrochemical companies pay millions for field trials to get approximations. We will have it across every crop, every country, indexed by GPS region and season — contributed for free by the farmers themselves.

**What VIO unlocks:**
- *"This product works for 87% of olive growers in Peloponnese with this disease"* — no one can say this today with real data
- Training a proprietary agricultural model that outperforms generic LLMs on crop problems
- Selling efficacy analytics back to input manufacturers (they spend €50M+ per year on field trials globally)
- Powering agronomist recommendations with outcome evidence instead of manufacturer marketing claims

---

## Business Model

| Tier | Price | Who |
|------|-------|-----|
| **Free** | €0 · 20 messages/month | Farmers trying the product |
| **Pro** | €4.99/month · €49/year | Individual farmers, unlimited advice |
| **Agronomist** | €49/month · €490/year | Certified agronomists managing multiple farmer clients |
| **Enterprise** | Custom | Cooperatives, agri-input distributors, extension services |

The Agronomist tier is a deliberate wedge into the professional channel — the same agronomists who recommend products to hundreds of farmers become Oli's distribution network.

**Future — B2B API:** Sell agricultural AI inference to cooperatives, input distributors (ADAMA, Yara, Bayer), and agtech platforms. High-margin, high-scale.

Unit economics: Gemini API cost per conversation ~€0.001–0.005. A Pro subscriber at €4.99/month covers 1,000–5,000 conversations. Gross margin at scale exceeds 85%.

---

## Market Opportunity

| Segment | Size |
|---------|------|
| Global agricultural market | $5T/year |
| Crop protection (pesticides, fungicides, biocontrol) | $84B/year |
| Precision agriculture software | $12B → $25B by 2030 |
| Addressable: 500M smallholder farms worldwide | ~$50B/year in inputs + advisory spend |

**Beachhead:** Greece — 700,000 registered farm holdings, high smartphone penetration, 6 languages supported from day one. Greece is the test lab, not the destination.

**Expansion path:** Mediterranean (Italy, Spain, Morocco, Egypt) → India → sub-Saharan Africa → Latin America.

---

## What Makes This Different

**It remembers.** Every field, crop, past problem, and treatment outcome is stored and injected into every future conversation as context. The AI knows your farm.

**It follows up.** Oli records whether treatments worked. This is the data no one else has.

**It's a real agent, not a chatbot.** Image pre-extraction, modular intent routing, structured JSON output with confidence scoring, field memory snapshots, automated follow-up scheduling — the pipeline is what makes the advice reliable.

**It works on a €40 phone.** No app install, no subscription required to try. PWA, instant-loading shell, SSE streaming so responses appear as they're generated.

**Bottom-up distribution.** Farmers share diagnoses with neighbors in the field. They post results in Facebook farming groups. Agronomists share treatment plans with clients. Every diagnosis has a public shareable link with an OG card — built for how farmers actually communicate.

---

## Product Status

**Built and working (pre-launch):**

- ✅ Full chat — diagnosis, treatment plans, field memory, SSE streaming
- ✅ Multi-language — Greek, English, Italian, Spanish, French, Arabic
- ✅ Photo + audio + PDF upload and AI analysis
- ✅ Image pre-extraction agent — dedicated Gemini call before main diagnosis
- ✅ Modular intent routing — TYPE A–F system prompt modules loaded per query
- ✅ Five-Pillar confidence scoring — structured JSON confidence_score + missing_pillars
- ✅ VIO follow-up loop — push + email reminders, vio_step 1–3, outcome recording
- ✅ Field management — named fields, crop type, soil, GPS, historical context
- ✅ Field memory snapshots — rolling log of problems and outcomes per field
- ✅ Intervention logging — inline in chat or modal, public shareable links + OG cards
- ✅ Field reports — PDF report generation for agronomist-grade field history
- ✅ Guest mode — 1 free question/IP/24h, no account required
- ✅ Auth — magic link + Google OAuth + Facebook OAuth (in-chat modal)
- ✅ Freemium paywall — 20 messages/month free, Pro tier gated
- ✅ GDPR-compliant (EU Frankfurt hosting, no PII in analytics)
- ✅ Daily KPI snapshot pipeline (automated Supabase cron)
- ✅ Admin dashboard — KPI metrics, promo codes, ops event feed
- ✅ Onboarding — name, location with geocoding, primary crop
- ✅ Push notifications (VAPID) + email reminders (Resend)
- ✅ Multi-grower accounts — agronomist manages multiple farmer profiles
- ✅ Promo codes — named codes + bulk generation, tier-granting with expiry
- ✅ Automatic Gemini fallback — primary → gemini-2.0-flash-lite on quota or 5xx
- ✅ Weather integration — Open-Meteo API, gated by intent (skipped for calculations)

**Not live yet:**
- 🔲 Stripe payment integration (paywall UI exists, checkout not wired)
- 🔲 Production domain (askoli.ai)
- 🔲 App Store / Play Store listing (PWA in the interim)
- 🔲 Public B2B API

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser / Mobile PWA (Vercel CDN, global edge)          │
│  React 19 + TypeScript + Vite 6 + Tailwind CSS v4        │
│                                                          │
│  Chat.tsx → chatFunction.ts → SSE stream                 │
│                                                          │
│  Key client modules:                                     │
│  ├── chatFunction.ts      SSE streaming client           │
│  ├── extractAndApply.ts   silent field extraction        │
│  ├── imageCache.ts        IndexedDB + canvas compression │
│  └── i18n.ts              typed 6-language string dict   │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS / SSE
┌────────────────────▼─────────────────────────────────────┐
│  Supabase (EU Frankfurt — GDPR compliant)                │
│  ├── PostgreSQL   users, fields, conversations,          │
│  │                chat_messages, interventions,          │
│  │                growers, kpi_snapshots, promo_codes,   │
│  │                guest_rate_limits, operational_events  │
│  ├── Auth         magic link, Google OAuth, Facebook     │
│  ├── Storage      chat_uploads (photos, audio, PDFs)     │
│  ├── RLS          row-level security on all tables       │
│  └── Edge Functions (Deno runtime)                       │
│      ├── chat/index.ts   ← core AI agent (~3,100 lines)  │
│      │   auth → rate limit → image pre-extraction →      │
│      │   intent classify → system prompt assembly →       │
│      │   Gemini → validate → SSE stream → DB write →     │
│      │   field memory update → conversation title        │
│      ├── og-image        OG card generation              │
│      ├── send-email      drip + VIO emails (Resend)      │
│      ├── send-push       web push (VAPID)                │
│      ├── kpi-snapshot    daily analytics pipeline        │
│      ├── greeting        personalised chat greeting      │
│      ├── delete-account  GDPR account deletion           │
│      └── api-v1          future public API surface       │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼─────────────────────────────────────┐
│  Google Gemini                                           │
│  ├── gemini-2.5-flash (primary)                          │
│  │   — structured JSON output via responseSchema         │
│  │   — native multimodal photo analysis                  │
│  │   — modular system prompt, intent-routed              │
│  ├── gemini-2.0-flash (image pre-extraction agent)       │
│  └── gemini-2.0-flash-lite (automatic fallback)          │
└──────────────────────────────────────────────────────────┘
```

**Security:** The Gemini API key never touches the browser. All AI calls flow through the Supabase Edge Function, which reads the key from a server-side secret. The browser holds only the Supabase anon key, which is designed to be public. Row-level security is enforced at the database level on every table.

---

## Database Schema

```sql
users             — profile, tier, message_count_month, language, area_unit, reset_date
fields            — name, crop_type, size_ha, soil_type, GPS, memory_log (JSONB)
conversations     — user + field link, title, last_message_at
chat_messages     — role, content, metadata (JSON: intent, diagnosis_data,
                    action_detected, crop_mentioned), starred, image_urls[]
interventions     — field, crop, diagnosis, product_applied, dosage, severity,
                    organic_treatments[], chemical_treatments[], confidence_score,
                    follow_up_at, vio_step (0–3), outcome (better/same/worse/not_applied),
                    outcome_note, share_id (UUID for public links), location_lat/lon
growers           — advisor_id → user_id mapping (agronomist manages farmer)
guest_rate_limits — ip, request_count, window_start (DB-backed, cold-start safe)
kpi_snapshots     — daily metrics: DAU/WAU/MAU, retention D1/D7/D30, VIO funnel, MRR
promo_codes       — code, grants_tier, duration_days, max_redemptions, redemptions_count
promo_redemptions — user_id, code, granted_tier, granted_until, redeemed_at
operational_events— source, event_type, severity, message, metadata (AI monitoring)
admin_users       — auth_id whitelist for admin dashboard access
```

---

## Repository Structure

```
src/
├── pages/
│   ├── Chat.tsx               ⭐ core product — full conversation experience
│   ├── Landing.tsx            public marketing page (Greek + English)
│   ├── Auth.tsx               magic link + Google OAuth + Facebook OAuth
│   ├── Onboarding.tsx         3-step first-run (name, location, crop)
│   ├── Profile.tsx            settings, subscription, data export
│   ├── Fields.tsx             field management
│   ├── FieldDetail.tsx        per-field history and interventions
│   ├── History.tsx            intervention history across all fields
│   ├── SharedDiagnosis.tsx    public /d/:id share page
│   ├── AdminMetrics.tsx       admin KPI dashboard, promo codes, ops feed
│   ├── ClientDashboard.tsx    agronomist client list
│   ├── ClientDetail.tsx       per-client management
│   └── CooperativeAdmin.tsx   coop team management
├── components/
│   ├── MessageBubble.tsx      renders treatment cards, confidence, VIO chips
│   ├── ConversationSidebar.tsx
│   ├── LogInterventionModal.tsx
│   ├── ReportGenerator.tsx    PDF field report
│   ├── ShareModal.tsx         WhatsApp, Telegram, Facebook, X, email, copy
│   ├── PaywallModal.tsx
│   └── LoginModal.tsx
├── hooks/useAuth.tsx           session, profile, appUserId
└── lib/
    ├── chatFunction.ts         SSE streaming client
    ├── extractAndApply.ts      silent field extraction from messages
    ├── imageCache.ts           IndexedDB + canvas compression
    ├── analytics.ts            PostHog event tracking
    └── i18n.ts                 typed 6-language string dictionary

supabase/functions/
├── chat/index.ts              ⭐ core AI agent function (~3,100 lines)
│   ├── lib/fieldContext.ts    server-side field context assembly
│   ├── lib/imageExtraction.ts image pre-extraction agent
│   └── lib/systemPrompt.ts   modular prompt assembly (TYPE A–F)
├── og-image/index.ts
├── send-email/index.ts
├── send-push/index.ts
├── kpi-snapshot/index.ts
├── greeting/index.ts
├── delete-account/index.ts
└── api-v1/index.ts
```

---

## Local Development

```bash
git clone https://github.com/VasileiosTs/codex_ask_oli_app.git
cd codex_ask_oli_app
npm install
cp .env.example .env.local   # fill in Supabase + Gemini credentials
npm run dev                  # http://localhost:5173
npx tsc --noEmit             # type check
```

**Frontend env vars:**
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SENTRY_DSN               (optional)
VITE_VAPID_PUBLIC_KEY         (optional, for push notifications)
```

**Supabase Edge Function secrets:**
```
GEMINI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:hello@askoli.ai
CRON_SECRET
FROM_EMAIL=Oli <noreply@askoli.ai>
APP_URL=https://codex-ask-oli-app.vercel.app
ALLOWED_ORIGIN=https://codex-ask-oli-app.vercel.app
SUPPORT_EMAIL=hello@askoli.ai
```

---

## Deployment

**Frontend:** Vercel — auto-deploy on push to `main`.  
**Edge Functions:** GitHub Actions deploys on any change to `supabase/functions/**`.  
**Database:** Supabase managed Postgres, EU Frankfurt region.

---

## Why This Wins

**Founder-market fit.** 18 years agri-business, certified agronomist, direct relationships with ADAMA and Yara, operated across 27 countries. The founder is the product's first user and knows every buyer in the value chain.

**Timing.** Gemini 2.5's multimodal capability makes photo-based crop diagnosis reliable at scale. The agent architecture — image pre-extraction, modular routing, structured JSON output, field memory — is what turns a capable model into a reliable agronomist. This wasn't possible 18 months ago.

**The flywheel.** Every VIO recorded makes the next recommendation more accurate. Every farmer who joins makes the dataset denser. Competitors cannot fast-follow — they need years of outcome data that only comes from real farmers using the product.

**No incumbent owns this space.** Enterprise agtech ignores smallholders. Consumer agtech is mostly photo-ID apps with no memory, no follow-up, no data loop. Oli is the first to close the full cycle: diagnosis → treatment → outcome → learning → better diagnosis.

---

## Phase 2 Roadmap (not yet implemented)

The current Gemini setup is Phase 1. Post product-market fit:

- **Vision router:** Fine-tuned ViT on our own VIO outcome data for plant disease from photo
- **OCR layer:** Qwen-VL for reading product labels / spray schedules from photos
- **Reasoning layer:** Keep Gemini Flash for conversation; route image-only queries to fine-tuned model
- **API product:** Sell fine-tuned crop disease API to agrochemical companies
- **Data moat:** Every VIO outcome (treatment X → outcome Y on crop Z in climate C) trains the next model version

Phase 2 prep already in place:
- `confidence_score` stored on every intervention (filters training data by quality)
- VIO outcomes stored with full context: crop, location_lat/lon, climate, treatment, dosage
- `operational_events` table tracks AI model performance per query

---

## Founder

**Vasileios Tsipas** — Solo founder, Xylokastro, Corinthia, Greece.

18+ years in agri-business, international BD, and supply chain. Not a tourist in this market — an agronomist who built software, not a software person who discovered farming.

- **Bravo Stimaga Grapes S.A.** (2021–present) — €1.5M+ ARR through distributor partnerships across NL/BE/UK/Poland/Germany/Sweden. 35% YoY revenue growth.
- **Freelance Agronomist Consultant** (2019+) — phytosanitary assessments, plant health diagnosis, growth cycle planning.
- **Founded an award-winning plant nursery** — exported to USA and China. EU entrepreneurship recognition, Brussels 2017.
- Clients: Samsung, Deloitte, H&M, STIHL, OECD.
- Direct relationships with senior contacts at **ADAMA** (global crop protection, top 5 worldwide) and **Yara** (world's largest fertilizer company), Greek Ministry of Agriculture.
- Operated across **27 countries**.

**Contact:** founder@askoli.ai
