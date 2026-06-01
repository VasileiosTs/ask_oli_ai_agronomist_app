# Oli: The AI Agronomist That Knows Your Field

> **Diagnosis in seconds. A treatment plan you can act on. And Oli follows up to confirm it worked.**

**App:** https://ask-oli.com
**Stage:** Live and growing
**Stack:** React 19 + TypeScript · Supabase (Postgres + Edge Functions + Auth) · Google Gemini 2.5 · Vercel

---

## The Problem

There are **500 million smallholder growers** worldwide. They grow 70% of the world's food. They have no access to affordable agronomic expertise.

A certified agronomist costs EUR 50-150 per visit in Southern Europe. In sub-Saharan Africa, India, and Latin America there may be one agronomist per 1,000 growers. A crop disease left undiagnosed for 48 hours can destroy an entire season's income.

Today's "solution": show a sick leaf to a neighbor and hope they've seen it before. Post a photo in a farming group and wait for conflicting opinions. Search the symptoms and land on a generic gardening blog.

Enterprise agtech (Trimble, John Deere Ops Center, Climate Corp) costs $10,000+/year and requires machinery integration. It is built for the 1% of large commercial farms. The other 500 million growers are invisible to it.

**No one has built ChatGPT for growing. Until now.**

---

## Mission

Make expert agronomic guidance as accessible as a text message: for every grower, on every crop, in any language, on any device.

---

## Vision

Oli becomes the agronomist every grower can afford, anywhere. Not a search box you ask once and forget, but a working relationship: it learns your field, remembers every problem and treatment, and gets sharper on your land every season.

---

## What Oli Does

Oli is a **chat-first AI agronomist**: instant, expert-level crop guidance through a simple conversation, in your language, on any crop, on any device.

**Core loop:**
Photo or description of a problem, then a diagnosis in seconds, then a treatment protocol with exact dosages, then a follow-up to confirm whether it worked.

### What a grower can do today

| Task | How |
|------|-----|
| Diagnose crop disease from a photo | Attach photo, describe symptoms, Oli identifies the problem and cause |
| Get treatment plans | Organic and chemical options, exact product names, dosages, application method |
| Log what they applied | One-tap intervention logging directly in the chat thread |
| Track field history | Fields, crops, seasons, past problems, remembered across every conversation |
| Get follow-up care | Oli checks back: "Did you apply? How is it looking?" |
| Share a diagnosis | Public shareable link with an OG card for co-ops, agronomists, forums |
| Talk in any language | Greek, English, Italian, Spanish, French, Arabic, auto-detected from message |
| Send voice or audio | Audio files processed as messages |
| Upload any file type | Photos, PDFs, audio, same interface, no separate app |
| Generate field reports | Agronomist-ready PDF reports of field history and interventions |
| Manage multiple clients | Agronomist tier: manage multiple grower profiles under one account |
| Set chat reminders | "Remind me in 10 days to spray copper" creates a timed reminder with push notification |
| Get smart field alerts (Pro+) | Daily AI weather analysis per field: if rain is coming and your lemons need protection, Oli alerts you before it's too late |

---

## What Makes Oli Different

**It knows your field.** Every field, crop, past problem, and treatment outcome is stored and injected into every future conversation as context. Generic AI forgets you the moment you close it. Oli remembers, so the advice gets more specific to your land the longer you use it.

**It follows through.** After a diagnosis, Oli checks back to record whether the treatment worked (better / same / worse / not applied). It also watches the weather and warns you before problems happen, proactively, not reactively. Every other tool answers once and disappears.

**It's a real agent, not a chatbot.** Image pre-extraction, modular intent routing, structured JSON output with confidence scoring, field memory snapshots, automated follow-up scheduling. The pipeline is what makes the advice reliable.

**It works on a EUR 40 phone.** No app install, no subscription required to try. PWA, instant-loading shell, SSE streaming so responses appear as they are generated.

**Built for how growers actually communicate.** Every diagnosis has a public shareable link with an OG card. Growers share results with neighbors in the field; agronomists share treatment plans with clients.

---

## Follow-Through: the VIO Loop

The product behavior that sets Oli apart. After a diagnosis, Oli does not vanish:

```
Diagnosis made
    -> grower applies treatment
"Did you apply?"      (a few days later, push + email)
    -> confirmed
"Any improvement?"    (~a week later, push + email)
    -> outcome recorded against the field's history
```

Each recorded outcome makes Oli's future advice for that field, crop, and region sharper. The follow-up is what turns one-off answers into a record you can act on across seasons.

---

## The Agent Architecture

Oli is not a simple chatbot. Every message flows through a multi-stage AI agent pipeline.

### Authenticated request pipeline

```
1.  JWT verification -> Supabase user identity
2.  Monthly message count check vs FREE_LIMIT (atomic RPC, no race conditions)
3.  Attachment resolution: storage paths -> signed URLs -> base64 inline
4.  Field context assembly: active field name, crop, soil type, GPS, last problem,
    past interventions, recent memory log, injected as structured context
5.  Image pre-extraction (if photo attached):
      -> dedicated Gemini call extracts structured observations first
        (affected area %, symptom description, pest signs, visible damage)
      -> these observations feed the main diagnosis call as structured input
        rather than forcing the main model to "see" and "reason" simultaneously
6.  Intent classification (hybrid rule + LLM):
      diagnosis / calculation / planning / followup / indoor / general
      -> routes to the correct system prompt module
7.  System prompt assembly (modular, token-optimised):
      language instruction + dosage units + growth stage + weather rules +
      seasonal advisory + intent module (TYPE A-F) + universal rules + field context
8.  Gemini 2.5 Flash call with JSON responseSchema (structured output enforced at API level)
      -> response_text (user-visible prose, paragraph-structured)
      -> diagnosis_data (problem, cause, severity, confidence_score, missing_pillars,
         organic_treatments[], chemical_treatments[], product_applied, dosage,
         application_method, action_type)
      -> intent, field_scope, crop_mentioned, action_detected
9.  Response validation:
      -> banned opener check (strips AI-sounding greetings)
      -> JSON repair on malformed structured output
      -> word limit enforcement per intent type
10. SSE streaming: meta event (structured data) -> token chunks -> done event
11. DB writes (async, non-blocking):
      -> save assistant message with full metadata
      -> update monthly message count
      -> if diagnosis with intervention detected: schedule follow-up
      -> set vio_step = 1 (follow-up loop opened)
      -> if schedule_reminder detected: create entry in scheduled_treatments table
12. Post-save tasks (fire-and-forget):
      -> field memory snapshot update (rolling log of problems + outcomes per field)
      -> conversation title generation
```

### Intent modules (TYPE A-F)

| Type | Intent | Behaviour |
|------|--------|-----------|
| **A** | Diagnosis | Five-Pillar confidence scoring (0-100). Tiered diagnosis: <40 = no disease named, 40-65 = suspected, 65-85 = primary + uncertainty, >85 = full + treatment |
| **B** | Calculation | Step-by-step formula: ETc, NPK, spray volume, area conversion, gross margin |
| **C** | Planning | Full seasonal plan, numbered steps, actions + timings + quantities |
| **D** | General | Direct answer, active ingredient first, paragraph-structured prose |
| **E** | Follow-up | Emotional acknowledgment first, updated clinical recommendation |
| **F** | Indoor/Container | Six-pillar indoor framework: plant, container, light, water, soil, position |

### Five-Pillar Diagnostic (TYPE A)

Confidence is scored 0-100 across five pillars: THE VICTIM (crop/variety) · THE SYMPTOMS (color, texture, pattern) · THE TIMELINE (when, growth stage) · THE ENVIRONMENT (soil, weather, irrigation) · THE EVIDENCE (photo quality).

Confidence thresholds determine what Oli can say:
- `< 40` — hard block: describe symptoms only, do not name disease, ask for missing pillars
- `40-65` — "possible/suspected", 2-3 candidates, one safe interim action
- `65-85` — primary diagnosis with uncertainty language, one follow-up question
- `> 85` — full diagnosis, complete treatment protocol, prevention, follow-up commitment
- Quarantine diseases (HLB, Xylella, Fire Blight, Plum Pox, ToBRFV, Fusarium TR4) — require >85 to name; below: "consult your local plant protection service"

---

## Product Status

**Built and working:**

- Full chat: diagnosis, treatment plans, field memory, SSE streaming
- Multi-language: Greek, English, Italian, Spanish, French, Arabic
- Photo + audio + PDF upload and AI analysis
- Image pre-extraction agent: dedicated Gemini call before main diagnosis
- Modular intent routing: TYPE A-F system prompt modules loaded per query
- Five-Pillar confidence scoring: structured JSON confidence_score + missing_pillars
- Follow-up loop: push + email reminders, vio_step 1-3, outcome recording
- Chat-triggered reminders: "remind me in 10 days" creates a timed reminder with push
- Proactive weather alerts (Pro+): daily field scan, crop + GPS + 7-day forecast -> alert if action needed within 48h
- Field management: named fields, crop type, soil, GPS, historical context
- Field memory snapshots: rolling log of problems and outcomes per field
- Intervention logging: inline in chat or modal, public shareable links + OG cards
- Field reports: PDF generation for agronomist-grade field history
- Auth: magic link + Google OAuth
- Freemium paywall: 20 messages/month free, Pro tier gated
- GDPR-compliant (EU Frankfurt hosting, no PII in analytics)
- Daily KPI snapshot pipeline (automated Supabase cron)
- Admin dashboard: KPI metrics, promo codes, ops event feed
- Push notifications (VAPID) + email reminders (Resend)
- Multi-grower accounts: agronomist manages multiple grower profiles
- Stripe payment integration: checkout, webhooks, tier gating
- Promo codes: named codes + bulk generation, tier-granting with expiry
- Automatic Gemini fallback: primary -> gemini-2.0-flash-lite on quota or 5xx
- Weather integration: Open-Meteo API, gated by intent

**Not live yet:**
- App Store / Play Store listing (PWA in the interim)
- Public B2B API

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser / Mobile PWA (Vercel CDN, global edge)          │
│  React 19 + TypeScript + Vite 6 + Tailwind CSS v4        │
│                                                          │
│  Chat.tsx -> chatFunction.ts -> SSE stream               │
│                                                          │
│  Key client modules:                                     │
│  ├── chatFunction.ts      SSE streaming client           │
│  ├── extractAndApply.ts   silent field extraction        │
│  ├── imageCache.ts        IndexedDB + canvas compression │
│  └── i18n.ts              typed 6-language string dict   │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS / SSE
┌────────────────────▼─────────────────────────────────────┐
│  Supabase (EU Frankfurt, GDPR compliant)                 │
│  ├── PostgreSQL   users, fields, conversations,          │
│  │                chat_messages, interventions,          │
│  │                growers, kpi_snapshots, promo_codes,   │
│  │                guest_rate_limits, operational_events  │
│  ├── Auth         magic link, Google OAuth                │
│  ├── Storage      chat_uploads (photos, audio, PDFs)     │
│  ├── RLS          row-level security on all tables       │
│  └── Edge Functions (Deno runtime)                       │
│      ├── chat/index.ts   <- core AI agent (~3,200 lines) │
│      │   auth -> rate limit -> image pre-extraction ->   │
│      │   intent classify -> system prompt assembly ->    │
│      │   Gemini -> validate -> SSE stream -> DB write -> │
│      │   field memory update -> conversation title       │
│      ├── og-image        OG card generation              │
│      ├── send-email      drip + VIO emails (Resend)      │
│      ├── send-push       web push (VAPID)                │
│      ├── proactive-alerts  daily AI field scan (Pro+)    │
│      ├── kpi-snapshot    daily analytics pipeline        │
│      ├── greeting        personalised chat greeting      │
│      ├── delete-account  GDPR account deletion           │
│      └── api-v1          future public API surface       │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼─────────────────────────────────────┐
│  Google Gemini                                           │
│  ├── gemini-2.5-flash (primary)                          │
│  │   structured JSON output via responseSchema           │
│  │   native multimodal photo analysis                    │
│  │   modular system prompt, intent-routed                │
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
                    follow_up_at, vio_step (0-3), outcome (better/same/worse/not_applied),
                    outcome_note, share_id (UUID for public links), location_lat/lon
growers           — advisor_id -> user_id mapping (agronomist manages grower)
guest_rate_limits — ip, request_count, window_start (DB-backed, cold-start safe)
kpi_snapshots     — daily metrics: DAU/WAU/MAU, retention D1/D7/D30, VIO funnel, MRR
promo_codes       — code, grants_tier, duration_days, max_redemptions, redemptions_count
promo_redemptions — user_id, code, granted_tier, granted_until, redeemed_at
scheduled_treatments — task, due_at, push_sent_at, status, field_id, conversation_id
field_alerts        — message, severity, field_id, read_at (proactive AI-generated alerts)
operational_events— source, event_type, severity, message, metadata (AI monitoring)
admin_users       — auth_id whitelist for admin dashboard access
```

---

## Repository Structure

```
src/
├── pages/
│   ├── Chat.tsx               core product, full conversation experience
│   ├── Landing.tsx            public marketing page
│   ├── Auth.tsx               magic link + Google OAuth
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
├── chat/index.ts              core AI agent function (~3,200 lines)
│   ├── lib/fieldContext.ts    server-side field context assembly
│   ├── lib/imageExtraction.ts image pre-extraction agent
│   └── lib/systemPrompt.ts    modular prompt assembly (TYPE A-F)
├── og-image/index.ts
├── send-email/index.ts
├── send-push/index.ts
├── proactive-alerts/index.ts
├── kpi-snapshot/index.ts
├── greeting/index.ts
├── delete-account/index.ts
└── api-v1/index.ts
```

---

## Local Development

```bash
git clone https://github.com/VasileiosTs/ask_oli_ai_agronomist_app.git
cd ask_oli_ai_agronomist_app
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
VAPID_SUBJECT=mailto:hello@ask-oli.com
CRON_SECRET
FROM_EMAIL=Oli <noreply@ask-oli.com>
APP_URL=https://ask-oli.com
ALLOWED_ORIGIN=https://ask-oli.com
SUPPORT_EMAIL=hello@ask-oli.com
```

---

## Deployment

**Frontend:** Vercel, auto-deploy on push to `main`.
**Edge Functions:** GitHub Actions deploys on any change to `supabase/functions/**`.
**Database:** Supabase managed Postgres, EU Frankfurt region.

---

## Pricing

| Tier | Price | Who |
|------|-------|-----|
| Free | EUR 0 · 20 messages/month | Growers trying the product |
| Pro | EUR 4.99/month · EUR 49/year | Individual growers, unlimited advice |
| Master | EUR 49/month · EUR 490/year | Agronomists managing multiple grower clients |
| Enterprise | Custom | Co-ops, input distributors, extension services |

---

## Founder

**Vasileios Tsipas** — Solo founder. Xylokastro, Corinthia, Greece.

Not a software person who discovered farming. A licensed agronomist who ran EU-level agricultural trade negotiations, built a EUR 1.5M export operation, founded a multi-award-winning agri-startup, managed greenhouse production for nine years, and then built Oli because the tool he needed in the field did not exist.

**BSc Agricultural Sciences** — School of Agriculture, Food, and Nutrition, Thessaloniki
**Certified:** Green Economy & Environmental Friendly Entrepreneurship
**Languages:** Greek (native) · English (advanced)

### Career

**Business Development & Operations Manager** — Bravo Stimaga Grapes S.A., Greece · Dec 2021 to Present
- Secured distributor partnerships in Netherlands and Belgium generating **EUR 1.5M+ ARR**
- Negotiated **5 long-term multi-country contracts**, each EUR 250k-500k/year
- Managed key accounts across Greece, UK, Netherlands, Poland, Belgium, Germany, Sweden
- Directed packing-season operations for **80-110 staff**; **35% productivity increase**, **45% harvest efficiency improvement**
- Digitalized all certification pipelines (GlobalG.A.P., BRC, IFS, Sedex) to 100% audit compliance

**Plant Nurseries Production Consultant** — Freelance Advisory, Corinthia · Jan 2019 to Present
- Conducts phytosanitary inspections for plant health and regulatory compliance
- Develops seasonal plant care programmes; trains nursery staff on propagation and disease prevention

**Founder** — PlantBox, Corinthia · Jan 2018 to Present
- Founded a multi-award-winning agri-startup producing pre-packaged trees with extended shelf life
- Exported to **27 countries** including USA, China, and across the EU
- Served **50+ large corporate and government clients** including Samsung, Deloitte, H&M, STIHL, OECD

**Agribusiness Consultant** — EU DG Agri & Ministry of Agriculture, Brussels and China · Nov 2017 to Dec 2018
- Contributed to the **EU-China Agricultural Trade Agreement of 2019**
- Conducted nationwide farm visits across China advising on production and export standards

**Production Manager** — Plant Nurseries Tsipas Christos, Greece · Sep 2007 to Sep 2016
- Managed production, operations, and distribution across a **7-hectare greenhouse facility**
- Led a team of **25 workers**; **25% annual production growth** at a **55% average profit margin**

### Awards

| Year | Award | Body |
|------|-------|------|
| 2020 | 2nd Best Young Agriculture Professional in Greece | Greek Young Farmers Association |
| 2017-18 | Most Promising Young Agriculture Professional in the EU | European Commission, DG Agriculture |
| 2017-19 | Startup Innovation Award | National Bank of Greece |
| 2017-19 | Startup Innovation Award | American-Hellenic Chamber of Commerce |
| 2017-19 | Startup Innovation Award | Ministry of Digital Transformation, Greece |
| 2017-19 | Startup Innovation Award | Athens Chamber of Commerce and Industry |

---

**Contact:** hello@ask-oli.com · [LinkedIn](https://www.linkedin.com/in/vasileios-tsipas/)
